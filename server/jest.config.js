// jest.config.js
module.exports = {
  testEnvironment: 'node',
  testTimeout: 10000, // 10 seconds timeout for tests that might be slow (like DB setup)
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'], // A setup file for all tests
};
