const request = require('supertest');
const express = require('express');
const path = require('path');
const fs = require('fs');
const ocrRoutes = require('../../src/routes/ocrRoutes');
const recordRoutes = require('../../src/routes/recordRoutes');
const errorHandler = require('../../src/middleware/errorHandler');

// Mock Azure OCR service with correct data structure
jest.mock('../../src/services/ocrService', () => ({
  analyzeImage: jest.fn().mockResolvedValue({
    results: [
      { text: 'INVOICE', boundingBox: [100, 50, 200, 50, 200, 80, 100, 80] },
      { text: 'Customer: Test Customer', boundingBox: [100, 100, 300, 100, 300, 130, 100, 130] },
      { text: 'Amount: KES 1,500', boundingBox: [100, 150, 300, 150, 300, 180, 100, 180] },
      { text: 'Date: 2024-01-15', boundingBox: [100, 200, 300, 200, 300, 230, 100, 230] }
    ],
    rawText: 'INVOICE\nCustomer: Test Customer\nAmount: KES 1,500\nDate: 2024-01-15'
  }),
  analyzeDocument: jest.fn().mockResolvedValue({
    results: [
      { text: 'INVOICE', boundingBox: [100, 50, 200, 50, 200, 80, 100, 80] },
      { text: 'Customer: Test Customer', boundingBox: [100, 100, 300, 100, 300, 130, 100, 130] },
      { text: 'Amount: KES 1,500', boundingBox: [100, 150, 300, 150, 300, 180, 100, 180] },
      { text: 'Date: 2024-01-15', boundingBox: [100, 200, 300, 200, 300, 230, 100, 230] }
    ],
    rawText: 'INVOICE\nCustomer: Test Customer\nAmount: KES 1,500\nDate: 2024-01-15'
  })
}));

// Mock Clerk SDK completely
jest.mock('@clerk/clerk-sdk-node', () => ({
  ClerkExpressRequireAuth: () => (req, res, next) => {
    req.auth = {
      userId: 'test-user-123',
      sessionClaims: {
        metadata: { role: 'seller' },
        publicMetadata: { role: 'seller' }
      }
    };
    next();
  },
  clerkClient: {
    users: {
      getUser: jest.fn().mockResolvedValue({
        id: 'test-user-123',
        firstName: 'Test',
        lastName: 'Seller',
        username: 'testseller',
        emailAddresses: [{ emailAddress: 'test@example.com' }],
        publicMetadata: { role: 'seller' }
      })
    }
  }
}));

// Mock subscription middleware - allow the request but do not alter subscriptions
jest.mock('../../src/middleware/subscriptionMiddleware', () => ({
  checkSubscription: (req, res, next) => next(),
  requireLimit: () => (req, res, next) => next(),
  trackUsage: () => (req, res, next) => next()
}));

const AnalysisEvent = require('../../src/models/AnalysisEvent');
const Subscription = require('../../src/models/Subscription');

describe('Billing flows (integration) — AnalysisEvent dedupe', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/ocr', ocrRoutes);
  app.use('/api/records', recordRoutes);
  app.use(errorHandler);

  const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'ocr');
  const testImagePath = path.join(__dirname, 'test-invoice.jpg');

  beforeAll(() => {
    // create minimal jpeg file
    const minimalJpeg = Buffer.from([0xFF,0xD8,0xFF,0xD9]);
    fs.writeFileSync(testImagePath, minimalJpeg);
  });

  afterAll(() => {
    if (fs.existsSync(testImagePath)) fs.unlinkSync(testImagePath);
    const testUserDir = path.join(uploadDir, 'test-user-123');
    if (fs.existsSync(testUserDir)) fs.rmSync(testUserDir, { recursive: true, force: true });
  });

  afterEach(async () => {
    // Clear AnalysisEvent and Subscription collections between tests
    await AnalysisEvent.deleteMany({});
    await Subscription.deleteMany({});
  });

  it('seller upload creates AnalysisEvent and bills seller ocrScans', async () => {
    // Ensure subscription exists for seller
    await Subscription.create({ userId: 'test-user-123', tier: 'basic', status: 'active' });

    const res = await request(app)
      .post('/api/ocr/upload')
      .attach('document', testImagePath)
      .field('documentType', 'invoice');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('analysisId');
    const analysisId = res.body.analysisId;
    expect(analysisId).toBeTruthy();

    const ae = await AnalysisEvent.findOne({ analysisId }).lean();
    expect(ae).toBeTruthy();
    expect(ae.sellerId).toBe('test-user-123');
    expect(ae.billedToSeller).toBe(true);

    const sub = await Subscription.findOne({ userId: 'test-user-123' }).lean();
    expect(sub).toBeTruthy();
    expect(sub.usage.ocrScans).toBe(1);
  });

  it('creating a record with existing analysisId does not bill customerOcrScans again', async () => {
    // Create subscription and an AnalysisEvent billed to seller
    await Subscription.create({ userId: 'test-user-123', tier: 'basic', status: 'active' });
    const ae = await AnalysisEvent.create({ analysisId: 'a-1', sellerId: 'test-user-123', uploaderType: 'seller', billedToSeller: true });

    const form = new FormData();
    const recordId = 'r-1';
    // Use supertest to send multipart/form-data via attach fields
    const res = await request(app)
      .post('/api/records')
      .field('_id', recordId)
      .field('ocrData', JSON.stringify({ extracted: { businessName: 'X' } }))
      .field('analysisId', 'a-1')
      .attach('image', testImagePath);

    expect(res.status).toBe(201);

    const sub = await Subscription.findOne({ userId: 'test-user-123' }).lean();
    expect(sub.usage.customerOcrScans).toBe(0);

    const updatedAe = await AnalysisEvent.findOne({ analysisId: 'a-1' }).lean();
    expect(updatedAe.billedToCustomer).toBe(false);
  });

  it('creating a record without analysisId and flagged as customer submission bills customerOcrScans', async () => {
    await Subscription.create({ userId: 'test-user-123', tier: 'basic', status: 'active' });

    const res = await request(app)
      .post('/api/records')
      .field('_id', 'r-2')
      .field('ocrData', JSON.stringify({ extracted: { businessName: 'CustX' } }))
      .field('isCustomerSubmission', 'true')
      .attach('image', testImagePath);

    expect(res.status).toBe(201);

    const sub = await Subscription.findOne({ userId: 'test-user-123' }).lean();
    expect(sub.usage.customerOcrScans).toBe(1);

    const ae = await AnalysisEvent.findOne({ sellerId: 'test-user-123' }).lean();
    expect(ae).toBeTruthy();
    expect(ae.uploaderType).toBe('customer');
    expect(ae.billedToCustomer).toBe(true);
  });
});
