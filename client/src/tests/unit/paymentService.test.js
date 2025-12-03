import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { makePayment } from '../../services/paymentService';
import api from '../../services/api';

vi.mock('../../services/api', () => ({
  default: {
    post: vi.fn(),
  },
}));

describe('paymentService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('makePayment', () => {
    it('should initiate payment successfully', async () => {
      const invoiceId = 'inv-1';
      const paymentDetails = {
        amount: 100,
        currency: 'USD',
        customerEmail: 'customer@example.com',
      };

      const mockResponse = {
        paymentLink: 'https://payment.provider.com/pay/abc123',
        transactionId: 'txn-123',
        status: 'pending',
      };

      api.post.mockResolvedValue({ data: mockResponse });

      const result = await makePayment(invoiceId, paymentDetails);

      expect(api.post).toHaveBeenCalledWith('/payments/pay', {
        _id: invoiceId,
        invoiceId: invoiceId,
        ...paymentDetails,
      });
      expect(result).toEqual(mockResponse);
    });

    it('should handle payment initiation with minimal details', async () => {
      const invoiceId = 'inv-2';
      const paymentDetails = {};

      const mockResponse = {
        paymentLink: 'https://payment.provider.com/pay/xyz789',
        transactionId: 'txn-456',
        status: 'pending',
      };

      api.post.mockResolvedValue({ data: mockResponse });

      const result = await makePayment(invoiceId, paymentDetails);

      expect(api.post).toHaveBeenCalledWith('/payments/pay', {
        _id: invoiceId,
        invoiceId: invoiceId,
      });
      expect(result).toEqual(mockResponse);
    });

    it('should handle invalid invoice ID error', async () => {
      const invoiceId = 'invalid-id';
      const paymentDetails = { amount: 100 };

      const mockError = new Error('Invalid invoice ID');
      mockError.response = { status: 400 };
      api.post.mockRejectedValue(mockError);

      await expect(makePayment(invoiceId, paymentDetails)).rejects.toThrow('Invalid invoice ID');
    });

    it('should handle invoice not found error', async () => {
      const invoiceId = 'nonexistent';
      const paymentDetails = { amount: 100 };

      const mockError = new Error('Invoice not found');
      mockError.response = { status: 404 };
      api.post.mockRejectedValue(mockError);

      await expect(makePayment(invoiceId, paymentDetails)).rejects.toThrow('Invoice not found');
    });

    it('should handle payment provider errors', async () => {
      const invoiceId = 'inv-1';
      const paymentDetails = { amount: 100 };

      const mockError = new Error('Payment provider unavailable');
      mockError.response = { status: 503 };
      api.post.mockRejectedValue(mockError);

      await expect(makePayment(invoiceId, paymentDetails)).rejects.toThrow('Payment provider unavailable');
    });

    it('should handle network errors', async () => {
      const invoiceId = 'inv-1';
      const paymentDetails = { amount: 100 };

      const mockError = new Error('Network error');
      api.post.mockRejectedValue(mockError);

      await expect(makePayment(invoiceId, paymentDetails)).rejects.toThrow('Network error');
    });

    it('should pass through additional payment details', async () => {
      const invoiceId = 'inv-1';
      const paymentDetails = {
        amount: 150.50,
        currency: 'KES',
        customerEmail: 'test@example.com',
        customerPhone: '+254712345678',
        description: 'Payment for services',
      };

      const mockResponse = {
        paymentLink: 'https://payment.provider.com/pay/custom123',
        transactionId: 'txn-789',
        status: 'pending',
      };

      api.post.mockResolvedValue({ data: mockResponse });

      const result = await makePayment(invoiceId, paymentDetails);

      expect(api.post).toHaveBeenCalledWith('/payments/pay', {
        _id: invoiceId,
        invoiceId: invoiceId,
        amount: 150.50,
        currency: 'KES',
        customerEmail: 'test@example.com',
        customerPhone: '+254712345678',
        description: 'Payment for services',
      });
      expect(result).toEqual(mockResponse);
    });
  });
});
