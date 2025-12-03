/**
 * OCR Analytics Service
 * Handles AnalysisEvent tracking and deduplication
 */

const AnalysisEvent = require('../../../models/AnalysisEvent');
const { v4: uuidv4 } = require('uuid');

/**
 * Check if an upload has already been analyzed (deduplication)
 */
async function checkDuplicateAnalysis(uploadId) {
  if (!uploadId) return null;
  
  try {
    const existing = await AnalysisEvent.findOne({ uploadId });
    return existing;
  } catch (error) {
    console.warn('[Analytics] Error checking duplicate:', error);
    return null;
  }
}

/**
 * Create an analysis event record
 */
async function createAnalysisEvent(data) {
  const {
    userId,
    uploadId,
    documentType,
    fileName,
    fileSize,
    mimeType,
    extractedData,
    ocrRawResults,
    confidence,
    processingTime
  } = data;

  try {
    const event = await AnalysisEvent.create({
      analysisId: uuidv4(),
      uploadId: uploadId || null,
      user: userId,
      documentType,
      fileName,
      fileSize: fileSize || 0,
      mimeType: mimeType || 'application/octet-stream',
      extractedData,
      ocrRawResults: ocrRawResults || null,
      confidence: confidence || null,
      processingTime: processingTime || 0,
      analyzedAt: new Date()
    });

    return event;
  } catch (error) {
    console.error('[Analytics] Error creating analysis event:', error);
    return null;
  }
}

/**
 * Update subscription usage for OCR scans
 */
async function trackOCRUsage(userId, documentType) {
  const Subscription = require('../../../models/Subscription');
  
  try {
    const subscription = await Subscription.findOne({ user: userId });
    if (!subscription) {
      console.warn(`[Analytics] No subscription found for user ${userId}`);
      return false;
    }

    // Determine which usage field to increment
    let usageField;
    if (documentType === 'utility' || documentType === 'utility-bill') {
      usageField = 'usage.sellerOcrScans';
    } else if (documentType === 'customer' || documentType === 'customer-consumption') {
      usageField = 'usage.customerOcrScans';
    } else {
      usageField = 'usage.sellerOcrScans'; // Default
    }

    await Subscription.findByIdAndUpdate(
      subscription._id,
      { $inc: { [usageField]: 1 } }
    );

    console.info(`[Analytics] Incremented ${usageField} for user ${userId}`);
    return true;
  } catch (error) {
    console.error('[Analytics] Error tracking OCR usage:', error);
    return false;
  }
}

module.exports = {
  checkDuplicateAnalysis,
  createAnalysisEvent,
  trackOCRUsage
};
