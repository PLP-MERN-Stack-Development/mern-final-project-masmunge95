const express = require('express');
const router = express.Router();
const {
  getServices,
  createService,
  getServiceById,
  updateService,
  deleteService,
} = require('../controllers/utilityServiceController');
const { ClerkExpressRequireAuth } = require('@clerk/clerk-sdk-node');

// Define authorized parties to ensure requests from the frontend are trusted.
const envOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

const authorizedParties = Array.from(new Set([
    process.env.FRONTEND_URL || 'http://localhost:5173',
    'http://localhost', // Capacitor Android
    'capacitor://localhost', // Capacitor iOS
    ...envOrigins,
]));

// Protect all service routes, ensuring the user is authenticated
router.use(ClerkExpressRequireAuth({ authorizedParties }));

router.route('/')
  .get(getServices)
  .post(createService);

router.route('/:id')
  .get(getServiceById)
  .put(updateService)
  .delete(deleteService);

module.exports = router;