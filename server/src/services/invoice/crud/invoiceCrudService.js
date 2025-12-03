/**
 * Invoice CRUD Service
 * Handles basic invoice database operations
 */

const Invoice = require('../../../models/Invoice');
const Customer = require('../../../models/Customer');

/**
 * Find invoice by ID with customer populated
 */
async function findInvoiceById(id) {
  return await Invoice.findById(id).populate('customer');
}

/**
 * Find invoices with filters
 */
async function findInvoices(filter, options = {}) {
  const { sort = { createdAt: -1 }, populate = null, limit, skip } = options;
  
  let query = Invoice.find(filter).sort(sort);
  
  if (skip) {
    query = query.skip(skip);
  }
  
  if (limit) {
    query = query.limit(limit);
  }
  
  if (populate) {
    query = query.populate(populate);
  }
  
  return await query;
}

/**
 * Create a new invoice
 */
async function createInvoice(invoiceData) {
  return await Invoice.create(invoiceData);
}

/**
 * Count invoices matching filter
 */
async function countInvoices(filter = {}) {
  return await Invoice.countDocuments(filter);
}

/**
 * Update invoice by ID
 */
async function updateInvoiceById(id, updates) {
  return await Invoice.findByIdAndUpdate(id, updates, { 
    new: true, 
    runValidators: true 
  }).populate('customer');
}

/**
 * Delete invoice by ID
 */
async function deleteInvoiceById(id) {
  return await Invoice.findByIdAndDelete(id);
}

/**
 * Find customer by ID and verify user ownership
 */
async function findCustomerByIdAndUser(customerId, userId) {
  return await Customer.findOne({ _id: customerId, users: userId });
}

/**
 * Find customer by email or phone
 */
async function findCustomerByContact(email, phone) {
  const lookup = {};
  if (email) lookup.email = email.toLowerCase();
  if (phone) lookup.phone = phone;
  
  if (Object.keys(lookup).length === 0) return null;
  
  return await Customer.findOne({ ...lookup });
}

/**
 * Find customer by contact linked to specific user
 */
async function findCustomerByContactAndUser(email, phone, userId) {
  const lookup = {};
  if (email) lookup.email = email.toLowerCase();
  if (phone) lookup.phone = phone;
  
  if (Object.keys(lookup).length === 0) return null;
  
  return await Customer.findOne({ ...lookup, users: userId });
}

/**
 * Create a new customer
 */
async function createCustomer(data) {
  return await Customer.create(data);
}

/**
 * Link user to existing customer
 */
async function linkUserToCustomer(customer, userId) {
  if (!Array.isArray(customer.users) || !customer.users.includes(userId)) {
    customer.users = Array.from(new Set([...(customer.users || []), userId]));
    await customer.save();
  }
  return customer;
}

/**
 * Find existing invoice by clientTempId (for idempotency)
 */
async function findInvoiceByTempId(userId, clientTempId) {
  if (!clientTempId) return null;
  
  try {
    return await Invoice.findOne({ 
      user: userId, 
      clientTempId: String(clientTempId) 
    });
  } catch (e) {
    return null;
  }
}

/**
 * Recalculate invoice totals
 */
function recalculateInvoiceTotals(invoice) {
  const newSubTotal = invoice.items.reduce((sum, item) => sum + item.total, 0);
  invoice.subTotal = newSubTotal;
  invoice.total = newSubTotal + (invoice.tax || 0);
  return invoice;
}

module.exports = {
  findInvoiceById,
  findInvoices,
  createInvoice,
  updateInvoiceById,
  deleteInvoiceById,
  countInvoices,
  findCustomerByIdAndUser,
  findCustomerByContact,
  findCustomerByContactAndUser,
  createCustomer,
  linkUserToCustomer,
  findInvoiceByTempId,
  recalculateInvoiceTotals
};
