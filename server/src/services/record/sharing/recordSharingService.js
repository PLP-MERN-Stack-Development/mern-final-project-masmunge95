/**
 * Validate sharing requirements
 * @param {Array} recipientIds - Array of recipient IDs
 * @param {string} role - Share role
 */
function validateShareRequirements(recipientIds, role) {
    if (!recipientIds || !Array.isArray(recipientIds) || recipientIds.length === 0) {
        const error = new Error('Please provide recipientIds array');
        error.status = 400;
        throw error;
    }

    if (!role || !['seller-to-customer', 'customer-to-seller'].includes(role)) {
        const error = new Error('Invalid share role');
        error.status = 400;
        throw error;
    }
}

/**
 * Check if user is authorized to share record
 * @param {Object} record - Record object
 * @param {string} userId - User ID
 * @param {string} role - Share role ('seller-to-customer' or 'customer-to-seller')
 * @returns {boolean}
 */
function isAuthorizedToShare(record, userId, role) {
    if (role === 'seller-to-customer') {
        // Seller sharing with customers - must own the record
        return record.user === userId;
    } else if (role === 'customer-to-seller') {
        // Customer sharing with seller - must be uploader or owner
        return record.uploaderCustomerId === userId || record.user === userId;
    }
    
    return false;
}

/**
 * Add recipients to record sharing
 * @param {Object} record - Record object
 * @param {Array} recipientIds - Array of recipient IDs
 * @param {string} userId - User ID (sharer)
 * @param {string} role - Share role
 */
function addRecipientsToRecord(record, recipientIds, userId, role) {
    record.sharedBy = userId;
    record.shareRole = role;
    record.sharedWith = [...new Set([...record.sharedWith, ...recipientIds])]; // Merge and deduplicate
}

/**
 * Check if user is authorized to view record
 * @param {Object} record - Record object
 * @param {string} userId - User ID
 * @returns {boolean}
 */
function isAuthorizedToView(record, userId) {
    return record.user === userId || record.sharedWith.includes(userId);
}

module.exports = {
    validateShareRequirements,
    isAuthorizedToShare,
    addRecipientsToRecord,
    isAuthorizedToView
};
