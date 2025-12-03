const request = require('supertest');
const express = require('express');
const invoiceRoutes = require('../../src/routes/invoiceRoutes');
const Invoice = require('../../src/models/Invoice');
const Customer = require('../../src/models/Customer');
const errorHandler = require('../../src/middleware/errorHandler');
const mongoose = require('mongoose');

// Mock Clerk authentication
let mockUserId = 'test-user-123';
let mockRole = 'customer';
let mockCustomer2Email = 'customer2@test.com'; // Can be changed per test

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
        // Return email matching the customer email for customer1 only
        if (userId.includes('customer1')) {
          return Promise.resolve({
            id: userId,
            firstName: 'Test',
            lastName: 'Customer',
            emailAddresses: [{ emailAddress: 'customer@test.com' }],
            publicMetadata: {}
          });
        }
        // customer2 email is configurable
        if (userId.includes('customer2')) {
          return Promise.resolve({
            id: userId,
            firstName: 'Test',
            lastName: 'Customer2',
            emailAddresses: [{ emailAddress: mockCustomer2Email }],
            publicMetadata: {}
          });
        }
        return Promise.resolve({
          id: userId,
          firstName: 'Test',
          lastName: 'User',
          emailAddresses: [{ emailAddress: 'other@test.com' }],
          publicMetadata: {}
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

describe('Invoice Dispute Authorization (Proper Implementation)', () => {
  let sellerId, customer1Id, customer2Id, invoiceId, customerDoc;

  beforeAll(async () => {
    sellerId = 'seller-' + Date.now();
    customer1Id = 'customer1-' + Date.now();
    customer2Id = 'customer2-' + Date.now();
  });

  beforeEach(async () => {
    // Create customer with customer1 in users array
    customerDoc = await Customer.create({
      name: 'Test Customer',
      email: 'customer@test.com',
      phone: '+254700000000',
      users: [customer1Id] // customer1 is authorized
    });

    // Create invoice with customer._id (proper reference)
    const invoice = await Invoice.create({
      user: sellerId,
      customer: customerDoc._id, // Proper Customer document reference
      customerName: 'Test Customer',
      invoiceNumber: 'INV-AUTH-' + Date.now(),
      items: [{ description: 'Item', quantity: 1, unitPrice: 100, total: 100 }],
      subTotal: 100,
      total: 100,
      status: 'sent',
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    });

    invoiceId = invoice._id.toString();
  });

  afterEach(async () => {
    await Invoice.deleteMany({});
    await Customer.deleteMany({});
  });

  describe('POST /api/invoices/:id/dispute - Authorization', () => {
    it('should allow customer in users array to dispute', async () => {
      mockUserId = customer1Id; // This user IS in customer.users
      mockRole = 'customer';

      const response = await request(app)
        .post(`/api/invoices/${invoiceId}/dispute`)
        .send({
          reason: 'Valid dispute from authorized customer'
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.invoice.disputes).toHaveLength(1);
    });

    it('should reject customer NOT in users array', async () => {
      mockUserId = customer2Id; // This user is NOT in customer.users
      mockRole = 'customer';

      const response = await request(app)
        .post(`/api/invoices/${invoiceId}/dispute`)
        .send({
          reason: 'Unauthorized dispute attempt'
        })
        .expect(403);

      expect(response.body.message).toContain('Not authorized to dispute this invoice');
    });

    it('should handle multiple users in customer.users array', async () => {
      // Add customer2 to the customer's users array
      customerDoc.users.push(customer2Id);
      await customerDoc.save();

      // Update mock to return matching email for this test
      mockCustomer2Email = 'customer@test.com'; // Same email as customer1

      mockUserId = customer2Id; // Now customer2 is also authorized
      mockRole = 'customer';

      const response = await request(app)
        .post(`/api/invoices/${invoiceId}/dispute`)
        .send({
          reason: 'Dispute from second authorized user'
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      
      // Reset for other tests
      mockCustomer2Email = 'customer2@test.com';
    });
  });

  describe('GET /api/invoices/:id/disputes - Authorization', () => {
    beforeEach(async () => {
      // Add a dispute to the invoice
      const invoice = await Invoice.findById(invoiceId);
      invoice.disputes.push({
        disputedBy: customer1Id,
        reason: 'Test dispute',
        status: 'pending'
      });
      await invoice.save();
    });

    it('should allow seller to view disputes', async () => {
      mockUserId = sellerId;
      mockRole = 'seller';

      const response = await request(app)
        .get(`/api/invoices/${invoiceId}/disputes`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.disputes).toHaveLength(1);
    });

    it('should allow authorized customer to view disputes', async () => {
      mockUserId = customer1Id; // In customer.users array
      mockRole = 'customer';

      const response = await request(app)
        .get(`/api/invoices/${invoiceId}/disputes`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.disputes).toHaveLength(1);
    });

    it('should reject unauthorized customer', async () => {
      mockUserId = customer2Id; // NOT in customer.users array
      mockRole = 'customer';

      await request(app)
        .get(`/api/invoices/${invoiceId}/disputes`)
        .expect(403);
    });
  });

  describe('Edge Cases', () => {
    it('should handle invoice with null customer field', async () => {
      // Create invoice with invalid customer reference
      const badInvoice = await Invoice.create({
        user: sellerId,
        customer: new mongoose.Types.ObjectId(), // Non-existent customer
        customerName: 'Unknown Customer',
        invoiceNumber: 'INV-BAD-' + Date.now(),
        items: [{ description: 'Item', quantity: 1, unitPrice: 100, total: 100 }],
        subTotal: 100,
        total: 100,
        status: 'sent',
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      });

      mockUserId = customer1Id;
      mockRole = 'customer';

      const response = await request(app)
        .post(`/api/invoices/${badInvoice._id}/dispute`)
        .send({
          reason: 'Should fail - customer does not exist'
        })
        .expect(403);

      expect(response.body.message).toContain('Not authorized to dispute this invoice');
    });

    it('should handle customer with empty users array', async () => {
      // Create customer with no users
      const emptyCustomer = await Customer.create({
        name: 'Empty Customer',
        email: 'empty@test.com',
        users: [] // No authorized users
      });

      const invoice = await Invoice.create({
        user: sellerId,
        customer: emptyCustomer._id,
        customerName: 'Empty Customer',
        invoiceNumber: 'INV-EMPTY-' + Date.now(),
        items: [{ description: 'Item', quantity: 1, unitPrice: 100, total: 100 }],
        subTotal: 100,
        total: 100,
        status: 'sent',
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      });

      mockUserId = customer1Id;
      mockRole = 'customer';

      await request(app)
        .post(`/api/invoices/${invoice._id}/dispute`)
        .send({
          reason: 'Should fail - no users authorized'
        })
        .expect(403);
    });
  });
});
