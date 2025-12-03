const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

let mongoServer;

// Set environment variables for testing
process.env.NODE_ENV = 'test';
process.env.CLERK_SECRET_KEY = 'sk_test_mock_key_for_testing';
process.env.JWT_SECRET = 'test_jwt_secret_key';
process.env.SKIP_OCR_API_CALLS = 'true'; // Skip real OCR API calls in tests
process.env.SKIP_SUBSCRIPTION_CHECKS = 'true'; // Skip subscription limits in tests
// Increase MongoDB Memory Server instance start timeout
process.env.MONGOMS_DOWNLOAD_TIMEOUT = '60000';
process.env.MONGOMS_INSTANCE_START_TIMEOUT = '60000';

beforeAll(async () => {
  try {
    // Disconnect any existing connections
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    
    mongoServer = await MongoMemoryServer.create({
      instance: {
        dbName: 'recordiq_test'
      }
    });
    const mongoUri = mongoServer.getUri();
    
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log(`MongoDB Memory server started at ${mongoUri}`);
  } catch (err) {
    console.error('Failed to connect to in-memory MongoDB', err);
    throw err;
  }
}, 60000); // Increased timeout to 60 seconds

afterEach(async () => {
  // Clear all data after each test
  try {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  } catch (err) {
    console.error('Error clearing collections:', err);
  }
}, 30000); // Increased to 30 seconds

afterAll(async () => {
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
    console.log('MongoDB Memory server stopped');
  } catch (err) {
    console.error('Error stopping MongoDB Memory server:', err);
  }
}, 60000); // Increased to 60 seconds
