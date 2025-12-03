// middleware/performanceMonitor.js
const performanceMonitor = (req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[Performance] ${req.method} ${req.originalUrl} - ${res.statusCode} [${duration}ms]`);
  });

  next();
};

module.exports = performanceMonitor;