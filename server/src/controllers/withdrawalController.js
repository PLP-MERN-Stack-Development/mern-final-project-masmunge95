const SellerWallet = require('../models/SellerWallet');
const WithdrawalRequest = require('../models/WithdrawalRequest');
const PaymentLedger = require('../models/PaymentLedger');
const { processAutoWithdrawal } = require('../services/autoWithdrawalService');
const { FeeCalculator } = require('../services/feeService');

/**
 * Get seller's wallet details
 */
const getWallet = async (req, res) => {
  try {
    const { userId } = req.auth;
    
    console.log('[Wallet] Getting wallet for user:', userId);
    
    if (!userId) {
      console.error('[Wallet] No userId in req.auth');
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }
    
    let wallet = await SellerWallet.findOne({ seller: userId });
    
    // Create wallet if doesn't exist
    if (!wallet) {
      console.log('[Wallet] Creating new wallet for user:', userId);
      wallet = new SellerWallet({ seller: userId });
      await wallet.save();
    }
    
    console.log('[Wallet] Returning wallet data:', {
      availableBalance: wallet.availableBalance,
      pendingBalance: wallet.pendingBalance,
      totalEarnings: wallet.totalEarnings,
    });
    
    res.json({
      success: true,
      wallet: {
        availableBalance: wallet.availableBalance,
        pendingBalance: wallet.pendingBalance,
        heldBalance: wallet.heldBalance,
        totalEarnings: wallet.totalEarnings,
        totalWithdrawals: wallet.totalWithdrawals,
        currency: wallet.currency,
        withdrawalMethod: wallet.withdrawalMethod,
        withdrawalDetails: wallet.withdrawalDetails,
        minimumWithdrawal: wallet.minimumWithdrawal,
        autoWithdraw: wallet.autoWithdraw,
        stats: wallet.stats,
        isActive: wallet.isActive,
        isSuspended: wallet.isSuspended,
      },
    });
  } catch (error) {
    console.error('Get wallet error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Update withdrawal method and details
 */
const updateWithdrawalMethod = async (req, res) => {
  try {
    const { userId } = req.auth;
    const { withdrawalMethod, withdrawalDetails } = req.body;
    
    const wallet = await SellerWallet.findOne({ seller: userId });
    if (!wallet) {
      return res.status(404).json({
        success: false,
        error: 'Wallet not found',
      });
    }
    
    // Validate withdrawal method
    const validMethods = ['mpesa', 'bank', 'intasend_wallet'];
    if (!validMethods.includes(withdrawalMethod)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid withdrawal method',
      });
    }
    
    // Validate required fields based on method
    if (withdrawalMethod === 'mpesa' && !withdrawalDetails.mpesaNumber) {
      return res.status(400).json({
        success: false,
        error: 'M-Pesa number is required',
      });
    }
    
    if (withdrawalMethod === 'bank' && 
        (!withdrawalDetails.bankName || !withdrawalDetails.accountNumber || !withdrawalDetails.accountName)) {
      return res.status(400).json({
        success: false,
        error: 'Bank details are incomplete',
      });
    }
    
    if (withdrawalMethod === 'intasend_wallet' && !withdrawalDetails.walletEmail) {
      return res.status(400).json({
        success: false,
        error: 'Wallet email is required',
      });
    }
    
    wallet.withdrawalMethod = withdrawalMethod;
    wallet.withdrawalDetails = withdrawalDetails;
    await wallet.save();
    
    res.json({
      success: true,
      message: 'Withdrawal method updated',
      wallet: {
        withdrawalMethod: wallet.withdrawalMethod,
        withdrawalDetails: wallet.withdrawalDetails,
      },
    });
  } catch (error) {
    console.error('Update withdrawal method error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Request a withdrawal
 */
const requestWithdrawal = async (req, res) => {
  try {
    const { userId } = req.auth;
    const { amount, notes } = req.body;
    
    // Validate amount
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid withdrawal amount',
      });
    }
    
    const wallet = await SellerWallet.findOne({ seller: userId });
    if (!wallet) {
      return res.status(404).json({
        success: false,
        error: 'Wallet not found',
      });
    }
    
    // Check if can withdraw
    if (!wallet.canWithdraw(amount)) {
      return res.status(400).json({
        success: false,
        error: `Cannot withdraw. Reasons: 
          - Minimum withdrawal: ${wallet.minimumWithdrawal} ${wallet.currency}
          - Available balance: ${wallet.availableBalance} ${wallet.currency}
          - Wallet active: ${wallet.isActive}
          - Wallet suspended: ${wallet.isSuspended}`,
      });
    }
    
    // Check if withdrawal method is configured
    if (!wallet.withdrawalMethod || !wallet.withdrawalDetails) {
      return res.status(400).json({
        success: false,
        error: 'Please configure your withdrawal method first',
      });
    }
    
    // Calculate fees using centralized fee service
    const feeCalculation = FeeCalculator.withdrawal(amount, wallet.withdrawalMethod);
    
    const platformFee = feeCalculation.platformFee;
    const processingFee = feeCalculation.processingFee;
    const netAmount = feeCalculation.netToSeller;
    
    if (netAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Amount too small after fees',
        feeBreakdown: feeCalculation.breakdown,
      });
    }
    
    // Create withdrawal request
    const requestId = WithdrawalRequest.generateRequestId();
    
    const withdrawalRequest = new WithdrawalRequest({
      requestId,
      seller: userId,
      amount,
      currency: wallet.currency,
      withdrawalMethod: wallet.withdrawalMethod,
      withdrawalDetails: wallet.withdrawalDetails,
      platformFee,
      processingFee,
      netAmount,
      sellerNotes: notes,
      isAutomatic: false,
    });
    
    await withdrawalRequest.save();
    
    // Deduct from available balance immediately (hold until processed)
    await wallet.withdraw(amount);
    
    // Create ledger entry
    const ledgerEntry = new PaymentLedger({
      transactionId: `WD-${requestId}`,
      type: 'withdrawal',
      seller: userId,
      amount,
      currency: wallet.currency,
      direction: 'debit',
      balanceAfter: wallet.availableBalance,
      status: 'pending',
      platformFee,
      processingFee,
      netAmount,
      metadata: {
        withdrawalRequestId: requestId,
        withdrawalMethod: wallet.withdrawalMethod,
      },
    });
    
    await ledgerEntry.save();
    
    withdrawalRequest.ledgerTransactionId = ledgerEntry.transactionId;
    await withdrawalRequest.save();
    
    // Attempt automatic approval
    let autoApprovalResult = null;
    const autoApprovalEnabled = process.env.AUTO_WITHDRAWAL_APPROVAL === 'true';
    
    if (autoApprovalEnabled) {
      try {
        console.log(`[Withdrawal] Attempting auto-approval for ${requestId}`);
        autoApprovalResult = await processAutoWithdrawal(requestId);
        
        if (autoApprovalResult.success) {
          console.log(`[Withdrawal] Auto-approved and processed: ${requestId}`);
          return res.json({
            success: true,
            message: 'Withdrawal request approved and processed automatically',
            request: {
              requestId: withdrawalRequest.requestId,
              amount: withdrawalRequest.amount,
              platformFee: withdrawalRequest.platformFee,
              processingFee: withdrawalRequest.processingFee,
              netAmount: withdrawalRequest.netAmount,
              status: 'completed',
              autoApproved: true,
            },
            newBalance: wallet.availableBalance,
          });
        } else if (autoApprovalResult.requiresManualReview) {
          console.log(`[Withdrawal] Auto-approval blocked, requires manual review: ${requestId}`);
        }
      } catch (autoError) {
        console.error(`[Withdrawal] Auto-approval failed for ${requestId}:`, autoError);
        // Continue to return pending status
      }
    }
    
    res.json({
      success: true,
      message: autoApprovalEnabled && autoApprovalResult?.requiresManualReview 
        ? 'Withdrawal request created. Requires manual review due to security checks.'
        : 'Withdrawal request created. Awaiting approval.',
      request: {
        requestId: withdrawalRequest.requestId,
        amount: withdrawalRequest.amount,
        platformFee: withdrawalRequest.platformFee,
        processingFee: withdrawalRequest.processingFee,
        netAmount: withdrawalRequest.netAmount,
        status: withdrawalRequest.status,
        createdAt: withdrawalRequest.createdAt,
        requiresManualReview: autoApprovalResult?.requiresManualReview || false,
        securityIssues: autoApprovalResult?.validation?.issues?.map(i => i.message) || [],
      },
      newBalance: wallet.availableBalance,
    });
  } catch (error) {
    console.error('Request withdrawal error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Get withdrawal requests for seller
 */
const getWithdrawalRequests = async (req, res) => {
  try {
    const { userId } = req.auth;
    const { status, limit = 50, offset = 0 } = req.query;
    
    const query = { seller: userId };
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
    console.error('Get withdrawal requests error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Get single withdrawal request details
 */
const getWithdrawalRequest = async (req, res) => {
  try {
    const { userId } = req.auth;
    const { requestId } = req.params;
    
    const request = await WithdrawalRequest.findOne({ 
      requestId,
      seller: userId,
    });
    
    if (!request) {
      return res.status(404).json({
        success: false,
        error: 'Withdrawal request not found',
      });
    }
    
    res.json({
      success: true,
      request,
    });
  } catch (error) {
    console.error('Get withdrawal request error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Cancel withdrawal request (only if pending)
 */
const cancelWithdrawalRequest = async (req, res) => {
  try {
    const { userId } = req.auth;
    const { requestId } = req.params;
    
    const request = await WithdrawalRequest.findOne({ 
      requestId,
      seller: userId,
    });
    
    if (!request) {
      return res.status(404).json({
        success: false,
        error: 'Withdrawal request not found',
      });
    }
    
    if (request.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: `Cannot cancel request with status: ${request.status}`,
      });
    }
    
    // Refund to wallet
    const wallet = await SellerWallet.findOne({ seller: userId });
    wallet.availableBalance += request.amount;
    await wallet.save();
    
    // Update request status
    request.status = 'rejected';
    request.rejectionReason = 'Cancelled by seller';
    await request.save();
    
    // Update ledger entry
    await PaymentLedger.findOneAndUpdate(
      { transactionId: request.ledgerTransactionId },
      { 
        status: 'cancelled',
        'metadata.cancelledAt': new Date(),
        'metadata.cancelledBy': userId,
      }
    );
    
    res.json({
      success: true,
      message: 'Withdrawal request cancelled',
      refundedAmount: request.amount,
      newBalance: wallet.availableBalance,
    });
  } catch (error) {
    console.error('Cancel withdrawal request error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Get transaction history (ledger entries)
 */
const getTransactionHistory = async (req, res) => {
  try {
    const { userId } = req.auth;
    const { type, status, limit = 50, offset = 0 } = req.query;
    
    const query = { seller: userId };
    if (type) {
      query.type = type;
    }
    if (status) {
      query.status = status;
    }
    
    const transactions = await PaymentLedger.find(query)
      .sort({ transactionDate: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset));
    
    const total = await PaymentLedger.countDocuments(query);
    
    res.json({
      success: true,
      transactions,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
      },
    });
  } catch (error) {
    console.error('Get transaction history error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

module.exports = {
  getWallet,
  updateWithdrawalMethod,
  requestWithdrawal,
  getWithdrawalRequests,
  getWithdrawalRequest,
  cancelWithdrawalRequest,
  getTransactionHistory,
};
