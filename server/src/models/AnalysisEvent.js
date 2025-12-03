const mongoose = require('mongoose');

const analysisEventSchema = new mongoose.Schema({
  analysisId: { type: String, required: true, unique: true, index: true },
  sellerId: { type: String, required: true, index: true },
  uploaderId: { type: String },
  uploaderType: { type: String, enum: ['seller', 'customer'], default: 'seller' },
  pages: { type: Number },
  metadata: { type: mongoose.Schema.Types.Mixed },
  billedToSeller: { type: Boolean, default: false },
  billedToCustomer: { type: Boolean, default: false },
}, { timestamps: true });

// Optional dedupe index: if clients provide a per-upload `uploadId` in metadata,
// ensure we only create one AnalysisEvent per seller+uploadId. Sparse so it
// doesn't affect events without an uploadId.
analysisEventSchema.index({ sellerId: 1, 'metadata.uploadId': 1 }, { unique: true, sparse: true });
// Also dedupe by content hash when available (helps when clients don't supply
// a stable uploadId but the same file is uploaded multiple times). Sparse so it
// doesn't affect events without a contentHash.
analysisEventSchema.index({ sellerId: 1, 'metadata.contentHash': 1 }, { unique: true, sparse: true });
// Index for admin listing sorted by createdAt (descending)
analysisEventSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AnalysisEvent', analysisEventSchema);
