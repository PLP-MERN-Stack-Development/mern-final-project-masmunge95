const { requireRole } = require('../../src/middleware/authMiddleware');

describe('requireRole Middleware', () => {
  let mockRequest;
  let mockResponse;
  let nextFunction;

  beforeEach(() => {
    mockRequest = {
      auth: {
        sessionClaims: {
          metadata: {},
        },
      },
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    nextFunction = jest.fn();
  });

  it('should call next() if user has the required role', () => {
    mockRequest.auth.sessionClaims.metadata.role = 'admin';
    const middleware = requireRole('admin');

    middleware(mockRequest, mockResponse, nextFunction);

    expect(nextFunction).toHaveBeenCalled();
    expect(mockResponse.status).not.toHaveBeenCalled();
  });

  it('should return 403 if user does not have the required role', () => {
    mockRequest.auth.sessionClaims.metadata.role = 'customer';
    const middleware = requireRole('admin');

    middleware(mockRequest, mockResponse, nextFunction);

    expect(nextFunction).not.toHaveBeenCalled();
    expect(mockResponse.status).toHaveBeenCalledWith(403);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('does not have permission'),
      })
    );
  });
});
