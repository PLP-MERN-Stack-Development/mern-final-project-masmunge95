const { clerkClient } = require('@clerk/clerk-sdk-node');
const Customer = require('../../../models/Customer');

/**
 * Validate conversion requirements (synchronous checks only)
 * @param {Object} record - Record to convert
 * @param {string} customerId - Customer ID
 * @param {string} userId - User ID
 * @returns {Object} - Validation result with customerId
 */
function validateConversionRequirements(record, customerId, userId) {
    // Check if already converted
    if (record.linkedInvoiceId) {
        throw new Error('Record has already been converted to an invoice.');
    }

    // Ensure customer ID is provided
    const finalCustomerId = customerId || record.customer;
    if (!finalCustomerId) {
        throw new Error('Cannot convert record: no customer specified');
    }

    return { customerId: finalCustomerId };
}

/**
 * Build invoice items from record data
 * @param {Object} extracted - Extracted data from record
 * @param {number} fallbackTotal - Fallback total amount
 * @returns {Array} - Invoice items array with {description, quantity, unitPrice}
 */
function buildInvoiceItems(extracted, fallbackTotal = 0) {
    let items = [];

    // Try lineItems first
    if (Array.isArray(extracted.lineItems) && extracted.lineItems.length > 0) {
        items = extracted.lineItems.map(li => ({
            description: li.description || li.name || 'Item',
            quantity: Number(li.quantity) || 1,
            unitPrice: Number(li.unitPrice || li.price || li.unit_amount || li.rate || li.total) || 0,
        }));
    }
    // Try items array
    else if (Array.isArray(extracted.items) && extracted.items.length > 0) {
        items = extracted.items.map(li => ({
            description: li.description || li.name || 'Item',
            quantity: Number(li.quantity) || 1,
            unitPrice: Number(li.unitPrice || li.price || li.rate || li.unit_amount || li.total) || 0,
        }));
    }
    // Fallback to single item from total
    else {
        const amt = Number(extracted.totalAmount || extracted.total || extracted.amount || fallbackTotal || 0);
        items = [{
            description: extracted.description || 'Record Total',
            quantity: 1,
            unitPrice: amt,
        }];
    }

    return items;
}

/**
 * Calculate invoice totals
 * @param {Array} items - Invoice items with quantity and unitPrice
 * @param {Object} extracted - Extracted data containing tax information
 * @returns {Object} - Calculated totals with subtotal, tax, and total
 */
function calculateInvoiceTotals(items, extracted = {}) {
    const subtotal = items.reduce((sum, item) => {
        const quantity = Number(item.quantity) || 0;
        const unitPrice = Number(item.unitPrice) || 0;
        return sum + (quantity * unitPrice);
    }, 0);
    
    const tax = Number(extracted.tax || extracted.taxAmount || 0);
    const total = subtotal + tax;
    
    return { subtotal, tax, total };
}

/**
 * Build invoice dates
 * @param {Object} extracted - Extracted data with date fields (issueDate, date, dueDate)
 * @returns {Object} - Issue and due dates
 */
function buildInvoiceDates(extracted = {}) {
    // Use issueDate if available, otherwise fall back to date field, otherwise current date
    const issueDate = extracted.issueDate 
        ? new Date(extracted.issueDate) 
        : extracted.date 
        ? new Date(extracted.date) 
        : new Date();
    
    // Use dueDate if available, otherwise 30 days after issueDate
    const dueDate = extracted.dueDate 
        ? new Date(extracted.dueDate) 
        : new Date(issueDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    return { issueDate, dueDate };
}

/**
 * Get seller metadata from Clerk
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - Seller name and prefix
 */
async function getSellerMetadata(userId) {
    // Fallback defaults
    let sellerName = userId || 'Unknown Seller';
    let sellerPrefix = userId ? String(userId).slice(0, 8) : 'INV';

    if (!userId) {
        return { sellerName, sellerPrefix };
    }

    try {
        const seller = await clerkClient.users.getUser(userId);
        if (seller) {
            const first = seller?.firstName || '';
            const last = seller?.lastName || '';
            sellerName = (first || last) 
                ? `${first} ${last}`.trim() 
                : (seller?.publicMetadata?.businessName || 
                   seller?.publicMetadata?.organization || 
                   (seller.emailAddresses && seller.emailAddresses[0] && seller.emailAddresses[0].emailAddress) || 
                   userId);
            sellerPrefix = seller?.publicMetadata?.sellerPrefix || (userId ? String(userId).slice(0, 8) : sellerPrefix);
        }
    } catch (e) {
        // Return fallback defaults
    }

    return { sellerName, sellerPrefix };
}

/**
 * Build complete invoice payload for conversion
 * @param {Object} record - Record object
 * @param {string} customerId - Customer ID
 * @param {string} userId - User ID
 * @param {Object} requestBody - Optional request body with overrides
 * @returns {Object} - Invoice payload
 */
async function buildInvoicePayload(record, customerId, userId, requestBody = {}) {
    const extracted = record.extracted || {};
    const fallbackTotal = Number(record.amount || extracted.total || extracted.amount || 0);
    
    const items = buildInvoiceItems(extracted, fallbackTotal);
    
    // Build extracted object with tax from requestBody or extracted
    const extractedWithTax = {
        ...extracted,
        tax: typeof requestBody.tax !== 'undefined' ? Number(requestBody.tax) : (extracted.tax || extracted.taxAmount || 0)
    };
    
    const { subtotal, tax, total } = calculateInvoiceTotals(items, extractedWithTax);
    
    // Build dates from extracted (with issueDate/dueDate or date field)
    const extractedWithDates = {
        ...extracted,
        issueDate: requestBody.issueDate || extracted.issueDate || extracted.date,
        dueDate: requestBody.dueDate || extracted.dueDate
    };
    const { issueDate, dueDate } = buildInvoiceDates(extractedWithDates);
    
    const { sellerName, sellerPrefix } = await getSellerMetadata(userId);

    const service = (requestBody.service || (items && items[0] && items[0].description) || '').toString().trim() || undefined;

    return {
        customer: customerId,
        customerName: requestBody.customerName || extracted.customerName,
        user: userId,
        sellerName,
        sellerPrefix,
        service,
        items,
        subtotal,
        tax,
        total,
        status: requestBody.status || 'pending',
        issueDate,
        dueDate,
        convertedFromRecord: record._id,
    };
}

module.exports = {
    validateConversionRequirements,
    buildInvoiceItems,
    calculateInvoiceTotals,
    buildInvoiceDates,
    getSellerMetadata,
    buildInvoicePayload
};
