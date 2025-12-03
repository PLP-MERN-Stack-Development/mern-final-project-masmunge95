/**
 * Test Helpers - Utilities for testing
 */

/**
 * Generate a unique test user ID for each test run
 * This prevents quota/subscription limit issues
 */
function generateTestUserId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return `test-user-${timestamp}-${random}`;
}

/**
 * Mock Clerk auth for tests
 */
function mockClerkAuth(userId = null, role = 'seller') {
  return (req, res, next) => {
    req.auth = {
      userId: userId || generateTestUserId(),
      sessionClaims: {
        metadata: {
          role: role
        },
        publicMetadata: {
          role: role
        }
      }
    };
    next();
  };
}

/**
 * Create mock subscription with unlimited usage for tests
 */
function mockSubscription(userId) {
  return {
    userId: userId,
    plan: 'premium',
    status: 'active',
    limits: {
      ocrUploads: 999999,
      invoices: 999999,
      customers: 999999,
      records: 999999
    },
    usage: {
      ocrUploads: 0,
      invoices: 0,
      customers: 0,
      records: 0
    },
    currentPeriodStart: new Date(),
    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
  };
}

/**
 * Mock OCR service response
 */
function mockOCRResponse(documentType = 'invoice') {
  const baseResults = [
    { text: 'INVOICE', boundingBox: [100, 50, 200, 50, 200, 80, 100, 80] },
    { text: 'Customer: Test Customer', boundingBox: [100, 100, 300, 100, 300, 130, 100, 130] },
    { text: 'Amount: KES 1,500', boundingBox: [100, 150, 300, 150, 300, 180, 100, 180] },
    { text: 'Date: 2024-01-15', boundingBox: [100, 200, 300, 200, 300, 230, 100, 230] }
  ];

  if (documentType === 'utility') {
    return {
      results: [
        { text: 'SAFEMAG', boundingBox: [100, 50, 200, 50, 200, 80, 100, 80] },
        { text: '12.892662', boundingBox: [100, 100, 200, 100, 200, 130, 100, 130] },
        { text: 'Qn 1.5 m³/h', boundingBox: [100, 150, 200, 150, 200, 180, 100, 180] },
        { text: '00368215', boundingBox: [100, 250, 200, 250, 200, 280, 100, 280] }
      ],
      rawText: 'SAFEMAG\n12.892662\nQn 1.5 m³/h\n00368215'
    };
  }

  if (documentType === 'customer-consumption') {
    return {
      results: [
        { text: 'Customer Name: John Doe', boundingBox: [100, 50, 300, 50, 300, 80, 100, 80] },
        { text: 'Meter Reading: 1250', boundingBox: [100, 100, 300, 100, 300, 130, 100, 130] },
        { text: 'Previous Reading: 1100', boundingBox: [100, 150, 300, 150, 300, 180, 100, 180] },
        { text: 'Consumption: 150 units', boundingBox: [100, 200, 300, 200, 300, 230, 100, 230] }
      ],
      rawText: 'Customer Name: John Doe\nMeter Reading: 1250\nPrevious Reading: 1100\nConsumption: 150 units'
    };
  }

  if (documentType === 'inventory') {
    return {
      results: [
        { text: 'Product: Water Meter', boundingBox: [100, 50, 300, 50, 300, 80, 100, 80] },
        { text: 'SKU: WM-1500', boundingBox: [100, 100, 250, 100, 250, 130, 100, 130] },
        { text: 'Quantity: 45', boundingBox: [100, 150, 250, 150, 250, 180, 100, 180] },
        { text: 'Location: Warehouse A', boundingBox: [100, 200, 300, 200, 300, 230, 100, 230] }
      ],
      rawText: 'Product: Water Meter\nSKU: WM-1500\nQuantity: 45\nLocation: Warehouse A'
    };
  }

  if (documentType === 'customer') {
    return {
      results: [
        { text: 'Name: Jane Smith', boundingBox: [100, 50, 250, 50, 250, 80, 100, 80] },
        { text: 'Phone: +254712345678', boundingBox: [100, 100, 300, 100, 300, 130, 100, 130] },
        { text: 'Email: jane@example.com', boundingBox: [100, 150, 300, 150, 300, 180, 100, 180] },
        { text: 'Address: Nairobi', boundingBox: [100, 200, 250, 200, 250, 230, 100, 230] }
      ],
      rawText: 'Name: Jane Smith\nPhone: +254712345678\nEmail: jane@example.com\nAddress: Nairobi'
    };
  }

  return {
    results: baseResults,
    rawText: baseResults.map(r => r.text).join('\n')
  };
}

module.exports = {
  generateTestUserId,
  mockClerkAuth,
  mockSubscription,
  mockOCRResponse
};
