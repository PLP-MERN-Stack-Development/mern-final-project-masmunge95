const express = require('express');
const router = express.Router();
const Subscription = require('../models/Subscription');
const { sendUpgradeSuccessEmail, sendPaymentFailedEmail } = require('../services/emailService');
const { clerkClient } = require('@clerk/clerk-sdk-node');

/**
 * IntaSend webhook endpoint for subscription payments
 * POST /api/webhooks/intasend
 * 
 * Webhook events from IntaSend:
 * - COMPLETE: Payment successful
 * - FAILED: Payment failed
 * - RETRY: Payment being retried
 */
router.post('/intasend', express.json(), async (req, res) => {
  try {
    console.log('[Webhook] IntaSend webhook received:', JSON.stringify(req.body, null, 2));

    const {
      invoice_id,
      state,
      value,
      currency,
      account,
      failed_reason,
      api_ref,
      meta, // Our custom metadata (userId, tier, type)
    } = req.body;

    // Verify webhook authenticity (IntaSend uses API key in headers)
    const apiKey = req.headers['x-intasend-signature'];
    if (apiKey !== process.env.INTASEND_PUBLISHABLE_KEY && apiKey !== process.env.INTASEND_SECRET_KEY) {
      console.error('[Webhook] Invalid IntaSend signature');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Parse metadata
    const metadata = typeof meta === 'string' ? JSON.parse(meta) : meta;
    const { userId, tier, type } = metadata || {};

    if (!userId) {
      console.error('[Webhook] No userId in metadata');
      return res.status(400).json({ error: 'Missing userId in metadata' });
    }

    // Find subscription
    const subscription = await Subscription.findOne({ userId });

    if (!subscription) {
      console.error('[Webhook] Subscription not found for user:', userId);
      return res.status(404).json({ error: 'Subscription not found' });
    }

    // Handle payment based on state
    switch (state) {
      case 'COMPLETE':
        console.log(`[Webhook] Payment successful for user ${userId}, tier ${tier}`);

        // Check if there's a pending upgrade
        const hasPendingUpgrade = subscription.pendingUpgrade && subscription.pendingUpgrade.tier;
        const upgradeTier = hasPendingUpgrade ? subscription.pendingUpgrade.tier : tier;
        const upgradeCycle = hasPendingUpgrade ? subscription.pendingUpgrade.billingCycle : 'monthly';

        // Update subscription
        if (type === 'subscription_upgrade' || type === 'annual_subscription' || hasPendingUpgrade) {
          // Initial upgrade or annual
          subscription.tier = upgradeTier;
          subscription.status = 'active';
          subscription.billingCycle = upgradeCycle;
          subscription.currentPeriodStart = new Date();
          
          const periodDays = upgradeCycle === 'annual' ? 365 : 30;
          subscription.currentPeriodEnd = new Date(Date.now() + periodDays * 24 * 60 * 60 * 1000);
          subscription.nextBillingDate = new Date(Date.now() + periodDays * 24 * 60 * 60 * 1000);
          
          // Clear pending upgrade
          subscription.pendingUpgrade = undefined;
        } else if (type === 'subscription_renewal') {
          // Monthly renewal
          subscription.status = 'active';
          subscription.currentPeriodStart = new Date();
          subscription.currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
          subscription.nextBillingDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
          
          // Reset monthly usage counters
          subscription.usage = {
            invoices: 0,
            customers: 0,
            ocrScans: 0,
            records: 0,
            lastResetDate: new Date(),
          };
        }

        subscription.lastPaymentDate = new Date();
        subscription.lastPaymentAmount = value;
        subscription.lastPaymentMethod = 'MPESA';

        // Update pending payment in history to completed
        const pendingPaymentIndex = subscription.paymentHistory.findIndex(
          p => p.transactionId === (invoice_id || api_ref) && p.status === 'pending'
        );
        if (pendingPaymentIndex !== -1) {
          subscription.paymentHistory[pendingPaymentIndex].status = 'completed';
        } else {
          // Add to payment history if not already there
          subscription.paymentHistory.push({
            amount: value,
            tier: upgradeTier,
            status: 'completed',
            transactionId: invoice_id || api_ref,
            method: 'MPESA',
          });
        }

        await subscription.save();

        // Send success email
        try {
          const user = await clerkClient.users.getUser(userId);
          const email = user.emailAddresses?.[0]?.emailAddress;
          const name = user.firstName || user.username;

          if (email) {
            await sendUpgradeSuccessEmail(email, name, tier, value);
          }
        } catch (emailError) {
          console.error('[Webhook] Error sending success email:', emailError);
        }

        console.log(`[Webhook] Subscription updated for user ${userId}`);
        break;

      case 'FAILED':
        console.log(`[Webhook] Payment failed for user ${userId}: ${failed_reason}`);

        // Update pending payment in history to failed
        const failedPaymentIndex = subscription.paymentHistory.findIndex(
          p => p.transactionId === (invoice_id || api_ref) && p.status === 'pending'
        );
        if (failedPaymentIndex !== -1) {
          subscription.paymentHistory[failedPaymentIndex].status = 'failed';
        } else {
          // Add to payment history if not already there
          subscription.paymentHistory.push({
            amount: value,
            tier,
            status: 'failed',
            transactionId: invoice_id || api_ref,
            method: 'MPESA',
          });
        }

        // Clear pending upgrade
        subscription.pendingUpgrade = undefined;

        // If this was a renewal, mark subscription as past_due
        if (type === 'subscription_renewal') {
          subscription.status = 'past_due';
        }

        await subscription.save();

        // Send failure email
        try {
          const user = await clerkClient.users.getUser(userId);
          const email = user.emailAddresses?.[0]?.emailAddress;
          const name = user.firstName || user.username;

          if (email) {
            await sendPaymentFailedEmail(email, name, value, tier);
          }
        } catch (emailError) {
          console.error('[Webhook] Error sending failure email:', emailError);
        }

        console.log(`[Webhook] Payment failure recorded for user ${userId}`);
        break;

      case 'RETRY':
        console.log(`[Webhook] Payment retry for user ${userId}`);
        // Just log it, don't update subscription yet
        break;

      default:
        console.log(`[Webhook] Unknown state: ${state}`);
    }

    // Always respond with 200 to acknowledge receipt
    res.status(200).json({ received: true });
  } catch (error) {
    console.error('[Webhook] Error processing IntaSend webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

module.exports = router;
