/**
 * Payment Validation Service
 * Handles all payment-related validation logic
 */

/**
 * Validate payment initiation request
 */
const validatePaymentRequest = ({ _id, invoiceId, name, email, paymentMethod, phone }) => {
    if (!_id || !invoiceId || !name || !email) {
        const error = new Error('Please provide _id and all required payment details.');
        error.status = 400;
        throw error;
    }

    // Validate payment method
    const method = paymentMethod || 'mpesa';
    if (!['mpesa', 'card'].includes(method)) {
        const error = new Error('Invalid payment method. Use "mpesa" or "card".');
        error.status = 400;
        throw error;
    }

    // M-Pesa requires phone number
    if (method === 'mpesa' && !phone) {
        const error = new Error('Phone number is required for M-Pesa payment.');
        error.status = 400;
        throw error;
    }

    return method;
};

/**
 * Validate invoice can be paid
 */
const validateInvoicePayable = (invoice) => {
    if (invoice.status === 'paid') {
        const error = new Error('Invoice has already been paid.');
        error.status = 400;
        throw error;
    }
};

/**
 * Validate webhook payload structure
 */
const validateWebhookPayload = (payload, rawBody) => {
    let parsedPayload;
    try {
        parsedPayload = JSON.parse(rawBody);
    } catch (err) {
        console.error('Webhook Error: Invalid JSON payload.');
        return null;
    }

    // Basic validation: check for the challenge string
    if (parsedPayload.challenge !== process.env.INTASEND_CHALLENGE_TOKEN) {
        console.error('Webhook Error: Challenge validation failed.');
        return null;
    }

    return parsedPayload;
};

/**
 * Extract invoice and transaction IDs from webhook payload
 */
const extractWebhookIds = (payload) => {
    let intasendInvoiceId = payload.invoice_id;
    if (!intasendInvoiceId && payload.transaction && payload.transaction.invoice) {
        intasendInvoiceId = payload.transaction.invoice.invoice_id;
    }

    let invoiceId = payload.api_ref;
    if (!invoiceId && payload.transaction && payload.transaction.invoice) {
        invoiceId = payload.transaction.invoice.api_ref;
    }

    if (!invoiceId || !intasendInvoiceId) {
        console.error('Webhook Error: Payload missing api_ref or invoice_id.');
        return null;
    }

    return { invoiceId, intasendInvoiceId };
};

module.exports = {
    validatePaymentRequest,
    validateInvoicePayable,
    validateWebhookPayload,
    extractWebhookIds,
};
