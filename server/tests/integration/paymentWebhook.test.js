const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const paymentRoutes = require('../../src/routes/paymentRoutes');
const Invoice = require('../../src/models/Invoice');
const Customer = require('../../src/models/Customer');
const Record = require('../../src/models/Record');
const errorHandler = require('../../src/middleware/errorHandler');

// Mock mongoose session to avoid transaction issues with MongoDB Memory Server
const mockSession = {
  startTransaction: jest.fn(),
  commitTransaction: jest.fn().mockResolvedValue(undefined),
  abortTransaction: jest.fn().mockResolvedValue(undefined),
  endSession: jest.fn(),
  inTransaction: jest.fn().mockReturnValue(true),
};
jest.spyOn(mongoose, 'startSession').mockResolvedValue(mockSession);

// Mock Clerk authentication
jest.mock('@clerk/clerk-sdk-node', () => ({
  ClerkExpressRequireAuth: () => (req, res, next) => {
    req.auth = {
      userId: 'test-user-123',
      sessionClaims: { metadata: { role: 'seller' } }
    };
    next();
  }
}));

// Mock subscription middleware
jest.mock('../../src/middleware/subscriptionMiddleware', () => ({
  checkSubscription: (req, res, next) => next(),
  requireLimit: () => (req, res, next) => next(),
  trackUsage: () => (req, res, next) => next()
}));

// Mock payment validation - pass through for webhook tests
jest.mock('../../src/services/payment/validation/paymentValidation', () => ({
  validatePaymentRequest: jest.fn(),
  validateInvoicePayable: jest.fn(),
  validateWebhookPayload: jest.fn((body) => body),
  extractWebhookIds: jest.fn((payload) => ({
    invoiceId: payload.invoice_id,
    intasendInvoiceId: payload.api_ref || payload.invoice_id
  }))
}));

// Mock payment provider service
jest.mock('../../src/services/payment/provider/paymentProviderService');
const { verifyTransaction, isTransactionComplete } = require('../../src/services/payment/provider/paymentProviderService');

// Create test express app
const app = express();
app.use(express.json());
app.use('/api/payments', paymentRoutes);
app.use(errorHandler);

let testInvoice;
let testCustomer;
const testUserId = 'test-user-123';

describe('Payment Webhook Integration Tests', () => {
  beforeEach(async () => {
    jest.clearAllMocks();

    testCustomer = await Customer.create({
      user: testUserId,
      name: 'Test Customer',
      email: 'customer@example.com',
    });

    testInvoice = await Invoice.create({
      user: testUserId,
      customer: testCustomer._id,
      customerName: 'Test Customer',
      invoiceNumber: 'INV-WEBHOOK-001',
      items: [{ description: 'Test Item', quantity: 2, unitPrice: 1000, total: 2000 }],
      subTotal: 2000,
      total: 2000,
      status: 'sent',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    });
  });

  describe('POST /api/payments/webhook', () => {
    it('should acknowledge webhook immediately', async () => {
      const response = await request(app)
        .post('/api/payments/webhook')
        .send({ invoice_id: testInvoice._id.toString(), state: 'PENDING' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ received: true });
    });

    it.skip('should process completed payment webhook (skipped: requires replica set)', async () => {
      const mockVerifiedData = {
        invoice: {
          invoice_id: testInvoice._id.toString(),
          state: 'COMPLETE',
          value: 2000,
          net_amount: 1950,
          currency: 'KES',
          account: '254700000000',
          mpesa_reference: 'TEST-MPESA-REF',
        },
        created_at: new Date().toISOString(),
      };

      verifyTransaction.mockResolvedValue(mockVerifiedData);
      isTransactionComplete.mockReturnValue(true);

      const response = await request(app)
        .post('/api/payments/webhook')
        .send({
          invoice_id: testInvoice._id.toString(),
          state: 'COMPLETE',
          api_ref: 'API-REF-123',
        });

      expect(response.status).toBe(200);

      // Wait for async webhook processing
      await new Promise(resolve => setTimeout(resolve, 200));

      const updatedInvoice = await Invoice.findById(testInvoice._id);
      expect(updatedInvoice.status).toBe('paid');

      // Verify ledger record was created (using Record model as proxy for PaymentLedger)
      const ledgerRecords = await Record.find({ invoice: testInvoice._id });
      expect(ledgerRecords.length).toBeGreaterThan(0);
    });

    it('should ignore incomplete payment webhook', async () => {
      const mockVerifiedData = {
        invoice: {
          invoice_id: testInvoice._id.toString(),
          state: 'PENDING',
          value: 2000,
        },
      };

      verifyTransaction.mockResolvedValue(mockVerifiedData);
      isTransactionComplete.mockReturnValue(false);

      const response = await request(app)
        .post('/api/payments/webhook')
        .send({
          invoice_id: testInvoice._id.toString(),
          state: 'PENDING',
        });

      expect(response.status).toBe(200);

      await new Promise(resolve => setTimeout(resolve, 200));

      const updatedInvoice = await Invoice.findById(testInvoice._id);
      expect(updatedInvoice.status).toBe('sent'); // Should remain sent, not change
    });

    it('should ignore webhook for already paid invoice', async () => {
      await Invoice.findByIdAndUpdate(testInvoice._id, {
        status: 'paid',
      });

      const mockVerifiedData = {
        invoice: {
          invoice_id: testInvoice._id.toString(),
          state: 'COMPLETE',
          value: 2000,
          mpesa_reference: 'DUPLICATE-REF',
        },
      };

      verifyTransaction.mockResolvedValue(mockVerifiedData);
      isTransactionComplete.mockReturnValue(true);

      const response = await request(app)
        .post('/api/payments/webhook')
        .send({
          invoice_id: testInvoice._id.toString(),
          state: 'COMPLETE',
        });

      expect(response.status).toBe(200);

      await new Promise(resolve => setTimeout(resolve, 200));

      const updatedInvoice = await Invoice.findById(testInvoice._id);
      expect(updatedInvoice.status).toBe('paid'); // Should remain paid
      
      // No duplicate ledger records should be created
      const ledgerRecords = await Record.find({ invoice: testInvoice._id });
      expect(ledgerRecords).toHaveLength(0);
    });

    it('should handle verification errors gracefully', async () => {
      verifyTransaction.mockRejectedValue(new Error('Provider API error'));

      const response = await request(app)
        .post('/api/payments/webhook')
        .send({
          invoice_id: testInvoice._id.toString(),
          state: 'COMPLETE',
        });

      expect(response.status).toBe(200);

      await new Promise(resolve => setTimeout(resolve, 200));

      const updatedInvoice = await Invoice.findById(testInvoice._id);
      expect(updatedInvoice.status).toBe('sent'); // Should remain sent, not change
    });
  });
});
