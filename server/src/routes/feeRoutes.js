const express = require('express');
const { ClerkExpressRequireAuth } = require('@clerk/clerk-sdk-node');
const {
  getFeeDescription,
  displayCustomerFees,
  getPricingDisplay,
  FeeCalculator,
} = require('../services/feeService');

const router = express.Router();

// Define authorized parties for Clerk middleware
const authorizedParties = ['http://localhost:5173', 'http://localhost', 'capacitor://localhost'];
if (process.env.CORS_ALLOWED_ORIGINS) {
  authorizedParties.push(...process.env.CORS_ALLOWED_ORIGINS.split(','));
}

/**
 * Get fee calculation for a specific transaction
 * GET /api/fees/calculate
 */
router.get('/calculate', ClerkExpressRequireAuth({ authorizedParties }), (req, res) => {
  try {
    const { type, amount, method } = req.query;
    
    if (!type || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: type, amount',
      });
    }
    
    const validTypes = ['subscription', 'invoicePayment', 'withdrawal', 'bulkOperation', 'ocrScan'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        error: `Invalid type. Must be one of: ${validTypes.join(', ')}`,
      });
    }
    
    const amountNum = parseFloat(amount);
    const paymentMethod = method || 'mpesa';
    
    const fees = FeeCalculator[type](amountNum, paymentMethod);
    
    res.json({
      success: true,
      type,
      amount: amountNum,
      method: paymentMethod,
      fees,
      description: getFeeDescription(type),
    });
  } catch (error) {
    console.error('Fee calculation error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Get customer-facing fee display
 * GET /api/fees/customer-display
 */
router.get('/customer-display', ClerkExpressRequireAuth({ authorizedParties }), (req, res) => {
  try {
    const { type, amount, method } = req.query;
    
    if (!type || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: type, amount',
      });
    }
    
    const amountNum = parseFloat(amount);
    const paymentMethod = method || 'mpesa';
    
    const display = displayCustomerFees(amountNum, type, paymentMethod);
    
    res.json({
      success: true,
      display,
    });
  } catch (error) {
    console.error('Customer fee display error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Get complete pricing display for frontend
 * GET /api/fees/pricing
 */
router.get('/pricing', (req, res) => {
  try {
    const pricing = getPricingDisplay();
    
    res.json({
      success: true,
      pricing,
    });
  } catch (error) {
    console.error('Pricing display error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Get withdrawal fee estimate (for wallet page)
 * GET /api/fees/withdrawal-estimate
 */
router.get('/withdrawal-estimate', ClerkExpressRequireAuth({ authorizedParties }), (req, res) => {
  try {
    const { amount, method } = req.query;
    
    if (!amount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter: amount',
      });
    }
    
    const amountNum = parseFloat(amount);
    const withdrawalMethod = method || 'mpesa';
    
    const fees = FeeCalculator.withdrawal(amountNum, withdrawalMethod);
    
    res.json({
      success: true,
      withdrawalAmount: amountNum,
      method: withdrawalMethod,
      platformFee: fees.platformFee,
      processingFee: fees.processingFee,
      totalFees: fees.totalFees,
      netAmount: fees.netToSeller,
      breakdown: fees.breakdown,
    });
  } catch (error) {
    console.error('Withdrawal estimate error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
