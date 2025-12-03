const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { uploadAndAnalyze } = require('../controllers/ocrController');
const { ClerkExpressRequireAuth } = require('@clerk/clerk-sdk-node');
const { checkSubscription, requireLimit, trackUsage } = require('../middleware/subscriptionMiddleware');

// Define authorized parties for Clerk middleware
const authorizedParties = ['http://localhost:5173', 'http://localhost', 'capacitor://localhost'];
if (process.env.CORS_ALLOWED_ORIGINS) {
    authorizedParties.push(...process.env.CORS_ALLOWED_ORIGINS.split(','));
}

// Base uploads directory
const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'ocr');

// Ensure base OCR directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for disk storage with organized folder structure
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Get user ID from Clerk auth
    const userId = req.auth?.userId || 'anonymous';
    const documentType = req.body?.documentType || 'general';
    
    // Create user-specific folder: uploads/ocr/{userId}/{documentType}/
    const userDir = path.join(uploadDir, userId);
    const typeDir = path.join(userDir, documentType);
    
    // Create directories if they don't exist
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    if (!fs.existsSync(typeDir)) {
      fs.mkdirSync(typeDir, { recursive: true });
    }
    
    cb(null, typeDir);
  },
  filename: (req, file, cb) => {
    // Generate filename: timestamp-originalname
    const timestamp = Date.now();
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${timestamp}-${sanitizedName}`);
  }
});

// File filter to accept images and documents
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    // Images
    'image/jpeg',
    'image/png',
    'image/jpg',
    'image/gif',
    'image/bmp',
    'image/tiff',
    // Documents
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
    'text/html'
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Supported: Images (JPG, PNG, GIF, BMP, TIFF), PDF, Word (.docx), Excel (.xlsx), PowerPoint (.pptx)'), false);
  }
};

const upload = multer({ 
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// @route   POST /api/ocr/upload
// @desc    Upload a document for OCR analysis
// @access  Private (can be bypassed during local dev using DEV_TEST_SELLER_ID or via x-dev-test-seller header)
const devBypassAuth = (req, res, next) => {
  const devId = process.env.DEV_TEST_SELLER_ID;
  if (devId) {
    req.auth = req.auth || {};
    req.auth.userId = req.auth.userId || devId;
    req.auth.sessionClaims = req.auth.sessionClaims || { metadata: { role: 'seller' } };
    console.warn('[DEV] Clerk auth bypass active. Using DEV_TEST_SELLER_ID=', devId);
  }
  return next();
};

// Header-based dev bypass: allow a specific header to set a dev seller id for quick local testing
const headerBypassAuth = (req, res, next) => {
  const hdr = req.headers['x-dev-test-seller'] || req.headers['x-dev-test-seller-id'];
  if (hdr) {
    req.auth = req.auth || {};
    req.auth.userId = req.auth.userId || hdr;
    req.auth.sessionClaims = req.auth.sessionClaims || { metadata: { role: 'seller' } };
    console.warn('[DEV] Clerk auth bypass active via header. Using x-dev-test-seller=', hdr);
  }
  return next();
};

// Choose authentication per-request: inspect header first, then server env dev bypass, otherwise Clerk middleware
const chooseAuth = (req, res, next) => {
  // Check header directly (defensive - route previously used headerBypassAuth but ensure detection here)
  const hdr = req.headers['x-dev-test-seller'] || req.headers['x-dev-test-seller-id'];
  if (hdr) {
    req.auth = req.auth || {};
    req.auth.userId = req.auth.userId || hdr;
    req.auth.sessionClaims = req.auth.sessionClaims || { metadata: { role: 'seller' } };
    console.warn('[DEV] Clerk auth bypass active via header (chooseAuth). Using x-dev-test-seller=', hdr);
    return next();
  }

  // If header already set by earlier middleware, allow through
  if (req.auth && req.auth.userId) return next();

  // If server was started with DEV_TEST_SELLER_ID, apply dev bypass
  if (process.env.DEV_TEST_SELLER_ID) {
    return devBypassAuth(req, res, next);
  }

  // Otherwise, run Clerk middleware
  return ClerkExpressRequireAuth({ authorizedParties })(req, res, next);
};

router.post('/upload', 
  // chooseAuth handles header dev bypass and falls back to Clerk
  chooseAuth,
  checkSubscription,
  requireLimit('ocrScans'),
  upload.single('document'),
  uploadAndAnalyze
);

module.exports = router;
