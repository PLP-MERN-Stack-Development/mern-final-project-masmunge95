const WithdrawalRequest = require('../models/WithdrawalRequest');
const SellerWallet = require('../models/SellerWallet');
const PaymentLedger = require('../models/PaymentLedger');
const { processWithdrawalPayout } = require('../utils/paymentProvider');

/**
 * Security checks for automatic withdrawal approval
 */
class WithdrawalSecurityValidator {
  constructor(request, wallet) {
    this.request = request;
    this.wallet = wallet;
    this.issues = [];
  }

  /**
   * Run all security checks
   */
  async validate() {
    await this.checkWalletStatus();
    await this.checkAmountLimits();
    await this.checkFrequency();
    await this.checkWithdrawalPattern();
    await this.checkSellerReputation();
    await this.checkPaymentDetails();
    
    return {
      approved: this.issues.length === 0,
      issues: this.issues,
      riskScore: this.calculateRiskScore(),
    };
  }

  /**
   * Check if wallet is in good standing
   */
  async checkWalletStatus() {
    if (this.wallet.isSuspended) {
      this.issues.push({
        severity: 'critical',
        code: 'WALLET_SUSPENDED',
        message: 'Wallet is suspended',
      });
    }

    if (!this.wallet.isActive) {
      this.issues.push({
        severity: 'critical',
        code: 'WALLET_INACTIVE',
        message: 'Wallet is not active',
      });
    }
  }

  /**
   * Check amount limits
   */
  async checkAmountLimits() {
    // Maximum auto-approval amount (configurable)
    const MAX_AUTO_APPROVAL = parseFloat(process.env.MAX_AUTO_WITHDRAWAL_AMOUNT) || 10000; // KES 10,000
    
    if (this.request.amount > MAX_AUTO_APPROVAL) {
      this.issues.push({
        severity: 'high',
        code: 'AMOUNT_EXCEEDS_AUTO_LIMIT',
        message: `Amount ${this.request.amount} exceeds auto-approval limit ${MAX_AUTO_APPROVAL}`,
      });
    }

    // Check if amount is unusually high for this seller
    const avgWithdrawal = this.wallet.stats?.averageWithdrawal || 0;
    if (avgWithdrawal > 0 && this.request.amount > avgWithdrawal * 3) {
      this.issues.push({
        severity: 'medium',
        code: 'UNUSUAL_AMOUNT',
        message: `Amount is 3x higher than seller's average withdrawal (${avgWithdrawal})`,
      });
    }

    // Check minimum withdrawal
    if (this.request.amount < this.wallet.minimumWithdrawal) {
      this.issues.push({
        severity: 'critical',
        code: 'BELOW_MINIMUM',
        message: `Amount below minimum withdrawal ${this.wallet.minimumWithdrawal}`,
      });
    }
  }

  /**
   * Check withdrawal frequency (rate limiting)
   */
  async checkFrequency() {
    // Limit: Max 3 withdrawals per day
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentWithdrawals = await WithdrawalRequest.countDocuments({
      seller: this.request.seller,
      createdAt: { $gte: oneDayAgo },
      status: { $in: ['completed', 'processing', 'approved'] },
    });

    if (recentWithdrawals >= 3) {
      this.issues.push({
        severity: 'high',
        code: 'FREQUENCY_LIMIT_EXCEEDED',
        message: `Seller has ${recentWithdrawals} withdrawals in last 24 hours (limit: 3)`,
      });
    }

    // Check if last withdrawal was too recent (minimum 4 hours between withdrawals)
    const lastWithdrawal = await WithdrawalRequest.findOne({
      seller: this.request.seller,
      status: { $in: ['completed', 'processing'] },
    }).sort({ createdAt: -1 });

    if (lastWithdrawal) {
      const hoursSinceLastWithdrawal = (Date.now() - lastWithdrawal.createdAt) / (1000 * 60 * 60);
      if (hoursSinceLastWithdrawal < 4) {
        this.issues.push({
          severity: 'medium',
          code: 'TOO_FREQUENT',
          message: `Last withdrawal was ${hoursSinceLastWithdrawal.toFixed(1)} hours ago (minimum: 4 hours)`,
        });
      }
    }
  }

  /**
   * Check for suspicious withdrawal patterns
   */
  async checkWithdrawalPattern() {
    // Check for rapid sequential withdrawals (potential fraud)
    const last5Minutes = new Date(Date.now() - 5 * 60 * 1000);
    const veryRecentRequests = await WithdrawalRequest.countDocuments({
      seller: this.request.seller,
      createdAt: { $gte: last5Minutes },
    });

    if (veryRecentRequests > 1) {
      this.issues.push({
        severity: 'critical',
        code: 'RAPID_REQUESTS',
        message: `Multiple withdrawal requests in last 5 minutes (possible fraud)`,
      });
    }

    // Check if withdrawal details have changed recently (account switching = red flag)
    const lastCompletedWithdrawal = await WithdrawalRequest.findOne({
      seller: this.request.seller,
      status: 'completed',
    }).sort({ completedAt: -1 });

    if (lastCompletedWithdrawal && lastCompletedWithdrawal.withdrawalMethod === this.request.withdrawalMethod) {
      // Compare details
      if (this.request.withdrawalMethod === 'mpesa') {
        if (lastCompletedWithdrawal.withdrawalDetails.mpesaNumber !== this.request.withdrawalDetails.mpesaNumber) {
          this.issues.push({
            severity: 'high',
            code: 'CHANGED_PAYMENT_DETAILS',
            message: 'M-Pesa number changed from previous withdrawal',
          });
        }
      } else if (this.request.withdrawalMethod === 'bank') {
        if (lastCompletedWithdrawal.withdrawalDetails.accountNumber !== this.request.withdrawalDetails.accountNumber) {
          this.issues.push({
            severity: 'high',
            code: 'CHANGED_PAYMENT_DETAILS',
            message: 'Bank account changed from previous withdrawal',
          });
        }
      }
    }
  }

  /**
   * Check seller reputation and history
   */
  async checkSellerReputation() {
    // New sellers (account < 30 days old) require manual approval for first withdrawal
    const accountAge = Date.now() - this.wallet.createdAt;
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    
    if (accountAge < thirtyDays) {
      const completedWithdrawals = await WithdrawalRequest.countDocuments({
        seller: this.request.seller,
        status: 'completed',
      });

      if (completedWithdrawals === 0) {
        this.issues.push({
          severity: 'medium',
          code: 'NEW_SELLER_FIRST_WITHDRAWAL',
          message: 'First withdrawal for seller with account < 30 days old',
        });
      }
    }

    // Check if seller has failed withdrawals (might indicate payment detail issues)
    const failedWithdrawals = await WithdrawalRequest.countDocuments({
      seller: this.request.seller,
      status: 'failed',
    });

    if (failedWithdrawals > 2) {
      this.issues.push({
        severity: 'medium',
        code: 'MULTIPLE_FAILED_WITHDRAWALS',
        message: `Seller has ${failedWithdrawals} failed withdrawals`,
      });
    }
  }

  /**
   * Validate payment details
   */
  async checkPaymentDetails() {
    if (this.request.withdrawalMethod === 'mpesa') {
      const mpesaNumber = this.request.withdrawalDetails.mpesaNumber;
      
      // Validate Kenyan phone format (254XXXXXXXXX)
      if (!/^254[17]\d{8}$/.test(mpesaNumber)) {
        this.issues.push({
          severity: 'critical',
          code: 'INVALID_MPESA_NUMBER',
          message: `Invalid M-Pesa number format: ${mpesaNumber}`,
        });
      }
    } else if (this.request.withdrawalMethod === 'bank') {
      const { accountNumber, accountName, bankName } = this.request.withdrawalDetails;
      
      if (!accountNumber || !accountName || !bankName) {
        this.issues.push({
          severity: 'critical',
          code: 'INCOMPLETE_BANK_DETAILS',
          message: 'Bank details are incomplete',
        });
      }

      // Account number should be 10-16 digits
      if (accountNumber && !/^\d{10,16}$/.test(accountNumber)) {
        this.issues.push({
          severity: 'medium',
          code: 'SUSPICIOUS_ACCOUNT_NUMBER',
          message: 'Bank account number format looks unusual',
        });
      }
    }
  }

  /**
   * Calculate overall risk score (0-100, higher = riskier)
   */
  calculateRiskScore() {
    let score = 0;
    
    for (const issue of this.issues) {
      switch (issue.severity) {
        case 'critical':
          score += 50;
          break;
        case 'high':
          score += 25;
          break;
        case 'medium':
          score += 10;
          break;
        case 'low':
          score += 5;
          break;
      }
    }
    
    return Math.min(score, 100);
  }
}

/**
 * Process automatic withdrawal approval
 */
async function processAutoWithdrawal(requestId) {
  const request = await WithdrawalRequest.findOne({ requestId });
  
  if (!request) {
    throw new Error('Withdrawal request not found');
  }

  if (request.status !== 'pending') {
    throw new Error(`Cannot auto-process request with status: ${request.status}`);
  }

  const wallet = await SellerWallet.findOne({ seller: request.seller });
  
  if (!wallet) {
    throw new Error('Seller wallet not found');
  }

  // Run security validation
  const validator = new WithdrawalSecurityValidator(request, wallet);
  const validation = await validator.validate();

  // Log validation result
  console.log('[AutoWithdrawal] Validation result:', {
    requestId,
    approved: validation.approved,
    riskScore: validation.riskScore,
    issues: validation.issues,
  });

  // Auto-approve only if no issues
  if (!validation.approved) {
    // Mark request for manual review
    request.status = 'pending';
    request.adminNotes = `Auto-approval blocked. Issues: ${validation.issues.map(i => i.code).join(', ')}. Risk score: ${validation.riskScore}`;
    await request.save();

    return {
      success: false,
      requiresManualReview: true,
      validation,
    };
  }

  try {
    // Auto-approve (system user)
    request.status = 'approved';
    request.processedBy = 'SYSTEM_AUTO_APPROVAL';
    request.processedAt = new Date();
    request.adminNotes = `Auto-approved. Risk score: ${validation.riskScore}`;
    await request.save();

    // Mark as processing
    await request.markProcessing();

    // Process payout
    const payoutResult = await processWithdrawalPayout({
      requestId: request.requestId,
      amount: request.netAmount,
      currency: request.currency,
      method: request.withdrawalMethod,
      details: request.withdrawalDetails,
    });

    // Mark as completed
    await request.markCompleted(payoutResult);

    // Update ledger
    await PaymentLedger.findOneAndUpdate(
      { transactionId: request.ledgerTransactionId },
      { 
        status: 'completed',
        intasendTransactionId: payoutResult.transactionId,
        'metadata.processedAt': new Date(),
        'metadata.processedBy': 'SYSTEM_AUTO_APPROVAL',
        'metadata.autoApproved': true,
      }
    );

    console.log('[AutoWithdrawal] Successfully processed:', requestId);

    return {
      success: true,
      request,
      payout: payoutResult,
      validation,
    };

  } catch (payoutError) {
    console.error('[AutoWithdrawal] Payout failed:', payoutError);

    // Mark as failed
    await request.markFailed(payoutError.message, payoutError);

    // Refund to wallet
    wallet.availableBalance += request.amount;
    await wallet.save();

    // Update ledger
    await PaymentLedger.findOneAndUpdate(
      { transactionId: request.ledgerTransactionId },
      { 
        status: 'failed',
        'metadata.failedAt': new Date(),
        'metadata.failureReason': payoutError.message,
      }
    );

    throw payoutError;
  }
}

/**
 * Process all pending withdrawal requests (batch job)
 */
async function processPendingWithdrawals() {
  const pendingRequests = await WithdrawalRequest.find({
    status: 'pending',
    isAutomatic: true, // Only auto-process automatic withdrawals
  }).sort({ createdAt: 1 }); // Oldest first

  console.log(`[AutoWithdrawal] Processing ${pendingRequests.length} pending withdrawals`);

  const results = {
    processed: 0,
    approved: 0,
    manualReview: 0,
    failed: 0,
  };

  for (const request of pendingRequests) {
    try {
      const result = await processAutoWithdrawal(request.requestId);
      results.processed++;
      
      if (result.success) {
        results.approved++;
      } else if (result.requiresManualReview) {
        results.manualReview++;
      }
    } catch (error) {
      console.error(`[AutoWithdrawal] Failed to process ${request.requestId}:`, error);
      results.failed++;
    }
  }

  console.log('[AutoWithdrawal] Batch processing complete:', results);
  return results;
}

module.exports = {
  WithdrawalSecurityValidator,
  processAutoWithdrawal,
  processPendingWithdrawals,
};
