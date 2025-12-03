/**
 * OCR Orchestration Service Unit Tests
 * Tests for billing context, file organization, deduplication, and record persistence
 */

const {
  determineBillingContext,
  getUserTier,
  cacheOcrDataInAnalysisEvent
} = require('../../src/services/ocr/orchestration/ocrOrchestration');
const { clerkClient } = require('@clerk/clerk-sdk-node');
const Subscription = require('../../src/models/Subscription');
const AnalysisEvent = require('../../src/models/AnalysisEvent');

jest.mock('@clerk/clerk-sdk-node', () => ({
  clerkClient: {
    users: {
      getUser: jest.fn()
    }
  }
}));
jest.mock('../../src/models/Subscription');
jest.mock('../../src/models/AnalysisEvent');

describe('OCR Orchestration Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('determineBillingContext', () => {
    it('should handle seller upload correctly', async () => {
      const req = {
        auth: { userId: 'seller_123' },
        body: {}
      };

      const mockAuthUser = {
        publicMetadata: { role: 'seller' }
      };

      clerkClient.users.getUser.mockResolvedValue(mockAuthUser);

      const result = await determineBillingContext(req);

      expect(result.billingSellerId).toBe('seller_123');
      expect(result.uploaderId).toBe('seller_123');
      expect(result.uploaderType).toBe('seller');
      expect(result.uploaderName).toBeNull();
    });

    it('should handle customer upload with valid sellerId', async () => {
      const req = {
        auth: { userId: 'customer_456' },
        body: { sellerId: 'seller_789', documentType: 'receipt' }
      };

      const mockCustomer = {
        publicMetadata: { role: 'customer' },
        firstName: 'John',
        lastName: 'Doe',
        emailAddresses: [{ emailAddress: 'john@example.com' }]
      };

      const mockSeller = {
        publicMetadata: { role: 'seller' },
        firstName: 'Jane',
        username: 'janeseller'
      };

      clerkClient.users.getUser
        .mockResolvedValueOnce(mockCustomer)
        .mockResolvedValueOnce(mockSeller);

      const result = await determineBillingContext(req);

      expect(result.billingSellerId).toBe('seller_789');
      expect(result.uploaderId).toBe('customer_456');
      expect(result.uploaderType).toBe('customer');
      expect(result.uploaderName).toBe('John Doe');
    });

    it('should throw error when customer upload missing sellerId', async () => {
      const req = {
        auth: { userId: 'customer_123' },
        body: { documentType: 'receipt' }
      };

      const mockCustomer = {
        publicMetadata: { role: 'customer' },
        firstName: 'John',
        lastName: 'Doe'
      };

      clerkClient.users.getUser.mockResolvedValue(mockCustomer);

      await expect(determineBillingContext(req)).rejects.toThrow('Missing sellerId');
    });

    it('should throw error when sellerId is not a seller', async () => {
      const req = {
        auth: { userId: 'customer_123' },
        body: { sellerId: 'invalid_seller' }
      };

      const mockCustomer = {
        publicMetadata: { role: 'customer' }
      };

      const mockInvalidSeller = {
        publicMetadata: { role: 'customer' } // Not a seller!
      };

      clerkClient.users.getUser
        .mockResolvedValueOnce(mockCustomer)
        .mockResolvedValueOnce(mockInvalidSeller);

      await expect(determineBillingContext(req)).rejects.toThrow('Invalid sellerId');
    });

    it('should use DEV_TEST_SELLER_ID when no auth', async () => {
      const originalEnv = process.env.DEV_TEST_SELLER_ID;
      process.env.DEV_TEST_SELLER_ID = 'dev_seller_123';

      const req = {
        body: {}
      };

      const result = await determineBillingContext(req);

      expect(result.billingSellerId).toBe('dev_seller_123');
      expect(result.uploaderId).toBeNull();
      expect(result.uploaderType).toBe('seller');

      process.env.DEV_TEST_SELLER_ID = originalEnv;
    });

    it('should throw error when no auth and no DEV_TEST_SELLER_ID', async () => {
      const originalEnv = process.env.DEV_TEST_SELLER_ID;
      delete process.env.DEV_TEST_SELLER_ID;

      const req = {
        body: {}
      };

      await expect(determineBillingContext(req)).rejects.toThrow('Unauthorized');

      process.env.DEV_TEST_SELLER_ID = originalEnv;
    });

    it('should extract customer name from firstName and lastName', async () => {
      const req = {
        auth: { userId: 'customer_123' },
        body: { sellerId: 'seller_456' }
      };

      const mockCustomer = {
        publicMetadata: { role: 'customer' },
        firstName: 'Alice',
        lastName: 'Smith',
        emailAddresses: []
      };

      const mockSeller = {
        publicMetadata: { role: 'seller' }
      };

      clerkClient.users.getUser
        .mockResolvedValueOnce(mockCustomer)
        .mockResolvedValueOnce(mockSeller);

      const result = await determineBillingContext(req);

      expect(result.uploaderName).toBe('Alice Smith');
    });

    it('should fall back to username when name not available', async () => {
      const req = {
        auth: { userId: 'customer_123' },
        body: { sellerId: 'seller_456' }
      };

      const mockCustomer = {
        publicMetadata: { role: 'customer' },
        username: 'alicesmith',
        emailAddresses: []
      };

      const mockSeller = {
        publicMetadata: { role: 'seller' }
      };

      clerkClient.users.getUser
        .mockResolvedValueOnce(mockCustomer)
        .mockResolvedValueOnce(mockSeller);

      const result = await determineBillingContext(req);

      expect(result.uploaderName).toBe('alicesmith');
    });

    it('should fall back to email when name and username not available', async () => {
      const req = {
        auth: { userId: 'customer_123' },
        body: { sellerId: 'seller_456' }
      };

      const mockCustomer = {
        publicMetadata: { role: 'customer' },
        emailAddresses: [{ emailAddress: 'alice@example.com' }]
      };

      const mockSeller = {
        publicMetadata: { role: 'seller' }
      };

      clerkClient.users.getUser
        .mockResolvedValueOnce(mockCustomer)
        .mockResolvedValueOnce(mockSeller);

      const result = await determineBillingContext(req);

      expect(result.uploaderName).toBe('alice@example.com');
    });
  });

  describe('getUserTier', () => {
    it('should return trial when no userId', async () => {
      const tier = await getUserTier(null);
      expect(tier).toBe('trial');
    });

    it('should return subscription tier when found', async () => {
      const mockSubscription = {
        userId: 'user_123',
        tier: 'enterprise'
      };

      Subscription.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockSubscription)
      });

      const tier = await getUserTier('user_123');
      expect(tier).toBe('enterprise');
    });

    it('should return trial when no subscription found', async () => {
      Subscription.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null)
      });

      const tier = await getUserTier('user_456');
      expect(tier).toBe('trial');
    });

    it('should return trial on error', async () => {
      Subscription.findOne.mockReturnValue({
        exec: jest.fn().mockRejectedValue(new Error('Database error'))
      });

      const tier = await getUserTier('user_789');
      expect(tier).toBe('trial');
    });

    it('should handle basic tier', async () => {
      const mockSubscription = {
        userId: 'user_basic',
        tier: 'basic'
      };

      Subscription.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockSubscription)
      });

      const tier = await getUserTier('user_basic');
      expect(tier).toBe('basic');
    });

    it('should handle pro tier', async () => {
      const mockSubscription = {
        userId: 'user_pro',
        tier: 'pro'
      };

      Subscription.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockSubscription)
      });

      const tier = await getUserTier('user_pro');
      expect(tier).toBe('pro');
    });
  });

  describe('cacheOcrDataInAnalysisEvent', () => {
    it('should cache OCR data successfully', async () => {
      const analysisId = 'analysis_123';
      const cacheData = {
        extractedData: { businessName: 'Test Store', total: 50.00 },
        parsedFields: { amount: 50.00 },
        driverRaw: { pages: [] },
        documentType: 'receipt',
        mimeType: 'image/jpeg'
      };

      AnalysisEvent.updateOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ nModified: 1 })
      });

      await cacheOcrDataInAnalysisEvent(analysisId, cacheData);

      expect(AnalysisEvent.updateOne).toHaveBeenCalledWith(
        { analysisId },
        expect.objectContaining({
          $set: expect.objectContaining({
            'metadata.cachedOcrData': expect.objectContaining({
              extractedData: cacheData.extractedData,
              parsedFields: cacheData.parsedFields,
              driverRaw: cacheData.driverRaw,
              documentType: 'receipt',
              mimeType: 'image/jpeg',
              cachedAt: expect.any(Date)
            })
          })
        })
      );
    });

    it('should handle caching errors gracefully', async () => {
      const analysisId = 'analysis_456';
      const cacheData = {
        extractedData: {},
        parsedFields: {},
        driverRaw: {},
        documentType: 'invoice',
        mimeType: 'application/pdf'
      };

      AnalysisEvent.updateOne.mockReturnValue({
        exec: jest.fn().mockRejectedValue(new Error('Database error'))
      });

      // Should not throw
      await expect(
        cacheOcrDataInAnalysisEvent(analysisId, cacheData)
      ).resolves.not.toThrow();
    });

    it('should default documentType to receipt if not provided', async () => {
      const analysisId = 'analysis_789';
      const cacheData = {
        extractedData: {},
        parsedFields: {},
        driverRaw: {},
        mimeType: 'image/png'
      };

      AnalysisEvent.updateOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ nModified: 1 })
      });

      await cacheOcrDataInAnalysisEvent(analysisId, cacheData);

      expect(AnalysisEvent.updateOne).toHaveBeenCalledWith(
        { analysisId },
        expect.objectContaining({
          $set: expect.objectContaining({
            'metadata.cachedOcrData': expect.objectContaining({
              documentType: 'receipt' // Default value
            })
          })
        })
      );
    });
  });
});
