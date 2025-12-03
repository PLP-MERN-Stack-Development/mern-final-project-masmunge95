import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock Clerk authentication
vi.mock('@clerk/clerk-react', () => ({
  ClerkProvider: ({ children }) => children,
  useAuth: () => ({
    userId: 'test-user-123',
    isSignedIn: true,
    isLoaded: true,
    getToken: vi.fn().mockResolvedValue('test-token'),
  }),
  useUser: () => ({
    user: {
      id: 'test-user-123',
      firstName: 'Test',
      lastName: 'User',
      emailAddresses: [{ emailAddress: 'test@example.com' }],
    },
    isLoaded: true,
  }),
  SignIn: () => null,
  SignUp: () => null,
  UserButton: () => null,
}));

// Mock QueueStatus component to prevent errors in tests
vi.mock('../components/QueueStatus', () => ({
  default: () => null,
}));

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock window.confirm
Object.defineProperty(window, 'confirm', {
  writable: true,
  value: vi.fn().mockReturnValue(true),
});

// Mock IndexedDB for Dexie
const indexedDB = {
  open: vi.fn(),
  deleteDatabase: vi.fn(),
  databases: vi.fn().mockResolvedValue([]),
};
global.indexedDB = indexedDB;

// Mock Dexie database with proper query chain methods
vi.mock('../db', () => {
  const createMockTable = (tableName) => {
    let data = [];
    
    const mockTable = {
      toArray: vi.fn(async () => [...data]),
      where: vi.fn().mockReturnThis(),
      equals: vi.fn().mockReturnThis(),
      first: vi.fn(async () => data[0] || null),
      put: vi.fn(async (item) => {
        if (!item.id) {
          item.id = global.crypto.randomUUID();
        }
        const existing = data.findIndex(d => (d.id === item.id) || (d._id && d._id === item._id));
        if (existing !== -1) {
          data[existing] = { ...data[existing], ...item };
        } else {
          data.push(item);
        }
        return item.id;
      }),
      add: vi.fn(async (item) => {
        if (!item.id) {
          item.id = global.crypto.randomUUID();
        }
        data.push(item);
        return item.id;
      }),
      modify: vi.fn(async (changes) => {
        data = data.map(item => ({ ...item, ...changes }));
        return data.length;
      }),
      delete: vi.fn(async () => {
        data = [];
        return 1;
      }),
      clear: vi.fn(async () => {
        data = [];
      }),
      // Additional query methods
      count: vi.fn(async () => data.length),
      each: vi.fn(async (callback) => {
        data.forEach(callback);
      }),
    };
    
    // Make query methods chainable and functional
    mockTable.where = vi.fn((field) => ({
      ...mockTable,
      equals: vi.fn((value) => ({
        ...mockTable,
        first: vi.fn(async () => data.find(d => d[field] === value) || null),
        toArray: vi.fn(async () => data.filter(d => d[field] === value)),
        modify: vi.fn(async (changes) => {
          const filtered = data.filter(d => d[field] === value);
          filtered.forEach(item => Object.assign(item, changes));
          return filtered.length;
        }),
        delete: vi.fn(async () => {
          const beforeLength = data.length;
          data = data.filter(d => d[field] !== value);
          return beforeLength - data.length;
        }),
      })),
    }));
    
    return mockTable;
  };
  
  return {
    default: {
      utilityServices: createMockTable('utilityServices'),
      invoices: createMockTable('invoices'),
      customers: createMockTable('customers'),
      records: createMockTable('records'),
      wallets: createMockTable('wallets'),
      withdrawalRequests: createMockTable('withdrawalRequests'),
      syncQueue: createMockTable('syncQueue'),
    },
  };
});

// Mock crypto.randomUUID
if (!global.crypto) {
  global.crypto = {};
}
global.crypto.randomUUID = vi.fn(() => '12345678-1234-1234-1234-123456789012');
