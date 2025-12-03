const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

/**
 * PaymentLedger - Immutable double-entry ledger for ALL financial transactions
 * This is your source of truth for disputes, refunds, and reconciliation
 */
const paymentLedgerSchema = new mongoose.Schema({
  _id: {
    type: String,
    default: () => uuidv4(),
  },
  
  // Transaction identification
  transactionId: {
    type: String,
    required: true,
    index: true,
    unique: true, // Ensures no duplicate transactions
  },
  
  // IntaSend reference for external reconciliation
  intasendInvoiceId: {
    type: String,
    index: true,
  },
  
  intasendTransactionId: {
    type: String,
    index: true,
  },
  
  // Transaction type
  type: {
    type: String,
    enum: [
      'invoice_payment',      // Customer pays invoice
      'subscription_payment', // Subscription charge
      'withdrawal',           // Seller withdraws funds
      'refund',              // Payment refunded to customer
      'platform_fee',        // Platform commission deduction
      'dispute_hold',        // Funds held due to dispute
      'dispute_release',     // Dispute resolved, funds released
      'chargeback',          // Payment reversed by provider
    ],
    required: true,
    index: true,
  },
  
  // Related entities
  seller: {
    type: String,
    ref: 'User', // Clerk user ID
    required: true,
    index: true,
  },
  
  customer: {
    type: String,
    ref: 'Customer',
    index: true,
  },
  
  invoice: {
    type: String,
    ref: 'Invoice',
    index: true,
  },
  
  payment: {
    type: String,
    ref: 'Payment',
    index: true,
  },
  
  // Financial details
  amount: {
    type: Number,
    required: true,
  },
  
  currency: {
    type: String,
    default: 'KES',
    enum: ['KES', 'USD'],
  },
  
  // Direction of funds
  direction: {
    type: String,
    enum: ['credit', 'debit'], // credit = money in, debit = money out
    required: true,
  },
  
  // Balance after this transaction (for reconciliation)
  balanceAfter: {
    type: Number,
    required: true,
  },
  
  // Transaction status
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'reversed'],
    default: 'pending',
    index: true,
  },
  
  // Payment provider details
  provider: {
    type: String,
    default: 'IntaSend',
  },
  
  providerResponse: {
    type: mongoose.Schema.Types.Mixed, // Store raw provider response
  },
  
  // Fees and deductions
  platformFee: {
    type: Number,
    default: 0,
  },
  
  processingFee: {
    type: Number,
    default: 0,
  },
  
  netAmount: {
    type: Number, // Amount after fees (what seller actually receives)
    required: true,
  },
  
  // Dispute/refund tracking
  isDisputed: {
    type: Boolean,
    default: false,
  },
  
  disputeReason: String,
  
  relatedTransaction: {
    type: String,
    ref: 'PaymentLedger', // Link to original transaction for refunds/reversals
  },
  
  // Metadata
  description: String,
  
  metadata: {
    type: mongoose.Schema.Types.Mixed,
  },
  
  // Timestamps
  transactionDate: {
    type: Date,
    default: Date.now,
    index: true,
  },
  
}, {
  timestamps: true, // createdAt, updatedAt
});

// Compound indexes for common queries
paymentLedgerSchema.index({ seller: 1, transactionDate: -1 });
paymentLedgerSchema.index({ seller: 1, status: 1, type: 1 });
paymentLedgerSchema.index({ customer: 1, transactionDate: -1 });

// Virtual for formatted amount
paymentLedgerSchema.virtual('formattedAmount').get(function() {
  return `${this.currency} ${this.amount.toFixed(2)}`;
});

const PaymentLedger = mongoose.model('PaymentLedger', paymentLedgerSchema);

module.exports = PaymentLedger;
