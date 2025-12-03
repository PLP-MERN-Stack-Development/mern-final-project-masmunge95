const express = require('express');
const router = express.Router();
const {
    createInvoice,
    getInvoices,
    getInvoiceById,
    updateInvoice,
    deleteInvoice,
    sendInvoice,
    createInvoiceDispute,
    getDisputedInvoices,
    resolveInvoiceDispute,
    getInvoiceDisputes
} = require('../controllers/invoiceController');
const { ClerkExpressRequireAuth } = require('@clerk/clerk-sdk-node');
const { checkSubscription, requireLimit, trackUsage } = require('../middleware/subscriptionMiddleware');

// Define authorized parties for Clerk middleware
// `CORS_ALLOWED_ORIGINS` in .env is a comma-separated string; split it so Clerk receives
// individual origin strings rather than a single combined string which won't match.
const envOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

const authorizedParties = Array.from(new Set([
    process.env.FRONTEND_URL || 'http://localhost:5173',
    'http://localhost', // Capacitor Android
    'capacitor://localhost', // Capacitor iOS
    ...envOrigins,
]));

// All routes in this file are protected
router.use(ClerkExpressRequireAuth({ authorizedParties: authorizedParties }));

// Apply subscription check to all routes
router.use(checkSubscription);

router.route('/')
    .post(requireLimit('invoices'), trackUsage('invoices'), createInvoice)
    .get(getInvoices);

// Dispute routes - MUST be before /:id routes to avoid matching "disputed" as an ID
router.get('/disputed', getDisputedInvoices);

router.route('/:id')
    .get(getInvoiceById)
    .put(updateInvoice)
    .delete(deleteInvoice);

router.route('/:id/send').post(sendInvoice);

// Dispute routes for specific invoices
router.post('/:id/dispute', createInvoiceDispute);
router.get('/:id/disputes', getInvoiceDisputes);
router.put('/:id/resolve-dispute', resolveInvoiceDispute);

module.exports = router;
