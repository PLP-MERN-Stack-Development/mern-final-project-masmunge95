const request = require('supertest');
const express = require('express');
const invoiceRoutes = require('../../src/routes/invoiceRoutes');
const Invoice = require('../../src/models/Invoice');
const Customer = require('../../src/models/Customer');
const errorHandler = require('../../src/middleware/errorHandler');

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

const app = express();
app.use(express.json());
app.use('/api/invoices', invoiceRoutes);
app.use(errorHandler);

describe('Invoice Routes Integration Tests', () => {
  let customerId;

  beforeEach(async () => {
    const customer = await Customer.create({
      name: 'Test Customer',
      email: 'customer@test.com',
      users: ['test-user-123']
    });
    customerId = customer._id.toString();
  });

  describe('POST /api/invoices', () => {
    it('should create a new invoice', async () => {
      const invoiceData = {
        customerId,
        items: [
          { description: 'Product 1', quantity: 2, unitPrice: 100, total: 200 }
        ],
        subTotal: 200,
        tax: 32,
        total: 232,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
      };

      const response = await request(app)
        .post('/api/invoices')
        .send(invoiceData)
        .expect(201);

      expect(response.body).toHaveProperty('_id');
      expect(response.body.invoiceNumber).toMatch(/^INV-\d+$/); // Auto-generated invoice number
      expect(response.body.subTotal).toBe(invoiceData.subTotal);
      expect(response.body.total).toBe(invoiceData.total);
      expect(response.body.status).toBe('draft');
    });

    it('should validate required fields', async () => {
      const invalidData = {
        customerId,
        // Missing required fields
      };

      await request(app)
        .post('/api/invoices')
        .send(invalidData)
        .expect(400);
    });

    it('should calculate totals correctly', async () => {
      const invoiceData = {
        customerId,
        items: [
          { description: 'Item 1', quantity: 3, unitPrice: 50, total: 150 },
          { description: 'Item 2', quantity: 1, unitPrice: 100, total: 100 }
        ],
        subTotal: 250,
        tax: 40,
        total: 290,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      };

      const response = await request(app)
        .post('/api/invoices')
        .send(invoiceData)
        .expect(201);

      expect(response.body.subTotal).toBe(250);
      expect(response.body.total).toBe(290);
    });
  });

  describe('GET /api/invoices', () => {
    beforeEach(async () => {
      await Invoice.create([
        {
          customer: customerId,
          customerName: 'Test Customer',
          invoiceNumber: 'INV-100',
          items: [{ description: 'Test', quantity: 1, unitPrice: 100, total: 100 }],
          subTotal: 100,
          total: 116,
          user: 'test-user-123',
          status: 'draft',
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        },
        {
          customer: customerId,
          customerName: 'Test Customer',
          invoiceNumber: 'INV-101',
          items: [{ description: 'Test 2', quantity: 1, unitPrice: 200, total: 200 }],
          subTotal: 200,
          total: 232,
          user: 'test-user-123',
          status: 'sent',
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        }
      ]);
    });

    it('should return all invoices for user', async () => {
      const response = await request(app)
        .get('/api/invoices')
        .expect(200);

      expect(Array.isArray(response.body.invoices)).toBe(true);
      expect(response.body.invoices.length).toBe(2);
    });

    it('should filter by status', async () => {
      const response = await request(app)
        .get('/api/invoices?status=sent')
        .expect(200);

      expect(response.body.invoices.length).toBe(1);
      expect(response.body.invoices[0].status).toBe('sent');
    });

    it('should filter by customer', async () => {
      const response = await request(app)
        .get(`/api/invoices?customerId=${customerId}`)
        .expect(200);

      expect(response.body.invoices.every(inv => inv.customer === customerId)).toBe(true);
    });
  });

  describe('PUT /api/invoices/:id', () => {
    let invoiceId;

    beforeEach(async () => {
      const invoice = await Invoice.create({
        customer: customerId,
        customerName: 'Test Customer',
        invoiceNumber: 'INV-UPDATE',
        items: [{ description: 'Original', quantity: 1, unitPrice: 100, total: 100 }],
        subTotal: 100,
        total: 116,
        user: 'test-user-123',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      });
      invoiceId = invoice._id.toString();
    });

    it('should update invoice status', async () => {
      const response = await request(app)
        .put(`/api/invoices/${invoiceId}`)
        .send({ status: 'sent' })
        .expect(200);

      expect(response.body.status).toBe('sent');
    });

    it('should update invoice items', async () => {
      const updatedItems = [
        { description: 'Updated Item', quantity: 2, unitPrice: 150, total: 300 }
      ];

      const response = await request(app)
        .put(`/api/invoices/${invoiceId}`)
        .send({ items: updatedItems, subTotal: 300, total: 300 })
        .expect(200);

      expect(response.body.items[0].description).toBe('Updated Item');
      expect(response.body.total).toBe(300);
    });
  });

  describe('DELETE /api/invoices/:id', () => {
    let invoiceId;

    beforeEach(async () => {
      const invoice = await Invoice.create({
        customer: customerId,
        customerName: 'Test Customer',
        invoiceNumber: 'INV-DELETE',
        items: [{ description: 'To Delete', quantity: 1, unitPrice: 100, total: 100 }],
        subTotal: 100,
        total: 116,
        user: 'test-user-123',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      });
      invoiceId = invoice._id.toString();
    });

    it('should delete invoice', async () => {
      await request(app)
        .delete(`/api/invoices/${invoiceId}`)
        .expect(200);

      const deleted = await Invoice.findById(invoiceId);
      expect(deleted).toBeNull();
    });

    it('should return 404 for non-existent invoice', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      
      await request(app)
        .delete(`/api/invoices/${fakeId}`)
        .expect(404);
    });
  });

  describe('POST /api/invoices - Customer auto-creation', () => {
    it('should create invoice with existing customer by ID', async () => {
      const invoiceData = {
        customerId,
        items: [{ description: 'Test', quantity: 1, unitPrice: 100, total: 100 }],
        subTotal: 100,
        total: 100,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      };

      const response = await request(app)
        .post('/api/invoices')
        .send(invoiceData)
        .expect(201);

      expect(response.body).toHaveProperty('customer');
      expect(response.body.customer).toBe(customerId);
    });

    it('should require customerId or customer contact info', async () => {
      const invoiceData = {
        items: [{ description: 'Test', quantity: 1, unitPrice: 100, total: 100 }],
        subTotal: 100,
        total: 100,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      };

      const response = await request(app)
        .post('/api/invoices')
        .send(invoiceData)
        .expect(400);

      expect(response.body.message).toContain('customerId');
    });

    it('should require items array', async () => {
      const invoiceData = {
        customerId,
        subTotal: 100,
        total: 100,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      };

      const response = await request(app)
        .post('/api/invoices')
        .send(invoiceData)
        .expect(400);

      expect(response.body.message).toContain('items');
    });
  });

  describe('POST /api/invoices - Idempotency', () => {
    it('should return existing invoice when clientTempId is reused', async () => {
      const invoiceData = {
        customerId,
        clientTempId: 'unique-temp-id-123',
        items: [{ description: 'Test', quantity: 1, unitPrice: 100, total: 100 }],
        subTotal: 100,
        total: 100,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      };

      // Create first invoice
      const response1 = await request(app)
        .post('/api/invoices')
        .send(invoiceData)
        .expect(201);

      const firstInvoiceId = response1.body._id;

      // Attempt to create again with same clientTempId
      const response2 = await request(app)
        .post('/api/invoices')
        .send(invoiceData)
        .expect(200);  // Should return 200, not 201

      // Should return the same invoice
      expect(response2.body._id).toBe(firstInvoiceId);
    });
  });

  describe('GET /api/invoices/:id', () => {
    it('should retrieve invoice by ID', async () => {
      const invoice = await Invoice.create({
        customer: customerId,
        customerName: 'Test Customer',
        invoiceNumber: 'INV-GET-ID',
        items: [{ description: 'Test', quantity: 1, unitPrice: 100, total: 100 }],
        subTotal: 100,
        total: 100,
        user: 'test-user-123',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      });

      const response = await request(app)
        .get(`/api/invoices/${invoice._id}`)
        .expect(200);

      expect(response.body._id).toBe(invoice._id.toString());
      expect(response.body.invoiceNumber).toBe('INV-GET-ID');
    });

    it('should return 404 for non-existent invoice', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      
      await request(app)
        .get(`/api/invoices/${fakeId}`)
        .expect(404);
    });
  });

  describe('GET /api/invoices - Advanced filtering and pagination', () => {
    beforeEach(async () => {
      await Invoice.deleteMany({});
      
      // Create multiple invoices for filtering tests
      await Invoice.create([
        {
          customer: customerId,
          customerName: 'Test Customer',
          invoiceNumber: 'INV-200',
          items: [{ description: 'Water Service', quantity: 1, unitPrice: 100, total: 100 }],
          service: 'water',
          subTotal: 100,
          total: 116,
          user: 'test-user-123',
          status: 'draft',
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        },
        {
          customer: customerId,
          customerName: 'Test Customer',
          invoiceNumber: 'INV-201',
          items: [{ description: 'Electricity Bill', quantity: 1, unitPrice: 200, total: 200 }],
          service: 'electricity',
          subTotal: 200,
          total: 232,
          user: 'test-user-123',
          status: 'sent',
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        },
        {
          customer: customerId,
          customerName: 'Test Customer',
          invoiceNumber: 'INV-202',
          items: [{ description: 'Gas Service', quantity: 1, unitPrice: 150, total: 150 }],
          service: 'gas',
          subTotal: 150,
          total: 174,
          user: 'test-user-123',
          status: 'paid',
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        },
      ]);
    });

    it('should filter by service field', async () => {
      const response = await request(app)
        .get('/api/invoices?service=water')
        .expect(200);

      expect(response.body.invoices.length).toBe(1);
      expect(response.body.invoices[0].service).toBe('water');
    });

    it('should filter by service in item descriptions', async () => {
      const response = await request(app)
        .get('/api/invoices?service=Electricity')
        .expect(200);

      expect(response.body.invoices.length).toBeGreaterThanOrEqual(1);
      expect(response.body.invoices.some(inv => inv.items.some(item => item.description.includes('Electricity')))).toBe(true);
    });

    it('should support pagination with page and limit', async () => {
      const response = await request(app)
        .get('/api/invoices?page=1&limit=2')
        .expect(200);

      expect(response.body.invoices.length).toBe(2);
      expect(response.body.page).toBe(1);
      expect(response.body.total).toBe(3);
      expect(response.body.pages).toBe(2);
    });

    it('should return page 2 results', async () => {
      const response = await request(app)
        .get('/api/invoices?page=2&limit=2')
        .expect(200);

      expect(response.body.invoices.length).toBe(1);
      expect(response.body.page).toBe(2);
    });

    it('should support sync=true for all invoices without pagination', async () => {
      const response = await request(app)
        .get('/api/invoices?sync=true')
        .expect(200);

      expect(response.body.invoices.length).toBe(3);
      expect(response.body.pages).toBe(1);
      expect(response.body.total).toBe(3);
    });

    it('should combine multiple filters', async () => {
      const response = await request(app)
        .get(`/api/invoices?status=sent&customerId=${customerId}`)
        .expect(200);

      expect(response.body.invoices.every(inv => inv.status === 'sent' && inv.customer === customerId)).toBe(true);
    });
  });

  describe('PUT /api/invoices/:id - Advanced update scenarios', () => {
    let invoiceId;

    beforeEach(async () => {
      const invoice = await Invoice.create({
        customer: customerId,
        customerName: 'Test Customer',
        invoiceNumber: 'INV-UPDATE-ADV',
        items: [{ description: 'Original', quantity: 1, unitPrice: 100, total: 100 }],
        subTotal: 100,
        total: 116,
        user: 'test-user-123',
        status: 'draft',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      });
      invoiceId = invoice._id.toString();
    });

    it('should prevent updating paid invoice', async () => {
      // First update to paid status
      await Invoice.findByIdAndUpdate(invoiceId, { status: 'paid' });

      const response = await request(app)
        .put(`/api/invoices/${invoiceId}`)
        .send({ status: 'draft' })
        .expect(400);

      expect(response.body.message).toContain('paid');
    });

    it('should prevent updating void invoice', async () => {
      await Invoice.findByIdAndUpdate(invoiceId, { status: 'void' });

      const response = await request(app)
        .put(`/api/invoices/${invoiceId}`)
        .send({ items: [{ description: 'New', quantity: 1, unitPrice: 200, total: 200 }] })
        .expect(400);

      expect(response.body.message).toContain('void');
    });

    it('should recalculate totals when items updated', async () => {
      const updatedItems = [
        { description: 'Item 1', quantity: 2, unitPrice: 100, total: 200 },
        { description: 'Item 2', quantity: 1, unitPrice: 50, total: 50 }
      ];

      const response = await request(app)
        .put(`/api/invoices/${invoiceId}`)
        .send({ items: updatedItems, tax: 25 })
        .expect(200);

      expect(response.body.subTotal).toBe(250);
      expect(response.body.total).toBe(275); // 250 + 25 tax
    });

    it('should update customer with contact info lookup', async () => {
      const newCustomer = await Customer.create({
        name: 'New Customer',
        email: 'newcustomer@test.com',
        phone: '555-9999',
        users: ['test-user-123']
      });

      const response = await request(app)
        .put(`/api/invoices/${invoiceId}`)
        .send({ 
          customerId: newCustomer._id.toString(),
          customerEmail: 'newcustomer@test.com'
        })
        .expect(200);

      expect(response.body.customer).toBe(newCustomer._id.toString());
      expect(response.body.customerName).toBe('New Customer');
    });

    it('should link existing customer when updating with contact info', async () => {
      const existingCustomer = await Customer.create({
        name: 'Existing Customer',
        email: 'existing@test.com',
        users: ['another-user']
      });

      const response = await request(app)
        .put(`/api/invoices/${invoiceId}`)
        .send({
          customerId: existingCustomer._id.toString(),
          customerEmail: 'existing@test.com'
        })
        .expect(200);

      // Should link the existing customer to current user
      const updated = await Customer.findById(existingCustomer._id);
      expect(updated.users).toContain('test-user-123');
    });

    it('should create new customer if not found during update', async () => {
      const initialCount = await Customer.countDocuments();

      const response = await request(app)
        .put(`/api/invoices/${invoiceId}`)
        .send({
          customerId: 'new-customer-id',
          customerEmail: 'brandnew@test.com',
          customerName: 'Brand New Customer',
          customerPhone: '555-1234'
        })
        .expect(200);

      const finalCount = await Customer.countDocuments();
      expect(finalCount).toBe(initialCount + 1);

      const newCustomer = await Customer.findOne({ email: 'brandnew@test.com' });
      expect(newCustomer).toBeTruthy();
      expect(newCustomer.name).toBe('Brand New Customer');
      expect(newCustomer.users).toContain('test-user-123');
    });

    it('should return 404 when updating with invalid customerId and no contact info', async () => {
      const response = await request(app)
        .put(`/api/invoices/${invoiceId}`)
        .send({ customerId: 'invalid-customer-id-xyz' })
        .expect(404);

      expect(response.body.message).toContain('Customer not found');
    });
  });

  describe('DELETE /api/invoices/:id - Advanced delete scenarios', () => {
    it('should only allow deletion of draft invoices', async () => {
      const sentInvoice = await Invoice.create({
        customer: customerId,
        customerName: 'Test Customer',
        invoiceNumber: 'INV-SENT',
        items: [{ description: 'Test', quantity: 1, unitPrice: 100, total: 100 }],
        subTotal: 100,
        total: 116,
        user: 'test-user-123',
        status: 'sent',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      });

      const response = await request(app)
        .delete(`/api/invoices/${sentInvoice._id}`)
        .expect(400);

      expect(response.body.message).toContain('draft');
    });

    it('should successfully delete draft invoice', async () => {
      const draftInvoice = await Invoice.create({
        customer: customerId,
        customerName: 'Test Customer',
        invoiceNumber: 'INV-DRAFT',
        items: [{ description: 'Test', quantity: 1, unitPrice: 100, total: 100 }],
        subTotal: 100,
        total: 116,
        user: 'test-user-123',
        status: 'draft',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      });

      await request(app)
        .delete(`/api/invoices/${draftInvoice._id}`)
        .expect(200);

      const deleted = await Invoice.findById(draftInvoice._id);
      expect(deleted).toBeNull();
    });
  });

  describe('POST /api/invoices/:id/send', () => {
    let invoiceId;

    beforeEach(async () => {
      const invoice = await Invoice.create({
        customer: customerId,
        customerName: 'Test Customer',
        invoiceNumber: 'INV-SEND',
        items: [{ description: 'Test', quantity: 1, unitPrice: 100, total: 100 }],
        subTotal: 100,
        total: 116,
        user: 'test-user-123',
        status: 'draft',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      });
      invoiceId = invoice._id.toString();
    });

    it('should send draft invoice and update status to sent', async () => {
      const response = await request(app)
        .post(`/api/invoices/${invoiceId}/send`)
        .expect(200);

      expect(response.body.status).toBe('sent');
    });

    it('should prevent sending non-draft invoice', async () => {
      await Invoice.findByIdAndUpdate(invoiceId, { status: 'paid' });

      const response = await request(app)
        .post(`/api/invoices/${invoiceId}/send`)
        .expect(400);

      expect(response.body.message).toContain('paid');
    });

    it('should prevent sending already sent invoice', async () => {
      await Invoice.findByIdAndUpdate(invoiceId, { status: 'sent' });

      const response = await request(app)
        .post(`/api/invoices/${invoiceId}/send`)
        .expect(400);

      expect(response.body.message).toContain('sent');
    });

    it('should return 404 for non-existent invoice', async () => {
      const fakeId = '507f1f77bcf86cd799439011';

      await request(app)
        .post(`/api/invoices/${fakeId}/send`)
        .expect(404);
    });
  });

  describe('POST /api/invoices - Auto-create customer from contact info', () => {
    it('should create invoice and customer from email', async () => {
      const initialCount = await Customer.countDocuments();

      const response = await request(app)
        .post('/api/invoices')
        .send({
          customerId: 'new-customer-email',
          customerEmail: 'autocreate@test.com',
          customerName: 'Auto Created',
          items: [{ description: 'Test', quantity: 1, unitPrice: 100, total: 100 }],
          subTotal: 100,
          total: 100,
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        })
        .expect(201);

      const finalCount = await Customer.countDocuments();
      expect(finalCount).toBe(initialCount + 1);

      const newCustomer = await Customer.findOne({ email: 'autocreate@test.com' });
      expect(newCustomer).toBeTruthy();
      expect(newCustomer.name).toBe('Auto Created');
      expect(response.body.customer).toBe(newCustomer._id.toString());
    });

    it('should link existing customer from different seller', async () => {
      const existingCustomer = await Customer.create({
        name: 'Shared Customer',
        email: 'shared@test.com',
        users: ['another-seller-123']
      });

      const response = await request(app)
        .post('/api/invoices')
        .send({
          customerId: 'link-existing',
          customerEmail: 'shared@test.com',
          items: [{ description: 'Test', quantity: 1, unitPrice: 100, total: 100 }],
          subTotal: 100,
          total: 100,
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        })
        .expect(201);

      const updated = await Customer.findById(existingCustomer._id);
      expect(updated.users).toContain('test-user-123');
      expect(updated.users).toContain('another-seller-123');
      expect(response.body.customer).toBe(existingCustomer._id.toString());
    });

    it('should create customer from phone number', async () => {
      const response = await request(app)
        .post('/api/invoices')
        .send({
          customerId: 'new-customer-phone',
          customerPhone: '555-7777',
          customerName: 'Phone Customer',
          items: [{ description: 'Test', quantity: 1, unitPrice: 100, total: 100 }],
          subTotal: 100,
          total: 100,
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        })
        .expect(201);

      const newCustomer = await Customer.findOne({ phone: '555-7777' });
      expect(newCustomer).toBeTruthy();
      expect(newCustomer.name).toBe('Phone Customer');
    });

    it('should default customer name to "Unnamed Customer" if not provided', async () => {
      const response = await request(app)
        .post('/api/invoices')
        .send({
          customerId: 'new-unnamed',
          customerEmail: 'unnamed@test.com',
          items: [{ description: 'Test', quantity: 1, unitPrice: 100, total: 100 }],
          subTotal: 100,
          total: 100,
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        })
        .expect(201);

      const newCustomer = await Customer.findOne({ email: 'unnamed@test.com' });
      expect(newCustomer.name).toBe('Unnamed Customer');
    });

    it('should handle duplicate customer creation gracefully', async () => {
      // Create first invoice
      await request(app)
        .post('/api/invoices')
        .send({
          customerId: 'new-duplicate',
          customerEmail: 'duplicate@test.com',
          customerName: 'Duplicate Customer',
          items: [{ description: 'Test', quantity: 1, unitPrice: 100, total: 100 }],
          subTotal: 100,
          total: 100,
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        })
        .expect(201);

      // Try to create second invoice with same customer email
      const response2 = await request(app)
        .post('/api/invoices')
        .send({
          customerId: 'use-existing-duplicate',
          customerEmail: 'duplicate@test.com',
          customerName: 'Duplicate Customer',
          items: [{ description: 'Test 2', quantity: 1, unitPrice: 200, total: 200 }],
          subTotal: 200,
          total: 200,
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        })
        .expect(201);

      // Should use same customer
      const customer1 = await Customer.findById(response2.body.customer);
      expect(customer1.email).toBe('duplicate@test.com');

      // Should only have one customer with this email
      const count = await Customer.countDocuments({ email: 'duplicate@test.com' });
      expect(count).toBe(1);
    });
  });

  describe('POST /api/invoices - Date handling', () => {
    it('should default issueDate to now if not provided', async () => {
      const beforeCreate = new Date();
      
      const response = await request(app)
        .post('/api/invoices')
        .send({
          customerId,
          items: [{ description: 'Test', quantity: 1, unitPrice: 100, total: 100 }],
          subTotal: 100,
          total: 100,
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        })
        .expect(201);

      const afterCreate = new Date();
      const issueDate = new Date(response.body.issueDate);
      
      expect(issueDate.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime());
      expect(issueDate.getTime()).toBeLessThanOrEqual(afterCreate.getTime());
    });

    it('should default dueDate to 30 days after issueDate if not provided', async () => {
      const issueDate = new Date('2025-01-01');
      
      const response = await request(app)
        .post('/api/invoices')
        .send({
          customerId,
          issueDate,
          items: [{ description: 'Test', quantity: 1, unitPrice: 100, total: 100 }],
          subTotal: 100,
          total: 100
        })
        .expect(201);

      const dueDate = new Date(response.body.dueDate);
      const expectedDueDate = new Date(issueDate.getTime() + 30 * 24 * 60 * 60 * 1000);
      
      expect(dueDate.toDateString()).toBe(expectedDueDate.toDateString());
    });

    it('should handle invalid issueDate gracefully', async () => {
      const response = await request(app)
        .post('/api/invoices')
        .send({
          customerId,
          issueDate: 'invalid-date',
          items: [{ description: 'Test', quantity: 1, unitPrice: 100, total: 100 }],
          subTotal: 100,
          total: 100,
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        })
        .expect(201);

      // Should default to current date
      expect(response.body.issueDate).toBeTruthy();
      expect(new Date(response.body.issueDate).getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('should handle invalid dueDate gracefully', async () => {
      const issueDate = new Date('2025-01-01');
      
      const response = await request(app)
        .post('/api/invoices')
        .send({
          customerId,
          issueDate,
          dueDate: 'invalid-date',
          items: [{ description: 'Test', quantity: 1, unitPrice: 100, total: 100 }],
          subTotal: 100,
          total: 100
        })
        .expect(201);

      // Should default to 30 days after issueDate
      const dueDate = new Date(response.body.dueDate);
      const expectedDueDate = new Date(issueDate.getTime() + 30 * 24 * 60 * 60 * 1000);
      expect(dueDate.toDateString()).toBe(expectedDueDate.toDateString());
    });
  });
});
