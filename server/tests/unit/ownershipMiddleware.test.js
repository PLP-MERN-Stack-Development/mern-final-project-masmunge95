const requireOwnership = require('../../src/middleware/ownershipMiddleware');
const mongoose = require('mongoose');

// Mock Mongoose model
const MockModel = {
  findOne: jest.fn(),
};

describe('Ownership Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Successful ownership validation', () => {
    it('should return document when user owns it', async () => {
      const mockDoc = { _id: 'doc-123', user: 'user-123', name: 'Test Doc' };
      MockModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockDoc),
      });

      const result = await requireOwnership(MockModel, 'doc-123', 'user-123', 'user');

      expect(result).toEqual(mockDoc);
      expect(MockModel.findOne).toHaveBeenCalledWith({
        _id: 'doc-123',
        user: 'user-123',
      });
    });

    it('should handle UUID strings', async () => {
      const mockDoc = { _id: 'uuid-string-123', user: 'user-123' };
      MockModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockDoc),
      });

      const result = await requireOwnership(MockModel, 'uuid-string-123', 'user-123', 'user');

      expect(result).toEqual(mockDoc);
    });

    it('should handle ObjectId format', async () => {
      const objectId = new mongoose.Types.ObjectId();
      const mockDoc = { _id: objectId.toString(), user: 'user-123' };
      MockModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockDoc),
      });

      const result = await requireOwnership(MockModel, objectId.toString(), 'user-123', 'user');

      expect(result).toEqual(mockDoc);
    });

    it('should use custom owner field', async () => {
      const mockDoc = { _id: 'doc-123', seller: 'seller-123' };
      MockModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockDoc),
      });

      const result = await requireOwnership(MockModel, 'doc-123', 'seller-123', 'seller');

      expect(result).toEqual(mockDoc);
      expect(MockModel.findOne).toHaveBeenCalledWith({
        _id: 'doc-123',
        seller: 'seller-123',
      });
    });

    it('should default to "user" as owner field', async () => {
      const mockDoc = { _id: 'doc-123', user: 'user-123' };
      MockModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockDoc),
      });

      const result = await requireOwnership(MockModel, 'doc-123', 'user-123');

      expect(MockModel.findOne).toHaveBeenCalledWith({
        _id: 'doc-123',
        user: 'user-123',
      });
    });
  });

  describe('Error cases', () => {
    it('should throw 400 error when id is missing', async () => {
      await expect(
        requireOwnership(MockModel, null, 'user-123', 'user')
      ).rejects.toThrow('Missing id for ownership check');

      await expect(
        requireOwnership(MockModel, null, 'user-123', 'user')
      ).rejects.toMatchObject({ status: 400 });
    });

    it('should throw 400 error when id is empty string', async () => {
      await expect(
        requireOwnership(MockModel, '', 'user-123', 'user')
      ).rejects.toThrow('Missing id for ownership check');
    });

    it('should throw 401 error when ownerId is missing', async () => {
      await expect(
        requireOwnership(MockModel, 'doc-123', null, 'user')
      ).rejects.toThrow('Unauthorized');

      await expect(
        requireOwnership(MockModel, 'doc-123', null, 'user')
      ).rejects.toMatchObject({ status: 401 });
    });

    it('should throw 401 error when ownerId is empty string', async () => {
      await expect(
        requireOwnership(MockModel, 'doc-123', '', 'user')
      ).rejects.toThrow('Unauthorized');
    });

    it('should throw 404 error when document not found', async () => {
      MockModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        requireOwnership(MockModel, 'doc-123', 'user-123', 'user')
      ).rejects.toThrow('Not found or access denied');

      await expect(
        requireOwnership(MockModel, 'doc-123', 'user-123', 'user')
      ).rejects.toMatchObject({ status: 404 });
    });

    it('should throw 404 error when user does not own document', async () => {
      MockModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        requireOwnership(MockModel, 'doc-123', 'different-user', 'user')
      ).rejects.toThrow('Not found or access denied');
    });

    it('should handle database errors gracefully', async () => {
      MockModel.findOne.mockReturnValue({
        exec: jest.fn().mockRejectedValue(new Error('Database connection failed')),
      });

      await expect(
        requireOwnership(MockModel, 'doc-123', 'user-123', 'user')
      ).rejects.toThrow('Database connection failed');
    });
  });

  describe('Edge cases', () => {
    it('should handle numeric IDs', async () => {
      const mockDoc = { _id: '12345', user: 'user-123' };
      MockModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockDoc),
      });

      const result = await requireOwnership(MockModel, '12345', 'user-123', 'user');

      expect(result).toEqual(mockDoc);
    });

    it('should handle special characters in IDs', async () => {
      const mockDoc = { _id: 'doc-with-dashes-123', user: 'user-123' };
      MockModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockDoc),
      });

      const result = await requireOwnership(MockModel, 'doc-with-dashes-123', 'user-123', 'user');

      expect(result).toEqual(mockDoc);
    });

    it('should handle array owner fields (like users)', async () => {
      const mockDoc = { _id: 'doc-123', users: ['user-1', 'user-2', 'user-3'] };
      MockModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockDoc),
      });

      const result = await requireOwnership(MockModel, 'doc-123', 'user-2', 'users');

      expect(result).toEqual(mockDoc);
      expect(MockModel.findOne).toHaveBeenCalledWith({
        _id: 'doc-123',
        users: 'user-2',
      });
    });

    it('should preserve error properties from database errors', async () => {
      const dbError = new Error('Connection timeout');
      dbError.code = 'ETIMEDOUT';
      
      MockModel.findOne.mockReturnValue({
        exec: jest.fn().mockRejectedValue(dbError),
      });

      await expect(
        requireOwnership(MockModel, 'doc-123', 'user-123', 'user')
      ).rejects.toMatchObject({
        message: 'Connection timeout',
        code: 'ETIMEDOUT',
      });
    });

    it('should work with different model instances', async () => {
      const AnotherModel = {
        findOne: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({ _id: 'other-123', owner: 'owner-123' }),
        }),
      };

      const result = await requireOwnership(AnotherModel, 'other-123', 'owner-123', 'owner');

      expect(result).toEqual({ _id: 'other-123', owner: 'owner-123' });
    });
  });
});
