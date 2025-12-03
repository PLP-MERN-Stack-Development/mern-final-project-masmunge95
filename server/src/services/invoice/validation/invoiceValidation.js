/**
 * Invoice Validation Service
 * Handles validation and normalization of invoice data
 */

const { clerkClient } = require('@clerk/clerk-sdk-node');

/**
 * Validate and normalize dates
 */
function validateDates(issueDate, dueDate) {
  // Normalize and validate issueDate
  let parsedIssueDate;
  try {
    parsedIssueDate = issueDate ? new Date(issueDate) : new Date();
    if (isNaN(parsedIssueDate.getTime())) parsedIssueDate = new Date();
  } catch (e) {
    parsedIssueDate = new Date();
  }

  // Normalize and validate dueDate
  let parsedDueDate;
  try {
    parsedDueDate = dueDate ? new Date(dueDate) : null;
    if (!parsedDueDate || isNaN(parsedDueDate.getTime())) {
      // Default due date: 30 days after issue date
      parsedDueDate = new Date(parsedIssueDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    }
  } catch (e) {
    parsedDueDate = new Date(parsedIssueDate.getTime() + 30 * 24 * 60 * 60 * 1000);
  }

  return { parsedIssueDate, parsedDueDate };
}

/**
 * Extract customer contact information from request body
 */
function extractCustomerContact(body) {
  const providedEmail = (
    body.customerEmail || 
    body.email || 
    body.customer?.email || 
    body.customerEmailAddress || 
    ''
  ).toString().trim();
  
  const providedPhone = (
    body.customerPhone || 
    body.phone || 
    body.customer?.phone || 
    ''
  ).toString().trim();
  
  const providedName = (
    body.customerName || 
    body.name || 
    body.customer?.name || 
    ''
  ).toString().trim();

  return {
    email: providedEmail ? providedEmail.toLowerCase() : null,
    phone: providedPhone || null,
    name: providedName || null
  };
}

/**
 * Calculate invoice totals from items
 */
function calculateTotals(items, tax) {
  const subTotal = items.reduce((acc, item) => acc + (Number(item.total) || 0), 0);
  const total = subTotal + (Number(tax) || 0);
  
  return { subTotal, total };
}

/**
 * Get seller metadata from Clerk
 */
async function getSellerMetadata(userId) {
  let sellerName = userId;
  let sellerPrefix = userId ? String(userId).slice(0, 8) : null;
  
  try {
    const seller = await clerkClient.users.getUser(userId);
    if (seller) {
      const first = seller?.firstName || '';
      const last = seller?.lastName || '';
      sellerName = (first || last) 
        ? `${first} ${last}`.trim() 
        : (
          seller?.publicMetadata?.businessName || 
          seller?.publicMetadata?.organization || 
          (seller.emailAddresses && seller.emailAddresses[0] && seller.emailAddresses[0].emailAddress) || 
          userId
        );
      sellerPrefix = seller?.publicMetadata?.sellerPrefix || (userId ? String(userId).slice(0, 8) : sellerPrefix);
    }
  } catch (e) {
    // Non-fatal: fall back to userId-derived values
  }
  
  return { sellerName, sellerPrefix };
}

/**
 * Normalize service field from request body or items
 */
function normalizeService(body, items) {
  return (
    body.service || 
    (items && items[0] && items[0].description) || 
    ''
  ).toString().trim();
}

/**
 * Validate invoice can be updated (check status)
 */
function validateInvoiceUpdateAllowed(invoice) {
  if (invoice.status === 'paid' || invoice.status === 'void') {
    const error = new Error(`Cannot update an invoice with status '${invoice.status}'.`);
    error.status = 400;
    throw error;
  }
  return true;
}

/**
 * Validate invoice can be sent (check status)
 */
function validateInvoiceSendAllowed(invoice) {
  if (invoice.status === 'paid' || invoice.status === 'sent') {
    const error = new Error(`Invoice cannot be sent because its status is '${invoice.status}'.`);
    error.status = 400;
    throw error;
  }
  return true;
}

/**
 * Validate dispute resolution status
 */
function validateDisputeStatus(status) {
  if (!status || !['accepted', 'rejected'].includes(status)) {
    const error = new Error('Invalid resolution status');
    error.status = 400;
    throw error;
  }
  return true;
}

/**
 * Validate line item index
 */
function validateLineItemIndex(lineItemIndex, items) {
  if (lineItemIndex !== null && lineItemIndex !== undefined) {
    if (lineItemIndex < 0 || lineItemIndex >= items.length) {
      const error = new Error('Invalid line item index');
      error.status = 400;
      throw error;
    }
  }
  return true;
}

module.exports = {
  validateDates,
  extractCustomerContact,
  calculateTotals,
  getSellerMetadata,
  normalizeService,
  validateInvoiceUpdateAllowed,
  validateInvoiceSendAllowed,
  validateDisputeStatus,
  validateLineItemIndex
};
