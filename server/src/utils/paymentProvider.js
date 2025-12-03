const IntaSend = require('intasend-node');

// Initialize the Intasend client with your credentials from .env
// The last argument `true` sets it to the test environment.
const intasend = new IntaSend(
    process.env.INTASEND_PUBLISHABLE_KEY,
    process.env.INTASEND_SECRET_KEY,
    true 
);

// USD to KSH exchange rate (approximate - should be updated from live API in production)
const USD_TO_KSH_RATE = 130;

/**
 * Converts USD amount to KSH
 * @param {number} usdAmount - Amount in USD
 * @returns {number} Amount in KSH
 */
const convertUsdToKsh = (usdAmount) => {
    return Math.round(usdAmount * USD_TO_KSH_RATE);
};

/**
 * Creates a checkout URL with Intasend.
 * @param {object} options - Options for creating the checkout.
 * @param {number} options.amount - The amount to charge.
 * @param {string} options.currency - The currency code (e.g., 'usd').
 * @param {string} options.api_ref - Your internal reference for the transaction (e.g., orderId).
 * @returns {Promise<string>} The payment link URL from Intasend.
 */
const createIntasendCheckout = async ({ amount, currency, api_ref }) => {
    try {
        const response = await intasend.checkout.create({
            amount,
            currency,
            api_ref,
            // 'service' can be specified here, e.g., 'MPESA', 'CARD'
            // 'host' is your frontend URL where user is redirected after payment
            host: process.env.FRONTEND_URL || 'http://localhost:3000',
        });
        // Intasend returns a payment link in the response
        return response.data.payment_link;
    } catch (error) {
        console.error('Intasend SDK Error:', error.message);
        throw new Error('Failed to create payment checkout.');
    }
};

/*
 * As per research, IntaSend does not use cryptographic webhook signing secrets in a verifiable way.
 * The `intasend.signature.verify` method is therefore not used.
 * Instead, we will verify transactions by making a direct API call.
 */

/**
 * Verifies a transaction's status by calling the IntaSend API directly.
 * This is the secure way to confirm a payment.
 * @param {string} invoiceId - The invoice ID used as the `api_ref`.
 * @returns {Promise<object>} The verified transaction data from IntaSend.
 */
const verifyTransaction = async (invoiceId) => {
    try {
        const response = await intasend.collection().status(invoiceId);
        return response;
    } catch (error) {
        console.error(`IntaSend API verification failed for invoice ${invoiceId}:`, error.message);
        throw new Error('Failed to verify transaction with provider.');
    }
};

const collectMpesaPayment = async ({ amount, currency, email, phone_number, api_ref, first_name, last_name }) => {
    try {
        const collection = intasend.collection();
        const response = await collection.mpesaStkPush({
            first_name,
            last_name,
            email,
            host: process.env.FRONTEND_URL || 'http://localhost:3000',
            amount,
            phone_number,
            api_ref,
            currency
        });
        return response;
    } catch (error) {
        console.error('Intasend SDK Error:', error.message);
        throw new Error('Failed to initiate M-Pesa payment.');
    }
};

/**
 * Creates a card payment checkout with IntaSend.
 * @param {object} options - Options for creating the card payment.
 * @param {number} options.amount - The amount to charge.
 * @param {string} options.currency - The currency code (e.g., 'KES', 'USD').
 * @param {string} options.email - Customer email address.
 * @param {string} options.api_ref - Your internal reference for the transaction (e.g., invoiceId).
 * @param {string} options.first_name - Customer first name.
 * @param {string} options.last_name - Customer last name.
 * @returns {Promise<object>} The checkout response with payment URL.
 */
const collectCardPayment = async ({ amount, currency, email, api_ref, first_name, last_name }) => {
    try {
        const collection = intasend.collection();
        const response = await collection.charge({
            first_name,
            last_name,
            email,
            host: process.env.FRONTEND_URL || 'http://localhost:3000',
            amount,
            currency,
            api_ref,
            method: 'CARD-PAYMENT', // Only show card payment option
            redirect_url: process.env.FRONTEND_URL || 'http://localhost:3000'
        });
        return response;
    } catch (error) {
        console.error('Intasend Card Payment Error:', error.message);
        throw new Error('Failed to initiate card payment.');
    }
};

/**
 * Process payment for subscriptions - converts USD to KSH and initiates payment
 * @param {object} options - Payment options
 * @param {number} options.amount - Amount in USD
 * @param {string} options.currency - Original currency (USD for subscriptions)
 * @param {string} options.email - Customer email
 * @param {string} options.phoneNumber - Phone number for M-Pesa
 * @param {string} options.method - Payment method (MPESA or CARD)
 * @param {object} options.metadata - Additional metadata (userId, tier, type, etc.)
 * @returns {Promise<object>} Payment result with success status and transaction details
 */
const processPayment = async ({ amount, currency, email, phoneNumber, method, metadata }) => {
    try {
        // Convert USD to KSH for Instasend (Instasend requires KES)
        const amountInKsh = currency === 'USD' ? convertUsdToKsh(amount) : amount;
        const paymentCurrency = 'KES'; // Instasend uses KES

        console.log(`Processing ${method} payment: $${amount} USD = ${amountInKsh} KSH`);

        // Generate unique API reference
        const api_ref = `sub_${metadata.userId}_${Date.now()}`;

        let response;

        if (method === 'MPESA') {
            // M-Pesa payment
            response = await collectMpesaPayment({
                amount: amountInKsh,
                currency: paymentCurrency,
                email,
                phone_number: phoneNumber,
                api_ref,
                first_name: metadata.firstName || 'Subscriber',
                last_name: metadata.lastName || 'User',
            });

            return {
                success: true,
                message: 'M-Pesa payment initiated successfully',
                transactionId: response.invoice?.invoice_id || api_ref,
                paymentUrl: response.invoice?.api_ref || null,
                amountUsd: amount,
                amountKsh: amountInKsh,
            };
        } else if (method === 'CARD') {
            // Card payment
            response = await collectCardPayment({
                amount: amountInKsh,
                currency: paymentCurrency,
                email,
                api_ref,
                first_name: metadata.firstName || 'Subscriber',
                last_name: metadata.lastName || 'User',
            });

            return {
                success: true,
                message: 'Card payment initiated successfully',
                transactionId: response.invoice?.invoice_id || api_ref,
                paymentUrl: response.checkout?.url || response.url || null,
                amountUsd: amount,
                amountKsh: amountInKsh,
            };
        } else {
            throw new Error(`Unsupported payment method: ${method}`);
        }
    } catch (error) {
        console.error('Payment processing error:', error);
        return {
            success: false,
            message: error.message || 'Payment processing failed',
            error: error.message,
        };
    }
};

/**
 * Process withdrawal payout to seller
 * @param {object} options - Payout options
 * @param {string} options.requestId - Withdrawal request ID
 * @param {number} options.amount - Amount to payout (net after fees)
 * @param {string} options.currency - Currency (KES or USD)
 * @param {string} options.method - Payout method (mpesa, bank, intasend_wallet)
 * @param {object} options.details - Payout details (phone, account, etc.)
 * @returns {Promise<object>} Payout result with transaction ID
 */
const processWithdrawalPayout = async ({ requestId, amount, currency, method, details }) => {
    try {
        // Convert to KSH if in USD
        const amountInKsh = currency === 'USD' ? convertUsdToKsh(amount) : amount;
        
        console.log(`Processing ${method} payout: ${amount} ${currency} = ${amountInKsh} KSH`);
        
        // IntaSend payouts API
        const payouts = intasend.payouts();
        
        let response;
        
        if (method === 'mpesa') {
            // M-Pesa payout
            response = await payouts.mpesa({
                currency: 'KES',
                transactions: [
                    {
                        name: 'Seller Withdrawal',
                        account: details.mpesaNumber,
                        amount: amountInKsh,
                        narrative: `Withdrawal ${requestId}`,
                    }
                ]
            });
            
            return {
                success: true,
                transactionId: response.tracking_id || response.id || requestId,
                method: 'mpesa',
                amount: amountInKsh,
                currency: 'KES',
                status: response.status || 'processing',
                response,
            };
            
        } else if (method === 'bank') {
            // Bank payout
            response = await payouts.bank({
                currency: 'KES',
                transactions: [
                    {
                        name: details.accountName,
                        account: details.accountNumber,
                        amount: amountInKsh,
                        narrative: `Withdrawal ${requestId}`,
                        bank_code: details.branchCode || details.bankName,
                    }
                ]
            });
            
            return {
                success: true,
                transactionId: response.tracking_id || response.id || requestId,
                method: 'bank',
                amount: amountInKsh,
                currency: 'KES',
                status: response.status || 'processing',
                response,
            };
            
        } else if (method === 'intasend_wallet') {
            // IntaSend wallet payout
            response = await payouts.intasendTransfer({
                currency: 'KES',
                transactions: [
                    {
                        name: 'Seller Withdrawal',
                        account: details.walletEmail,
                        amount: amountInKsh,
                        narrative: `Withdrawal ${requestId}`,
                    }
                ]
            });
            
            return {
                success: true,
                transactionId: response.tracking_id || response.id || requestId,
                method: 'intasend_wallet',
                amount: amountInKsh,
                currency: 'KES',
                status: response.status || 'processing',
                response,
            };
            
        } else {
            throw new Error(`Unsupported payout method: ${method}`);
        }
        
    } catch (error) {
        console.error('Payout processing error:', error);
        throw new Error(`Payout failed: ${error.message}`);
    }
};

module.exports = { 
    createIntasendCheckout, 
    verifyTransaction, 
    collectMpesaPayment, 
    collectCardPayment,
    processPayment,
    convertUsdToKsh,
    processWithdrawalPayout,
};