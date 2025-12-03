/**
 * A higher-order function to wrap async route handlers and catch errors.
 * @param {function} fn The async function to execute.
 * @returns {function} An Express route handler with error catching.
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;