const Invoice = require('../models/Invoice');
const Counter = require('../models/Counter');

/**
 * Create an invoice with an atomic per-seller sequence.
 * Uses a counter document `invoiceNumber:<sellerId>` to atomically increment
 * the seller's sequence and retries on duplicate-key errors.
 *
 * @param {Object} payload - Invoice payload (without invoiceNumber/publicInvoiceId)
 * @param {String} sellerId - Clerk user id for the seller
 * @param {String} sellerPrefix - optional short prefix for seller
 * @param {Number} [maxRetries=5]
 */
async function createInvoiceWithSequence(payload, sellerId, sellerPrefix, maxRetries = 5) {
  let attempts = 0;
  let lastErr = null;

  while (attempts < maxRetries) {
    attempts++;
    // Atomically increment the per-seller counter
    const counterId = `invoiceNumber:${sellerId}`;
    const counter = await Counter.findOneAndUpdate(
      { _id: counterId },
      { $inc: { sequence_value: 1 } },
      { new: true, upsert: true }
    );

    const seq = counter && counter.sequence_value ? counter.sequence_value : null;
    if (!seq) {
      lastErr = new Error('Failed to obtain sequence from counter');
      continue;
    }

    // Compose values
    const invoiceNumber = `INV-${seq}`;
    const publicInvoiceId = `${(sellerPrefix || String(sellerId)).toString().replace(/\s+/g, '_')}-${seq}`;

    // Attach to payload copy. Ensure we do NOT preserve a client-supplied `_id` here,
    // because retries that increment the per-seller counter will otherwise repeatedly
    // attempt to insert the same _id and cause duplicate-key errors on the _id index.
    const toCreate = Object.assign({}, payload, { invoiceNumber, publicInvoiceId });
    // Always let the server generate the canonical _id. Remove any incoming _id to
    // avoid retrying with the same value across attempts.
    if (toCreate._id) delete toCreate._id;

    try {
      const created = await Invoice.create(toCreate);
      return created;
    } catch (err) {
      lastErr = err;
      // If duplicate key on compound index { user, invoiceNumber }, retry (we'll increment again)
      const isDuplicateKey = err && (err.code === 11000 || (err.message && err.message.includes('duplicate')));
      if (isDuplicateKey) {
        // Log and retry
        // eslint-disable-next-line no-console
        console.warn('[invoiceHelper] duplicate-key detected on invoice create, retrying assignment', { sellerId, attempt: attempts, err: err.message });
        continue; // next loop will increment counter and attempt again
      }
      // Other errors should abort
      throw err;
    }
  }

  // If we exit loop, throw last encountered error
  const e = lastErr || new Error('Failed to create invoice after retries');
  throw e;
}

module.exports = {
  createInvoiceWithSequence,
};
