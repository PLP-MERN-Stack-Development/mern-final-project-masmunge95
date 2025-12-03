const Invoice = require('../models/Invoice');
const asyncHandler = require('../utils/asyncHandler');
const mongoose = require('mongoose');
const requireOwnership = require('../middleware/ownershipMiddleware');

// Service imports
const { validatePaymentRequest, validateInvoicePayable, validateWebhookPayload, extractWebhookIds } = require('../services/payment/validation/paymentValidation');
const { collectMpesaPayment, collectCardPayment, verifyTransaction, isTransactionComplete } = require('../services/payment/provider/paymentProviderService');
const { processPaymentTransaction } = require('../services/payment/transaction/paymentTransactionService');

/**
 * @desc    Create a pending payment and get a payment link from IntaSend
 * @route   POST /api/payments/initiate
 * @access  Private
 */
exports.makePayment = asyncHandler(async (req, res) => {
    const { _id, invoiceId, name, email, phone, paymentMethod } = req.body;

    // Validate payment request
    const method = validatePaymentRequest({ _id, invoiceId, name, email, paymentMethod, phone });

    // Verify invoice ownership and payability
    const invoice = await requireOwnership(Invoice, invoiceId, req.auth.userId, 'user');
    validateInvoicePayable(invoice);

    // Split name into first and last
    const [firstName, ...lastName] = name.split(' ');

    // Initiate payment with provider
    let response;
    if (method === 'mpesa') {
        response = await collectMpesaPayment({
            firstName,
            lastName: lastName.join(' '),
            amount: invoice.total,
            email,
            phone,
            apiRef: invoice._id.toString(),
        });
    } else if (method === 'card') {
        response = await collectCardPayment({
            firstName,
            lastName: lastName.join(' '),
            amount: invoice.total,
            email,
            apiRef: invoice._id.toString(),
        });
    }

    res.status(200).json({
        ...response,
        paymentMethod: method
    });
});

/**
 * @desc    Webhook to handle payment success events from IntaSend
 * @route   POST /api/payments/webhook
 * @access  Public (secured by webhook signature)
 */
exports.handlePaymentWebhook = asyncHandler(async (req, res) => {
    // Acknowledge the webhook immediately
    res.status(200).send({ received: true });

    // Validate and parse webhook payload
    const payload = validateWebhookPayload(req.body, req.rawBody);
    if (!payload) return;

    console.log('Received IntaSend webhook payload:', payload);

    // Extract invoice and transaction IDs
    const ids = extractWebhookIds(payload);
    if (!ids) return;

    const { invoiceId, intasendInvoiceId } = ids;

    // Verify transaction with provider (don't trust the payload)
    try {
        const verifiedData = await verifyTransaction(intasendInvoiceId);

        // Only process completed payments
        if (!isTransactionComplete(verifiedData)) {
            console.log(`Ignoring webhook for invoice ${invoiceId}. Status is '${verifiedData.invoice.state}'.`);
            return;
        }

        const invoice = await Invoice.findById(invoiceId);

        if (!invoice || invoice.status === 'paid') {
            console.log(`Invoice ${invoiceId} not found or already paid. Webhook ignored.`);
            return;
        }

        // Process payment transaction
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            await processPaymentTransaction({
                invoice,
                verifiedData,
                isWebhook: true,
                session,
            });

            await session.commitTransaction();
            console.log(`Payment for invoice ${invoiceId} successfully processed and verified. Ledger entry created.`);
        } catch (dbError) {
            await session.abortTransaction();
            console.error(`Database update failed for invoice ${invoiceId} after verification:`, dbError);
        } finally {
            session.endSession();
        }
    } catch (verificationError) {
        console.error(`Webhook processing failed for invoice ${invoiceId}:`, verificationError.message);
    }
});

exports.verifyPayment = asyncHandler(async (req, res) => {
    const { invoiceId } = req.params;
    const userId = req.auth.userId;

    const invoice = await Invoice.findOne({ _id: invoiceId, user: userId });

    if (!invoice) {
        res.status(404);
        throw new Error('Invoice not found.');
    }

    validateInvoicePayable(invoice);

    try {
        const verifiedData = await verifyTransaction(invoiceId);

        if (!isTransactionComplete(verifiedData)) {
            return res.status(200).json({ message: `Payment status is '${verifiedData.invoice.state}'.` });
        }

        // Process payment transaction
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            await processPaymentTransaction({
                invoice,
                verifiedData,
                isWebhook: false,
                session,
            });

            await session.commitTransaction();
            res.status(200).json({ message: 'Payment successfully verified and invoice updated.' });
        } catch (dbError) {
            await session.abortTransaction();
            throw new Error('Database update failed after verification.');
        } finally {
            session.endSession();
        }
    } catch (verificationError) {
        throw new Error('Failed to verify payment with provider.');
    }
});
