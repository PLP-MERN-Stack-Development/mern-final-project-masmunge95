const express = require('express');
const { Webhook } = require('svix');
const { clerkClient } = require('@clerk/clerk-sdk-node');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// Use express.raw for the webhook endpoint
router.post(
  '/clerk', asyncHandler(async (req, res) => {
    // Choose the correct webhook secret based on the environment
    const WEBHOOK_SECRET =
      process.env.NODE_ENV === 'production'
        ? process.env.CLERK_WEBHOOK_SECRET_PUBLISHED
        : process.env.CLERK_WEBHOOK_SECRET_LOCAL;

    if (!WEBHOOK_SECRET) {
      throw new Error('You need a Clerk Webhook Secret in your .env file for the current environment.');
    }

    // Get the headers
    const svix_id = req.headers['svix-id'];
    const svix_timestamp = req.headers['svix-timestamp'];
    const svix_signature = req.headers['svix-signature'];

    if (!svix_id || !svix_timestamp || !svix_signature) {
      return res.status(400).send('Error occurred -- no svix headers');
    }

    const payload = req.body;
    const wh = new Webhook(WEBHOOK_SECRET);

    let evt;
    try {
      evt = wh.verify(payload, { 'svix-id': svix_id, 'svix-timestamp': svix_timestamp, 'svix-signature': svix_signature });
    } catch (err) {
      console.error('Error verifying webhook:', err);
      return res.status(400).send('Error occurred');
    }

    // Handle user.created and user.updated events
    if (evt.type === 'user.created' || evt.type === 'user.updated') {
      console.log(`[Webhook] Received ${evt.type} event. Full data:`, JSON.stringify(evt.data, null, 2));

      // The event shape can vary; try several common locations for role metadata
      const candidatePaths = [
        evt.data, // top-level
        evt.data?.data, // some svix payloads nest under data
        evt.data?.user, // some events place user under 'user'
        evt.data?.attributes, // alternate nesting
      ];

      let role;
      let userId = evt.data?.id || evt.data?.user?.id || evt.data?.data?.id || null;
      for (const p of candidatePaths) {
        if (!p) continue;
        // try unsafe metadata variants
        if (p.unsafe_metadata && p.unsafe_metadata.role) {
          role = p.unsafe_metadata.role;
          break;
        }
        if (p.unsafeMetadata && p.unsafeMetadata.role) {
          role = p.unsafeMetadata.role;
          break;
        }
        // also try public metadata
        if (p.public_metadata && p.public_metadata.role) {
          role = p.public_metadata.role;
          break;
        }
        if (p.publicMetadata && p.publicMetadata.role) {
          role = p.publicMetadata.role;
          break;
        }
        // Some Clerk events may include custom fields under 'metadata'
        if (p.metadata && p.metadata.role) {
          role = p.metadata.role;
          break;
        }
      }

      role = role || null; // only update when a role is actually present
      if (!userId) {
        // fallback to evt.data.id if still missing
        userId = evt.data?.id || null;
      }

      if (!userId) {
        console.warn('[Webhook] Could not determine user id from event, skipping update. Event data:', JSON.stringify(evt.data));
      } else if (!role) {
        console.log(`[Webhook] No role found in event for user ${userId}; nothing to update.`);
      } else {
        try {
          await clerkClient.users.updateUser(userId, {
            publicMetadata: { role },
          });
          console.log(`[Webhook] User ${userId} successfully assigned role: '${role}'`);
        } catch (err) {
          console.error('[Webhook] Failed to update Clerk user publicMetadata:', err);
        }
      }
    } else {
      console.log(`[Webhook] Received unhandled event type: ${evt.type}`);
    }

    res.status(200).send('Webhook received');
  })
);

module.exports = router;