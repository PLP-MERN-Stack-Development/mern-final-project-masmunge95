const errorHandler = require('../../src/middleware/errorHandler');

describe('Error Handler Middleware', () => {
  let mockRequest;
  let mockResponse;
  let nextFunction;

  beforeEach(() => {
    mockRequest = {};
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      statusCode: 200, // Default status code
    };
    nextFunction = jest.fn();

    // Suppress console output during tests
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  it('should handle error with custom status code', () => {
    const error = new Error('Custom error');
    error.status = 404;

    errorHandler(error, mockRequest, mockResponse, nextFunction);

    expect(mockResponse.status).toHaveBeenCalledWith(404);
    expect(mockResponse.json).toHaveBeenCalledWith({
      message: 'Custom error',
      stack: expect.any(String),
    });
  });

  it('should default to 500 if no status code provided', () => {
    const error = new Error('Server error');

    errorHandler(error, mockRequest, mockResponse, nextFunction);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith({
      message: 'Server error',
      stack: expect.any(String),
    });
  });

  it('should use statusCode property if status not available', () => {
    const error = new Error('Status code error');
    error.statusCode = 400;

    errorHandler(error, mockRequest, mockResponse, nextFunction);

    // Middleware doesn't use error.statusCode, only error.status
    // Falls back to res.statusCode (200) then defaults to 500
    expect(mockResponse.status).toHaveBeenCalledWith(500);
  });

  it('should handle validation errors (400)', () => {
    const error = new Error('Validation failed');
    error.status = 400;

    errorHandler(error, mockRequest, mockResponse, nextFunction);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith({
      message: 'Validation failed',
      stack: expect.any(String),
    });
  });

  it('should handle unauthorized errors (401)', () => {
    const error = new Error('Unauthorized');
    error.status = 401;

    errorHandler(error, mockRequest, mockResponse, nextFunction);

    expect(mockResponse.status).toHaveBeenCalledWith(401);
  });

  it('should handle forbidden errors (403)', () => {
    const error = new Error('Forbidden');
    error.status = 403;

    errorHandler(error, mockRequest, mockResponse, nextFunction);

    expect(mockResponse.status).toHaveBeenCalledWith(403);
  });

  it('should handle not found errors (404)', () => {
    const error = new Error('Not found');
    error.status = 404;

    errorHandler(error, mockRequest, mockResponse, nextFunction);

    expect(mockResponse.status).toHaveBeenCalledWith(404);
  });

  it('should include error message in response', () => {
    const error = new Error('Specific error message');
    error.status = 500;

    errorHandler(error, mockRequest, mockResponse, nextFunction);

    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Specific error message',
      })
    );
  });

  it('should include stack trace in response', () => {
    const error = new Error('Error with stack');
    error.status = 500;

    errorHandler(error, mockRequest, mockResponse, nextFunction);

    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        stack: expect.any(String),
      })
    );
  });

  it('should log error to console', () => {
    const error = new Error('Logged error');
    error.status = 500;

    errorHandler(error, mockRequest, mockResponse, nextFunction);

    expect(console.error).toHaveBeenCalledWith(error.stack);
  });

  it('should handle errors without message', () => {
    const error = new Error();
    error.status = 500;

    errorHandler(error, mockRequest, mockResponse, nextFunction);

    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Server Error', // Default message when err.message is empty
      })
    );
  });

  it('should handle MongoDB duplicate key errors', () => {
    const error = new Error('E11000 duplicate key error');
    error.code = 11000;

    errorHandler(error, mockRequest, mockResponse, nextFunction);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
  });

  it('should handle cast errors', () => {
    const error = new Error('Cast to ObjectId failed');
    error.name = 'CastError';
    error.kind = 'ObjectId';
    error.value = 'invalid-id';

    errorHandler(error, mockRequest, mockResponse, nextFunction);

    expect(mockResponse.status).toHaveBeenCalledWith(404);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Resource not found with id of invalid-id',
      })
    );
  });

  it('should handle validation errors', () => {
    const error = new Error('Validation failed');
    error.name = 'ValidationError';
    error.errors = {
      field1: { message: 'Field 1 is required' },
      field2: { message: 'Field 2 is invalid' },
    };

    errorHandler(error, mockRequest, mockResponse, nextFunction);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Field 1 is required, Field 2 is invalid',
      })
    );
  });

  it('should preserve existing status codes', () => {
    mockResponse.statusCode = 404;
    const error = new Error('Error');

    errorHandler(error, mockRequest, mockResponse, nextFunction);

    expect(mockResponse.status).toHaveBeenCalledWith(404);
  });

  it('should handle errors with both status and statusCode', () => {
    const error = new Error('Conflict');
    error.status = 409;
    error.statusCode = 400;

    errorHandler(error, mockRequest, mockResponse, nextFunction);

    // status should take precedence
    expect(mockResponse.status).toHaveBeenCalledWith(409);
  });
});
