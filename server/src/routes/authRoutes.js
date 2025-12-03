const express = require('express');
const router = express.Router();
const { ClerkExpressRequireAuth } = require('@clerk/clerk-sdk-node');
const { whoami } = require('../controllers/authController');

// Define authorized parties (reuse same origins pattern as other routers)
const authorizedParties = ['http://localhost:5173', 'http://localhost', 'capacitor://localhost'];
if (process.env.CORS_ALLOWED_ORIGINS) {
  authorizedParties.push(...process.env.CORS_ALLOWED_ORIGINS.split(','));
}

// In dev we allow DEV_TEST_SELLER_ID bypass in ocrRoutes; here we require auth
const authMiddleware = process.env.DEV_TEST_SELLER_ID ? (req, res, next) => { req.auth = req.auth || {}; req.auth.userId = req.auth.userId || process.env.DEV_TEST_SELLER_ID; return next(); } : ClerkExpressRequireAuth({ authorizedParties });

router.get('/whoami', authMiddleware, whoami);

module.exports = router;
