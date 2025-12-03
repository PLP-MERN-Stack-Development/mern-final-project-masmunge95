const Subscription = require('../models/Subscription');

/**
 * Middleware to check if user has an active subscription
 * Automatically creates trial subscription for new users
 */
const checkSubscription = async (req, res, next) => {
  try {
    const userId = req.auth.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Find or create subscription
    let subscription = await Subscription.findOne({ userId });

    if (!subscription) {
      // Create trial subscription for new user
      subscription = new Subscription({
        userId,
        tier: 'trial',
        status: 'active',
      });
      await subscription.save();
    }

    // Check if subscription is active
    if (!subscription.isActive()) {
      return res.status(403).json({
        error: 'Subscription expired',
        message: subscription.tier === 'trial' 
          ? 'Your free trial has expired. Please upgrade to continue using RecordIQ.'
          : 'Your subscription has expired. Please renew to continue.',
        tier: subscription.tier,
        trialExpired: subscription.tier === 'trial' && subscription.isTrialExpired(),
      });
    }

    // Attach subscription to request
    req.subscription = subscription;
    next();
  } catch (error) {
    console.error('Subscription check error:', error);
    res.status(500).json({ error: 'Failed to verify subscription' });
  }
};

/**
 * Middleware to check if user can perform a specific action based on tier limits
 * Usage: requireLimit('invoices') or requireLimit('ocrScans')
 */
const requireLimit = (action) => {
  return async (req, res, next) => {
    try {
      const subscription = req.subscription;

      if (!subscription) {
        return res.status(403).json({ error: 'No subscription found' });
      }

      // Check if user can perform this action
      if (!subscription.canPerformAction(action)) {
        const limits = Subscription.getLimits();
        const tierLimit = limits[subscription.tier][action];

        return res.status(403).json({
          error: 'Usage limit reached',
          message: `You've reached your ${action} limit for the ${subscription.tier} tier (${tierLimit}/${tierLimit}). Please upgrade to continue.`,
          tier: subscription.tier,
          action,
          limit: tierLimit,
          current: subscription.usage[action] || 0,
          upgradeRequired: true,
        });
      }

      next();
    } catch (error) {
      console.error('Usage limit check error:', error);
      res.status(500).json({ error: 'Failed to check usage limits' });
    }
  };
};

/**
 * Middleware to increment usage counter after successful action
 * Usage: trackUsage('invoices') or trackUsage('ocrScans')
 */
const trackUsage = (action) => {
  return async (req, res, next) => {
    // Store original res.json to intercept successful responses
    const originalJson = res.json.bind(res);

    res.json = function(data) {
      // Only increment if response was successful (2xx status)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const subscription = req.subscription;
        if (subscription) {
          subscription.incrementUsage(action).catch(err => {
            console.error('Failed to track usage:', err);
            // Don't fail the request if tracking fails
          });
        }
      }
      return originalJson(data);
    };

    next();
  };
};

/**
 * Middleware to restrict features by tier
 * Usage: requireTier(['pro', 'enterprise'])
 */
const requireTier = (allowedTiers) => {
  return (req, res, next) => {
    const subscription = req.subscription;

    if (!subscription) {
      return res.status(403).json({ error: 'No subscription found' });
    }

    if (!allowedTiers.includes(subscription.tier)) {
      return res.status(403).json({
        error: 'Upgrade required',
        message: `This feature is only available for ${allowedTiers.join(', ')} tiers.`,
        currentTier: subscription.tier,
        requiredTiers: allowedTiers,
      });
    }

    next();
  };
};

/**
 * Middleware to track customer OCR usage when OCR data is present in record creation
 * This is used for customer portal submissions that include OCR data
 */
const trackCustomerOcrUsage = async (req, res, next) => {
  // Store original res.json to intercept successful responses
  const originalJson = res.json.bind(res);

  res.json = function(data) {
    // Only increment if response was successful and OCR data was provided
    if (res.statusCode >= 200 && res.statusCode < 300 && req.body.ocrData) {
      const subscription = req.subscription;
      if (subscription) {
        // Record as analytics only — policy: charge seller once for OCR, but
        // keep a non-billable analytics counter for customer-submitted OCRs.
        // This prevents double-billing while preserving analytics.
        subscription.recordAnalytics('customerOcrScans').catch(err => {
          console.error('Failed to record customer OCR analytics:', err);
        });
      }
    }
    return originalJson(data);
  };

  next();
};

module.exports = {
  checkSubscription,
  requireLimit,
  trackUsage,
  requireTier,
  trackCustomerOcrUsage,
};
