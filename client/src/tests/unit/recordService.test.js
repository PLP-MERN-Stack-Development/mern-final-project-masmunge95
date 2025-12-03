import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getRecords, createRecord, deleteRecord } from '../../services/recordService';
import api from '../../services/api';

vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('recordService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getRecords', () => {
    it('should fetch all records successfully', async () => {
      const mockRecords = [
        {
          _id: 'rec-1',
          customerId: 'cust-1',
          recordType: 'receipt',
          amount: 50,
          date: '2025-01-01',
        },
        {
          _id: 'rec-2',
          customerId: 'cust-2',
          recordType: 'utility',
          amount: 100,
          date: '2025-01-02',
        },
      ];

      api.get.mockResolvedValue({ data: mockRecords });

      const result = await getRecords();

      expect(api.get).toHaveBeenCalledWith('/records');
      expect(result).toEqual(mockRecords);
    });

    it('should handle errors when fetching records', async () => {
      const mockError = new Error('Network error');
      api.get.mockRejectedValue(mockError);

      await expect(getRecords()).rejects.toThrow('Network error');
      expect(api.get).toHaveBeenCalledWith('/records');
    });

    it('should return empty array when no records exist', async () => {
      api.get.mockResolvedValue({ data: [] });

      const result = await getRecords();

      expect(result).toEqual([]);
    });
  });

  describe('createRecord', () => {
    it('should create a new record with FormData successfully', async () => {
      const formData = new FormData();
      formData.append('customerId', 'cust-1');
      formData.append('recordType', 'receipt');
      formData.append('amount', '50');
      formData.append('file', new Blob(['test'], { type: 'image/png' }), 'receipt.png');

      const mockResponse = {
        _id: 'rec-new',
        customerId: 'cust-1',
        recordType: 'receipt',
        amount: 50,
        imageUrl: '/uploads/receipt.png',
      };

      api.post.mockResolvedValue({ data: mockResponse });

      const result = await createRecord(formData);

      expect(api.post).toHaveBeenCalledWith('/records', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      expect(result).toEqual(mockResponse);
    });

    it('should handle file upload errors', async () => {
      const formData = new FormData();
      const mockError = new Error('File too large');
      mockError.response = { status: 413 };
      api.post.mockRejectedValue(mockError);

      await expect(createRecord(formData)).rejects.toThrow('File too large');
    });

    it('should handle validation errors', async () => {
      const formData = new FormData();
      formData.append('customerId', 'cust-1');
      // Missing required fields

      const mockError = new Error('Validation failed');
      mockError.response = { status: 400 };
      api.post.mockRejectedValue(mockError);

      await expect(createRecord(formData)).rejects.toThrow('Validation failed');
    });
  });

  describe('deleteRecord', () => {
    it('should delete a record successfully', async () => {
      const recordId = 'rec-1';
      const mockResponse = { message: 'Record deleted successfully' };

      api.delete.mockResolvedValue({ data: mockResponse });

      const result = await deleteRecord(recordId);

      expect(api.delete).toHaveBeenCalledWith(`/records/${recordId}`);
      expect(result).toEqual(mockResponse);
    });

    it('should handle record not found error', async () => {
      const recordId = 'nonexistent';
      const mockError = new Error('Record not found');
      mockError.response = { status: 404 };
      api.delete.mockRejectedValue(mockError);

      await expect(deleteRecord(recordId)).rejects.toThrow('Record not found');
      expect(api.delete).toHaveBeenCalledWith(`/records/${recordId}`);
    });

    it('should handle server errors on delete', async () => {
      const recordId = 'rec-1';
      const mockError = new Error('Internal server error');
      mockError.response = { status: 500 };
      api.delete.mockRejectedValue(mockError);

      await expect(deleteRecord(recordId)).rejects.toThrow('Internal server error');
    });
  });
});
