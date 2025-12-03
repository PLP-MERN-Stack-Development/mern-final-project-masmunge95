const express = require('express');
const router = express.Router();
const {
    makePayment,
    handlePaymentWebhook,
    verifyPayment
} = require('../controllers/paymentController');
const { ClerkExpressRequireAuth } = require('@clerk/clerk-sdk-node');

// Define authorized parties to ensure requests from the frontend (via proxy) are trusted.
const authorizedParties = [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    'http://localhost', // Capacitor Android
    'capacitor://localhost', // Capacitor iOS
    process.env.CORS_ALLOWED_ORIGINS
].filter(Boolean);

// Protected route to initiate a payment for an invoice
router.post('/pay', ClerkExpressRequireAuth({ authorizedParties }), makePayment);

// Protected route to manually verify a payment for an invoice
router.post('/verify/:invoiceId', ClerkExpressRequireAuth({ authorizedParties }), verifyPayment);

// Public webhook route for IntaSend.
// It needs the raw body to verify the signature, so we use express.raw() before the JSON parser.
router.post('/webhook', handlePaymentWebhook);


module.exports = router;
