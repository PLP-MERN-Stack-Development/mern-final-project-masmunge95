/**
 * Payment Provider Service
 * Handles integration with IntaSend payment provider
 */

const paymentProvider = require('../../../utils/paymentProvider');

/**
 * Initiate M-Pesa payment collection
 */
const collectMpesaPayment = async ({ firstName, lastName, amount, email, phone, apiRef }) => {
    return await paymentProvider.collectMpesaPayment({
        first_name: firstName,
        last_name: lastName,
        amount,
        currency: 'KES',
        email,
        phone_number: phone,
        api_ref: apiRef,
    });
};

/**
 * Initiate card payment collection
 */
const collectCardPayment = async ({ firstName, lastName, amount, email, apiRef }) => {
    return await paymentProvider.collectCardPayment({
        first_name: firstName,
        last_name: lastName,
        amount,
        currency: 'KES',
        email,
        api_ref: apiRef,
    });
};

/**
 * Verify transaction with payment provider
 */
const verifyTransaction = async (invoiceId) => {
    return await paymentProvider.verifyTransaction(invoiceId);
};

/**
 * Check if verified transaction is complete
 */
const isTransactionComplete = (verifiedData) => {
    return verifiedData.invoice.state === 'COMPLETE';
};

module.exports = {
    collectMpesaPayment,
    collectCardPayment,
    verifyTransaction,
    isTransactionComplete,
};
