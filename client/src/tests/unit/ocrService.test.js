import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { uploadForOcr } from '../../services/ocrService';
import api from '../../services/api';

vi.mock('../../services/api', () => ({
  default: {
    post: vi.fn(),
  },
}));

describe('ocrService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('uploadForOcr', () => {
    it('should upload a receipt file for OCR analysis', async () => {
      const file = new File(['receipt content'], 'receipt.jpg', { type: 'image/jpeg' });
      const documentType = 'receipt';

      const serverResponse = {
        data: {
          merchantName: 'Test Store',
          total: 50.99,
          date: '2025-01-01',
          items: [{ description: 'Item 1', amount: 50.99 }],
        },
        documentType: 'receipt',
        confidence: 0.95,
      };

      api.post.mockResolvedValue({ data: serverResponse });

      const result = await uploadForOcr(file, documentType);

      expect(api.post).toHaveBeenCalledWith(
        '/ocr/upload',
        expect.any(FormData),
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      // Verify FormData contains correct fields
      const callArgs = api.post.mock.calls[0];
      const formData = callArgs[1];
      expect(formData.get('document')).toBe(file);
      expect(formData.get('documentType')).toBe('receipt');

      // The client normalizes the server response; verify the normalized shape
      expect(result.data).toEqual(serverResponse.data);
      expect(result.documentType).toBe('receipt');
      expect(result.success).toBe(true);
    });

    it('should upload a utility bill for OCR analysis', async () => {
      const file = new File(['utility bill content'], 'bill.pdf', { type: 'application/pdf' });
      const documentType = 'utility';

      const serverResponse = {
        data: {
          serviceName: 'Electricity',
          accountNumber: '123456789',
          total: 100.50,
          dueDate: '2025-02-01',
        },
        documentType: 'utility',
        confidence: 0.92,
      };

      api.post.mockResolvedValue({ data: serverResponse });

      const result = await uploadForOcr(file, documentType);

      const callArgs = api.post.mock.calls[0];
      const formData = callArgs[1];
      expect(formData.get('document')).toBe(file);
      expect(formData.get('documentType')).toBe('utility');

      expect(result.data).toEqual(serverResponse.data);
      expect(result.documentType).toBe('utility');
      expect(result.success).toBe(true);
    });

    it('should handle OCR processing errors', async () => {
      const file = new File(['corrupt file'], 'corrupt.jpg', { type: 'image/jpeg' });
      const documentType = 'receipt';

      const mockError = new Error('OCR processing failed');
      mockError.response = { status: 422 };
      api.post.mockRejectedValue(mockError);

      await expect(uploadForOcr(file, documentType)).rejects.toThrow('OCR processing failed');
    });

    it('should handle unsupported file type errors', async () => {
      const file = new File(['text content'], 'document.txt', { type: 'text/plain' });
      const documentType = 'receipt';

      const mockError = new Error('Unsupported file type');
      mockError.response = { status: 400 };
      api.post.mockRejectedValue(mockError);

      await expect(uploadForOcr(file, documentType)).rejects.toThrow('Unsupported file type');
    });

    it('should handle file size limit errors', async () => {
      const largeFile = new File(['x'.repeat(10 * 1024 * 1024)], 'large.jpg', { type: 'image/jpeg' });
      const documentType = 'receipt';

      const mockError = new Error('File too large');
      mockError.response = { status: 413 };
      api.post.mockRejectedValue(mockError);

      await expect(uploadForOcr(largeFile, documentType)).rejects.toThrow('File too large');
    });

    it('should handle network errors', async () => {
      const file = new File(['content'], 'receipt.jpg', { type: 'image/jpeg' });
      const documentType = 'receipt';

      const mockError = new Error('Network error');
      api.post.mockRejectedValue(mockError);

      await expect(uploadForOcr(file, documentType)).rejects.toThrow('Network error');
    });

    it('should handle missing document type', async () => {
      const file = new File(['content'], 'receipt.jpg', { type: 'image/jpeg' });
      const documentType = '';

      const mockError = new Error('Document type is required');
      mockError.response = { status: 400 };
      api.post.mockRejectedValue(mockError);

      await expect(uploadForOcr(file, documentType)).rejects.toThrow('Document type is required');
    });
  });
});
