import Dexie from 'dexie';
import { pruneSyncNonCloneable, makeCloneSafe, safeStringify } from './utils/dbUtils';

// Centralized Dexie wrapper
const DB_NAME = 'Recordiq';
const db = new Dexie(DB_NAME);

// --- Schema (kept compatible with previous versions) ----------------------
// Keep versions but simplify migrations to minimal safe changes. These
// versions mirror previous shape and ensure `_id` and fields exist.
db.version(1).stores({
  records: '++id, &_id, type, recordType, amount, description, recordDate, customerId, syncStatus, imagePath, ocrData, modelSpecs',
  invoices: '++id, &_id, invoiceNumber, customerId, customerName, status, dueDate, issueDate, items, subTotal, tax, total, syncStatus',
  customers: '++id, &_id, name, phone, email, isActive, syncStatus',
  payments: '++id, &_id, invoiceId, transactionId, status, amount, provider, paymentDate, syncStatus',
  utilityServices: '++id, &_id, name, user, syncStatus',
  wallets: '++id, &seller, availableBalance, pendingBalance, heldBalance, status, withdrawalMethod, withdrawalDetails, syncStatus',
  withdrawalRequests: '++id, &requestId, seller, amount, status, createdAt, syncStatus',
  syncQueue: '++id, entity, entityId, action, payload, timestamp, attempts, nextAttemptAt, lastError, failed',
});

db.version(2).upgrade(async (trans) => {
  // Ensure any missing _id fields are present and strings
  const makeId = () => (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `client_${Date.now()}_${Math.random().toString(36).slice(2,9)}`;
  const tables = ['records','invoices','customers','payments','utilityServices','withdrawalRequests'];
  for (const t of tables) {
    try {
      await trans.table(t).toCollection().modify(item => {
        if (!item) return;
        if (item._id === undefined || item._id === null) item._id = makeId();
        try { item._id = String(item._id); } catch (e) { item._id = makeId(); }
      });
    } catch (e) {
      // ignore table-specific failures
    }
  }
});

// Version 3: Add createdAt, updatedAt, disputeStatus indexes
db.version(3).stores({
  records: '++id, &_id, type, recordType, amount, description, recordDate, customerId, syncStatus, imagePath, ocrData, modelSpecs, createdAt, updatedAt',
  invoices: '++id, &_id, invoiceNumber, customerId, customerName, status, dueDate, issueDate, items, subTotal, tax, total, syncStatus, createdAt, updatedAt, disputeStatus',
  customers: '++id, &_id, name, phone, email, isActive, syncStatus, createdAt, updatedAt',
  payments: '++id, &_id, invoiceId, transactionId, status, amount, provider, paymentDate, syncStatus, createdAt, updatedAt',
  utilityServices: '++id, &_id, name, user, syncStatus, createdAt, updatedAt',
  wallets: '++id, &seller, availableBalance, pendingBalance, heldBalance, status, withdrawalMethod, withdrawalDetails, syncStatus, createdAt, updatedAt',
  withdrawalRequests: '++id, &requestId, seller, amount, status, createdAt, syncStatus, updatedAt',
  syncQueue: '++id, entity, entityId, action, payload, timestamp, attempts, nextAttemptAt, lastError, failed',
}).upgrade(async (trans) => {
  // Add createdAt/updatedAt to existing records if missing
  const now = new Date().toISOString();
  const tables = ['records', 'invoices', 'customers', 'payments', 'utilityServices', 'wallets', 'withdrawalRequests'];
  for (const t of tables) {
    try {
      await trans.table(t).toCollection().modify(item => {
        if (!item) return;
        if (!item.createdAt) item.createdAt = now;
        if (!item.updatedAt) item.updatedAt = now;
      });
    } catch (e) {
      // ignore table-specific failures
    }
  }
});

// Version 4: Add missing user, service, seller indexes for better querying
db.version(4).stores({
  records: '++id, &_id, type, recordType, amount, description, recordDate, customerId, user, sellerId, uploaderCustomerId, service, syncStatus, imagePath, ocrData, modelSpecs, createdAt, updatedAt',
  invoices: '++id, &_id, invoiceNumber, customerId, customerName, user, publicInvoiceId, service, status, dueDate, issueDate, items, subTotal, tax, total, syncStatus, createdAt, updatedAt, disputeStatus',
  customers: '++id, &_id, name, phone, email, users, isActive, syncStatus, createdAt, updatedAt',
  payments: '++id, &_id, invoice, invoiceId, customer, user, transactionId, status, amount, provider, paymentDate, syncStatus, createdAt, updatedAt',
  utilityServices: '++id, &_id, name, user, syncStatus, createdAt, updatedAt',
  wallets: '++id, &seller, availableBalance, pendingBalance, heldBalance, status, withdrawalMethod, withdrawalDetails, syncStatus, createdAt, updatedAt',
  withdrawalRequests: '++id, &requestId, seller, amount, status, createdAt, syncStatus, updatedAt',
  syncQueue: '++id, entity, entityId, action, payload, timestamp, attempts, nextAttemptAt, lastError, failed',
});

// --- Sanitization utilities -----------------------------------------------
function deepSanitize(input, seen = new WeakMap()) {
  if (input === null || input === undefined) return input;
  if (typeof input === 'function') return '<function>';
  if (typeof input !== 'object') return input;
  if (seen.has(input)) return seen.get(input);
  if (Array.isArray(input)) {
    const out = [];
    seen.set(input, out);
    for (const el of input) out.push(deepSanitize(el, seen));
    return out;
  }
  // thenable/promise check
  if (typeof input.then === 'function') return '<thenable>';
  const out = {};
  seen.set(input, out);
  for (const [k, v] of Object.entries(input)) {
    try {
      if (typeof v === 'function') { out[k] = '<function>'; continue; }
      if (v && typeof v === 'object' && typeof v.then === 'function') { out[k] = '<thenable>'; continue; }
      out[k] = deepSanitize(v, seen);
    } catch (e) { out[k] = null; }
  }
  return out;
}

function prepareForDb(candidate) {
  try {
    if (typeof structuredClone === 'function') {
      try { structuredClone(candidate); return candidate; } catch (_e) { /* fallthrough */ }
    }
  } catch (_e) {}

  try {
    const pruned = pruneSyncNonCloneable(candidate);
    const safe = makeCloneSafe(pruned);
    try { if (typeof structuredClone === 'function') structuredClone(safe); } catch (_e) {}
    return safe;
  } catch (_e) {
    try {
      const deep = deepSanitize(candidate);
      try { if (typeof structuredClone === 'function') structuredClone(deep); } catch (_e) {}
      return deep;
    } catch (_e2) {
      // Final fallback: minimal placeholder preserving _id and serialized payload
      try {
        const fallback = {};
        if (candidate && (candidate._id !== undefined && candidate._id !== null)) fallback._id = String(candidate._id);
        else if (candidate && (candidate.id !== undefined && candidate.id !== null)) fallback._id = String(candidate.id);
        else fallback._id = `failed_${Date.now()}`;
        fallback._failedSync = true;
        try { fallback._payloadJson = safeStringify(candidate); } catch (_e3) { fallback._payloadJson = null; }
        return fallback;
      } catch (_e3) {
        return {};
      }
    }
  }
}

// Final synchronous guard used by prototype patches: try structuredClone,
// then prepareForDb, then fallback to JSON round-trip to ensure a plain
// prototype-less object is passed to IndexedDB. This is aggressive but
// prevents Promise/function values from ever reaching Dexie at boot.
function ensureCloneableSyncForDb(candidate) {
  try {
    if (typeof structuredClone === 'function') {
      try { structuredClone(candidate); return candidate; } catch (_e) { /* fallthrough */ }
    }
  } catch (_e) {}

  try {
    // Attempt the usual prepareForDb sanitization
    const prepared = prepareForDb(candidate);
    try { if (typeof structuredClone === 'function') structuredClone(prepared); return prepared; } catch (_e) { /* fallthrough */ }
    // If structuredClone still fails, try a JSON round-trip to produce a
    // plain POJO. This will drop Dates/Files but guarantees cloneability.
    try {
      const json = JSON.stringify(prepared);
      return JSON.parse(json);
    } catch (_e) {
      // As a last resort, return a minimal placeholder preserving _id
      const fallback = {};
      if (candidate && (candidate._id !== undefined && candidate._id !== null)) fallback._id = String(candidate._id);
      else if (candidate && (candidate.id !== undefined && candidate.id !== null)) fallback._id = String(candidate.id);
      else fallback._id = `failed_${Date.now()}`;
      fallback._failedSync = true;
      try { fallback._payloadJson = safeStringify(candidate); } catch (_e2) { fallback._payloadJson = null; }
      return fallback;
    }
  } catch (_e) {
    // Worst-case fallback
    try {
      const json = JSON.stringify(candidate);
      return JSON.parse(json);
    } catch (_e2) {
      return { _id: `failed_${Date.now()}`, _failedSync: true };
    }
  }
}

// --- Table wrapper -------------------------------------------------------
function wrapTable(table) {
  if (!table || typeof table !== 'object') return table;
  const writeMethods = new Set(['add','put','update','bulkAdd','bulkPut']);
  return new Proxy(table, {
    get(target, prop) {
      const orig = target[prop];
      if (writeMethods.has(prop)) {
          return async function () {
            const args = Array.from(arguments || []);
            try {
              if (prop === 'update') {
                if (args.length >= 2 && args[1] && typeof args[1] === 'object') args[1] = ensureCloneableSyncForDb(args[1]);
              } else if (prop === 'bulkAdd' || prop === 'bulkPut') {
                if (Array.isArray(args[0])) args[0] = args[0].map(it => ensureCloneableSyncForDb(it));
              } else {
                if (args.length > 0 && args[0] && typeof args[0] === 'object') args[0] = ensureCloneableSyncForDb(args[0]);
              }
            } catch (_e) {}
            return orig.apply(target, args);
          };
        }
      if (typeof orig === 'function') return orig.bind(target);
      return orig;
    }
  });
}

// Apply wrappers after ensuring DB is open
async function initWrappers() {
  const TABLE_NAMES = ['records','invoices','customers','payments','utilityServices','syncQueue'];
  try {
    await db.open();
  } catch (e) {
    // ignore, db will be created/opened lazily by Dexie later
  }
  for (const t of TABLE_NAMES) {
    try {
      const tableHandle = (typeof db.table === 'function') ? db.table(t) : db[t];
      if (tableHandle) db[t] = wrapTable(tableHandle);
    } catch (_e) {}
  }
}

// --- Global prototype patches --------------------------------------------
try {
  const TableProto = Dexie && Dexie.Table && Dexie.Table.prototype ? Dexie.Table.prototype : null;
  if (TableProto && !TableProto.__safePatched) {
    const origAdd = TableProto.add;
    TableProto.add = async function () {
      const rawCandidate = arguments && arguments.length ? arguments[0] : undefined;
      let candidate = rawCandidate;
      // Always sanitize synchronously to protect early/boot writes from
      // non-cloneable values (Promises/functions) reaching IndexedDB.
      try { candidate = ensureCloneableSyncForDb(candidate); } catch (_e) { /* best-effort */ }
      try { return await origAdd.apply(this, [candidate]); } catch (err) {
        // Capture original raw argument for debugging (DEV only)
        try {
          if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
            const key = `debug_dexie_failed_${Date.now()}`;
            try {
              const replacer = function (_k, v) {
                if (v && (typeof v === 'object' || typeof v === 'function') && typeof v.then === 'function') return '[Promise]';
                if (typeof v === 'function') return '[Function]';
                return v;
              };
              try { localStorage.setItem(key, safeStringify(rawCandidate, replacer)); } catch (_e) { localStorage.setItem(key, JSON.stringify(String(rawCandidate))); }
            } catch (_e) { /* ignore storage */ }
            // Also capture a shallow descriptor snapshot without invoking getters
            try {
              const desc = {};
              if (rawCandidate && typeof rawCandidate === 'object') {
                const names = Object.getOwnPropertyNames(rawCandidate).concat(Object.getOwnPropertySymbols(rawCandidate));
                for (const n of names) {
                  try {
                    const d = Object.getOwnPropertyDescriptor(rawCandidate, n) || {};
                    const keyName = typeof n === 'symbol' ? n.toString() : String(n);
                    desc[keyName] = { enumerable: !!d.enumerable, configurable: !!d.configurable };
                    if ('value' in d) {
                      try {
                        const v = d.value;
                        desc[keyName].type = typeof v;
                        desc[keyName].isPromiseLike = !!(v && (typeof v === 'object' || typeof v === 'function') && typeof v.then === 'function');
                      } catch (_e) { desc[keyName].type = 'unknown'; }
                    } else {
                      desc[keyName].accessor = true;
                    }
                  } catch (_e) { /* ignore property snapshot error */ }
                }
              }
              try { localStorage.setItem(key + '_desc', JSON.stringify(desc)); } catch (_e) { /* ignore */ }
              try { window.__lastDexieFailed = { key, table: (this && (this.name || this.tableName || (this.schema && this.schema.name))), error: String(err && err.message) }; } catch (_e) { /* ignore */ }
            } catch (_e) { /* ignore descriptor errors */ }
          }
        } catch (_e) { /* ignore debug capture errors */ }
        // Fallback behavior for syncQueue to avoid losing app operations
        try {
          const tableName = this && (this.name || this.tableName || (this.schema && this.schema.name));
          if (tableName === 'syncQueue') {
            const fallback = {
              entity: candidate && candidate.entity ? candidate.entity : 'unknown',
              entityId: candidate && candidate.entityId ? String(candidate.entityId) : null,
              action: candidate && candidate.action ? candidate.action : 'unknown',
              payload: null,
              payloadJson: (typeof safeStringify === 'function' ? safeStringify(candidate && candidate.payload) : null),
              timestamp: (candidate && candidate.timestamp) || new Date().toISOString(),
              attempts: 0,
              failed: false,
              nextAttemptAt: null,
              lastError: String(err && err.message),
            };
            return await origAdd.apply(this, [fallback]);
          }
        } catch (_e) {}
        throw err;
      }
    };

    const origPut = TableProto.put;
    TableProto.put = async function () {
      const rawCandidate = arguments && arguments.length ? arguments[0] : undefined;
      let candidate = rawCandidate;
      // Always sanitize synchronously as a hardening measure for startup writes.
      try { candidate = ensureCloneableSyncForDb(candidate); } catch (_e) { /* best-effort */ }
      try { return await origPut.apply(this, [candidate]); } catch (err) {
        // Capture original raw argument for debugging (DEV only)
        try {
          if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
            const key = `debug_dexie_failed_${Date.now()}`;
            try {
              const replacer = function (_k, v) {
                if (v && (typeof v === 'object' || typeof v === 'function') && typeof v.then === 'function') return '[Promise]';
                if (typeof v === 'function') return '[Function]';
                return v;
              };
              try { localStorage.setItem(key, safeStringify(rawCandidate, replacer)); } catch (_e) { localStorage.setItem(key, JSON.stringify(String(rawCandidate))); }
            } catch (_e) { /* ignore storage */ }
            // Also capture a shallow descriptor snapshot without invoking getters
            try {
              const desc = {};
              if (rawCandidate && typeof rawCandidate === 'object') {
                const names = Object.getOwnPropertyNames(rawCandidate).concat(Object.getOwnPropertySymbols(rawCandidate));
                for (const n of names) {
                  try {
                    const d = Object.getOwnPropertyDescriptor(rawCandidate, n) || {};
                    const keyName = typeof n === 'symbol' ? n.toString() : String(n);
                    desc[keyName] = { enumerable: !!d.enumerable, configurable: !!d.configurable };
                    if ('value' in d) {
                      try {
                        const v = d.value;
                        desc[keyName].type = typeof v;
                        desc[keyName].isPromiseLike = !!(v && (typeof v === 'object' || typeof v === 'function') && typeof v.then === 'function');
                      } catch (_e) { desc[keyName].type = 'unknown'; }
                    } else {
                      desc[keyName].accessor = true;
                    }
                  } catch (_e) { /* ignore property snapshot error */ }
                }
              }
              try { localStorage.setItem(key + '_desc', JSON.stringify(desc)); } catch (_e) { /* ignore */ }
              try { window.__lastDexieFailed = { key, table: (this && (this.name || this.tableName || (this.schema && this.schema.name))), error: String(err && err.message) }; } catch (_e) { /* ignore */ }
            } catch (_e) { /* ignore descriptor errors */ }
          }
        } catch (_e) { /* ignore debug capture errors */ }
        try {
          const tableName = this && (this.name || this.tableName || (this.schema && this.schema.name));
          if (['invoices','records','customers'].includes(tableName)) {
            const fallback = { _id: candidate && candidate._id ? String(candidate._id) : `failed_${Date.now()}`, _failedSync: true };
            return await origPut.apply(this, [fallback]);
          }
        } catch (_e) {}
        throw err;
      }
    };

    TableProto.__safePatched = true;
  }
} catch (_e) {}

// Dev diagnostics helper
if (typeof window !== 'undefined' && typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
  window.runDbDiag = async function ({ attemptAdd = false } = {}) {
    const out = [];
    try {
      const keys = Object.keys(localStorage || {}).filter(k => k && (k.startsWith && (k.startsWith('recordiq_failed_sync_') || k.startsWith('debug_dexie_failed_'))));
      for (const k of keys) {
        try {
          const raw = localStorage.getItem(k);
          let parsed = null;
          try { parsed = JSON.parse(raw); } catch (_e) { parsed = raw; }
          let prepared = null;
          try { prepared = prepareForDb(parsed); } catch (_e) { prepared = null; }
          let cloneable = false;
          try { if (typeof structuredClone === 'function') { structuredClone(prepared); cloneable = true; } else { JSON.stringify(prepared); cloneable = true; } } catch (_e) { cloneable = false; }
          const entry = { key: k, original: parsed, prepared, cloneable };
          if (attemptAdd) {
            try { const res = await db.table('syncQueue').add({ entity: 'diagnostic', entityId: entry.prepared && entry.prepared._id ? String(entry.prepared._id) : `diag_${Date.now()}`, action: 'diagnostic-add', payload: entry.prepared, timestamp: new Date().toISOString(), attempts: 0, failed: false }); entry.addResult = { ok: true, id: res }; } catch (e) { entry.addResult = { ok: false, err: String(e && e.message ? e.message : e) }; }
          }
          out.push(entry);
        } catch (e) { out.push({ key: k, error: String(e && e.message ? e.message : e) }); }
      }
      console.table(out.map(o => ({ key: o.key, cloneable: !!o.cloneable, added: !!(o.addResult && o.addResult.ok) })));
    } catch (e) { console.error('[runDbDiag] failed', e); }
    return out;
  };

  // Expose the db for debugging convenience
  try { window.db = db; window.__dexie_db = db; } catch (_e) {}
}

// Initialize wrappers asynchronously (non-blocking)
initWrappers().catch(() => {});

export default db;
