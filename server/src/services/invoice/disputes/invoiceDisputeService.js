/**
 * Invoice Disputes Service
 * Handles dispute creation, resolution, and management
 */

/**
 * Check if user is authorized to dispute invoice (customer check)
 * Customers are authorized if their email matches the invoice customer's email
 */
async function isAuthorizedToDispute(invoice, userId, clerkClient) {
  if (!invoice.customer) {
    const error = new Error('Not authorized to dispute this invoice');
    error.status = 403;
    throw error;
  }

  // Get the logged-in user's email from Clerk
  let userEmail;
  try {
    const user = await clerkClient.users.getUser(userId);
    if (!user || !user.emailAddresses || user.emailAddresses.length === 0) {
      const error = new Error('User email not found');
      error.status = 403;
      throw error;
    }
    userEmail = user.emailAddresses[0].emailAddress;
  } catch (err) {
    const error = new Error('Failed to verify user identity');
    error.status = 403;
    throw error;
  }

  // Check if invoice customer is populated
  if (!invoice.customer.email) {
    const error = new Error('Invoice customer data not properly loaded');
    error.status = 500;
    throw error;
  }

  // Check if user's email matches the invoice customer's email
  const customerEmail = invoice.customer.email.toLowerCase();
  const isAuthorized = userEmail.toLowerCase() === customerEmail;

  if (!isAuthorized) {
    const error = new Error('Not authorized to dispute this invoice');
    error.status = 403;
    throw error;
  }
  
  return true;
}

/**
 * Check if user is authorized to resolve dispute (seller check)
 */
function isAuthorizedToResolve(invoice, userId) {
    if (invoice.user !== userId) {
        const error = new Error('Not authorized to resolve disputes on this invoice');
        error.status = 403;
        throw error;
    }
    return true;
}/**
 * Check if user is authorized to view disputes (seller or customer)
 * Customers are authorized if their email matches the invoice customer's email
 */
async function isAuthorizedToViewDisputes(invoice, userId, clerkClient) {
  const isSeller = invoice.user === userId;
  
  // Check if user is the customer (by email)
  let isCustomer = false;
  if (!isSeller) {
    try {
      const user = await clerkClient.users.getUser(userId);
      if (user && user.emailAddresses && user.emailAddresses.length > 0) {
        const userEmail = user.emailAddresses[0].emailAddress.toLowerCase();
        const customerEmail = invoice.customer?.email?.toLowerCase();
        isCustomer = userEmail === customerEmail;
      }
    } catch (err) {
      // If we can't verify, deny access
      isCustomer = false;
    }
  }
  
  if (!isSeller && !isCustomer) {
    const error = new Error('Not authorized to view disputes');
    error.status = 403;
    throw error;
  }
  return true;
}

/**
 * Add a dispute to an invoice
 */
function addDispute(invoice, disputeData) {
  const { userId, lineItemIndex, field, originalValue, suggestedValue, reason } = disputeData;
  
  invoice.disputes.push({
    disputedBy: userId,
    lineItemIndex: lineItemIndex ?? null,
    field: field || null,
    originalValue: originalValue || null,
    suggestedValue: suggestedValue || null,
    reason,
    status: 'pending',
    disputedAt: new Date()
  });

  // Update overall dispute status
  if (invoice.disputeStatus === 'none') {
    invoice.disputeStatus = 'disputed';
  }
  
  return invoice;
}

/**
 * Resolve a dispute
 */
function resolveDispute(invoice, disputeId, resolutionData) {
  const { userId, status, resolutionNotes, applyChanges } = resolutionData;
  
  const dispute = invoice.disputes.id(disputeId);
  if (!dispute) {
    const error = new Error('Dispute not found');
    error.status = 404;
    throw error;
  }

  // Update dispute
  dispute.status = status;
  dispute.reviewedAt = new Date();
  dispute.reviewedBy = userId;
  dispute.resolutionNotes = resolutionNotes || '';

  // If accepted and applyChanges is true, update the invoice
  if (status === 'accepted' && applyChanges && dispute.suggestedValue !== null) {
    if (dispute.lineItemIndex !== null) {
      // Update specific line item field
      const item = invoice.items[dispute.lineItemIndex];
      if (item && dispute.field) {
        item[dispute.field] = dispute.suggestedValue;
        
        // Recalculate line item total if quantity or unitPrice changed
        if (dispute.field === 'quantity' || dispute.field === 'unitPrice') {
          item.total = item.quantity * item.unitPrice;
        }
      }
    }

    // Recalculate invoice totals
    const newSubTotal = invoice.items.reduce((sum, item) => sum + item.total, 0);
    invoice.subTotal = newSubTotal;
    invoice.total = newSubTotal + (invoice.tax || 0);
  }

  // Check if all disputes are resolved
  const allResolved = invoice.disputes.every(d => d.status === 'accepted' || d.status === 'rejected');
  if (allResolved) {
    invoice.disputeStatus = 'resolved';
  } else {
    invoice.disputeStatus = 'under-review';
  }
  
  return true;
}

/**
 * Get disputed invoices for a seller
 */
async function getDisputedInvoicesForSeller(Invoice, userId) {
  return await Invoice.find({
    user: userId,
    disputes: { $exists: true, $ne: [] }
  }).sort({ updatedAt: -1 });
}

module.exports = {
  isAuthorizedToDispute,
  isAuthorizedToResolve,
  isAuthorizedToViewDisputes,
  addDispute,
  resolveDispute,
  getDisputedInvoicesForSeller
};
