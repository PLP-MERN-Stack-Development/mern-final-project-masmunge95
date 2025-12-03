/**
 * OCR Orchestration Service
 * Helper functions to break down the massive uploadAndAnalyze function
 * Each function handles one specific responsibility
 */

const { clerkClient } = require('@clerk/clerk-sdk-node');
const AnalysisEvent = require('../../../models/AnalysisEvent');
const Record = require('../../../models/Record');
const Subscription = require('../../../models/Subscription');
const { v4: uuidv4 } = require('uuid');
const { ensureOcrUserFolder } = require('../../../middleware/uploadMiddleware');
const { getDocumentTypeFolder } = require('../validation/ocrValidation');
const path = require('path');

/**
 * Determine billing context and uploader information
 * @param {Object} req - Express request object
 * @returns {Object} Billing context { billingSellerId, uploaderId, uploaderType, uploaderName }
 */
async function determineBillingContext(req) {
  let billingSellerId = null;
  let uploaderId = req.auth?.userId || null;
  let uploaderType = 'seller';
  let uploaderName = null;
  const devFallbackSeller = process.env.DEV_TEST_SELLER_ID || null;
  
  if (req.auth?.userId) {
    const authUser = await clerkClient.users.getUser(req.auth.userId);
    const authRole = authUser?.publicMetadata?.role || null;
    
    if (authRole === 'customer') {
      uploaderType = 'customer';
      uploaderId = req.auth.userId;
      
      // Extract customer's name
      const firstName = authUser.firstName || '';
      const lastName = authUser.lastName || '';
      const fullName = `${firstName} ${lastName}`.trim();
      const email = authUser.emailAddresses?.[0]?.emailAddress || '';
      uploaderName = fullName || authUser.username || email || null;
      
      const requestedSellerId = req.body?.sellerId || null;
      
      console.info('[OCR] Customer upload detected', {
        customerId: uploaderId,
        requestedSellerId,
        documentType: req.body.documentType
      });
      
      if (!requestedSellerId) {
        throw new Error('Missing sellerId: customers must select which seller to send this upload to');
      }
      
      const sellerProfile = await clerkClient.users.getUser(requestedSellerId);
      if (!sellerProfile || sellerProfile?.publicMetadata?.role !== 'seller') {
        throw new Error('Invalid sellerId provided');
      }
      
      billingSellerId = requestedSellerId;
      console.info('[OCR] Customer upload validated - sending to seller', {
        billingSellerId,
        sellerName: sellerProfile.firstName || sellerProfile.username
      });
    } else {
      billingSellerId = req.auth.userId;
    }
  } else {
    billingSellerId = devFallbackSeller || null;
    if (!billingSellerId) {
      throw new Error('Unauthorized: no authenticated user and no DEV_TEST_SELLER_ID configured');
    }
  }
  
  return { billingSellerId, uploaderId, uploaderType, uploaderName };
}

/**
 * Organize file into proper folder structure
 * @param {string} filePath - Current file path
 * @param {string} fileName - File name
 * @param {string} billingSellerId - Seller ID for folder organization
 * @param {string} documentType - Document type
 * @returns {Promise<string>} New file path
 */
async function organizeFile(filePath, fileName, billingSellerId, documentType) {
  const fs = require('fs').promises;
  
  try {
    const folderName = getDocumentTypeFolder(documentType);
    const targetDir = ensureOcrUserFolder(billingSellerId, folderName);
    const targetPath = path.join(targetDir, fileName);
    
    await fs.rename(filePath, targetPath);
    
    console.info('[OCR] File organized', {
      from: filePath,
      to: targetPath,
      folder: folderName
    });
    
    return targetPath;
  } catch (moveErr) {
    console.warn('[OCR] Failed to move file to organized folder, continuing with original path', moveErr);
    return filePath;
  }
}

/**
 * Check for duplicate analysis and return cached data if found
 * @param {string} contentHash - File content hash
 * @param {string} uploadId - Optional upload ID
 * @param {string} billingSellerId - Seller ID
 * @param {Object} req - Express request object
 * @returns {Promise<Object|null>} Cached analysis data or null
 */
async function checkDuplicateAndReturnCached(contentHash, uploadId, billingSellerId, req) {
  const orClauses = [];
  if (uploadId) orClauses.push({ 'metadata.uploadId': uploadId });
  if (contentHash) orClauses.push({ 'metadata.contentHash': contentHash });
  
  let dupQuery = { sellerId: billingSellerId };
  if (orClauses.length) dupQuery = Object.assign(dupQuery, { $or: orClauses });
  
  const existingAnalysis = await AnalysisEvent.findOne(dupQuery).exec();
  
  if (!existingAnalysis) return null;
  
  console.info('[OCR] Duplicate detected - returning cached data', { 
    analysisId: existingAnalysis.analysisId, 
    contentHash,
    uploadId,
    createRecordRequested: req.body?.createRecord === 'true'
  });
  
  // Try to find existing record
  let existingRecord = null;
  try {
    existingRecord = await Record.findOne({ 
      $or: [
        { 'billingMeta.analysisId': existingAnalysis.analysisId },
        { 'metadata.analysisId': existingAnalysis.analysisId }
      ]
    }).exec();
    
    if (existingRecord) {
      console.info('[OCR] Found existing record for duplicate upload', {
        recordId: existingRecord._id,
        recordOwner: existingRecord.user,
        uploaderCustomerId: existingRecord.uploaderCustomerId
      });
    }
  } catch (err) {
    console.warn('[OCR] Failed to query for existing Record during deduplication', err);
  }
  
  // Return cached OCR data
  const cachedData = existingAnalysis.metadata?.cachedOcrData;
  if (cachedData) {
    return {
      analysisId: existingAnalysis.analysisId,
      data: cachedData.extractedData,
      parsed: cachedData.parsedFields,
      driverRaw: cachedData.driverRaw,
      documentType: cachedData.documentType || 'receipt',
      fileType: cachedData.mimeType,
      recordId: existingRecord?._id || null,
      wasCached: true
    };
  }
  
  return null;
}

/**
 * Get user's subscription tier
 * @param {string} userId - User ID
 * @returns {Promise<string>} Subscription tier (trial, basic, pro, enterprise)
 */
async function getUserTier(userId) {
  if (!userId) return 'trial';
  
  try {
    const subscription = await Subscription.findOne({ userId }).exec();
    return subscription?.tier || 'trial';
  } catch (err) {
    console.warn('[OCR] Failed to fetch user subscription tier, defaulting to trial', err);
    return 'trial';
  }
}

/**
 * Create or update a Record from OCR analysis
 * @param {Object} params - Parameters object
 * @returns {Promise<Object|null>} Created/updated record or null
 */
async function persistRecord(params) {
  const {
    shouldCreateRecord,
    localRecordId,
    userId,
    extractedData,
    fileName,
    mimeType,
    sanitizeResults,
    filePath,
    documentType,
    uploaderType,
    billingSellerId
  } = params;
  
  const parsedOcr = {
    extracted: extractedData,
    rawText: extractedData?.rawText || null,
    docType: documentType || null,
    docConfidence: extractedData?.docConfidence || null,
    metadata: { fileName, mimeType, rawDriverResponse: sanitizeResults }
  };
  
  let persistedRecord = null;
  
  if (!shouldCreateRecord && !localRecordId) {
    return null;
  }
  
  // Try to update existing record
  if (localRecordId) {
    try {
      const existing = await Record.findOne({ _id: localRecordId, user: userId });
      if (existing) {
        existing.ocrData = parsedOcr;
        existing.extracted = extractedData;
        existing.rawText = parsedOcr.rawText || existing.rawText;
        existing.docType = parsedOcr.docType;
        existing.docConfidence = parsedOcr.docConfidence;
        existing.metadata = Object.assign(existing.metadata || {}, parsedOcr.metadata || {});
        existing.imagePath = filePath;
        existing.syncStatus = 'complete';
        
        if (!existing.metadata || !existing.metadata.rawDriverResponse) {
          existing.metadata = Object.assign(existing.metadata || {}, { rawDriverResponse: sanitizeResults });
        }
        
        persistedRecord = await existing.save();
        return persistedRecord;
      }
    } catch (err) {
      console.error('[OCR] Failed to update existing record', err);
    }
  }
  
  // Create new record if requested
  if (shouldCreateRecord && !persistedRecord) {
    try {
      const recordOwner = (uploaderType === 'customer' && billingSellerId) 
        ? billingSellerId 
        : userId;
      
      const newRec = await Record.create({
        recordType: documentType || 'business-record',
        type: null,
        amount: null,
        description: extractedData?.businessName || '',
        customer: null,
        recordDate: new Date(),
        user: recordOwner,
        imagePath: filePath,
        ocrData: parsedOcr,
        extracted: extractedData,
        rawText: parsedOcr.rawText,
        docType: parsedOcr.docType,
        docConfidence: parsedOcr.docConfidence,
        metadata: parsedOcr.metadata,
        syncStatus: 'complete'
      });
      
      console.info('[OCR] Created new record', {
        recordId: newRec._id,
        recordOwner,
        uploaderType,
        documentType,
        isCustomerUpload: uploaderType === 'customer'
      });
      
      return newRec;
    } catch (err) {
      console.error('[OCR] Failed to create record for analyzed file', err);
    }
  }
  
  return persistedRecord;
}

/**
 * Create analysis event and update subscription usage
 * @param {Object} params - Parameters object
 * @returns {Promise<Object>} Analysis event document
 */
async function createAnalysisEventAndTrackUsage(params) {
  const {
    contentHash,
    uploadId,
    billingSellerId,
    uploaderId,
    uploaderType,
    results,
    fileName,
    mimeType,
    sanitizeResults,
    requestedService,
    requestedReason
  } = params;
  
  const analysisId = uuidv4();
  
  // Build dedupe query
  const orClauses = [];
  if (uploadId) orClauses.push({ 'metadata.uploadId': uploadId });
  if (contentHash) orClauses.push({ 'metadata.contentHash': contentHash });
  
  let query = { sellerId: billingSellerId };
  if (orClauses.length) query = Object.assign(query, { $or: orClauses });
  
  // Build metadata
  const metadataObj = Object.assign(
    { fileName, mimeType, rawDriverResponse: sanitizeResults },
    uploadId ? { uploadId } : {},
    contentHash ? { contentHash } : {},
    requestedService ? { service: requestedService } : {},
    requestedReason ? { reason: requestedReason } : {}
  );
  
  // Atomically insert only if not found
  const onInsert = {
    analysisId,
    sellerId: billingSellerId,
    uploaderId,
    uploaderType,
    pages: Array.isArray(results) ? results.length : (results?.pages?.length || undefined),
    metadata: metadataObj,
    billedToSeller: false,
    billedToCustomer: false,
  };
  
  const raw = await AnalysisEvent.findOneAndUpdate(
    query,
    { $setOnInsert: onInsert },
    { upsert: true, new: true, rawResult: true }
  ).exec();
  
  let aeDoc = raw?.value || null;
  
  // Fallback if value is missing
  if (!aeDoc) {
    try {
      aeDoc = await AnalysisEvent.findOne(query).exec();
    } catch (fetchErr) {
      console.warn('[OCR] Failed to fetch AnalysisEvent after upsert fallback:', fetchErr);
    }
  }
  
  if (!aeDoc) {
    aeDoc = { analysisId };
  }
  
  const inserted = Boolean(aeDoc && aeDoc.analysisId === analysisId);
  
  // Log result
  const logMeta = { 
    sellerId: billingSellerId, 
    uploadId, 
    contentHash, 
    inserted: Boolean(inserted), 
    analysisId: aeDoc && aeDoc.analysisId 
  };
  
  if (inserted) {
    console.info('[OCR] AnalysisEvent inserted', logMeta);
  } else {
    console.info('[OCR] AnalysisEvent deduped (existing)', logMeta);
  }
  
  // Update subscription usage if new analysis
  if (inserted && billingSellerId) {
    try {
      const inc = {};
      if (uploaderType === 'customer') {
        inc['usage.customerOcrScans'] = 1;
      } else {
        inc['usage.ocrScans'] = 1;
      }
      
      const updatedSub = await Subscription.findOneAndUpdate(
        { userId: billingSellerId },
        { $inc: inc },
        { new: true }
      ).exec();
      
      if (updatedSub) {
        console.info('[OCR] Incremented subscription usage for seller', billingSellerId, 'newValues=', updatedSub.usage);
      }
      
      // Mark as billed
      if (aeDoc?.analysisId) {
        await AnalysisEvent.findOneAndUpdate(
          { analysisId: aeDoc.analysisId },
          { $set: { billedToSeller: true } }
        ).exec();
      }
    } catch (err) {
      console.error('[OCR] Failed to increment subscription usage for seller after analysis:', err);
    }
  }
  
  // Patch raw driver response if missing
  if (aeDoc?.analysisId && (!aeDoc.metadata || !aeDoc.metadata.rawDriverResponse)) {
    try {
      await AnalysisEvent.findOneAndUpdate(
        { analysisId: aeDoc.analysisId },
        { $set: { 'metadata.rawDriverResponse': sanitizeResults } }
      ).exec();
    } catch (patchErr) {
      console.warn('[OCR] Failed to patch AnalysisEvent with rawDriverResponse:', patchErr);
    }
  }
  
  return { aeDoc, inserted };
}

/**
 * Cache OCR data in AnalysisEvent for future deduplication
 * @param {string} analysisId - Analysis event ID
 * @param {Object} cacheData - Data to cache
 */
async function cacheOcrDataInAnalysisEvent(analysisId, cacheData) {
  const { extractedData, parsedFields, driverRaw, documentType, mimeType } = cacheData;
  
  try {
    await AnalysisEvent.updateOne(
      { analysisId },
      {
        $set: {
          'metadata.cachedOcrData': {
            extractedData,
            parsedFields,
            driverRaw,
            documentType: documentType || 'receipt',
            mimeType,
            cachedAt: new Date()
          }
        }
      }
    ).exec();
    
    console.info('[OCR] Cached OCR data in AnalysisEvent for future deduplication', {
      analysisId
    });
  } catch (cacheErr) {
    console.warn('[OCR] Failed to cache OCR data in AnalysisEvent (non-fatal):', cacheErr);
  }
}

module.exports = {
  determineBillingContext,
  organizeFile,
  checkDuplicateAndReturnCached,
  getUserTier,
  persistRecord,
  createAnalysisEventAndTrackUsage,
  cacheOcrDataInAnalysisEvent
};
