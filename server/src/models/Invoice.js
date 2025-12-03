const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const lineItemSchema = new mongoose.Schema({
  description: {
    type: String,
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 0,
  },
  unitPrice: {
    type: Number,
    required: true,
    min: 0,
  },
  total: {
    type: Number,
    required: true,
    min: 0,
  }
}, { _id: false });

const invoiceSchema = new mongoose.Schema({
  _id: {
    type: String,
    default: () => uuidv4(),
  },
  invoiceNumber: {
    type: String,
    required: true,
    // uniqueness is enforced per-seller via a compound index below
  },
  customer: {
    type: String,
    ref: 'Customer',
    required: true,
    index: true, // Index for faster queries by customer
  },
  customerName: {
    type: String,
    required: true,
  },
  user: {
    type: String,
    required: true,
    index: true, // Index for faster queries by user
  },
  // Seller metadata snapshot (display name and optional short prefix/code)
  sellerName: {
    type: String,
  },
  sellerPrefix: {
    type: String,
  },
  // Public human-readable id combining seller prefix and sequence (e.g., SLR-123)
  publicInvoiceId: {
    type: String,
    index: true,
  },
  // Optional client-provided temporary id to enable idempotent create operations
  clientTempId: {
    type: String,
    index: true,
  },
  // Normalized service label for easier querying/filtering (e.g., 'Water', 'Electricity')
  service: {
    type: String,
    index: true,
  },
  // Line items for the invoice
  items: [lineItemSchema],
  subTotal: {
    type: Number,
    required: true,
  },
  tax: {
    type: Number,
    default: 0,
  },
  total: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    enum: ['draft', 'sent', 'paid', 'overdue', 'void'],
    default: 'draft',
  },
  issueDate: {
    type: Date,
    default: Date.now,
  },
  dueDate: {
    type: Date,
    required: true,
  },
  // Optional notes or memo field
  notes: {
    type: String,
    default: null,
  },
  // Dispute tracking
  disputeStatus: {
    type: String,
    enum: ['none', 'disputed', 'under-review', 'resolved'],
    default: 'none',
  },
  disputes: [{
    disputedBy: { type: String, required: true }, // customerId
    lineItemIndex: { type: Number, default: null }, // null = entire invoice
    field: { type: String, default: null }, // 'quantity', 'unitPrice', 'description', 'total'
    originalValue: { type: mongoose.Schema.Types.Mixed, default: null },
    suggestedValue: { type: mongoose.Schema.Types.Mixed, default: null },
    reason: { type: String, required: true },
    status: { 
      type: String, 
      enum: ['pending', 'under-review', 'accepted', 'rejected'], 
      default: 'pending' 
    },
    disputedAt: { type: Date, default: Date.now },
    reviewedAt: { type: Date, default: null },
    reviewedBy: { type: String, default: null }, // seller userId
    resolution: { type: String, default: null },
    resolutionNotes: { type: String, default: null },
  }],
}, {
  timestamps: true,
});

// Ensure invoiceNumber is unique per seller (user)
invoiceSchema.index({ user: 1, invoiceNumber: 1 }, { unique: true });
// Optional uniqueness guard: prevent duplicate clientTempId per user (sparse)
invoiceSchema.index({ user: 1, clientTempId: 1 }, { unique: true, partialFilterExpression: { clientTempId: { $type: 'string' } } });

const Invoice = mongoose.model('Invoice', invoiceSchema);

module.exports = Invoice;
