const AnalysisEvent = require('../models/AnalysisEvent');
const Subscription = require('../models/Subscription');
const WithdrawalRequest = require('../models/WithdrawalRequest');
const SellerWallet = require('../models/SellerWallet');
const PaymentLedger = require('../models/PaymentLedger');
const { processWithdrawalPayout } = require('../utils/paymentProvider');
const { manualClearPending } = require('../services/walletScheduler');

// List AnalysisEvents with simple pagination
exports.listAnalysisEvents = async (req, res) => {
  try {
    const page = Math.max(0, parseInt(req.query.page) || 0);
    const limit = Math.min(100, parseInt(req.query.limit) || 50);
    const skip = page * limit;

    console.log('[Admin] Loading analysis events, page:', page, 'limit:', limit);
    const startTime = Date.now();

    // Run query and count in parallel
    const [events, total] = await Promise.all([
      AnalysisEvent.find({})
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('sellerId recordId docType billedToSeller billedToCustomer createdAt') // Only select needed fields
        .lean(),
      AnalysisEvent.estimatedDocumentCount() // Much faster than countDocuments for total count
    ]);

    const queryTime = Date.now() - startTime;
    console.log('[Admin] Loaded', events.length, 'events in', queryTime, 'ms');

    res.json({ page, limit, total, data: events });
  } catch (err) {
    console.error('[Admin] listAnalysisEvents error', err);
    res.status(500).json({ error: 'Failed to list analysis events' });
  }
};

// Reconcile Subscription usage counters from AnalysisEvent billed flags
exports.reconcileBilling = async (req, res) => {
  try {
    // Aggregate counts per sellerId
    const agg = await AnalysisEvent.aggregate([
      {
        $group: {
          _id: '$sellerId',
          billedToSellerCount: { $sum: { $cond: ['$billedToSeller', 1, 0] } },
          billedToCustomerCount: { $sum: { $cond: ['$billedToCustomer', 1, 0] } },
        }
      }
    ]).exec();

    const results = [];
    for (const row of agg) {
      const userId = row._id;
      const sellerCount = row.billedToSellerCount || 0;
      const customerCount = row.billedToCustomerCount || 0;

      const updated = await Subscription.findOneAndUpdate(
        { userId },
        { $set: { 'usage.ocrScans': sellerCount, 'usage.customerOcrScans': customerCount } },
        { new: true }
      ).lean();

      results.push({ userId, sellerCount, customerCount, updated: !!updated });
    }

    res.json({ reconciled: results.length, details: results });
  } catch (err) {
    console.error('[Admin] reconcileBilling error', err);
    res.status(500).json({ error: 'Failed to reconcile billing' });
  }
};

/**
 * Admin: Get all withdrawal requests
 */
exports.listWithdrawalRequests = async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;
    
    const query = {};
    if (status) {
      query.status = status;
    }
    
    const requests = await WithdrawalRequest.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset));
    
    const total = await WithdrawalRequest.countDocuments(query);
    
    res.json({
      success: true,
      requests,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
      },
    });
  } catch (error) {
    console.error('[Admin] List withdrawal requests error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Admin: Approve withdrawal request and process payout
 */
exports.approveWithdrawal = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { userId } = req.auth; // Admin user ID
    
    const request = await WithdrawalRequest.findOne({ requestId });
    
    if (!request) {
      return res.status(404).json({
        success: false,
        error: 'Withdrawal request not found',
      });
    }
    
    if (request.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: `Cannot approve request with status: ${request.status}`,
      });
    }
    
    // Mark as approved
    await request.approve(userId);
    
    // Process payout via IntaSend
    try {
      await request.markProcessing();
      
      const payoutResult = await processWithdrawalPayout({
        requestId: request.requestId,
        amount: request.netAmount,
        currency: request.currency,
        method: request.withdrawalMethod,
        details: request.withdrawalDetails,
      });
      
      // Mark as completed
      await request.markCompleted(payoutResult);
      
      // Update ledger entry
      await PaymentLedger.findOneAndUpdate(
        { transactionId: request.ledgerTransactionId },
        { 
          status: 'completed',
          intasendTransactionId: payoutResult.transactionId,
          'metadata.processedAt': new Date(),
          'metadata.processedBy': userId,
        }
      );
      
      res.json({
        success: true,
        message: 'Withdrawal approved and processed',
        request,
        payout: payoutResult,
      });
      
    } catch (payoutError) {
      console.error('Payout processing error:', payoutError);
      
      // Mark as failed
      await request.markFailed(payoutError.message, payoutError);
      
      // Refund to wallet
      const wallet = await SellerWallet.findOne({ seller: request.seller });
      wallet.availableBalance += request.amount;
      await wallet.save();
      
      // Update ledger entry
      await PaymentLedger.findOneAndUpdate(
        { transactionId: request.ledgerTransactionId },
        { 
          status: 'failed',
          'metadata.failedAt': new Date(),
          'metadata.failureReason': payoutError.message,
        }
      );
      
      res.status(500).json({
        success: false,
        error: 'Payout processing failed',
        details: payoutError.message,
        refunded: true,
      });
    }
    
  } catch (error) {
    console.error('[Admin] Approve withdrawal error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Admin: Reject withdrawal request
 */
exports.rejectWithdrawal = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { userId } = req.auth; // Admin user ID
    const { reason } = req.body;
    
    if (!reason) {
      return res.status(400).json({
        success: false,
        error: 'Rejection reason is required',
      });
    }
    
    const request = await WithdrawalRequest.findOne({ requestId });
    
    if (!request) {
      return res.status(404).json({
        success: false,
        error: 'Withdrawal request not found',
      });
    }
    
    if (request.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: `Cannot reject request with status: ${request.status}`,
      });
    }
    
    // Mark as rejected
    await request.reject(userId, reason);
    
    // Refund to wallet
    const wallet = await SellerWallet.findOne({ seller: request.seller });
    wallet.availableBalance += request.amount;
    await wallet.save();
    
    // Update ledger entry
    await PaymentLedger.findOneAndUpdate(
      { transactionId: request.ledgerTransactionId },
      { 
        status: 'rejected',
        'metadata.rejectedAt': new Date(),
        'metadata.rejectedBy': userId,
        'metadata.rejectionReason': reason,
      }
    );
    
    res.json({
      success: true,
      message: 'Withdrawal request rejected',
      refundedAmount: request.amount,
    });
    
  } catch (error) {
    console.error('[Admin] Reject withdrawal error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Admin: Get seller wallet details
 */
exports.getSellerWallet = async (req, res) => {
  try {
    const { sellerId } = req.params;
    
    const wallet = await SellerWallet.findOne({ seller: sellerId });
    
    if (!wallet) {
      return res.status(404).json({
        success: false,
        error: 'Wallet not found',
      });
    }
    
    res.json({
      success: true,
      wallet,
    });
  } catch (error) {
    console.error('[Admin] Get seller wallet error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Admin: Get payment ledger for reconciliation
 */
exports.getPaymentLedger = async (req, res) => {
  try {
    const { seller, type, status, startDate, endDate, limit = 100, offset = 0 } = req.query;
    
    const query = {};
    
    if (seller) {
      query.seller = seller;
    }
    
    if (type) {
      query.type = type;
    }
    
    if (status) {
      query.status = status;
    }
    
    if (startDate || endDate) {
      query.transactionDate = {};
      if (startDate) {
        query.transactionDate.$gte = new Date(startDate);
      }
      if (endDate) {
        query.transactionDate.$lte = new Date(endDate);
      }
    }
    
    const entries = await PaymentLedger.find(query)
      .sort({ transactionDate: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset));
    
    const total = await PaymentLedger.countDocuments(query);
    
    // Calculate summary statistics
    const summary = await PaymentLedger.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$type',
          totalAmount: { $sum: '$amount' },
          totalPlatformFees: { $sum: '$platformFee' },
          totalProcessingFees: { $sum: '$processingFee' },
          count: { $sum: 1 },
        },
      },
    ]);
    
    res.json({
      success: true,
      entries,
      summary,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
      },
    });
  } catch (error) {
    console.error('[Admin] Get payment ledger error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Admin: Manually clear pending balance for a seller
 */
exports.clearPendingBalance = async (req, res) => {
  try {
    const { sellerId } = req.params;
    const { amount } = req.body; // Optional: specific amount to clear
    
    const result = await manualClearPending(sellerId, amount);
    
    res.json({
      success: true,
      message: 'Pending balance cleared successfully',
      ...result,
    });
  } catch (error) {
    console.error('[Admin] Clear pending balance error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
