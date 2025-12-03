/**
 * OCR Analytics Service Unit Tests
 * Tests for analysis event tracking and deduplication
 */

const {
  checkDuplicateAnalysis,
  createAnalysisEvent,
  trackOCRUsage
} = require('../../src/services/ocr/analytics/ocrAnalytics');
const AnalysisEvent = require('../../src/models/AnalysisEvent');
const Subscription = require('../../src/models/Subscription');

jest.mock('../../src/models/AnalysisEvent');
jest.mock('../../src/models/Subscription');

describe('OCR Analytics Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkDuplicateAnalysis', () => {
    it('should return null when no uploadId provided', async () => {
      const result = await checkDuplicateAnalysis(null);
      expect(result).toBeNull();
      expect(AnalysisEvent.findOne).not.toHaveBeenCalled();
    });

    it('should return null when no duplicate found', async () => {
      AnalysisEvent.findOne.mockResolvedValue(null);

      const result = await checkDuplicateAnalysis('upload_123');
      
      expect(result).toBeNull();
      expect(AnalysisEvent.findOne).toHaveBeenCalledWith({ uploadId: 'upload_123' });
    });

    it('should return existing analysis when duplicate found', async () => {
      const mockAnalysis = {
        analysisId: 'analysis_456',
        uploadId: 'upload_123',
        documentType: 'receipt'
      };

      AnalysisEvent.findOne.mockResolvedValue(mockAnalysis);

      const result = await checkDuplicateAnalysis('upload_123');
      
      expect(result).toEqual(mockAnalysis);
      expect(AnalysisEvent.findOne).toHaveBeenCalledWith({ uploadId: 'upload_123' });
    });

    it('should handle database errors gracefully', async () => {
      AnalysisEvent.findOne.mockRejectedValue(new Error('Database error'));

      const result = await checkDuplicateAnalysis('upload_789');
      
      expect(result).toBeNull();
    });
  });

  describe('createAnalysisEvent', () => {
    it('should create analysis event with all data', async () => {
      const eventData = {
        userId: 'user_123',
        uploadId: 'upload_456',
        documentType: 'receipt',
        fileName: 'receipt.jpg',
        fileSize: 1024,
        mimeType: 'image/jpeg',
        extractedData: { businessName: 'Test Store', total: 50.00 },
        ocrRawResults: { pages: [] },
        confidence: 0.95,
        processingTime: 1500
      };

      const mockCreatedEvent = {
        ...eventData,
        analysisId: 'analysis_789',
        analyzedAt: new Date()
      };

      AnalysisEvent.create.mockResolvedValue(mockCreatedEvent);

      const result = await createAnalysisEvent(eventData);

      expect(result).toEqual(mockCreatedEvent);
      expect(AnalysisEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          analysisId: expect.any(String),
          uploadId: 'upload_456',
          user: 'user_123',
          documentType: 'receipt',
          fileName: 'receipt.jpg',
          fileSize: 1024,
          mimeType: 'image/jpeg',
          extractedData: eventData.extractedData,
          ocrRawResults: eventData.ocrRawResults,
          confidence: 0.95,
          processingTime: 1500,
          analyzedAt: expect.any(Date)
        })
      );
    });

    it('should handle missing optional fields', async () => {
      const eventData = {
        userId: 'user_123',
        documentType: 'invoice',
        fileName: 'invoice.pdf'
      };

      const mockCreatedEvent = {
        ...eventData,
        analysisId: 'analysis_abc',
        uploadId: null,
        fileSize: 0,
        mimeType: 'application/octet-stream',
        ocrRawResults: null,
        confidence: null,
        processingTime: 0
      };

      AnalysisEvent.create.mockResolvedValue(mockCreatedEvent);

      const result = await createAnalysisEvent(eventData);

      expect(AnalysisEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          uploadId: null,
          fileSize: 0,
          mimeType: 'application/octet-stream',
          ocrRawResults: null,
          confidence: null,
          processingTime: 0
        })
      );
    });

    it('should handle creation errors', async () => {
      const eventData = {
        userId: 'user_123',
        documentType: 'receipt',
        fileName: 'test.jpg'
      };

      AnalysisEvent.create.mockRejectedValue(new Error('Database error'));

      const result = await createAnalysisEvent(eventData);

      expect(result).toBeNull();
    });

    it('should generate unique analysisId', async () => {
      const eventData = {
        userId: 'user_123',
        documentType: 'receipt',
        fileName: 'test.jpg'
      };

      AnalysisEvent.create.mockImplementation((data) => Promise.resolve(data));

      const result = await createAnalysisEvent(eventData);

      expect(result.analysisId).toBeDefined();
      expect(typeof result.analysisId).toBe('string');
      expect(result.analysisId.length).toBeGreaterThan(0);
    });
  });

  describe('trackOCRUsage', () => {
    it('should track seller OCR scans for receipt', async () => {
      const mockSubscription = {
        _id: 'sub_123',
        user: 'user_123',
        usage: { sellerOcrScans: 5 }
      };

      Subscription.findOne.mockResolvedValue(mockSubscription);
      Subscription.findByIdAndUpdate.mockResolvedValue({
        ...mockSubscription,
        usage: { sellerOcrScans: 6 }
      });

      const result = await trackOCRUsage('user_123', 'receipt');

      expect(result).toBe(true);
      expect(Subscription.findByIdAndUpdate).toHaveBeenCalledWith(
        'sub_123',
        { $inc: { 'usage.sellerOcrScans': 1 } }
      );
    });

    it('should track seller OCR scans for utility bills', async () => {
      const mockSubscription = {
        _id: 'sub_456',
        user: 'user_456',
        usage: { sellerOcrScans: 10 }
      };

      Subscription.findOne.mockResolvedValue(mockSubscription);
      Subscription.findByIdAndUpdate.mockResolvedValue(mockSubscription);

      const result = await trackOCRUsage('user_456', 'utility');

      expect(result).toBe(true);
      expect(Subscription.findByIdAndUpdate).toHaveBeenCalledWith(
        'sub_456',
        { $inc: { 'usage.sellerOcrScans': 1 } }
      );
    });

    it('should track customer OCR scans for customer documents', async () => {
      const mockSubscription = {
        _id: 'sub_789',
        user: 'user_789',
        usage: { customerOcrScans: 3 }
      };

      Subscription.findOne.mockResolvedValue(mockSubscription);
      Subscription.findByIdAndUpdate.mockResolvedValue(mockSubscription);

      const result = await trackOCRUsage('user_789', 'customer');

      expect(result).toBe(true);
      expect(Subscription.findByIdAndUpdate).toHaveBeenCalledWith(
        'sub_789',
        { $inc: { 'usage.customerOcrScans': 1 } }
      );
    });

    it('should track customer OCR scans for customer consumption', async () => {
      const mockSubscription = {
        _id: 'sub_abc',
        user: 'user_abc',
        usage: { customerOcrScans: 7 }
      };

      Subscription.findOne.mockResolvedValue(mockSubscription);
      Subscription.findByIdAndUpdate.mockResolvedValue(mockSubscription);

      const result = await trackOCRUsage('user_abc', 'customer-consumption');

      expect(result).toBe(true);
      expect(Subscription.findByIdAndUpdate).toHaveBeenCalledWith(
        'sub_abc',
        { $inc: { 'usage.customerOcrScans': 1 } }
      );
    });

    it('should default to sellerOcrScans for unknown document types', async () => {
      const mockSubscription = {
        _id: 'sub_def',
        user: 'user_def',
        usage: { sellerOcrScans: 2 }
      };

      Subscription.findOne.mockResolvedValue(mockSubscription);
      Subscription.findByIdAndUpdate.mockResolvedValue(mockSubscription);

      const result = await trackOCRUsage('user_def', 'unknown-type');

      expect(result).toBe(true);
      expect(Subscription.findByIdAndUpdate).toHaveBeenCalledWith(
        'sub_def',
        { $inc: { 'usage.sellerOcrScans': 1 } }
      );
    });

    it('should return false when no subscription found', async () => {
      Subscription.findOne.mockResolvedValue(null);

      const result = await trackOCRUsage('user_nonexistent', 'receipt');

      expect(result).toBe(false);
      expect(Subscription.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      Subscription.findOne.mockRejectedValue(new Error('Database error'));

      const result = await trackOCRUsage('user_error', 'receipt');

      expect(result).toBe(false);
    });

    it('should handle update errors gracefully', async () => {
      const mockSubscription = {
        _id: 'sub_error',
        user: 'user_error',
        usage: { sellerOcrScans: 5 }
      };

      Subscription.findOne.mockResolvedValue(mockSubscription);
      Subscription.findByIdAndUpdate.mockRejectedValue(new Error('Update error'));

      const result = await trackOCRUsage('user_error', 'receipt');

      expect(result).toBe(false);
    });
  });
});
