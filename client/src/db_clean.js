import Dexie from 'dexie';

/**
 * DEVELOPMENT-ONLY DATABASE INSTANCE
 * 
 * This is a simplified test database used for validating sync implementation.
 * It runs in a separate IndexedDB instance ('RecordiqClean') to avoid interfering
 * with the main production database ('Recordiq').
 * 
 * WHEN TO USE:
 * - Set VITE_USE_CLEAN_DB=true in .env to enable
 * - Access via window.dbClean in browser console
 * - Used by services/syncQueue.js and services/fullSync.js for testing
 * 
 * DO NOT USE IN PRODUCTION CODE - this is loaded only when the feature flag is enabled.
 */
const db = new Dexie('RecordiqClean');

// Simple schema matching core tables we need for sync testing.
db.version(1).stores({
  invoices: '&_id, invoiceNumber, customerId, issueDate, dueDate, total, status',
  records: '++id, &_id, customerId, recordDate, type, amount',
  customers: '&_id, name, phone, email',
  payments: '++id, invoiceId, transactionId, amount, paymentDate',
  syncQueue: '++id, entity, entityId, action, timestamp'
});

// Dev exposure for debugging
try {
  if (typeof window !== 'undefined' && import.meta && import.meta.env?.DEV) {
    window.dbClean = db;
  }
} catch (e) { /* ignore */ }

export default db;
