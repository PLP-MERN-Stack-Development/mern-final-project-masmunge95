const request = require('supertest');
const express = require('express');
const invoiceRoutes = require('../../src/routes/invoiceRoutes');
const Invoice = require('../../src/models/Invoice');
const Customer = require('../../src/models/Customer');
const errorHandler = require('../../src/middleware/errorHandler');
const mongoose = require('mongoose');

// Mock Clerk authentication
let mockUserId = 'test-seller-123';
let mockRole = 'seller';

jest.mock('@clerk/clerk-sdk-node', () => ({
  ClerkExpressRequireAuth: () => (req, res, next) => {
    req.auth = {
      userId: mockUserId,
      sessionClaims: { metadata: { role: mockRole } }
    };
    next();
  },
  clerkClient: {
    users: {
      getUser: jest.fn((userId) => {
        // Return different email based on userId
        if (userId.includes('customer')) {
          return Promise.resolve({
            id: userId,
            firstName: 'Test',
            lastName: 'Customer',
            emailAddresses: [{ emailAddress: 'dispute@test.com' }],
            publicMetadata: {}
          });
        }
        return Promise.resolve({
          id: userId,
          firstName: 'Test',
          lastName: 'Seller',
          emailAddresses: [{ emailAddress: 'seller@test.com' }],
          publicMetadata: { sellerPrefix: 'TEST' }
        });
      })
    }
  }
}));

// Mock subscription middleware
jest.mock('../../src/middleware/subscriptionMiddleware', () => ({
  checkSubscription: (req, res, next) => next(),
  requireLimit: () => (req, res, next) => next(),
  trackUsage: () => (req, res, next) => next()
}));

const app = express();
app.use(express.json());
app.use('/api/invoices', invoiceRoutes);
app.use(errorHandler);

describe('Invoice Disputes Integration Tests', () => {
  let sellerId, customerId, invoiceId;

  beforeAll(async () => {
    sellerId = 'test-seller-' + Date.now();
    customerId = 'test-customer-' + Date.now();
    mockUserId = sellerId;
    mockRole = 'seller';
  });

  beforeEach(async () => {
    // Create test customer
    const customer = await Customer.create({
      name: 'Dispute Test Customer',
      email: 'dispute@test.com',
      phone: '+254722000000',
      users: [customerId]
    });

    // Create test invoice with customer field as Customer._id (proper reference)
    const invoice = await Invoice.create({
      user: sellerId,
      customer: customer._id,
      customerName: 'Dispute Test Customer',
      invoiceNumber: 'INV-DISPUTE-' + Date.now(),
      items: [
        { description: 'Product A', quantity: 2, unitPrice: 100, total: 200 },
        { description: 'Product B', quantity: 1, unitPrice: 50, total: 50 }
      ],
      subTotal: 250,
      tax: 25,
      total: 275,
      status: 'sent',
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    });

    invoiceId = invoice._id.toString();
  });

  afterEach(async () => {
    await Invoice.deleteMany({});
    await Customer.deleteMany({});
  });

  describe('POST /api/invoices/:id/dispute', () => {
    it('should allow customer to dispute an invoice', async () => {
      mockUserId = customerId;
      mockRole = 'customer';

      const response = await request(app)
        .post(`/api/invoices/${invoiceId}/dispute`)
        .send({
          reason: 'Quantity is incorrect, should be 1 not 2',
          lineItemIndex: 0,
          field: 'quantity',
          originalValue: 2,
          suggestedValue: 1
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.invoice.disputes).toHaveLength(1);
      expect(response.body.invoice.disputes[0].reason).toBe('Quantity is incorrect, should be 1 not 2');
      expect(response.body.invoice.disputes[0].status).toBe('pending');
      expect(response.body.invoice.disputeStatus).toBe('disputed');
    });

    it('should require a reason for dispute', async () => {
      mockUserId = customerId;
      mockRole = 'customer';

      const response = await request(app)
        .post(`/api/invoices/${invoiceId}/dispute`)
        .send({
          lineItemIndex: 0,
          field: 'quantity'
        })
        .expect(400);

      expect(response.body.message).toContain('reason');
    });

    it('should validate line item index', async () => {
      mockUserId = customerId;
      mockRole = 'customer';

      const response = await request(app)
        .post(`/api/invoices/${invoiceId}/dispute`)
        .send({
          reason: 'Invalid item',
          lineItemIndex: 99
        })
        .expect(400);

      expect(response.body.message).toContain('Invalid line item index');
    });

    it('should prevent unauthorized users from disputing', async () => {
      mockUserId = 'random-user';
      mockRole = 'customer';

      await request(app)
        .post(`/api/invoices/${invoiceId}/dispute`)
        .send({
          reason: 'Test dispute'
        })
        .expect(403);
    });

    it('should handle invoice not found', async () => {
      mockUserId = customerId;
      mockRole = 'customer';
      const fakeId = new mongoose.Types.ObjectId();

      await request(app)
        .post(`/api/invoices/${fakeId}/dispute`)
        .send({
          reason: 'Test dispute'
        })
        .expect(404);
    });

    it('should allow disputing without line item (general dispute)', async () => {
      mockUserId = customerId;
      mockRole = 'customer';

      const response = await request(app)
        .post(`/api/invoices/${invoiceId}/dispute`)
        .send({
          reason: 'Never received the products'
        })
        .expect(201);

      expect(response.body.invoice.disputes[0].lineItemIndex).toBeNull();
      expect(response.body.invoice.disputes[0].field).toBeNull();
    });
  });

  describe('GET /api/invoices/disputed', () => {
    beforeEach(async () => {
      // Create multiple invoices with disputes
      await Invoice.create({
        user: sellerId,
        customer: new mongoose.Types.ObjectId().toString(),
        customerName: 'Customer 1',
        invoiceNumber: 'INV-DISPUTED-1',
        items: [{ description: 'Item', quantity: 1, unitPrice: 100, total: 100 }],
        subTotal: 100,
        total: 100,
        status: 'sent',
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        disputeStatus: 'disputed',
        disputes: [{
          disputedBy: customerId,
          reason: 'Disputed invoice 1',
          status: 'pending'
        }]
      });

      await Invoice.create({
        user: sellerId,
        customer: new mongoose.Types.ObjectId().toString(),
        customerName: 'Customer 2',
        invoiceNumber: 'INV-DISPUTED-2',
        items: [{ description: 'Item', quantity: 1, unitPrice: 100, total: 100 }],
        subTotal: 100,
        total: 100,
        status: 'sent',
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        disputeStatus: 'under-review',
        disputes: [{
          disputedBy: customerId,
          reason: 'Disputed invoice 2',
          status: 'pending'
        }]
      });

      // Non-disputed invoice (should not be returned)
      await Invoice.create({
        user: sellerId,
        customer: new mongoose.Types.ObjectId().toString(),
        customerName: 'Customer 3',
        invoiceNumber: 'INV-CLEAN',
        items: [{ description: 'Item', quantity: 1, unitPrice: 100, total: 100 }],
        subTotal: 100,
        total: 100,
        status: 'sent',
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        disputeStatus: 'none'
      });
    });

    it('should return all disputed invoices for seller', async () => {
      mockUserId = sellerId;
      mockRole = 'seller';

      const response = await request(app)
        .get('/api/invoices/disputed')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.count).toBe(2);
      expect(response.body.invoices).toHaveLength(2);
      expect(response.body.invoices.every(inv => ['disputed', 'under-review'].includes(inv.disputeStatus))).toBe(true);
    });

    it('should return empty array if no disputed invoices', async () => {
      await Invoice.deleteMany({ disputeStatus: { $in: ['disputed', 'under-review'] } });
      mockUserId = sellerId;
      mockRole = 'seller';

      const response = await request(app)
        .get('/api/invoices/disputed')
        .expect(200);

      expect(response.body.count).toBe(0);
      expect(response.body.invoices).toHaveLength(0);
    });
  });

  describe('PUT /api/invoices/:id/resolve-dispute', () => {
    let disputeId;

    beforeEach(async () => {
      // Add dispute to invoice
      const invoice = await Invoice.findById(invoiceId);
      invoice.disputes.push({
        disputedBy: customerId,
        lineItemIndex: 0,
        field: 'quantity',
        originalValue: 2,
        suggestedValue: 1,
        reason: 'Wrong quantity',
        status: 'pending'
      });
      invoice.disputeStatus = 'disputed';
      await invoice.save();

      disputeId = invoice.disputes[0]._id.toString();
    });

    it('should allow seller to accept dispute and apply changes', async () => {
      mockUserId = sellerId;
      mockRole = 'seller';

      const response = await request(app)
        .put(`/api/invoices/${invoiceId}/resolve-dispute`)
        .send({
          disputeId,
          status: 'accepted',
          applyChanges: true,
          resolutionNotes: 'You are correct, updating quantity'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.invoice.disputes[0].status).toBe('accepted');
      expect(response.body.invoice.items[0].quantity).toBe(1);
      expect(response.body.invoice.items[0].total).toBe(100); // Recalculated: 1 * 100
      expect(response.body.invoice.disputeStatus).toBe('resolved');
    });

    it('should allow seller to reject dispute without changes', async () => {
      mockUserId = sellerId;
      mockRole = 'seller';

      const response = await request(app)
        .put(`/api/invoices/${invoiceId}/resolve-dispute`)
        .send({
          disputeId,
          status: 'rejected',
          resolutionNotes: 'Our records show quantity is correct'
        })
        .expect(200);

      expect(response.body.invoice.disputes[0].status).toBe('rejected');
      expect(response.body.invoice.items[0].quantity).toBe(2); // Unchanged
      expect(response.body.invoice.disputeStatus).toBe('resolved');
    });

    it('should require valid resolution status', async () => {
      mockUserId = sellerId;
      mockRole = 'seller';

      await request(app)
        .put(`/api/invoices/${invoiceId}/resolve-dispute`)
        .send({
          disputeId,
          status: 'invalid-status'
        })
        .expect(400);
    });

    it('should prevent non-owner from resolving disputes', async () => {
      mockUserId = 'other-seller';
      mockRole = 'seller';

      await request(app)
        .put(`/api/invoices/${invoiceId}/resolve-dispute`)
        .send({
          disputeId,
          status: 'accepted'
        })
        .expect(403);
    });

    it('should handle dispute not found', async () => {
      mockUserId = sellerId;
      mockRole = 'seller';
      const fakeDisputeId = new mongoose.Types.ObjectId();

      await request(app)
        .put(`/api/invoices/${invoiceId}/resolve-dispute`)
        .send({
          disputeId: fakeDisputeId,
          status: 'accepted'
        })
        .expect(404);
    });

    it('should set disputeStatus to under-review if not all disputes resolved', async () => {
      // Add second dispute
      const invoice = await Invoice.findById(invoiceId);
      invoice.disputes.push({
        disputedBy: customerId,
        lineItemIndex: 1,
        field: 'unitPrice',
        originalValue: 50,
        suggestedValue: 40,
        reason: 'Price too high',
        status: 'pending'
      });
      await invoice.save();

      const firstDisputeId = invoice.disputes[0]._id.toString();
      mockUserId = sellerId;
      mockRole = 'seller';

      const response = await request(app)
        .put(`/api/invoices/${invoiceId}/resolve-dispute`)
        .send({
          disputeId: firstDisputeId,
          status: 'accepted',
          applyChanges: true
        })
        .expect(200);

      expect(response.body.invoice.disputeStatus).toBe('under-review');
    });

    it('should accept dispute without applying changes if applyChanges is false', async () => {
      mockUserId = sellerId;
      mockRole = 'seller';

      const response = await request(app)
        .put(`/api/invoices/${invoiceId}/resolve-dispute`)
        .send({
          disputeId,
          status: 'accepted',
          applyChanges: false
        })
        .expect(200);

      expect(response.body.invoice.disputes[0].status).toBe('accepted');
      expect(response.body.invoice.items[0].quantity).toBe(2); // Unchanged
    });

    it('should recalculate invoice totals when accepting line item changes', async () => {
      mockUserId = sellerId;
      mockRole = 'seller';

      const response = await request(app)
        .put(`/api/invoices/${invoiceId}/resolve-dispute`)
        .send({
          disputeId,
          status: 'accepted',
          applyChanges: true
        })
        .expect(200);

      const invoice = response.body.invoice;
      // Original: (2*100) + (1*50) = 250, tax 25, total 275
      // Updated: (1*100) + (1*50) = 150, tax 25, total 175
      expect(invoice.subTotal).toBe(150);
      expect(invoice.total).toBe(175);
    });
  });

  describe('GET /api/invoices/:id/disputes', () => {
    beforeEach(async () => {
      // Add multiple disputes to invoice
      const invoice = await Invoice.findById(invoiceId);
      invoice.disputes.push(
        {
          disputedBy: customerId,
          lineItemIndex: 0,
          field: 'quantity',
          reason: 'Dispute 1',
          status: 'pending'
        },
        {
          disputedBy: customerId,
          reason: 'Dispute 2',
          status: 'accepted',
          reviewedBy: sellerId,
          reviewedAt: new Date()
        }
      );
      invoice.disputeStatus = 'under-review';
      await invoice.save();
    });

    it('should return all disputes for an invoice', async () => {
      mockUserId = sellerId;
      mockRole = 'seller';

      const response = await request(app)
        .get(`/api/invoices/${invoiceId}/disputes`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.disputes).toHaveLength(2);
      expect(response.body.disputes[0].reason).toBe('Dispute 1');
    });

    it('should handle invoice not found', async () => {
      mockUserId = sellerId;
      mockRole = 'seller';
      const fakeId = new mongoose.Types.ObjectId();

      await request(app)
        .get(`/api/invoices/${fakeId}/disputes`)
        .expect(404);
    });

    it('should return empty array if no disputes', async () => {
      await Invoice.findByIdAndUpdate(invoiceId, { disputes: [] });
      mockUserId = sellerId;
      mockRole = 'seller';

      const response = await request(app)
        .get(`/api/invoices/${invoiceId}/disputes`)
        .expect(200);

      expect(response.body.disputes).toHaveLength(0);
    });
  });
});
