/**
 * OCR Controller (Refactored V28)
 * Orchestrates OCR document analysis using extracted service modules
 * Slim controller focused on request handling and response formatting
 */

const { analyzeImage, analyzeDocument } = require('../services/ocrService.js');
const asyncHandler = require('../utils/asyncHandler.js');
const Record = require('../models/Record');
const AnalysisEvent = require('../models/AnalysisEvent');
const Subscription = require('../models/Subscription');
const { clerkClient } = require('@clerk/clerk-sdk-node');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const { ensureOcrUserFolder } = require('../middleware/uploadMiddleware');

// Extracted OCR service modules
const { parseUtilityBill } = require('../services/ocr/parsers/ocrUtilityParser');
const { parseOcrResult } = require('../services/ocr/parsers/ocrReceiptParser');
const { parseGenericDocument, parseUtilityCustomerRecords } = require('../services/ocr/parsers/ocrGenericParser');
const { checkDuplicateAnalysis, createAnalysisEvent, trackOCRUsage } = require('../services/ocr/analytics/ocrAnalytics');
const {
  validateFileUpload,
  determineOcrService,
  getDocumentTypeFolder,
  validateCustomerUpload,
  extractUploaderInfo,
  validateSellerProfile,
  sanitizeOcrResults,
  createResultsCopy
} = require('../services/ocr/validation/ocrValidation');

// OCR orchestration helpers
const {
  determineBillingContext,
  organizeFile,
  checkDuplicateAndReturnCached,
  getUserTier,
  persistRecord,
  createAnalysisEventAndTrackUsage,
  cacheOcrDataInAnalysisEvent
} = require('../services/ocr/orchestration/ocrOrchestration');

// Parser helpers (centralized)
const { findTotalCandidate, extractIdsFromRawDriverResponse, parseRawDriverResponse } = require('../services/ocrParsers');

const uploadAndAnalyze = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error('Please upload a file');
  }

  const fs = require('fs').promises;
  let filePath = req.file.path; // File is initially saved to uploads/ root
  const mimeType = req.file.mimetype;
  const fileName = req.file.filename;

  // Get the document type from the request body
  const { documentType } = req.body; // 'receipt', 'utility', 'inventory', 'customer-consumption'

  try {
    // === DETERMINE BILLING CONTEXT ===
    const { billingSellerId, uploaderId, uploaderType, uploaderName } = await determineBillingContext(req);
    
    // === ORGANIZE FILE BY USER AND DOCUMENT TYPE ===
    filePath = await organizeFile(filePath, fileName, billingSellerId, documentType);
    
    // Read the file from disk
    const fileBuffer = await fs.readFile(filePath);
    
    // === EARLY DUPLICATE DETECTION === 
    const contentHash = require('crypto').createHash('sha256').update(fileBuffer).digest('hex');
    const uploadId = req.body?.uploadId || null;
    
    const cachedResult = await checkDuplicateAndReturnCached(contentHash, uploadId, billingSellerId, req);
    if (cachedResult) {
      return res.status(200).json({
        message: 'File already analyzed (returning cached data)',
        data: cachedResult.data || {},
        driverRaw: cachedResult.driverRaw || null,
        parsed: cachedResult.parsed || null,
        documentType: cachedResult.documentType || documentType || 'receipt',
        fileType: cachedResult.fileType || mimeType,
        filePath: filePath.replace(/\\/g, '/'),
        fileName: fileName,
        recordId: cachedResult.recordId || null,
        analysisId: cachedResult.analysisId,
        cached: true
      });
    }
    
    let results;
    let extractedData;

    // Supported file types for Document Intelligence (structured documents)
    const documentIntelligenceTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
      'text/html',
      'image/tiff',
      'image/bmp'
    ];

    // Decide whether to use Azure Document Intelligence (structured parsing)
    // or Azure Computer Vision (image-focused). Prefer Document Intelligence
    // Tier-based OCR model selection: fetch user's subscription to determine quality level
    const userTier = await getUserTier(billingSellerId);

    // for known structured document types (receipts, invoices, inventory, customer
    // records) regardless of mime type, falling back to Computer Vision for
    // generic photos/handwritten images such as utility meter photos.
    const docTypesPreferDocInt = new Set(['receipt', 'invoice', 'inventory', 'customer', 'customer-consumption']);
    const preferDocIntByType = documentType && docTypesPreferDocInt.has(documentType);

    // Tier-based routing: Enterprise gets premium prebuilt-invoice, others get cost-effective CV Read
    const usePrebuiltInvoice = (documentType === 'receipt' || documentType === 'invoice') && userTier === 'enterprise';

    if (usePrebuiltInvoice || (preferDocIntByType && documentType !== 'receipt' && documentType !== 'invoice') || documentIntelligenceTypes.includes(mimeType)) {
      // Choose the right model based on document type and tier
      let model = 'prebuilt-read'; // Default to basic text extraction

      if (usePrebuiltInvoice) {
        model = 'prebuilt-invoice'; // Enterprise gets premium invoice model
      } else if (documentType === 'inventory' || documentType === 'customer' || documentType === 'customer-consumption') {
        model = 'prebuilt-layout'; // Use layout model for tables and structured data
      }

      results = await analyzeDocument(fileBuffer, model);
    } else if (mimeType && mimeType.startsWith('image/')) {
      results = await analyzeImage(fileBuffer);
    } else {
      res.status(400);
      throw new Error('Unsupported file type. Supported: Images (JPG, PNG), PDF, Word (.docx), Excel (.xlsx), PowerPoint (.pptx)');
    }

    // Capture an unmodified deep copy of the raw driver response for debugging
    // This is the exact payload returned by Document Intelligence / Computer Vision
    // before any parsing or grouping is applied.
    const driverRawUnmodified = (() => {
      try { return JSON.parse(JSON.stringify(results)); } catch (e) { return results; }
    })();

    // Call the appropriate parser based on the document type and OCR model used
    if (documentType === 'utility') {
      extractedData = parseUtilityBill(results);
    } else if (documentType === 'customer-consumption') {
      // Special parser for utility customer consumption records
      extractedData = parseUtilityCustomerRecords(results);
    } else if (documentType === 'inventory' || documentType === 'customer') {
      extractedData = parseGenericDocument(results);
    } else if ((documentType === 'receipt' || documentType === 'invoice') && usePrebuiltInvoice) {
      // Enterprise tier using prebuilt-invoice: structured fields will be parsed by
      // parseRawDriverResponse later in the flow. Return minimal extractedData here.
      extractedData = {
        businessName: '',
        businessAddress: '',
        invoiceNo: '',
        invoiceDate: '',
        items: [],
        fees: [],
        subtotal: 0,
        tax: 0,
        total: 0,
        rawText: results && results[0] && results[0].content || '',
        paymentMethod: '',
        promotions: ''
      };
    } else {
      // Computer Vision line-based parser for receipts/invoices (Trial/Basic/Pro tiers)
      // or any other image types
      extractedData = parseOcrResult(results);
    }

    // Sanitize the raw driver results so we can persist them safely to Mongo
    const sanitizeResults = (() => {
      try {
        return JSON.parse(JSON.stringify(results));
      } catch (e) {
        return { _serializationError: String(e) };
      }
    })();

    // === PERSIST RECORD ===
    const localRecordId = req.body?.localRecordId;
    const shouldCreateRecord = req.body?.createRecord === 'true';
    const userId = req.auth?.userId || null;
    
    const persistedRecord = await persistRecord({
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
    });

    // === CREATE ANALYSIS EVENT AND TRACK USAGE ===
    try {
      const requestedService = req.body?.service || null;
      const requestedReason = req.body?.reason || null;
      let sellerProfile = null;

      // Fetch seller profile for metadata
      try {
        if (billingSellerId) {
          sellerProfile = await clerkClient.users.getUser(billingSellerId);
        }
      } catch (e) { /* ignore */ }

      const { aeDoc, inserted } = await createAnalysisEventAndTrackUsage({
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
      });

      const analysisId = aeDoc?.analysisId || uuidv4();

      // Build normalized parsed fields (total, confidence, invoiceId, transactionId)
      let parsedFields = null;
      try {
        // When we didn't persist a Record, use the sanitized raw driver response
        // so structured Document Intelligence fields are discoverable.
        const fullText = (persistedRecord && persistedRecord.rawText) || extractedData?.rawText || '';
        const rawWrapper = { metadata: { rawDriverResponse: sanitizeResults } };
        const ocrForParsing = (persistedRecord && persistedRecord.ocrData) || (extractedData || {});
        // Ensure rawDriverResponse is available on the ocr object we pass to parsers
        ocrForParsing.metadata = Object.assign({}, ocrForParsing.metadata || {}, { rawDriverResponse: sanitizeResults });

        const parsed = findTotalCandidate(ocrForParsing, fullText, { ocrData: ocrForParsing, fullRecord: persistedRecord || rawWrapper });
        const ids = extractIdsFromRawDriverResponse(ocrForParsing, persistedRecord || rawWrapper);
        // enrich with the new detailed parser that builds items/fees/promotions and computed totals
        const extended = parseRawDriverResponse(ocrForParsing.metadata && ocrForParsing.metadata.rawDriverResponse ? ocrForParsing : rawWrapper);
        // If the detailed parser didn't produce a business name/address, fall back to
        // extractedData (layout-based) or the top lines of rawText. This is conservative
        // and only runs when extended.* is empty so we don't overwrite driver-provided values.
        try {
          if ((!extended.businessName || String(extended.businessName).trim() === '') && extractedData) {
            if (extractedData.businessName && String(extractedData.businessName).trim()) {
              extended.businessName = String(extractedData.businessName).trim();
              extended._fieldSources = extended._fieldSources || {};
              extended._fieldSources.businessName = { key: 'extractedData.businessName', source: 'layout' };
            } else if (extractedData.rawText && String(extractedData.rawText).trim()) {
              const lines = String(extractedData.rawText).split(/\r?\n/).map(l => l.trim()).filter(Boolean);
              const candidate = lines.find(l => l.length > 3 && !/(invoice|receipt|tax|total|customer|date|promo|payment)/i.test(l));
              if (candidate) {
                extended.businessName = candidate;
                extended._fieldSources = extended._fieldSources || {};
                extended._fieldSources.businessName = { key: 'extractedData.rawText:firstCandidate', source: 'rawText' };
              }
            }
          }
        } catch (e) {
          // non-fatal; leave extended as-is
        }
        parsedFields = {
          total: parsed && parsed.value !== undefined ? Number(parsed.value) : (extended.total != null ? Number(extended.total) : (extractedData?.total != null ? Number(extractedData.total) : null)),
          confidence: parsed && parsed.confidence ? parsed.confidence : extended.confidence,
          reason: parsed && parsed.reason ? parsed.reason : extended.reason,
          invoiceId: ids.InvoiceId || ids.InvoiceNo || ids.InvoiceNumber || extended.invoiceId || (extractedData && extractedData.invoiceNo) || null,
          transactionId: ids.TransactionId || ids.TransactionNo || ids.TransactionNumber || ids.Transaction || extended.transactionId || null,
          // extended details - fallback to extractedData when extended is empty or zero
          items: (extended.items && extended.items.length > 0) ? extended.items : (extractedData?.items || []),
          fees: (extended.fees && extended.fees.length > 0) ? extended.fees : (extractedData?.fees || []),
          promotions: (extended.promotions && extended.promotions.length > 0) ? extended.promotions : (extractedData?.promotions || []),
          businessName: extended.businessName || (extractedData && extractedData.businessName) || null,
          businessAddress: extended.businessAddress || (extractedData && extractedData.businessAddress) || null,
          subtotal: (extended.subtotal != null && extended.subtotal > 0) ? Number(extended.subtotal) : (extractedData?.subtotal != null ? Number(extractedData.subtotal) : null),
          tax: (extended.tax != null && extended.tax > 0) ? Number(extended.tax) : (extractedData?.tax != null ? Number(extractedData.tax) : null),
          computedTotal: extended.computedTotal != null ? Number(extended.computedTotal) : null,
          promoSum: extended.promoSum != null ? Number(extended.promoSum) : 0,
          totalAfterPromotions: extended.totalAfterPromotions != null ? Number(extended.totalAfterPromotions) : null,
          paymentMethod: extended.paymentMethod || (extractedData && extractedData.paymentMethod) || null
        };
      } catch (pfErr) {
        console.warn('[OCR] failed to build parsedFields for response', pfErr);
      }

      // IMPORTANT: Cache OCR data in AnalysisEvent for future duplicate detection
      await cacheOcrDataInAnalysisEvent(analysisId, {
        extractedData,
        parsedFields,
        driverRaw: driverRawUnmodified,
        documentType: documentType || 'receipt',
        mimeType
      });

      // If we persisted a record, attach parsedFields into its metadata for later use
      try {
        if (persistedRecord && parsedFields) {
          const update = { $set: { 'metadata.parsedFields': parsedFields } };
          await Record.updateOne({ _id: persistedRecord._id }, update).exec();
        }

        // Also persist seller/billing snapshot and driver raw into the Record so
        // downstream invoicing and exports can attribute this upload correctly.
        if (persistedRecord) {
          try {
            const sellerSnapshot = billingSellerId ? {
              sellerId: billingSellerId,
              sellerName: (sellerProfile && (sellerProfile.publicMetadata && sellerProfile.publicMetadata.businessName)) || (sellerProfile && (sellerProfile.firstName || sellerProfile.username)) || null,
              sellerPrefix: sellerProfile && sellerProfile.publicMetadata && sellerProfile.publicMetadata.invoicePrefix ? sellerProfile.publicMetadata.invoicePrefix : null,
            } : {};

            const billingMetaDelta = {
              analysisId: aeDoc && aeDoc.analysisId ? aeDoc.analysisId : analysisId,
              sellerId: billingSellerId || null,
              billedToSeller: Boolean(inserted && billingSellerId),
            };

            // If this upload was submitted by a customer and targeted a seller,
            // make the resulting Record owned by the billed seller so that the
            // seller's account (and their sync) will surface the record.
            const ownershipPatch = (uploaderType === 'customer' && billingSellerId) ? { user: billingSellerId } : {};

            const recordPatch = {
              $set: Object.assign({},
                sellerSnapshot,
                ownershipPatch,
                { uploaderCustomerId: uploaderType === 'customer' ? uploaderId : null },
                { uploaderCustomerName: uploaderType === 'customer' ? uploaderName : null },
                requestedService ? { service: requestedService } : {},
                requestedReason ? { reason: requestedReason } : {},
                { driverRaw: driverRawUnmodified || sanitizeResults || null },
                { billingMeta: Object.assign({}, (persistedRecord.billingMeta || {}), billingMetaDelta) }
              )
            };

            const updateResult = await Record.updateOne({ _id: persistedRecord._id }, recordPatch).exec();
            console.info('[OCR] Updated record with seller/billing metadata', {
              recordId: persistedRecord._id,
              matchedCount: updateResult.matchedCount,
              modifiedCount: updateResult.modifiedCount,
              uploaderCustomerId: uploaderType === 'customer' ? uploaderId : null
            });
          } catch (recPatchErr) {
            console.warn('[OCR] failed to persist seller/billing snapshot into Record:', recPatchErr);
          }
        }
      } catch (upErr) {
        console.warn('[OCR] failed to save parsedFields into persisted record metadata', upErr);
      }

      // Return the existing or newly-created analysisId and parsed data
      return res.status(200).json({
        message: inserted ? 'File analyzed successfully' : 'File already analyzed (deduped)',
        data: extractedData,
        driverRaw: driverRawUnmodified,
        parsed: parsedFields,
        documentType: documentType || 'receipt',
        fileType: mimeType,
        filePath: filePath.replace(/\\/g, '/'),
        fileName: fileName,
        recordId: persistedRecord?._id || null,
        analysisId: aeDoc && aeDoc.analysisId ? aeDoc.analysisId : analysisId,
      });
    } catch (err) {
      console.error('[OCR] Failed to record analysis event:', err);
      // In case of failure saving the analysis event, still return parsed data
      let parsedFields = null;
      try {
        const fullText = (persistedRecord && persistedRecord.rawText) || extractedData?.rawText || '';
        const parsed = findTotalCandidate((persistedRecord && persistedRecord.ocrData && persistedRecord.ocrData.extracted) || (persistedRecord && persistedRecord.ocrData) || (extractedData && extractedData) || {}, fullText, { ocrData: (persistedRecord && persistedRecord.ocrData) || {}, fullRecord: persistedRecord || {} });
        const ids = extractIdsFromRawDriverResponse((persistedRecord && persistedRecord.ocrData && persistedRecord.ocrData.metadata) || (persistedRecord && persistedRecord.metadata) || { metadata: { rawDriverResponse: sanitizeResults } }, persistedRecord || {});
        parsedFields = {
          total: parsed && parsed.value !== undefined ? Number(parsed.value) : null,
          confidence: parsed && parsed.confidence ? parsed.confidence : null,
          reason: parsed && parsed.reason ? parsed.reason : null,
          invoiceId: ids.InvoiceId || ids.InvoiceNo || ids.InvoiceNumber || null,
          transactionId: ids.TransactionId || ids.TransactionNo || ids.TransactionNumber || ids.Transaction || null,
        };
      } catch (pfErr) {
        console.warn('[OCR] failed to build parsedFields for fallback response', pfErr);
      }

      return res.status(200).json({
        message: 'File analyzed successfully',
        data: extractedData,
        driverRaw: driverRawUnmodified,
        parsed: parsedFields,
        documentType: documentType || 'receipt',
        fileType: mimeType,
        filePath: filePath.replace(/\\/g, '/'),
        fileName: fileName,
        recordId: persistedRecord?._id || null,
      });
    }
  } catch (error) {
    console.error('OCR Analysis Error:', error);
    res.status(500);
    throw new Error('Failed to analyze the document.');
  }
});

module.exports = {
  uploadAndAnalyze,
};
