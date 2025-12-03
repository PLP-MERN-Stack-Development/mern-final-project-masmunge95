const express = require('express');
const { ClerkExpressRequireAuth } = require('@clerk/clerk-sdk-node');
const {
  getWallet,
  updateWithdrawalMethod,
  requestWithdrawal,
  getWithdrawalRequests,
  getWithdrawalRequest,
  cancelWithdrawalRequest,
  getTransactionHistory,
} = require('../controllers/withdrawalController');

const router = express.Router();

// Define authorized parties for Clerk middleware
const authorizedParties = ['http://localhost:5173', 'http://localhost', 'capacitor://localhost'];
if (process.env.CORS_ALLOWED_ORIGINS) {
  authorizedParties.push(...process.env.CORS_ALLOWED_ORIGINS.split(','));
}

// All routes require authentication
router.use(ClerkExpressRequireAuth({ authorizedParties }));

// Wallet endpoints
router.get('/wallet', getWallet);
router.put('/wallet/withdrawal-method', updateWithdrawalMethod);

// Withdrawal request endpoints
router.post('/withdrawal/request', requestWithdrawal);
router.get('/withdrawal/requests', getWithdrawalRequests);
router.get('/withdrawal/requests/:requestId', getWithdrawalRequest);
router.post('/withdrawal/requests/:requestId/cancel', cancelWithdrawalRequest);

// Transaction history
router.get('/transactions', getTransactionHistory);

module.exports = router;
