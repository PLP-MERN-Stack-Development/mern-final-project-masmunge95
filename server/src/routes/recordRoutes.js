const express = require('express');
const router = express.Router();
const {
    createRecord,
    getRecords,
    getRecordById,
    updateRecord,
    deleteRecord,
    convertRecordToInvoice,
    shareRecord,
    getSharedWithMe,
    getSharedByMe,
    verifyRecord,
    getRecordVerifications,
    resolveRecordDispute
} = require('../controllers/recordController');
const { ClerkExpressRequireAuth } = require('@clerk/clerk-sdk-node');
const { upload } = require('../middleware/uploadMiddleware');
const { checkSubscription, requireLimit, trackUsage, trackCustomerOcrUsage } = require('../middleware/subscriptionMiddleware');
const { requireRole } = require('../middleware/authMiddleware');

// Define authorized parties for Clerk middleware
const authorizedParties = ['http://localhost:5173', 'http://localhost', 'capacitor://localhost'];
if (process.env.CORS_ALLOWED_ORIGINS) {
    authorizedParties.push(...process.env.CORS_ALLOWED_ORIGINS.split(','));
}

// All routes in this file are protected
router.route('/')
    .post(
        ClerkExpressRequireAuth({ authorizedParties }),
        checkSubscription,
        requireLimit('records'),
        upload.single('image'),
        trackUsage('records'),
        createRecord
    )
    .get(ClerkExpressRequireAuth({ authorizedParties }), checkSubscription, getRecords);

// Record sharing routes - MUST come before /:id routes
router.get('/shared-with-me',
    ClerkExpressRequireAuth({ authorizedParties }),
    checkSubscription,
    getSharedWithMe
);

router.get('/shared-by-me',
    ClerkExpressRequireAuth({ authorizedParties }),
    checkSubscription,
    getSharedByMe
);

router.route('/:id')
    .get(ClerkExpressRequireAuth({ authorizedParties }), checkSubscription, getRecordById)
    .put(ClerkExpressRequireAuth({ authorizedParties }), checkSubscription, updateRecord)
    .delete(ClerkExpressRequireAuth({ authorizedParties }), checkSubscription, deleteRecord);

// Convert a Record into an Invoice: protected and role-restricted
router.post('/:id/convert-to-invoice',
    ClerkExpressRequireAuth({ authorizedParties }),
    checkSubscription,
    requireRole(['seller', 'admin']),
    convertRecordToInvoice
);

// Record sharing routes
router.post('/:id/share',
    ClerkExpressRequireAuth({ authorizedParties }),
    checkSubscription,
    shareRecord
);

// Record verification routes
router.post('/:id/verify',
    ClerkExpressRequireAuth({ authorizedParties }),
    checkSubscription,
    verifyRecord
);

router.get('/:id/verifications',
    ClerkExpressRequireAuth({ authorizedParties }),
    checkSubscription,
    getRecordVerifications
);

router.put('/:id/resolve-dispute',
    ClerkExpressRequireAuth({ authorizedParties }),
    checkSubscription,
    resolveRecordDispute
);

module.exports = router;