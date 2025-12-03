const AnalysisEvent = require('../../../models/AnalysisEvent');
const Subscription = require('../../../models/Subscription');
const { v4: uuidv4 } = require('uuid');

/**
 * Process billing for OCR analysis based on uploader type
 * @param {Object} params - Billing parameters
 * @returns {Promise<Object>} - Billing result
 */
async function processOcrBilling(params) {
    const { analysisId, sellerId, uploaderType, isCustomerSubmission, hasOcrData } = params;

    if (!hasOcrData) {
        return { billed: false, reason: 'No OCR data' };
    }

    try {
        if (analysisId) {
            return await reconcileExistingAnalysis(analysisId, sellerId, uploaderType, isCustomerSubmission);
        } else {
            return await createNewAnalysis(sellerId, uploaderType, isCustomerSubmission);
        }
    } catch (error) {
        console.error('[Billing] Failed to process OCR billing:', error);
        return { billed: false, error: error.message };
    }
}

/**
 * Reconcile billing with existing analysis event
 * @param {string} analysisId - Analysis event ID
 * @param {string} sellerId - Seller user ID
 * @param {string} uploaderType - Type of uploader
 * @param {boolean} isCustomerSubmission - Whether this is a customer submission
 * @returns {Promise<Object>}
 */
async function reconcileExistingAnalysis(analysisId, sellerId, uploaderType, isCustomerSubmission) {
    const ae = await AnalysisEvent.findOne({ analysisId }).exec();

    if (!ae) {
        // No existing analysis found, create new one
        return await createNewAnalysis(sellerId, uploaderType, isCustomerSubmission);
    }

    // Verify seller ownership
    if (ae.sellerId && String(ae.sellerId) !== String(sellerId)) {
        throw new Error('AnalysisEvent belongs to a different seller');
    }

    const shouldBillCustomer = !ae.billedToCustomer && 
        (ae.uploaderType === 'customer' || uploaderType === 'customer' || isCustomerSubmission);

    if (shouldBillCustomer && sellerId) {
        try {
            await Subscription.findOneAndUpdate(
                { userId: sellerId },
                { $inc: { 'usage.customerOcrScans': 1 } },
                { new: true }
            ).exec();

            ae.billedToCustomer = true;
            await ae.save();

            return { billed: true, type: 'customer', analysisId };
        } catch (err) {
            console.error('[Billing] Failed to bill customerOcrScans:', err);
            return { billed: false, error: err.message };
        }
    }

    return { billed: false, reason: 'Already billed or not customer submission' };
}

/**
 * Create new analysis event and bill accordingly
 * @param {string} sellerId - Seller user ID
 * @param {string} uploaderType - Type of uploader
 * @param {boolean} isCustomerSubmission - Whether this is a customer submission
 * @returns {Promise<Object>}
 */
async function createNewAnalysis(sellerId, uploaderType, isCustomerSubmission) {
    const determinedUploaderType = (uploaderType === 'customer' || isCustomerSubmission) ? 'customer' : 'seller';

    if (determinedUploaderType === 'customer') {
        try {
            const newId = uuidv4();
            await AnalysisEvent.create({
                analysisId: newId,
                sellerId,
                uploaderId: null,
                uploaderType: determinedUploaderType,
                metadata: { source: 'record.create' },
                billedToCustomer: true,
            });

            await Subscription.findOneAndUpdate(
                { userId: sellerId },
                { $inc: { 'usage.customerOcrScans': 1 } },
                { new: true }
            ).exec();

            return { billed: true, type: 'customer', analysisId: newId };
        } catch (err) {
            console.error('[Billing] Failed to create AnalysisEvent and bill:', err);
            return { billed: false, error: err.message };
        }
    }

    // For seller submissions, no billing needed (handled by server OCR path)
    return { billed: false, reason: 'Seller submission - no billing needed' };
}

/**
 * Parse OCR data from string or object
 * @param {string|Object} ocrData - OCR data to parse
 * @returns {Object|null}
 */
function parseOcrData(ocrData) {
    if (!ocrData) return null;
    
    if (typeof ocrData === 'object') {
        return ocrData;
    }

    try {
        return JSON.parse(ocrData);
    } catch (e) {
        console.error('[OCR] Failed to parse OCR data:', e);
        return null;
    }
}

module.exports = {
    processOcrBilling,
    reconcileExistingAnalysis,
    createNewAnalysis,
    parseOcrData
};
