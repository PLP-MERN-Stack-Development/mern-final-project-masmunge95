const mongoose = require('mongoose');

/**
 * WithdrawalRequest - Tracks seller withdrawal requests and processing
 */
const withdrawalRequestSchema = new mongoose.Schema({
  requestId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  
  seller: {
    type: String, // Clerk user ID
    required: true,
    index: true,
  },
  
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
  
  currency: {
    type: String,
    default: 'KES',
    enum: ['KES', 'USD'],
  },
  
  // Withdrawal method details (snapshot at request time)
  withdrawalMethod: {
    type: String,
    required: true,
    enum: ['mpesa', 'bank', 'intasend_wallet'],
  },
  
  withdrawalDetails: {
    // M-Pesa
    mpesaNumber: String,
    
    // Bank
    bankName: String,
    accountNumber: String,
    accountName: String,
    branchCode: String,
    
    // IntaSend wallet
    walletEmail: String,
  },
  
  status: {
    type: String,
    enum: ['pending', 'approved', 'processing', 'completed', 'rejected', 'failed'],
    default: 'pending',
    index: true,
  },
  
  // Processing details
  processedBy: String, // Admin user ID who approved/rejected
  processedAt: Date,
  
  intasendPayoutId: String, // IntaSend payout transaction ID
  intasendResponse: mongoose.Schema.Types.Mixed, // Full IntaSend API response
  
  // Fees
  platformFee: {
    type: Number,
    default: 0,
  },
  
  processingFee: {
    type: Number,
    default: 0, // IntaSend/M-Pesa/Bank fees
  },
  
  netAmount: Number, // amount - platformFee - processingFee
  
  // Related records
  ledgerTransactionId: String, // Reference to PaymentLedger entry
  
  // Rejection/failure details
  rejectionReason: String,
  failureReason: String,
  failureDetails: mongoose.Schema.Types.Mixed,
  
  // Retry mechanism
  retryCount: {
    type: Number,
    default: 0,
  },
  
  maxRetries: {
    type: Number,
    default: 3,
  },
  
  lastRetryAt: Date,
  
  // Notes
  sellerNotes: String,
  adminNotes: String,
  
  // Automatic vs manual request
  isAutomatic: {
    type: Boolean,
    default: false,
  },
  
}, {
  timestamps: true,
});

// Indexes
withdrawalRequestSchema.index({ seller: 1, status: 1 });
withdrawalRequestSchema.index({ seller: 1, createdAt: -1 });
withdrawalRequestSchema.index({ status: 1, createdAt: 1 });

// Virtual for total deductions
withdrawalRequestSchema.virtual('totalDeductions').get(function() {
  return (this.platformFee || 0) + (this.processingFee || 0);
});

// Methods
withdrawalRequestSchema.methods.approve = async function(adminId) {
  this.status = 'approved';
  this.processedBy = adminId;
  this.processedAt = new Date();
  return this.save();
};

withdrawalRequestSchema.methods.reject = async function(adminId, reason) {
  this.status = 'rejected';
  this.processedBy = adminId;
  this.processedAt = new Date();
  this.rejectionReason = reason;
  return this.save();
};

withdrawalRequestSchema.methods.markProcessing = async function(intasendPayoutId) {
  this.status = 'processing';
  this.intasendPayoutId = intasendPayoutId;
  return this.save();
};

withdrawalRequestSchema.methods.markCompleted = async function(response) {
  this.status = 'completed';
  this.intasendResponse = response;
  return this.save();
};

withdrawalRequestSchema.methods.markFailed = async function(reason, details) {
  this.status = 'failed';
  this.failureReason = reason;
  this.failureDetails = details;
  return this.save();
};

withdrawalRequestSchema.methods.canRetry = function() {
  return this.status === 'failed' && this.retryCount < this.maxRetries;
};

withdrawalRequestSchema.methods.incrementRetry = async function() {
  this.retryCount += 1;
  this.lastRetryAt = new Date();
  this.status = 'pending';
  return this.save();
};

// Statics
withdrawalRequestSchema.statics.generateRequestId = function() {
  return `WD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
};

const WithdrawalRequest = mongoose.model('WithdrawalRequest', withdrawalRequestSchema);

module.exports = WithdrawalRequest;
