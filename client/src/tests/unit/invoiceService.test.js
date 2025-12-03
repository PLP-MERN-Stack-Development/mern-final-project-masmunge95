import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getInvoices,
  getInvoice,
  createInvoice,
  updateInvoice,
  sendInvoice,
  deleteInvoice,
} from '../../services/invoiceService';
import api from '../../services/api';

vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('invoiceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getInvoices', () => {
    it('should fetch all invoices with sync flag', async () => {
      const mockInvoices = [
        {
          _id: 'inv-1',
          customerId: 'cust-1',
          items: [{ description: 'Service', amount: 100 }],
          total: 100,
          status: 'pending',
        },
        {
          _id: 'inv-2',
          customerId: 'cust-2',
          items: [{ description: 'Product', amount: 200 }],
          total: 200,
          status: 'paid',
        },
      ];

      api.get.mockResolvedValue({ data: mockInvoices });

      const result = await getInvoices({ sync: true });

      expect(api.get).toHaveBeenCalledWith('/invoices?sync=true');
      expect(result).toEqual(mockInvoices);
    });

    it('should handle errors when fetching invoices', async () => {
      const mockError = new Error('Network error');
      api.get.mockRejectedValue(mockError);

      await expect(getInvoices()).rejects.toThrow('Network error');
    });
  });

  describe('getInvoice', () => {
    it('should fetch a single invoice by ID', async () => {
      const mockInvoice = {
        _id: 'inv-1',
        customerId: 'cust-1',
        items: [{ description: 'Service', amount: 100 }],
        total: 100,
        status: 'pending',
      };

      api.get.mockResolvedValue({ data: mockInvoice });

      const result = await getInvoice('inv-1');

      expect(api.get).toHaveBeenCalledWith('/invoices/inv-1');
      expect(result).toEqual(mockInvoice);
    });

    it('should handle invoice not found', async () => {
      const mockError = new Error('Invoice not found');
      mockError.response = { status: 404 };
      api.get.mockRejectedValue(mockError);

      await expect(getInvoice('nonexistent')).rejects.toThrow('Invoice not found');
    });
  });

  describe('createInvoice', () => {
    it('should create a new invoice successfully', async () => {
      const newInvoice = {
        _id: 'inv-new',
        customerId: 'cust-1',
        items: [{ description: 'New Service', amount: 150 }],
        total: 150,
        status: 'draft',
      };

      api.post.mockResolvedValue({ data: newInvoice });

      const result = await createInvoice(newInvoice);

      expect(api.post).toHaveBeenCalledWith('/invoices', newInvoice);
      expect(result).toEqual(newInvoice);
    });

    it('should handle validation errors', async () => {
      const invalidInvoice = {
        // Missing required fields
        items: [],
      };

      const mockError = new Error('Invalid invoice data');
      mockError.response = { status: 400 };
      api.post.mockRejectedValue(mockError);

      await expect(createInvoice(invalidInvoice)).rejects.toThrow('Invalid invoice data');
    });
  });

  describe('updateInvoice', () => {
    it('should update an invoice successfully', async () => {
      const invoiceId = 'inv-1';
      const updatedData = {
        items: [{ description: 'Updated Service', amount: 200 }],
        total: 200,
      };

      const mockResponse = { _id: invoiceId, ...updatedData, status: 'pending' };
      api.put.mockResolvedValue({ data: mockResponse });

      const result = await updateInvoice(invoiceId, updatedData);

      expect(api.put).toHaveBeenCalledWith(`/invoices/${invoiceId}`, updatedData);
      expect(result).toEqual(mockResponse);
    });

    it('should handle invoice not found on update', async () => {
      const mockError = new Error('Invoice not found');
      mockError.response = { status: 404 };
      api.put.mockRejectedValue(mockError);

      await expect(updateInvoice('nonexistent', {})).rejects.toThrow('Invoice not found');
    });
  });

  describe('sendInvoice', () => {
    it('should send an invoice successfully', async () => {
      const invoiceId = 'inv-1';
      const mockResponse = { _id: invoiceId, status: 'sent', sentAt: new Date() };

      api.post.mockResolvedValue({ data: mockResponse });

      const result = await sendInvoice(invoiceId);

      expect(api.post).toHaveBeenCalledWith(`/invoices/${invoiceId}/send`);
      expect(result).toEqual(mockResponse);
    });

    it('should handle errors when sending invoice', async () => {
      const mockError = new Error('Failed to send invoice');
      api.post.mockRejectedValue(mockError);

      await expect(sendInvoice('inv-1')).rejects.toThrow('Failed to send invoice');
    });
  });

  describe('deleteInvoice', () => {
    it('should delete an invoice successfully', async () => {
      const invoiceId = 'inv-1';
      const mockResponse = { message: 'Invoice deleted successfully' };

      api.delete.mockResolvedValue({ data: mockResponse });

      const result = await deleteInvoice(invoiceId);

      expect(api.delete).toHaveBeenCalledWith(`/invoices/${invoiceId}`);
      expect(result).toEqual(mockResponse);
    });

    it('should handle invoice not found on delete', async () => {
      const mockError = new Error('Invoice not found');
      mockError.response = { status: 404 };
      api.delete.mockRejectedValue(mockError);

      await expect(deleteInvoice('nonexistent')).rejects.toThrow('Invoice not found');
    });
  });
});
