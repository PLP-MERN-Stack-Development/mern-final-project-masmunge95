const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const feeSchema = new mongoose.Schema({
  description: {
    type: String,
    required: true,
    trim: true,
  },
  amount: {
    type: Number,
    required: true,
  },
});

const utilityServiceSchema = new mongoose.Schema({
  _id: {
    type: String,
    default: () => uuidv4(),
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  details: String,
  unitPrice: {
    type: Number,
    required: true,
  },
  fees: [feeSchema],
  user: {
    type: String, // Clerk User ID
    required: true,
  },
}, { timestamps: true });

// Ensure unique service names per user
utilityServiceSchema.index({ name: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('UtilityService', utilityServiceSchema);