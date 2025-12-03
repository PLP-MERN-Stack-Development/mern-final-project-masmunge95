const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  tier: {
    type: String,
    enum: ['trial', 'basic', 'pro', 'enterprise'],
    default: 'trial',
  },
  status: {
    type: String,
    enum: ['active', 'past_due', 'canceled', 'expired', 'pending_upgrade'],
    default: 'active',
  },
  trialStartDate: {
    type: Date,
    default: Date.now,
  },
  trialEndDate: {
    type: Date,
    default: () => new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
  },
  currentPeriodStart: {
    type: Date,
    default: Date.now,
  },
  currentPeriodEnd: {
    type: Date,
    default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
  },
  cancelAtPeriodEnd: {
    type: Boolean,
    default: false,
  },
  trialExtended: {
    type: Boolean,
    default: false,
    // Tracks if user has used their one-time 14-day trial extension
  },
  billingCycle: {
    type: String,
    enum: ['monthly', 'annual'],
    default: 'monthly',
  },
  // Pending upgrade (before payment confirmation)
  pendingUpgrade: {
    tier: String,
    billingCycle: String,
    amount: Number,
    initiatedAt: Date,
  },
  // Usage tracking
  usage: {
    invoices: {
      type: Number,
      default: 0,
    },
    customers: {
      type: Number,
      default: 0,
    },
    ocrScans: {
      type: Number,
      default: 0,
    },
    customerOcrScans: {
      type: Number,
      default: 0,
    },
    records: {
      type: Number,
      default: 0,
    },
    lastResetDate: {
      type: Date,
      default: Date.now,
    },
  },
  // Analytics counters (non-billable, for reporting)
  analytics: {
    customerOcrScans: {
      type: Number,
      default: 0,
    },
    ocrScans: {
      type: Number,
      default: 0,
    },
    lastRecordedAt: {
      type: Date,
    },
  },
  // Payment tracking
  lastPaymentDate: {
    type: Date,
  },
  lastPaymentAmount: {
    type: Number,
  },
  lastPaymentMethod: {
    type: String,
  },
  nextBillingDate: {
    type: Date,
  },
  // Payment provider reference (IntaSend)
  paymentProviderCustomerId: {
    type: String,
  },
  paymentHistory: [{
    date: {
      type: Date,
      default: Date.now,
    },
    amount: {
      type: Number,
      required: true,
    },
    tier: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'pending',
    },
    transactionId: {
      type: String,
    },
    method: {
      type: String,
    },
  }],
}, {
  timestamps: true,
});

// Method to check if trial has expired
subscriptionSchema.methods.isTrialExpired = function() {
  if (this.tier !== 'trial') return false;
  return new Date() > this.trialEndDate;
};

// Method to check if subscription is active
subscriptionSchema.methods.isActive = function() {
  if (this.status !== 'active') return false;
  if (this.tier === 'trial') {
    return !this.isTrialExpired();
  }
  return new Date() <= this.currentPeriodEnd;
};

// Method to check if user can perform action based on tier limits
subscriptionSchema.methods.canPerformAction = function(action) {
  const limits = {
    trial: {
      invoices: 10,
      customers: 5,
      ocrScans: 20,
      customerOcrScans: 30,
      records: 50,
    },
    basic: {
      invoices: 50,
      customers: 25,
      ocrScans: 100,
      customerOcrScans: 150,
      records: 200,
    },
    pro: {
      invoices: 500,
      customers: 250,
      ocrScans: 1000,
      customerOcrScans: 1500,
      records: 2000,
    },
    enterprise: {
      invoices: 10000,
      customers: 5000,
      ocrScans: 5000,
      customerOcrScans: 5000,
      records: 20000,
    },
  };

  const tierLimits = limits[this.tier] || limits.trial;
  const currentUsage = this.usage[action] || 0;

  return currentUsage < tierLimits[action];
};

// Method to increment usage counter
subscriptionSchema.methods.incrementUsage = async function(action) {
  // Use an atomic update to avoid ParallelSaveError when multiple requests
  // attempt to increment the same subscription concurrently.
  const now = new Date();
  const lastReset = (this.usage && this.usage.lastResetDate) ? new Date(this.usage.lastResetDate) : new Date(0);
  const daysSinceReset = (now - lastReset) / (1000 * 60 * 60 * 24);

  const update = {};

  if (daysSinceReset >= 30) {
    // Reset counters and set lastResetDate, then increment the requested action atomically
    update.$set = {
      'usage.invoices': 0,
      'usage.customers': 0,
      'usage.ocrScans': 0,
      'usage.customerOcrScans': 0,
      'usage.records': 0,
      'usage.lastResetDate': now,
    };
    update.$inc = { [`usage.${action}`]: 1 };
  } else {
    // Simple increment
    update.$inc = { [`usage.${action}`]: 1 };
  }

  // Perform atomic findOneAndUpdate against the subscription _id
  await this.constructor.findOneAndUpdate({ _id: this._id }, update, { new: true }).exec();
};

// Record non-billable analytics events (does not affect tier limits)
subscriptionSchema.methods.recordAnalytics = async function(action, opts = {}) {
  const now = new Date();
  const update = { $inc: {}, $set: {} };
  update.$inc[`analytics.${action}`] = 1;
  update.$set['analytics.lastRecordedAt'] = now;

  // Perform atomic update
  await this.constructor.findOneAndUpdate({ _id: this._id }, update, { new: true }).exec();
};

// Static method to get tier pricing
subscriptionSchema.statics.getPricing = function() {
  return {
    trial: { 
      price: 0, 
      currency: 'USD', 
      duration: '14 days',
      annual: null,
    },
    basic: { 
      price: 3, 
      currency: 'USD', 
      duration: 'month',
      annual: { price: 30, savings: 6, discount: '17%' }, // $2.50/month vs $3
    },
    pro: { 
      price: 10, 
      currency: 'USD', 
      duration: 'month',
      annual: { price: 100, savings: 20, discount: '17%' }, // $8.33/month vs $10
    },
    enterprise: { 
      price: 150, 
      currency: 'USD', 
      duration: 'month',
      annual: { price: 1500, savings: 300, discount: '17%' }, // $125/month vs $150
    },
  };
};

// Static method to get tier limits
subscriptionSchema.statics.getLimits = function() {
  return {
    trial: {
      invoices: 10,
      customers: 5,
      ocrScans: 20,
      customerOcrScans: 30,
      records: 50,
      duration: '14 days',
    },
    basic: {
      invoices: 50,
      customers: 25,
      ocrScans: 100,
      customerOcrScans: 150,
      records: 200,
      duration: 'unlimited',
    },
    pro: {
      invoices: 500,
      customers: 250,
      ocrScans: 1000,
      customerOcrScans: 1500,
      records: 2000,
      duration: 'unlimited',
    },
    enterprise: {
      invoices: 'unlimited',
      customers: 'unlimited',
      ocrScans: 'unlimited',
      customerOcrScans: 'unlimited',
      records: 'unlimited',
      duration: 'unlimited',
    },
  };
};

module.exports = mongoose.model('Subscription', subscriptionSchema);
