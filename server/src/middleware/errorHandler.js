// middleware/errorHandler.js
const errorHandler = (err, req, res, next) => {
  // Log the error for the developer
  console.error(err.stack);

  // Prefer an explicit status set on the error (e.g. requireOwnership sets err.status)
  let statusCode = err.status || (res.statusCode === 200 ? 500 : res.statusCode);
  let message = err.message || 'Server Error';

  // Handle Mongoose Bad ObjectId (e.g., GET /api/products/invalidId)
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    statusCode = 404;
    message = `Resource not found with id of ${err.value}`;
  }

  // Handle Mongoose Validation Errors (e.g., missing required fields on POST/PUT)
  if (err.name === 'ValidationError') {
    statusCode = 400; // Bad Request
    message = Object.values(err.errors).map(val => val.message).join(', ');
  }

  res.status(statusCode).json({
    message: message,
    // Expose stack only in non-production for easier debugging
    stack: process.env.NODE_ENV === 'production' ? '🥞' : err.stack,
  });
};

module.exports = errorHandler;
