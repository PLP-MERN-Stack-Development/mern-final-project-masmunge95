/**
 * Validate verification status
 * @param {string} status - Verification status
 */
function validateVerificationStatus(status) {
    if (!status || !['verified', 'disputed'].includes(status)) {
        const error = new Error('Invalid verification status');
        error.status = 400;
        throw error;
    }
}

/**
 * Validate resolution status
 * @param {string} resolution - Resolution status
 */
function validateResolutionStatus(resolution) {
    if (!resolution || !['accepted', 'rejected', 'modified'].includes(resolution)) {
        const error = new Error('Invalid resolution status');
        error.status = 400;
        throw error;
    }
}

/**
 * Check if user is authorized to verify record
 * @param {Object} record - Record object
 * @param {string} userId - User ID
 * @returns {boolean}
 */
function isAuthorizedToVerify(record, userId) {
    if (!record.sharedWith) {
        return false;
    }
    return record.sharedWith.includes(userId);
}

/**
 * Check if user is authorized to view verifications
 * @param {Object} record - Record object
 * @param {string} userId - User ID
 * @returns {boolean}
 */
function isAuthorizedToViewVerifications(record, userId) {
    return record.user === userId || (record.sharedWith && record.sharedWith.includes(userId));
}

/**
 * Check if user is authorized to resolve disputes
 * @param {Object} record - Record object
 * @param {string} userId - User ID
 * @returns {boolean}
 */
function isAuthorizedToResolveDisputes(record, userId) {
    return record.user === userId;
}

/**
 * Add or update verification on record
 * @param {Object} record - Record object
 * @param {string} userId - User ID
 * @param {Object} verificationData - Verification data
 * @param {string} userRole - User role ('seller' or 'customer')
 */
function addOrUpdateVerification(record, userId, verificationData, userRole = 'customer') {
    const { status, notes, suggestedCorrections } = verificationData;

    // Initialize verifications array if it doesn't exist
    if (!record.verifications) {
        record.verifications = [];
    }

    // Check if user already verified
    const existingVerification = record.verifications.find(v => v.verifiedBy === userId);
    
    if (existingVerification) {
        // Update existing verification
        existingVerification.status = status;
        existingVerification.comments = notes || '';
        existingVerification.suggestedCorrections = suggestedCorrections || null;
        existingVerification.verifiedAt = new Date();
        existingVerification.verifierRole = userRole;
    } else {
        // Add new verification
        record.verifications.push({
            verifiedBy: userId,
            verifierRole: userRole,
            status,
            comments: notes || '',
            suggestedCorrections: suggestedCorrections || null,
            verifiedAt: new Date()
        });
    }
}

/**
 * Find verification by ID
 * @param {Object} record - Record object
 * @param {string} verificationId - Verification ID
 * @returns {Object|undefined}
 */
function findVerificationById(record, verificationId) {
    if (!record.verifications || !Array.isArray(record.verifications)) {
        return undefined;
    }
    return record.verifications.find(v => v._id && v._id.toString() === verificationId.toString());
}

/**
 * Resolve dispute on verification
 * @param {Object} verification - Verification object
 * @param {Object} resolutionData - Resolution data
 * @param {string} userId - User ID
 */
function resolveDispute(verification, resolutionData, userId) {
    const { resolution, resolutionNotes } = resolutionData;

    verification.resolution = resolution;
    verification.resolutionNotes = resolutionNotes || '';
    verification.resolvedAt = new Date();
    verification.resolvedBy = userId;
}

/**
 * Apply suggested corrections to record
 * @param {Object} record - Record object
 * @param {Object} suggestedCorrections - Suggested corrections object to merge into extracted
 */
function applySuggestedCorrections(record, suggestedCorrections) {
    if (!suggestedCorrections || typeof suggestedCorrections !== 'object') {
        return;
    }

    // Initialize extracted if it doesn't exist
    if (!record.extracted) {
        record.extracted = {};
    }
    
    // Merge all correction fields directly into extracted
    Object.assign(record.extracted, suggestedCorrections);
    
    // Mark the extracted field as modified for Mongoose
    if (typeof record.markModified === 'function') {
        record.markModified('extracted');
    }
}

module.exports = {
    validateVerificationStatus,
    validateResolutionStatus,
    isAuthorizedToVerify,
    isAuthorizedToViewVerifications,
    isAuthorizedToResolveDisputes,
    addOrUpdateVerification,
    findVerificationById,
    resolveDispute,
    applySuggestedCorrections
};
