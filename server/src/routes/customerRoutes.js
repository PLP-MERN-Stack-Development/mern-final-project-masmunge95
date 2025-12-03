const express = require('express');
const router = express.Router();
const {
    createCustomer,
    getCustomers,
    getCustomerById,
    updateCustomer,
    deleteCustomer
} = require('../controllers/customerController');
const { ClerkExpressRequireAuth } = require('@clerk/clerk-sdk-node');
const { checkSubscription, requireLimit, trackUsage } = require('../middleware/subscriptionMiddleware');

// Define authorized parties to ensure requests from the frontend (via proxy) are trusted.
// This MUST be consistent with other routes to avoid authentication conflicts.
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
router.use(ClerkExpressRequireAuth({ authorizedParties }));

// Apply subscription check to all routes
router.use(checkSubscription);

router.route('/')
    .post(requireLimit('customers'), trackUsage('customers'), createCustomer)
    .get(getCustomers);

router.route('/:id')
    .get(getCustomerById)
    .put(updateCustomer)
    .delete(deleteCustomer);

module.exports = router;
