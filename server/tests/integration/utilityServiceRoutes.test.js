const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const utilityServiceRoutes = require('../../src/routes/utilityServiceRoutes');
const UtilityService = require('../../src/models/UtilityService');
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

// Create test express app
const app = express();
app.use(express.json());
app.use('/api/utility-services', utilityServiceRoutes);
app.use(errorHandler);

describe('Utility Service Routes Integration Tests', () => {
  describe('POST /api/utility-services', () => {
    it('should create a new utility service', async () => {
      const serviceData = {
        _id: 'service-elec-001',
        name: 'Electricity',
        unitPrice: 15,
        details: 'Electricity billing per kWh'
      };

      const response = await request(app)
        .post('/api/utility-services')
        .send(serviceData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('_id');
      expect(response.body.name).toBe('Electricity');
      expect(response.body.unitPrice).toBe(15);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/utility-services')
        .send({
          name: 'Water'
          // Missing _id
        });

      expect(response.status).toBe(400);
    });

    it('should prevent duplicate service names', async () => {
      const serviceData = {
        _id: 'service-water-001',
        name: 'Water',
        unitPrice: 50,
        user: 'test-user-123'
      };

      await UtilityService.create(serviceData);

      const response = await request(app)
        .post('/api/utility-services')
        .send({
          _id: 'service-water-002',
          name: 'Water',
          unitPrice: 55
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('already exists');
    });

  });

  describe('GET /api/utility-services', () => {
    beforeEach(async () => {
      await UtilityService.create([
        {
          _id: 'service-elec-get',
          name: 'Electricity',
          unitPrice: 15,
          details: 'Electricity billing',
          user: 'test-user-123'
        },
        {
          _id: 'service-water-get',
          name: 'Water',
          unitPrice: 50,
          details: 'Water supply billing',
          user: 'test-user-123'
        },
        {
          _id: 'service-internet-get',
          name: 'Internet',
          unitPrice: 2000,
          details: 'Internet service',
          user: 'test-user-123'
        }
      ]);
    });

    it('should list all utility services for the user', async () => {
      const response = await request(app)
        .get('/api/utility-services');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(3);
    });

    it('should search services by name', async () => {
      const response = await request(app)
        .get('/api/utility-services?search=Water');

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(1);
      expect(response.body[0].name).toBe('Water');
    });

  });

  describe('GET /api/utility-services/:id', () => {
    it('should retrieve a utility service by ID', async () => {
      const service = await UtilityService.create({
        _id: 'service-gas-001',
        name: 'Gas',
        unitPrice: 80,
        user: 'test-user-123'
      });

      const response = await request(app)
        .get(`/api/utility-services/${service._id}`);

      expect(response.status).toBe(200);
      expect(response.body._id).toBe(service._id.toString());
      expect(response.body.name).toBe('Gas');
    });

    it('should return 404 for non-existent service', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .get(`/api/utility-services/${fakeId}`);

      expect(response.status).toBe(404);
    });

    it('should handle invalid ID format', async () => {
      const response = await request(app)
        .get('/api/utility-services/invalid-id');

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Invalid');
    });

  });

  describe('PUT /api/utility-services/:id', () => {
    it('should update a utility service', async () => {
      const service = await UtilityService.create({
        _id: 'service-waste-001',
        name: 'Waste Collection',
        unitPrice: 500,
        user: 'test-user-123'
      });

      const response = await request(app)
        .put(`/api/utility-services/${service._id}`)
        .send({ unitPrice: 600, details: 'Updated waste collection service' });

      expect(response.status).toBe(200);
      expect(response.body.unitPrice).toBe(600);
      expect(response.body.details).toBe('Updated waste collection service');
    });

    it('should return 404 when updating non-existent service', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .put(`/api/utility-services/${fakeId}`)
        .send({ unitPrice: 100 });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/utility-services/:id', () => {
    it('should delete a utility service', async () => {
      const service = await UtilityService.create({
        _id: 'service-security-001',
        name: 'Security',
        unitPrice: 1000,
        user: 'test-user-123'
      });

      const response = await request(app)
        .delete(`/api/utility-services/${service._id}`);

      expect(response.status).toBe(200);

      const deletedService = await UtilityService.findById(service._id);
      expect(deletedService).toBeNull();
    });

    it('should return 404 for non-existent service', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .delete(`/api/utility-services/${fakeId}`);

      expect(response.status).toBe(404);
    });

    it('should handle invalid ID format', async () => {
      const response = await request(app)
        .delete('/api/utility-services/invalid-id');

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Invalid');
    });
  });
});
