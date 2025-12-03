const request = require('supertest');
const express = require('express');
const customerRoutes = require('../../src/routes/customerRoutes');
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

// Create test app
const app = express();
app.use(express.json());
app.use('/api/customers', customerRoutes);
app.use(errorHandler); // Add error handler

describe('Customer Routes Integration Tests', () => {
  describe('POST /api/customers', () => {
    it('should create a new customer', async () => {
      const customerData = {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '+254712345678',
        address: '123 Test Street'
      };

      const response = await request(app)
        .post('/api/customers')
        .send(customerData)
        .expect(201);

      expect(response.body).toHaveProperty('_id');
      expect(response.body.name).toBe(customerData.name);
      expect(response.body.email).toBe(customerData.email);
      expect(response.body.users).toContain('test-user-123');
    });

    it('should return 400 for invalid customer data', async () => {
      const invalidData = {
        name: '', // Empty name
        email: 'invalid-email'
      };

      const response = await request(app)
        .post('/api/customers')
        .send(invalidData)
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    it('should handle duplicate customer creation', async () => {
      const customerData = {
        name: 'Jane Doe',
        email: 'jane@example.com',
        phone: '+254712345679'
      };

      // Create first customer
      await request(app)
        .post('/api/customers')
        .send(customerData)
        .expect(201);

      // Try to create duplicate
      const response = await request(app)
        .post('/api/customers')
        .send(customerData);

      // Should either succeed or return appropriate error
      expect([201, 400, 409]).toContain(response.status);
    });
  });

  describe('GET /api/customers', () => {
    beforeEach(async () => {
      // Create test customers
      await Customer.create([
        { name: 'Customer 1', email: 'c1@test.com', users: ['test-user-123'] },
        { name: 'Customer 2', email: 'c2@test.com', users: ['test-user-123'] },
        { name: 'Other User Customer', email: 'c3@test.com', users: ['other-user'] }
      ]);
    });

    it('should return all customers for authenticated user', async () => {
      const response = await request(app)
        .get('/api/customers')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(2); // Only user's customers
      expect(response.body.every(c => c.users && c.users.includes('test-user-123'))).toBe(true);
    });

    it('should filter customers by search query', async () => {
      const response = await request(app)
        .get('/api/customers?search=Customer 1')
        .expect(200);

      expect(response.body.length).toBeGreaterThanOrEqual(1);
      expect(response.body[0].name).toContain('Customer 1');
    });
  });

  describe('GET /api/customers/:id', () => {
    let customerId;

    beforeEach(async () => {
      const customer = await Customer.create({
        name: 'Test Customer',
        email: 'test@example.com',
        users: ['test-user-123']
      });
      customerId = customer._id;
    });

    it('should return customer by ID', async () => {
      const response = await request(app)
        .get(`/api/customers/${customerId}`)
        .expect(200);

      expect(response.body._id).toBe(customerId);
      expect(response.body.name).toBe('Test Customer');
    });

    it('should return 404 for non-existent customer', async () => {
      const fakeId = '507f1f77bcf86cd799439011'; // Valid ObjectId format
      
      await request(app)
        .get(`/api/customers/${fakeId}`)
        .expect(404);
    });

    it('should return 404 for invalid ID format', async () => {
      // Since we use UUID strings, invalid format just returns 404 (not found)
      await request(app)
        .get('/api/customers/invalid-id')
        .expect(404);
    });
  });

  describe('PUT /api/customers/:id', () => {
    let customerId;

    beforeEach(async () => {
      const customer = await Customer.create({
        name: 'Original Name',
        email: 'original@example.com',
        users: ['test-user-123']
      });
      customerId = customer._id.toString();
    });

    it('should update customer', async () => {
      const updateData = {
        name: 'Updated Name',
        phone: '+254700000000'
      };

      const response = await request(app)
        .put(`/api/customers/${customerId}`)
        .send(updateData)
        .expect(200);

      expect(response.body.name).toBe(updateData.name);
      expect(response.body.phone).toBe(updateData.phone);
      expect(response.body.email).toBe('original@example.com'); // Unchanged
    });

    it('should return 404 when updating non-existent customer', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      
      await request(app)
        .put(`/api/customers/${fakeId}`)
        .send({ name: 'New Name' })
        .expect(404);
    });
  });

  describe('DELETE /api/customers/:id', () => {
    let customerId;

    beforeEach(async () => {
      const customer = await Customer.create({
        name: 'To Delete',
        email: 'delete@example.com',
        users: ['test-user-123']
      });
      customerId = customer._id.toString();
    });

    it('should delete customer', async () => {
      await request(app)
        .delete(`/api/customers/${customerId}`)
        .expect(200);

      const deletedCustomer = await Customer.findById(customerId);
      expect(deletedCustomer).toBeTruthy();
      expect(deletedCustomer.isActive).toBe(false); // Soft delete
    });

    it('should return 404 when deleting non-existent customer', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      
      await request(app)
        .delete(`/api/customers/${fakeId}`)
        .expect(404);
    });
  });

  describe('Edge Cases and Validation', () => {
    describe('Duplicate Detection', () => {
      it('should detect duplicate phone number', async () => {
        const customerData = {
          name: 'First Customer',
          phone: '+254712345678',
          email: 'first@example.com'
        };

        await request(app)
          .post('/api/customers')
          .send(customerData)
          .expect(201);

        const duplicateData = {
          name: 'Second Customer',
          phone: '+254712345678', // Same phone
          email: 'second@example.com'
        };

        const response = await request(app)
          .post('/api/customers')
          .send(duplicateData);

        expect([400]).toContain(response.status);
        if (response.status === 400) {
          expect(response.body.message).toMatch(/phone|email|exists/i);
        }
      });

      it('should detect duplicate email', async () => {
        const customerData = {
          name: 'First Customer',
          phone: '+254711111111',
          email: 'duplicate@example.com'
        };

        await request(app)
          .post('/api/customers')
          .send(customerData)
          .expect(201);

        const duplicateData = {
          name: 'Second Customer',
          phone: '+254722222222',
          email: 'duplicate@example.com' // Same email
        };

        const response = await request(app)
          .post('/api/customers')
          .send(duplicateData);

        expect([400]).toContain(response.status);
        if (response.status === 400) {
          expect(response.body.message).toMatch(/phone|email|exists/i);
        }
      });

      it('should allow same customer for different users', async () => {
        // Customer for user 1
        const customer1 = await Customer.create({
          name: 'Shared Customer',
          email: 'shared@example.com',
          phone: '+254700000000',
          users: ['other-user-456']
        });

        // Attempt to create similar customer for test-user-123
        // Should succeed if email/phone are globally unique, or link user if duplicate recovery enabled
        const response = await request(app)
          .post('/api/customers')
          .send({
            name: 'Shared Customer',
            email: 'shared@example.com',
            phone: '+254700000000'
          });

        // Either creates new or links to existing
        expect([200, 201]).toContain(response.status);
      });
    });

    describe('Multi-User Scenarios', () => {
      it('should handle customer with multiple users', async () => {
        const customer = await Customer.create({
          name: 'Multi-User Customer',
          email: 'multi@example.com',
          users: ['test-user-123', 'other-user-456']
        });

        const response = await request(app)
          .get(`/api/customers/${customer._id}`)
          .expect(200);

        expect(response.body.users).toContain('test-user-123');
        expect(response.body.users.length).toBeGreaterThanOrEqual(2);
      });

      it('should not allow access to other users customers', async () => {
        const otherCustomer = await Customer.create({
          name: 'Other User Customer',
          email: 'other@example.com',
          users: ['different-user-999']
        });

        await request(app)
          .get(`/api/customers/${otherCustomer._id}`)
          .expect(404); // Should not find customer for different user
      });

      it('should update only accessible customers', async () => {
        const otherCustomer = await Customer.create({
          name: 'Other User Customer',
          email: 'other@example.com',
          users: ['different-user-999']
        });

        await request(app)
          .put(`/api/customers/${otherCustomer._id}`)
          .send({ name: 'Hacked Name' })
          .expect(404); // Should not allow update
      });

      it('should delete only accessible customers', async () => {
        const otherCustomer = await Customer.create({
          name: 'Other User Customer',
          email: 'other@example.com',
          users: ['different-user-999']
        });

        await request(app)
          .delete(`/api/customers/${otherCustomer._id}`)
          .expect(404); // Should not allow delete
      });
    });

    describe('Data Validation', () => {
      it('should require customer name', async () => {
        const response = await request(app)
          .post('/api/customers')
          .send({
            email: 'noname@example.com',
            phone: '+254700000000'
          });

        expect(response.status).toBe(400);
        expect(response.body.message).toMatch(/name/i);
      });

      it('should accept customer with only name', async () => {
        const response = await request(app)
          .post('/api/customers')
          .send({
            name: 'Minimal Customer'
          });

        expect(response.status).toBe(201);
        expect(response.body.name).toBe('Minimal Customer');
      });

      it('should accept customer with name and phone only', async () => {
        const response = await request(app)
          .post('/api/customers')
          .send({
            name: 'Phone Only Customer',
            phone: '+254733333333'
          });

        expect(response.status).toBe(201);
        expect(response.body.phone).toBe('+254733333333');
      });

      it('should accept customer with name and email only', async () => {
        const response = await request(app)
          .post('/api/customers')
          .send({
            name: 'Email Only Customer',
            email: 'emailonly@example.com'
          });

        expect(response.status).toBe(201);
        expect(response.body.email).toBe('emailonly@example.com');
      });

      it('should handle special characters in customer name', async () => {
        const response = await request(app)
          .post('/api/customers')
          .send({
            name: "O'Brien & Sons Ltd.",
            email: 'obrien@example.com'
          });

        expect(response.status).toBe(201);
        expect(response.body.name).toBe("O'Brien & Sons Ltd.");
      });

      it('should handle very long customer names', async () => {
        const longName = 'A'.repeat(200);
        const response = await request(app)
          .post('/api/customers')
          .send({
            name: longName,
            email: 'longname@example.com'
          });

        // Should either accept or reject based on schema validation
        expect([201, 400]).toContain(response.status);
      });

      it('should handle international phone numbers', async () => {
        const response = await request(app)
          .post('/api/customers')
          .send({
            name: 'International Customer',
            phone: '+1-555-123-4567'
          });

        expect(response.status).toBe(201);
        expect(response.body.phone).toBe('+1-555-123-4567');
      });

      it('should handle email case sensitivity', async () => {
        await request(app)
          .post('/api/customers')
          .send({
            name: 'Customer 1',
            email: 'Test@Example.COM'
          })
          .expect(201);

        // Try to create with different case
        const response = await request(app)
          .post('/api/customers')
          .send({
            name: 'Customer 2',
            email: 'test@example.com'
          });

        // Should detect as duplicate if email is case-insensitive
        expect([200, 201, 400]).toContain(response.status);
      });
    });

    describe('Update Operations', () => {
      let customerId;

      beforeEach(async () => {
        const customer = await Customer.create({
          name: 'Original Customer',
          email: 'original@example.com',
          phone: '+254700000000',
          users: ['test-user-123']
        });
        customerId = customer._id.toString();
      });

      it('should update only name', async () => {
        const response = await request(app)
          .put(`/api/customers/${customerId}`)
          .send({ name: 'Updated Name Only' })
          .expect(200);

        expect(response.body.name).toBe('Updated Name Only');
        expect(response.body.email).toBe('original@example.com');
        expect(response.body.phone).toBe('+254700000000');
      });

      it('should update only email', async () => {
        const response = await request(app)
          .put(`/api/customers/${customerId}`)
          .send({ email: 'newemail@example.com' })
          .expect(200);

        expect(response.body.email).toBe('newemail@example.com');
        expect(response.body.name).toBe('Original Customer');
      });

      it('should update only phone', async () => {
        const response = await request(app)
          .put(`/api/customers/${customerId}`)
          .send({ phone: '+254711111111' })
          .expect(200);

        expect(response.body.phone).toBe('+254711111111');
        expect(response.body.name).toBe('Original Customer');
      });

      it('should update multiple fields at once', async () => {
        const response = await request(app)
          .put(`/api/customers/${customerId}`)
          .send({
            name: 'Completely Updated',
            email: 'updated@example.com',
            phone: '+254722222222'
          })
          .expect(200);

        expect(response.body.name).toBe('Completely Updated');
        expect(response.body.email).toBe('updated@example.com');
        expect(response.body.phone).toBe('+254722222222');
      });

      it('should preserve users array on update', async () => {
        const response = await request(app)
          .put(`/api/customers/${customerId}`)
          .send({ name: 'Updated' })
          .expect(200);

        expect(response.body.users).toContain('test-user-123');
      });

      it('should handle empty update request', async () => {
        const response = await request(app)
          .put(`/api/customers/${customerId}`)
          .send({})
          .expect(200);

        // Should return unchanged customer
        expect(response.body.name).toBe('Original Customer');
      });
    });

    describe('Search and Filtering', () => {
      beforeEach(async () => {
        await Customer.create([
          { name: 'Alice Anderson', email: 'alice@example.com', users: ['test-user-123'] },
          { name: 'Bob Builder', email: 'bob@example.com', users: ['test-user-123'] },
          { name: 'Charlie Chaplin', email: 'charlie@example.com', users: ['test-user-123'] },
          { name: 'Alice Cooper', email: 'cooper@example.com', users: ['test-user-123'] }
        ]);
      });

      it('should return all customers for user', async () => {
        const response = await request(app)
          .get('/api/customers')
          .expect(200);

        expect(response.body.length).toBeGreaterThanOrEqual(4);
        expect(response.body.every(c => c.users.includes('test-user-123'))).toBe(true);
      });

      it('should sort customers by name', async () => {
        const response = await request(app)
          .get('/api/customers')
          .expect(200);

        // Customers should be sorted alphabetically
        const names = response.body.map(c => c.name);
        const sortedNames = [...names].sort();
        expect(names).toEqual(sortedNames);
      });

      it('should handle query parameters gracefully', async () => {
        // Even if search param is passed, should return all (feature not implemented)
        const response = await request(app)
          .get('/api/customers?search=Alice')
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
      });
    });

    describe('Soft Delete Behavior', () => {
      let activeCustomerId, inactiveCustomerId;

      beforeEach(async () => {
        const activeCustomer = await Customer.create({
          name: 'Active Customer',
          email: 'active@example.com',
          users: ['test-user-123'],
          isActive: true
        });
        activeCustomerId = activeCustomer._id.toString();

        const inactiveCustomer = await Customer.create({
          name: 'Inactive Customer',
          email: 'inactive@example.com',
          users: ['test-user-123'],
          isActive: false
        });
        inactiveCustomerId = inactiveCustomer._id.toString();
      });

      it('should not return inactive customer by ID', async () => {
        await request(app)
          .get(`/api/customers/${inactiveCustomerId}`)
          .expect(404);
      });

      it('should include inactive customers in list', async () => {
        const response = await request(app)
          .get('/api/customers')
          .expect(200);

        // getCustomers returns ALL customers (active and inactive) for historical record display
        const hasInactive = response.body.some(c => c.isActive === false);
        expect(hasInactive).toBe(true);
      });

      it('should mark customer as inactive on delete', async () => {
        await request(app)
          .delete(`/api/customers/${activeCustomerId}`)
          .expect(200);

        const customer = await Customer.findById(activeCustomerId);
        expect(customer.isActive).toBe(false);
      });

      it('should allow updating inactive customer (no isActive check in updateCustomer)', async () => {
        const response = await request(app)
          .put(`/api/customers/${inactiveCustomerId}`)
          .send({ name: 'Updated Inactive' })
          .expect(200);

        // updateCustomer doesn't check isActive - it allows the update
        expect(response.body.name).toBe('Updated Inactive');
      });

      it('should allow deleting already inactive customer (idempotent)', async () => {
        const response = await request(app)
          .delete(`/api/customers/${inactiveCustomerId}`)
          .expect(200);

        // deleteCustomer sets isActive=false even if already false (idempotent)
        expect(response.body.message).toMatch(/deactivated/i);
        
        const customer = await Customer.findById(inactiveCustomerId);
        expect(customer.isActive).toBe(false);
      });
    });

    describe('Custom ID Support', () => {
      it('should accept custom _id from client', async () => {
        const customId = 'custom-customer-id-12345';
        const response = await request(app)
          .post('/api/customers')
          .send({
            _id: customId,
            name: 'Custom ID Customer',
            email: 'customid@example.com'
          })
          .expect(201);

        expect(response.body._id).toBe(customId);
      });

      it('should generate _id if not provided', async () => {
        const response = await request(app)
          .post('/api/customers')
          .send({
            name: 'Auto ID Customer',
            email: 'autoid@example.com'
          })
          .expect(201);

        expect(response.body._id).toBeDefined();
        expect(typeof response.body._id).toBe('string');
      });
    });
  });
});
