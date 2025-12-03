const mongoose = require('mongoose');

/**
 * SellerWallet - Tracks each seller's fund balance and withdrawal history
 * This is the single source of truth for seller balances
 */
const sellerWalletSchema = new mongoose.Schema({
  seller: {
    type: String, // Clerk user ID
    required: true,
    unique: true,
    index: true,
  },
  
  // Current balances
  availableBalance: {
    type: Number,
    default: 0,
    min: 0,
  },
  
  pendingBalance: {
    type: Number,
    default: 0,
    min: 0,
  },
  
  heldBalance: {
    type: Number,
    default: 0, // Funds held due to disputes
    min: 0,
  },
  
  totalEarnings: {
    type: Number,
    default: 0, // Lifetime earnings
  },
  
  totalWithdrawals: {
    type: Number,
    default: 0, // Lifetime withdrawals
  },
  
  currency: {
    type: String,
    default: 'KES',
    enum: ['KES', 'USD'],
  },
  
  // Withdrawal settings
  withdrawalMethod: {
    type: String,
    enum: ['mpesa', 'bank', 'intasend_wallet'],
    default: 'mpesa',
  },
  
  withdrawalDetails: {
    // M-Pesa
    mpesaNumber: String,
    
    // Bank
    bankName: String,
    accountNumber: String,
    accountName: String,
    branchCode: String,
    
    // IntaSend wallet email
    walletEmail: String,
  },
  
  // Minimum withdrawal amount
  minimumWithdrawal: {
    type: Number,
    default: 100, // KES 100 minimum
  },
  
  // Auto-withdrawal settings
  autoWithdraw: {
    enabled: {
      type: Boolean,
      default: false,
    },
    threshold: {
      type: Number,
      default: 1000, // Auto-withdraw when balance reaches KES 1000
    },
    schedule: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'threshold'],
      default: 'threshold',
    },
  },
  
  // Statistics
  stats: {
    totalTransactions: {
      type: Number,
      default: 0,
    },
    lastPaymentDate: Date,
    lastWithdrawalDate: Date,
    averageTransactionValue: Number,
  },
  
  // Status
  isActive: {
    type: Boolean,
    default: true,
  },
  
  isSuspended: {
    type: Boolean,
    default: false,
  },
  
  suspensionReason: String,
  
}, {
  timestamps: true,
});

// Methods
sellerWalletSchema.methods.canWithdraw = function(amount) {
  return this.isActive && !this.isSuspended && 
         this.availableBalance >= amount && 
         amount >= this.minimumWithdrawal;
};

sellerWalletSchema.methods.addFunds = async function(amount, type = 'invoice_payment') {
  // Funds go to pending first, moved to available after clearing period
  this.pendingBalance += amount;
  this.totalEarnings += amount;
  this.stats.totalTransactions += 1;
  this.stats.lastPaymentDate = new Date();
  return this.save();
};

sellerWalletSchema.methods.clearPending = async function(amount) {
  if (amount > this.pendingBalance) {
    throw new Error('Insufficient pending balance');
  }
  this.pendingBalance -= amount;
  this.availableBalance += amount;
  return this.save();
};

sellerWalletSchema.methods.withdraw = async function(amount) {
  if (!this.canWithdraw(amount)) {
    throw new Error('Cannot withdraw this amount');
  }
  this.availableBalance -= amount;
  this.totalWithdrawals += amount;
  this.stats.lastWithdrawalDate = new Date();
  return this.save();
};

sellerWalletSchema.methods.holdFunds = async function(amount, reason) {
  if (amount > this.availableBalance) {
    throw new Error('Insufficient available balance to hold');
  }
  this.availableBalance -= amount;
  this.heldBalance += amount;
  return this.save();
};

sellerWalletSchema.methods.releaseFunds = async function(amount) {
  if (amount > this.heldBalance) {
    throw new Error('Insufficient held balance to release');
  }
  this.heldBalance -= amount;
  this.availableBalance += amount;
  return this.save();
};

const SellerWallet = mongoose.model('SellerWallet', sellerWalletSchema);

module.exports = SellerWallet;
