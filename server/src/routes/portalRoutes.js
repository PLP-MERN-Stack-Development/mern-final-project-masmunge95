const express = require('express');
const router = express.Router();
const { getMyInvoices, getMyInvoiceById } = require('../controllers/portalController');
const { ClerkExpressRequireAuth } = require('@clerk/clerk-sdk-node');

// Build authorized parties list from environment variables
const authorizedParties = [];

// Add frontend URLs
if (process.env.FRONTEND_URL) {
    authorizedParties.push(process.env.FRONTEND_URL);
}

// Add CORS allowed origins
if (process.env.CORS_ALLOWED_ORIGINS) {
    const corsOrigins = process.env.CORS_ALLOWED_ORIGINS.split(',').map(origin => origin.trim());
    authorizedParties.push(...corsOrigins);
}

// Add default development URLs
if (process.env.NODE_ENV !== 'production') {
    authorizedParties.push('http://localhost:5173', 'http://localhost:4173', 'http://localhost:5174');
}

console.log('[Portal Routes] Authorized parties:', authorizedParties);

// All routes in this file are protected and intended for the logged-in user's customer portal.
// Only apply authorizedParties if we have any configured
const clerkAuth = authorizedParties.length > 0 
    ? ClerkExpressRequireAuth({ authorizedParties }) 
    : ClerkExpressRequireAuth();

router.use(clerkAuth);

router.get('/invoices', getMyInvoices);
router.get('/invoices/:id', getMyInvoiceById);
const { getMySellers } = require('../controllers/portalController');
router.get('/sellers', getMySellers);

module.exports = router;