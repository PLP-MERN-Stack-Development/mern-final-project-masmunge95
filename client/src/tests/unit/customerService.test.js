import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getCustomers, createCustomer, deleteCustomer } from '../../services/customerService';
import api from '../../services/api';

vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('customerService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getCustomers', () => {
    it('should fetch all customers successfully', async () => {
      const mockCustomers = [
        { _id: 'cust-1', name: 'John Doe', email: 'john@example.com', phone: '1234567890' },
        { _id: 'cust-2', name: 'Jane Smith', email: 'jane@example.com', phone: '0987654321' },
      ];

      api.get.mockResolvedValue({ data: mockCustomers });

      const result = await getCustomers();

      expect(api.get).toHaveBeenCalledWith('/customers');
      expect(result).toEqual(mockCustomers);
    });

    it('should handle errors when fetching customers', async () => {
      const mockError = new Error('Network error');
      api.get.mockRejectedValue(mockError);

      await expect(getCustomers()).rejects.toThrow('Network error');
      expect(api.get).toHaveBeenCalledWith('/customers');
    });

    it('should return empty array when no customers exist', async () => {
      api.get.mockResolvedValue({ data: [] });

      const result = await getCustomers();

      expect(result).toEqual([]);
      expect(api.get).toHaveBeenCalledWith('/customers');
    });
  });

  describe('createCustomer', () => {
    it('should create a new customer successfully', async () => {
      const newCustomer = {
        _id: 'cust-new',
        name: 'New Customer',
        email: 'new@example.com',
        phone: '5555555555',
      };

      api.post.mockResolvedValue({ data: newCustomer });

      const result = await createCustomer(newCustomer);

      expect(api.post).toHaveBeenCalledWith('/customers', newCustomer);
      expect(result).toEqual(newCustomer);
    });

    it('should handle validation errors', async () => {
      const invalidCustomer = {
        name: 'No Email Customer',
        // Missing required email field
      };

      const mockError = new Error('Email is required');
      mockError.response = { status: 400 };
      api.post.mockRejectedValue(mockError);

      await expect(createCustomer(invalidCustomer)).rejects.toThrow('Email is required');
      expect(api.post).toHaveBeenCalledWith('/customers', invalidCustomer);
    });

    it('should handle duplicate customer error', async () => {
      const duplicateCustomer = {
        _id: 'cust-duplicate',
        name: 'John Doe',
        email: 'existing@example.com',
        phone: '1234567890',
      };

      const mockError = new Error('Customer already exists');
      mockError.response = { status: 409 };
      api.post.mockRejectedValue(mockError);

      await expect(createCustomer(duplicateCustomer)).rejects.toThrow('Customer already exists');
    });
  });

  describe('deleteCustomer', () => {
    it('should delete a customer successfully', async () => {
      const customerId = 'cust-1';
      const mockResponse = { message: 'Customer deleted successfully' };

      api.delete.mockResolvedValue({ data: mockResponse });

      const result = await deleteCustomer(customerId);

      expect(api.delete).toHaveBeenCalledWith(`/customers/${customerId}`);
      expect(result).toEqual(mockResponse);
    });

    it('should handle customer not found error', async () => {
      const customerId = 'nonexistent';
      const mockError = new Error('Customer not found');
      mockError.response = { status: 404 };
      api.delete.mockRejectedValue(mockError);

      await expect(deleteCustomer(customerId)).rejects.toThrow('Customer not found');
      expect(api.delete).toHaveBeenCalledWith(`/customers/${customerId}`);
    });

    it('should handle server errors', async () => {
      const customerId = 'cust-1';
      const mockError = new Error('Internal server error');
      mockError.response = { status: 500 };
      api.delete.mockRejectedValue(mockError);

      await expect(deleteCustomer(customerId)).rejects.toThrow('Internal server error');
    });
  });
});
