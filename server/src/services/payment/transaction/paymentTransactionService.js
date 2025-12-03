/**
 * Payment Transaction Service
 * Handles payment record creation, wallet updates, and ledger entries
 */

const Payment = require('../../../models/Payment');
const Invoice = require('../../../models/Invoice');
const SellerWallet = require('../../../models/SellerWallet');
const PaymentLedger = require('../../../models/PaymentLedger');
const { v4: uuidv4 } = require('uuid');

/**
 * Create payment record
 */
const createPaymentRecord = async ({ invoiceId, customerId, userId, amount, transactionId, session }) => {
    const payment = new Payment({
        _id: uuidv4(),
        invoice: invoiceId,
        customer: customerId,
        user: userId,
        amount,
        provider: 'IntaSend',
        transactionId,
        status: 'completed',
    });
    
    await payment.save({ session });
    return payment;
};

/**
 * Update invoice status to paid
 */
const markInvoicePaid = async (invoice, session) => {
    invoice.status = 'paid';
    await invoice.save({ session });
};

/**
 * Update seller wallet balances
 */
const updateSellerWallet = async (sellerId, amount, session) => {
    let wallet = await SellerWallet.findOne({ seller: sellerId }).session(session);
    
    if (!wallet) {
        wallet = new SellerWallet({ seller: sellerId });
    }
    
    // Add funds to pending balance (will be moved to available after clearing period)
    wallet.pendingBalance += amount;
    wallet.totalEarnings += amount;
    wallet.stats.totalTransactions += 1;
    wallet.stats.lastPaymentDate = new Date();
    
    // Calculate average transaction value
    if (wallet.stats.totalTransactions > 0) {
        wallet.stats.averageTransactionValue = wallet.totalEarnings / wallet.stats.totalTransactions;
    }
    
    await wallet.save({ session });
    return wallet;
};

/**
 * Create payment ledger entry
 */
const createLedgerEntry = async ({
    paymentId,
    intasendInvoiceId,
    intasendTransactionId,
    sellerId,
    customerId,
    invoiceId,
    amount,
    currency = 'KES',
    wallet,
    invoice,
    isWebhook = false,
    session,
}) => {
    const ledgerEntry = new PaymentLedger({
        transactionId: `INV-${paymentId}`,
        intasendInvoiceId,
        intasendTransactionId,
        type: 'invoice_payment',
        seller: sellerId,
        customer: customerId,
        invoice: invoiceId,
        amount,
        currency,
        direction: 'credit',
        balanceAfter: wallet.pendingBalance + wallet.availableBalance + wallet.heldBalance,
        status: 'completed',
        platformFee: 0,
        processingFee: 0,
        netAmount: amount,
        metadata: {
            invoiceNumber: invoice.invoiceNumber,
            publicInvoiceId: invoice.publicInvoiceId,
            paymentId,
            webhookProcessed: isWebhook,
            manualVerification: !isWebhook,
        },
    });
    
    await ledgerEntry.save({ session });
    return ledgerEntry;
};

/**
 * Process complete payment transaction (payment record + wallet + ledger)
 */
const processPaymentTransaction = async ({
    invoice,
    verifiedData,
    isWebhook = false,
    session,
}) => {
    // Create payment record
    const payment = await createPaymentRecord({
        invoiceId: invoice._id,
        customerId: invoice.customer,
        userId: invoice.user,
        amount: verifiedData.invoice.value,
        transactionId: verifiedData.invoice.id,
        session,
    });

    // Update invoice status
    await markInvoicePaid(invoice, session);

    // Update seller wallet
    const wallet = await updateSellerWallet(
        invoice.user,
        verifiedData.invoice.value,
        session
    );

    // Create ledger entry
    await createLedgerEntry({
        paymentId: payment._id,
        intasendInvoiceId: verifiedData.invoice.invoice_id,
        intasendTransactionId: verifiedData.invoice.id,
        sellerId: invoice.user,
        customerId: invoice.customer,
        invoiceId: invoice._id,
        amount: verifiedData.invoice.value,
        currency: verifiedData.invoice.currency || 'KES',
        wallet,
        invoice,
        isWebhook,
        session,
    });

    return payment;
};

module.exports = {
    createPaymentRecord,
    markInvoicePaid,
    updateSellerWallet,
    createLedgerEntry,
    processPaymentTransaction,
};
