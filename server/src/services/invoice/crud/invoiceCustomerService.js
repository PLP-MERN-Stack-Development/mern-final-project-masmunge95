/**
 * Invoice Customer Service
 * Handles customer lookup, creation, and linking for invoices
 */

const Customer = require('../../../models/Customer');

/**
 * Find or create customer for invoice
 * Handles multiple scenarios:
 * 1. Customer found by ID linked to user
 * 2. Customer found by email/phone linked to user
 * 3. Customer exists for different seller - link current user
 * 4. No customer exists - create new one
 */
async function findOrCreateCustomer(params) {
  const { customerId, email, phone, name, userId } = params;
  
  let customer = null;
  
  // First, try strict lookup by provided customerId (linked to this user)
  if (customerId) {
    customer = await Customer.findOne({ _id: customerId, users: userId });
  }

  // If not found, attempt to lookup by email/phone
  if (!customer && (email || phone)) {
    const lookup = {};
    if (email) lookup.email = email;
    if (phone) lookup.phone = phone;

    if (Object.keys(lookup).length > 0) {
      // Prefer a customer already linked to this user
      customer = await Customer.findOne({ ...lookup, users: userId });
      
      if (!customer) {
        // If a customer exists for a different seller, link the current seller
        const existing = await Customer.findOne({ ...lookup });
        if (existing) {
          if (!Array.isArray(existing.users) || !existing.users.includes(userId)) {
            existing.users = Array.from(new Set([...(existing.users || []), userId]));
            await existing.save();
          }
          customer = existing;
        } else {
          // No existing customer at all — create one for this seller
          customer = await createNewCustomer({ email, phone, name, userId });
        }
      }
    }
  }

  return customer;
}

/**
 * Create a new customer with error handling for duplicate key errors
 */
async function createNewCustomer(params) {
  const { email, phone, name, userId } = params;
  
  const newCustomerData = {
    name: name || 'Unnamed Customer',
    users: [userId],
  };
  if (email) newCustomerData.email = email;
  if (phone) newCustomerData.phone = phone;

  try {
    return await Customer.create(newCustomerData);
  } catch (err) {
    const isDuplicateKey = err && (err.code === 11000 || (err.message && err.message.includes('duplicate')));
    if (isDuplicateKey) {
      // Attempt to recover: find existing by email/phone and link user
      let existing = null;
      if (email) existing = await Customer.findOne({ email });
      if (!existing && phone) existing = await Customer.findOne({ phone });
      
      if (existing) {
        if (!Array.isArray(existing.users) || !existing.users.includes(userId)) {
          existing.users = Array.from(new Set([...(existing.users || []), userId]));
          await existing.save();
        }
        return existing;
      } else {
        // If we can't recover, rethrow original error
        throw err;
      }
    } else {
      throw err;
    }
  }
}

/**
 * Build customer data for invoice payload
 */
function buildCustomerInvoiceData(customer) {
  return {
    customerId: customer._id,
    customerName: customer.name
  };
}

module.exports = {
  findOrCreateCustomer,
  createNewCustomer,
  buildCustomerInvoiceData
};
