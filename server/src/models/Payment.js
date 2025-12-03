const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const paymentSchema = new mongoose.Schema({
  _id: {
    type: String,
    default: () => uuidv4(),
  },
  invoice: {
    type: String,
    ref: 'Invoice',
    required: true,
  },
  customer: {
    type: String,
    ref: 'Customer',
  },
  amount: {
    type: Number,
    required: true,
  },
  // e.g., 'IntaSend', 'Cash', 'Bank Transfer', 'M-Pesa'
  provider: {
    type: String,
    required: true,
    default: 'IntaSend',
  },
  // The transaction ID from the payment provider (e.g., IntaSend)
  transactionId: {
    type: String,
    unique: true,
    sparse: true, // Allows multiple documents to have a null value for this field
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending',
  },
  paymentDate: {
    type: Date,
    default: Date.now,
  },
  user: {
    type: String,
    required: true,
  },
}, {
  timestamps: true,
});

const Payment = mongoose.model('Payment', paymentSchema);

module.exports = Payment;
