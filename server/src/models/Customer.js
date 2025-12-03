const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const customerSchema = new mongoose.Schema({
  _id: {
    type: String,
    default: () => uuidv4(), // Auto-generate UUID if not provided
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  phone: {
    type: String,
    trim: true,
    // Add sparse index to allow multiple null values if phone is not required
    sparse: true, 
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    sparse: true,
  },
  // The user who owns this customer record
  // Sellers/users who own or are linked to this customer
  users: {
    type: [String],
    required: true,
    default: [],
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

// To avoid creating duplicate customer entries for the same seller, index by (users, phone/email).
// These compound indexes ensure a given seller (member of `users`) cannot have two customers with same email/phone.
customerSchema.index({ users: 1, phone: 1 }, { unique: true, partialFilterExpression: { phone: { $type: "string" } } });
customerSchema.index({ users: 1, email: 1 }, { unique: true, partialFilterExpression: { email: { $type: "string" } } });


const Customer = mongoose.model('Customer', customerSchema);

module.exports = Customer;
