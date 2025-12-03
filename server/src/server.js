const express = require('express');
const dotenv = require('dotenv');
const path = require('path');
const cors = require('cors');
const { ClerkExpressRequireAuth } = require('@clerk/clerk-sdk-node');

// Load environment variables
dotenv.config();

// --- CORS Configuration ---
const allowedOrigins = [
  'http://localhost:5173', // Vite dev server
  'http://localhost:5174', // Vite dev alternate port
  'http://localhost:4173', // Vite preview
  'capacitor://localhost', // Capacitor Android/iOS
  'http://localhost',      // Capacitor Android
];

// Add production URLs from environment variable
if (process.env.CORS_ALLOWED_ORIGINS) {
  const envOrigins = process.env.CORS_ALLOWED_ORIGINS
    .split(',')
    .map(origin => origin.trim())
    .filter(origin => origin.length > 0);
  allowedOrigins.push(...envOrigins);
}

// Add individual frontend URL environment variables
if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL.trim());
}
if (process.env.FRONTEND_URL_DEV) {
  allowedOrigins.push(process.env.FRONTEND_URL_DEV.trim());
}
if (process.env.FRONTEND_URL_NGROK) {
  allowedOrigins.push(process.env.FRONTEND_URL_NGROK.trim());
}
if (process.env.FRONTEND_URL_PROD) {
  allowedOrigins.push(process.env.FRONTEND_URL_PROD.trim());
}

// Remove duplicates
const uniqueOrigins = [...new Set(allowedOrigins)];

console.log('Allowed CORS origins:', uniqueOrigins);

const corsOptions = {
  origin: (origin, callback) => {
    // Log the origin for debugging purposes
    console.log('Request Origin:', origin);
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    if (uniqueOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true, // Allow cookies and authorization headers
};


// Local imports
const connectDB = require('./config/db');
const recordRoutes = require('./routes/recordRoutes');
const customerRoutes = require('./routes/customerRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const webhookRoutes = require('./routes/webhookRoutes'); // 1. Import the new webhook router
const ocrRoutes = require('./routes/ocrRoutes');
const portalRoutes = require('./routes/portalRoutes');
const utilityServiceRoutes = require('./routes/utilityServiceRoutes');
const subscriptionRoutes = require('./routes/subscriptionRoutes');
const subscriptionWebhookRoutes = require('./routes/subscriptionWebhookRoutes');
const adminRoutes = require('./routes/adminRoutes');
const authRoutes = require('./routes/authRoutes');
const withdrawalRoutes = require('./routes/withdrawal');
const feeRoutes = require('./routes/feeRoutes');
const logger = require('./middleware/logger');
const performanceMonitor = require('./middleware/performanceMonitor');
const errorHandler = require('./middleware/errorHandler');
const { startScheduledTasks } = require('./services/subscriptionScheduler');
const { startWalletScheduler } = require('./services/walletScheduler');

// Initialize Express app
const app = express();

// Connect to Database
connectDB();

// --- Core Middleware ---

// Apply CORS middleware
app.use(cors(corsOptions));

// Raw body parser for the Clerk webhook, must come before express.json()
// This ensures we have the raw body for signature verification.
app.use('/api/webhooks/clerk', express.raw({ type: 'application/json' }));

// Body parsing middleware
// We need the raw body for webhook signature verification
app.use(express.json({
    verify: (req, res, buf) => {
        const url = req.originalUrl;
        if (url.startsWith('/api/records/webhook') || url.startsWith('/api/payments/webhook')) {
            req.rawBody = buf.toString();
        }
    }
}));
app.use(express.urlencoded({ extended: true }));

// Custom logging and performance middleware
app.use(logger);
app.use(performanceMonitor);

// Prevent caching of API JSON responses (avoids stale 304/Service-Worker cached bodies)
app.use('/api', (req, res, next) => {
  // Ensure API responses are not cached by browser, proxies, or service workers
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

// Serve static files from the 'uploads' directory
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// --- Routes ---

app.get('/api', (req, res) => {
    res.send('API is running...');
});

app.use('/api/records', recordRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/webhooks', webhookRoutes); // 2. Use the webhook router
app.use('/api/webhooks', subscriptionWebhookRoutes); // Subscription webhooks
app.use('/api/ocr', ocrRoutes);
app.use('/api/portal', portalRoutes);
app.use('/api/services', utilityServiceRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/seller', withdrawalRoutes);
app.use('/api/fees', feeRoutes);

// --- Error Handling Middleware ---
// This should be the last piece of middleware
app.use(errorHandler);

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
    
    // Start subscription scheduled tasks
    if (process.env.ENABLE_SUBSCRIPTION_SCHEDULER !== 'false') {
        startScheduledTasks();
    }
    
    // Start wallet scheduler for pending balance clearing
    if (process.env.ENABLE_WALLET_SCHEDULER !== 'false') {
        startWalletScheduler();
    }
    
    // Start automatic withdrawal processing
    if (process.env.AUTO_WITHDRAWAL_APPROVAL === 'true') {
        const processWithdrawalsJob = require('./jobs/processWithdrawals');
        const interval = parseInt(process.env.WITHDRAWAL_PROCESSING_INTERVAL) || 900000; // Default 15 minutes
        
        console.log(`[AutoWithdrawal] Scheduler enabled. Processing every ${interval / 1000 / 60} minutes`);
        
        // Run immediately on startup
        setTimeout(() => {
            processWithdrawalsJob().catch(err => {
                console.error('[AutoWithdrawal] Initial processing failed:', err);
            });
        }, 10000); // Wait 10 seconds after server starts
        
        // Then run periodically
        setInterval(() => {
            processWithdrawalsJob().catch(err => {
                console.error('[AutoWithdrawal] Scheduled processing failed:', err);
            });
        }, interval);
    }
});