const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

// Broadened record schema to support generic business records and
// to keep OCR/extraction metadata separate from strict invoice fields.
const recordSchema = new mongoose.Schema({
  _id: {
    type: String,
    default: () => uuidv4(),
  },
  // Optional high-level category (e.g. 'sale', 'expense', or freeform)
  type: {
    type: String,
    default: null,
  },
  // Freeform record type: 'business-record', 'receipt', 'invoice', 'utility', etc.
  recordType: {
    type: String,
    default: 'business-record',
  },
  // Amount is optional — not all records are monetary.
  amount: {
    type: Number,
    default: null,
  },
  description: {
    type: String,
    trim: true,
    default: '',
  },
  // The user who created the record
  user: {
    type: String,
    required: true,
  },
  // If this record is associated with a seller (billing target), persist seller id and snapshot
  sellerId: {
    type: String,
    default: null,
    index: true,
  },
  sellerName: {
    type: String,
    default: null,
  },
  sellerPrefix: {
    type: String,
    default: null,
  },
  // If uploaded by a customer (portal), store uploaderCustomerId for tracing
  uploaderCustomerId: {
    type: String,
    default: null,
    index: true,
  },
  // Store uploader's name for display (populated at upload time from Clerk profile)
  uploaderCustomerName: {
    type: String,
    default: null,
  },
  // Normalized service label and reason for upload (customer-provided)
  service: {
    type: String,
    default: null,
    index: true,
  },
  reason: {
    type: String,
    default: null,
  },
  // Optional: link to a customer for sales records
  customer: {
    type: String,
    ref: 'Customer',
    default: null,
  },
  // Persisted customer name (OCR-detected or user-entered) for quick display
  customerName: {
    type: String,
    trim: true,
    default: ''
  },
  // Persisted customer phone/mobile number
  customerPhone: {
    type: String,
    trim: true,
    default: ''
  },
  recordDate: {
    type: Date,
    default: Date.now,
  },
  imagePath: {
    type: String,
    default: null,
  },
  // Keep original OCR payload for compatibility
  ocrData: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  // Persist the raw driver response and sanitized driver payload for exports/debugging
  driverRaw: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  // Normalized extraction fields (recommended place to read structured fields)
  extracted: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  // Raw OCR text blob
  rawText: {
    type: String,
    default: null,
  },
  // AI classification and confidence
  docType: {
    type: String,
    default: null,
  },
  docConfidence: {
    type: Number,
    default: null,
  },
  // Arbitrary metadata (file size, pages, mime, etc.)
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  // Processing/sync status for background jobs
  syncStatus: {
    type: String,
    enum: ['pending', 'processing', 'complete', 'failed'],
    default: 'pending',
  },
  // Billing metadata captured at analysis time
  billingMeta: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  // Optional pointer to an invoice if this record was converted
  linkedInvoiceId: {
    type: String,
    default: null,
  },
  modelSpecs: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  // Record sharing: who shared this record and with whom
  sharedBy: {
    type: String, // userId or customerId who shared the record
    default: null,
  },
  sharedWith: {
    type: [String], // Array of userIds or customerIds who can view this record
    default: [],
  },
  shareRole: {
    type: String, // 'seller-to-customer' or 'customer-to-seller'
    enum: ['seller-to-customer', 'customer-to-seller'],
    default: null,
  },
  // Verification tracking from recipients
  verifications: [{
    verifiedBy: { type: String, required: true }, // userId or customerId
    verifierRole: { type: String, enum: ['seller', 'customer'], required: true },
    status: { 
      type: String, 
      enum: ['pending', 'verified', 'disputed'], 
      default: 'pending' 
    },
    suggestedCorrections: { type: mongoose.Schema.Types.Mixed, default: null },
    comments: { type: String, default: '' },
    verifiedAt: { type: Date, default: Date.now },
    resolvedAt: { type: Date, default: null },
    resolvedBy: { type: String, default: null },
    resolution: { type: String, default: null }, // 'accepted', 'rejected', 'modified'
  }],
}, {
  timestamps: true, // Adds createdAt and updatedAt timestamps
});

const Record = mongoose.model('Record', recordSchema);

module.exports = Record;
