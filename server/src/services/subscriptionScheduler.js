const cron = require('node-cron');
const Subscription = require('../models/Subscription');
const { sendTrialEndingEmail, sendTrialExpiredEmail } = require('./emailService');
const { clerkClient } = require('@clerk/clerk-sdk-node');

/**
 * Scheduled tasks for subscription management
 * These run automatically in the background
 */

/**
 * Check for trials ending in 3 days and send notification
 * Runs daily at 9 AM
 */
const checkTrialEndingNotifications = cron.schedule('0 9 * * *', async () => {
  console.log('[Cron] Checking for trials ending soon...');
  
  try {
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    threeDaysFromNow.setHours(23, 59, 59, 999);

    const twoDaysFromNow = new Date();
    twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);
    twoDaysFromNow.setHours(0, 0, 0, 0);

    // Find trials expiring in exactly 3 days
    const expiringTrials = await Subscription.find({
      tier: 'trial',
      status: 'active',
      trialEndDate: {
        $gte: twoDaysFromNow,
        $lte: threeDaysFromNow,
      },
    });

    console.log(`[Cron] Found ${expiringTrials.length} trials ending in 3 days`);

    for (const subscription of expiringTrials) {
      try {
        // Get user details from Clerk
        const user = await clerkClient.users.getUser(subscription.userId);
        const email = user.emailAddresses?.[0]?.emailAddress;
        const name = user.firstName || user.username;

        if (email) {
          const daysRemaining = Math.ceil((subscription.trialEndDate - new Date()) / (1000 * 60 * 60 * 24));
          await sendTrialEndingEmail(email, name, daysRemaining);
          console.log(`[Cron] Sent trial ending email to ${email}`);
        }
      } catch (error) {
        console.error(`[Cron] Error sending email for user ${subscription.userId}:`, error);
      }
    }
  } catch (error) {
    console.error('[Cron] Error checking trial ending notifications:', error);
  }
}, {
  scheduled: false // Start manually
});

/**
 * Check for expired trials and mark them
 * Runs daily at 10 AM
 */
const checkExpiredTrials = cron.schedule('0 10 * * *', async () => {
  console.log('[Cron] Checking for expired trials...');
  
  try {
    const now = new Date();

    // Find expired trials that are still marked as active
    const expiredTrials = await Subscription.find({
      tier: 'trial',
      status: 'active',
      trialEndDate: { $lt: now },
    });

    console.log(`[Cron] Found ${expiredTrials.length} expired trials`);

    for (const subscription of expiredTrials) {
      try {
        // Mark as expired
        subscription.status = 'expired';
        await subscription.save();

        // Get user details from Clerk
        const user = await clerkClient.users.getUser(subscription.userId);
        const email = user.emailAddresses?.[0]?.emailAddress;
        const name = user.firstName || user.username;

        if (email) {
          await sendTrialExpiredEmail(email, name);
          console.log(`[Cron] Sent trial expired email to ${email}`);
        }
      } catch (error) {
        console.error(`[Cron] Error processing expired trial for user ${subscription.userId}:`, error);
      }
    }
  } catch (error) {
    console.error('[Cron] Error checking expired trials:', error);
  }
}, {
  scheduled: false
});

/**
 * Check for subscriptions due for renewal and process payments
 * Runs daily at 8 AM
 */
const checkSubscriptionRenewals = cron.schedule('0 8 * * *', async () => {
  console.log('[Cron] Checking for subscription renewals...');
  
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Find paid subscriptions expiring today
    const dueSubs = await Subscription.find({
      tier: { $in: ['basic', 'pro', 'enterprise'] },
      status: 'active',
      currentPeriodEnd: {
        $gte: today,
        $lt: tomorrow,
      },
      cancelAtPeriodEnd: false,
    });

    console.log(`[Cron] Found ${dueSubs.length} subscriptions due for renewal`);

    for (const subscription of dueSubs) {
      try {
        // This is where IntaSend webhook would handle the payment
        // For now, we log it and extend the period manually
        console.log(`[Cron] Subscription ${subscription._id} due for renewal`);
        
        // In production, this would be handled by IntaSend webhook
        // For manual testing, you can uncomment below to auto-renew:
        /*
        subscription.currentPeriodStart = new Date();
        subscription.currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        subscription.nextBillingDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        await subscription.save();
        */
      } catch (error) {
        console.error(`[Cron] Error processing renewal for subscription ${subscription._id}:`, error);
      }
    }
  } catch (error) {
    console.error('[Cron] Error checking subscription renewals:', error);
  }
}, {
  scheduled: false
});

/**
 * Start all scheduled tasks
 */
const startScheduledTasks = () => {
  console.log('[Cron] Starting scheduled subscription tasks...');
  
  checkTrialEndingNotifications.start();
  checkExpiredTrials.start();
  checkSubscriptionRenewals.start();
  
  console.log('[Cron] ✓ Trial ending notifications (daily 9 AM)');
  console.log('[Cron] ✓ Expired trials check (daily 10 AM)');
  console.log('[Cron] ✓ Subscription renewals check (daily 8 AM)');
};

/**
 * Stop all scheduled tasks
 */
const stopScheduledTasks = () => {
  console.log('[Cron] Stopping scheduled subscription tasks...');
  
  checkTrialEndingNotifications.stop();
  checkExpiredTrials.stop();
  checkSubscriptionRenewals.stop();
};

module.exports = {
  startScheduledTasks,
  stopScheduledTasks,
  // Export individual tasks for manual testing
  checkTrialEndingNotifications,
  checkExpiredTrials,
  checkSubscriptionRenewals,
};
