const express = require('express');
const router = express.Router();
const { ClerkExpressRequireAuth } = require('@clerk/clerk-sdk-node');
const { requireRole } = require('../middleware/authMiddleware');
const { 
  listAnalysisEvents, 
  reconcileBilling,
  listWithdrawalRequests,
  approveWithdrawal,
  rejectWithdrawal,
  getSellerWallet,
  getPaymentLedger,
  clearPendingBalance,
} = require('../controllers/adminController');

// Define authorized parties for Clerk middleware (reuse same logic as other routers)
const authorizedParties = ['http://localhost:5173', 'http://localhost', 'capacitor://localhost'];
if (process.env.CORS_ALLOWED_ORIGINS) {
  authorizedParties.push(...process.env.CORS_ALLOWED_ORIGINS.split(','));
}

// Require admin role for these endpoints
router.use(ClerkExpressRequireAuth({ authorizedParties }));
router.use(requireRole(['admin']));

// GET /api/admin/analysis-events?page=0&limit=50
router.get('/analysis-events', listAnalysisEvents);

// POST /api/admin/reconcile - recompute subscription counters from AnalysisEvents
router.post('/reconcile', reconcileBilling);

// Withdrawal management
router.get('/withdrawals', listWithdrawalRequests);
router.post('/withdrawals/:requestId/approve', approveWithdrawal);
router.post('/withdrawals/:requestId/reject', rejectWithdrawal);

// Seller wallet management
router.get('/wallets/:sellerId', getSellerWallet);
router.post('/wallets/:sellerId/clear-pending', clearPendingBalance);

// Payment ledger for reconciliation
router.get('/ledger', getPaymentLedger);

module.exports = router;
