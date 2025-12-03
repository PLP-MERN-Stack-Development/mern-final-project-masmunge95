import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getUtilityServices,
  getUtilityServiceById,
  createUtilityService,
  updateUtilityService,
  deleteUtilityService,
} from '../../services/utilityService';
import api from '../../services/api';

// Mock the api module
vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('utilityService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getUtilityServices', () => {
    it('should fetch all utility services without search query', async () => {
      const mockServices = [
        { _id: 'service-1', name: 'Water', unitPrice: 50, fees: [] },
        { _id: 'service-2', name: 'Electricity', unitPrice: 100, fees: [] },
      ];

      api.get.mockResolvedValue({ data: mockServices });

      const result = await getUtilityServices();

      expect(api.get).toHaveBeenCalledWith('/services', { params: {} });
      expect(result).toEqual(mockServices);
    });

    it('should fetch utility services with search query', async () => {
      const mockServices = [
        { _id: 'service-1', name: 'Water', unitPrice: 50, fees: [] },
      ];

      api.get.mockResolvedValue({ data: mockServices });

      const result = await getUtilityServices('Water');

      expect(api.get).toHaveBeenCalledWith('/services', { params: { search: 'Water' } });
      expect(result).toEqual(mockServices);
    });

    it('should handle empty search query', async () => {
      const mockServices = [
        { _id: 'service-1', name: 'Water', unitPrice: 50, fees: [] },
        { _id: 'service-2', name: 'Electricity', unitPrice: 100, fees: [] },
      ];

      api.get.mockResolvedValue({ data: mockServices });

      const result = await getUtilityServices('');

      expect(api.get).toHaveBeenCalledWith('/services', { params: {} });
      expect(result).toEqual(mockServices);
    });

    it('should handle API errors', async () => {
      const mockError = new Error('Network error');
      api.get.mockRejectedValue(mockError);

      await expect(getUtilityServices()).rejects.toThrow('Network error');
      expect(api.get).toHaveBeenCalledWith('/services', { params: {} });
    });
  });

  describe('getUtilityServiceById', () => {
    it('should fetch a single utility service by ID', async () => {
      const mockService = { _id: 'service-1', name: 'Water', unitPrice: 50, fees: [] };

      api.get.mockResolvedValue({ data: mockService });

      const result = await getUtilityServiceById('service-1');

      expect(api.get).toHaveBeenCalledWith('/services/service-1');
      expect(result).toEqual(mockService);
    });

    it('should handle service not found', async () => {
      const mockError = new Error('Service not found');
      mockError.response = { status: 404 };
      api.get.mockRejectedValue(mockError);

      await expect(getUtilityServiceById('nonexistent')).rejects.toThrow('Service not found');
      expect(api.get).toHaveBeenCalledWith('/services/nonexistent');
    });

    it('should handle invalid ID format', async () => {
      const mockError = new Error('Invalid service ID format');
      mockError.response = { status: 400 };
      api.get.mockRejectedValue(mockError);

      await expect(getUtilityServiceById('invalid-id')).rejects.toThrow('Invalid service ID format');
      expect(api.get).toHaveBeenCalledWith('/services/invalid-id');
    });
  });

  describe('createUtilityService', () => {
    it('should create a new utility service', async () => {
      const newService = {
        _id: 'service-1',
        name: 'Water',
        details: 'Water utility service',
        unitPrice: 50,
        fees: [{ name: 'Service Fee', amount: 5 }],
      };

      const mockResponse = { ...newService, user: 'test-user-123', createdAt: new Date() };
      api.post.mockResolvedValue({ data: mockResponse });

      const result = await createUtilityService(newService);

      expect(api.post).toHaveBeenCalledWith('/services', newService);
      expect(result).toEqual(mockResponse);
    });

    it('should handle duplicate service name', async () => {
      const duplicateService = {
        _id: 'service-2',
        name: 'Water',
        unitPrice: 50,
        fees: [],
      };

      const mockError = new Error('A service with this name already exists.');
      mockError.response = { status: 400 };
      api.post.mockRejectedValue(mockError);

      await expect(createUtilityService(duplicateService)).rejects.toThrow('A service with this name already exists.');
      expect(api.post).toHaveBeenCalledWith('/services', duplicateService);
    });

    it('should handle validation errors', async () => {
      const invalidService = {
        // Missing _id
        name: 'Water',
        unitPrice: 50,
        fees: [],
      };

      const mockError = new Error('Please provide _id.');
      mockError.response = { status: 400 };
      api.post.mockRejectedValue(mockError);

      await expect(createUtilityService(invalidService)).rejects.toThrow('Please provide _id.');
      expect(api.post).toHaveBeenCalledWith('/services', invalidService);
    });
  });

  describe('updateUtilityService', () => {
    it('should update an existing utility service', async () => {
      const serviceId = 'service-1';
      const updatedData = {
        name: 'Updated Water Service',
        unitPrice: 60,
        fees: [{ name: 'New Fee', amount: 10 }],
      };

      const mockResponse = { _id: serviceId, ...updatedData, user: 'test-user-123', updatedAt: new Date() };
      api.put.mockResolvedValue({ data: mockResponse });

      const result = await updateUtilityService(serviceId, updatedData);

      expect(api.put).toHaveBeenCalledWith(`/services/${serviceId}`, updatedData);
      expect(result).toEqual(mockResponse);
    });

    it('should handle service not found on update', async () => {
      const mockError = new Error('Service not found');
      mockError.response = { status: 404 };
      api.put.mockRejectedValue(mockError);

      await expect(updateUtilityService('nonexistent', { name: 'Test' })).rejects.toThrow('Service not found');
      expect(api.put).toHaveBeenCalledWith('/services/nonexistent', { name: 'Test' });
    });

    it('should handle duplicate name on update', async () => {
      const mockError = new Error('A service with this name already exists.');
      mockError.response = { status: 400 };
      api.put.mockRejectedValue(mockError);

      await expect(updateUtilityService('service-1', { name: 'Duplicate' })).rejects.toThrow('A service with this name already exists.');
    });
  });

  describe('deleteUtilityService', () => {
    it('should delete a utility service', async () => {
      const serviceId = 'service-1';
      const mockResponse = { message: 'Service deleted successfully' };

      api.delete.mockResolvedValue({ data: mockResponse });

      const result = await deleteUtilityService(serviceId);

      expect(api.delete).toHaveBeenCalledWith(`/services/${serviceId}`);
      expect(result).toEqual(mockResponse);
    });

    it('should handle service not found on delete', async () => {
      const mockError = new Error('Service not found');
      mockError.response = { status: 404 };
      api.delete.mockRejectedValue(mockError);

      await expect(deleteUtilityService('nonexistent')).rejects.toThrow('Service not found');
      expect(api.delete).toHaveBeenCalledWith('/services/nonexistent');
    });

    it('should handle invalid ID format on delete', async () => {
      const mockError = new Error('Invalid service ID format');
      mockError.response = { status: 400 };
      api.delete.mockRejectedValue(mockError);

      await expect(deleteUtilityService('invalid-id')).rejects.toThrow('Invalid service ID format');
      expect(api.delete).toHaveBeenCalledWith('/services/invalid-id');
    });
  });
});
