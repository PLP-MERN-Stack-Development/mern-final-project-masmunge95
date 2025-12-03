import { getInvoices } from './invoiceService';
import { getRecords } from './recordService';
import { getCustomers } from './customerService';
import { getUtilityServices } from './utilityService';
import { syncWithServer } from './syncService';
import db from '../db';
import api from './api';
const LOCAL_USER_KEY = 'recordiq_localUserId';
import { sanitizeArrayForDb, firstOrUndefined, pruneSyncNonCloneable, makeCloneSafe, pickInvoiceForDb } from '../utils/dbUtils';
import { deepSanitizeAsync } from './queueService';
import { makeTempId } from '../utils/dbUtils';

// Remove top-level thenable/promise-like properties from an object in-place.
// This is a conservative synchronous guard to ensure we don't pass thenables
// into Dexie writes (which cause DataCloneError).
function pruneTopLevelThenables(obj) {
  try {
    if (!obj || typeof obj !== 'object') return obj;
    const names = Object.getOwnPropertyNames(obj).concat(Object.getOwnPropertySymbols(obj));
    for (const n of names) {
      try {
        const v = obj[n];
        if (v && (typeof v === 'object' || typeof v === 'function') && typeof v.then === 'function') {
          // delete problematic thenable
          try { delete obj[n]; } catch (_e) { obj[n] = null; }
        }
      } catch (_e) { /* ignore per-property errors */ }
    }
  } catch (_e) { /* ignore */ }
  return obj;
}

// Ensure an object is safe to write to IndexedDB by removing Promise/function
// values and attempting structuredClone on nested fields. Returns a shallow
// plain object containing only cloneable properties.
function ensureCloneable(obj) {
  if (obj === null || obj === undefined) return obj;
  // Primitive/known clonables
  if (typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean' || obj instanceof Date || obj instanceof File || obj instanceof Blob) return obj;

  // Start with a synchronous prune pass that removes Promise-like and function fields
  try {
    const pruned = pruneSyncNonCloneable(obj);
    // Build a conservative final object by making a clone-safe copy that
    // replaces thenables/accessors/functions with placeholders.
    const finalObj = makeCloneSafe(pruned);
    try {
      const names = Object.getOwnPropertyNames(pruned || {}).concat(Object.getOwnPropertySymbols(pruned || []));
      for (const n of names) {
        try {
          const desc = Object.getOwnPropertyDescriptor(pruned, n);
          let val;
          if (desc && (desc.get || desc.set)) {
            try { val = pruned[n]; } catch (_e) { continue; }
          } else {
            try { val = pruned[n]; } catch (_e) { continue; }
          }
          if (val === undefined) continue;
          if (val && (typeof val === 'object' || typeof val === 'function') && typeof val.then === 'function') continue;
          if (typeof val === 'function') continue;

          let candidate = val;
          let ok = true;
          try {
            if (typeof structuredClone === 'function') structuredClone(candidate);
          } catch (cloneErr) {
            try {
              candidate = pruneSyncNonCloneable(candidate);
              if (typeof structuredClone === 'function') structuredClone(candidate);
            } catch (_pruneErr) {
              ok = false;
              if (import.meta.env.DEV) console.warn('[ensureCloneable] dropping non-cloneable nested field', n, _pruneErr || cloneErr);
            }
          }
          if (ok) finalObj[n] = candidate;
        } catch (_e) { /* skip field */ }
      }
    } catch (_e) { return pruned; }
    return finalObj;
  } catch (e) {
    return obj;
  }
}

// Diagnostic helper: returns array of paths that fail structuredClone or are Promise/function
function detectNonCloneablePaths(obj) {
  const bad = [];
  const seen = new WeakSet();
  const inspect = (value, path = '<root>') => {
    try {
      if (value === null || value === undefined) return;
      if (typeof value === 'function') {
        bad.push({ path, type: 'function' });
        return;
      }
      if (value && (typeof value === 'object' || typeof value === 'function') && typeof value.then === 'function') {
        bad.push({ path, type: 'promise-like', value });
        return;
      }
      if (typeof structuredClone === 'function') {
        try { structuredClone(value); return; } catch (e) { /* fallthrough to deeper inspection */ }
      }
      if (value && typeof value === 'object') {
        if (seen.has(value)) return;
        seen.add(value);
        // enumerate own property names and symbols and also entries for objects
        try {
          const names = Object.getOwnPropertyNames(value).concat(Object.getOwnPropertySymbols(value));
          for (const n of names) {
            let desc;
            try { desc = Object.getOwnPropertyDescriptor(value, n); } catch (_e) { desc = null; }
            let v;
            try {
              if (desc && (desc.get || desc.set)) {
                try { v = value[n]; } catch (_e) { bad.push({ path: `${path}.${String(n)}`, type: 'getter-threw' }); continue; }
              } else { v = value[n]; }
            } catch (e) { bad.push({ path: `${path}.${String(n)}`, type: 'access-error', error: String(e && e.message) }); continue; }
            inspect(v, `${path}.${String(n)}`);
          }
          // if it's an array-like, also inspect elements
          if (Array.isArray(value)) {
            for (let i = 0; i < value.length; i++) inspect(value[i], `${path}[${i}]`);
          }
        } catch (e) {
          bad.push({ path, type: 'inspect-error', error: String(e && e.message) });
        }
      }
    } catch (e) {
      bad.push({ path, type: 'unknown-inspect-error', error: String(e && e.message) });
    }
  };
  inspect(obj);
  return bad;
}

// More aggressive diagnostic collector: collects property metadata (including
// non-enumerable and prototype properties) up to `maxEntries` items so we can
// see where a Promise-like or non-cloneable value may live (including on
// prototypes or via getters).
function gatherCloneabilityInfo(obj, maxEntries = 500) {
  const out = [];
  const seen = new WeakSet();
  const push = (entry) => { if (out.length < maxEntries) out.push(entry); };

  const inspect = (value, path = '<root>') => {
    if (out.length >= maxEntries) return;
    try {
      if (value === null || value === undefined) return;
      if (typeof value === 'function') { push({ path, kind: 'function' }); return; }
      if (value && (typeof value === 'object' || typeof value === 'function') && typeof value.then === 'function') { push({ path, kind: 'promise-like', constructor: value.constructor?.name }); return; }

      // Quick structuredClone test
      try { if (typeof structuredClone === 'function') { structuredClone(value); return; } } catch (e) { /* fall through to deeper inspection */ }

      if (value && typeof value === 'object') {
        if (seen.has(value)) return;
        seen.add(value);

        // Walk prototype chain to capture non-enumerable/proto properties
        let proto = value;
        while (proto && proto !== Object.prototype && out.length < maxEntries) {
          try {
            const names = Object.getOwnPropertyNames(proto).concat(Object.getOwnPropertySymbols(proto));
            for (const n of names) {
              if (out.length >= maxEntries) break;
              const key = typeof n === 'symbol' ? n.toString() : String(n);
              try {
                const desc = Object.getOwnPropertyDescriptor(proto, n);
                if (desc && (desc.get || desc.set)) {
                  try {
                    const v = value[n];
                    push({ path: `${path}.${key}`, descriptor: { get: true }, type: typeof v, constructor: v && v.constructor && v.constructor.name, isPromiseLike: !!(v && typeof v.then === 'function') });
                    inspect(v, `${path}.${key}`);
                  } catch (getErr) {
                    push({ path: `${path}.${key}`, descriptor: { get: true }, kind: 'getter-threw', error: String(getErr && getErr.message) });
                  }
                } else {
                  let v;
                  try { v = value[n]; } catch (accessErr) { push({ path: `${path}.${key}`, kind: 'access-error', error: String(accessErr && accessErr.message) }); continue; }
                  push({ path: `${path}.${key}`, descriptor: { get: false }, type: typeof v, constructor: v && v.constructor && v.constructor.name, isPromiseLike: !!(v && typeof v.then === 'function') });
                  inspect(v, `${path}.${key}`);
                }
              } catch (e) {
                push({ path: `${path}.${key}`, kind: 'enumeration-error', error: String(e && e.message) });
              }
            }
          } catch (e) {
            push({ path: path, kind: 'proto-enumeration-failed', error: String(e && e.message) });
          }
          proto = Object.getPrototypeOf(proto);
        }

        // Also inspect array elements if it's an array
        if (Array.isArray(value)) {
          for (let i = 0; i < value.length && out.length < maxEntries; i++) {
            inspect(value[i], `${path}[${i}]`);
          }
        }
      }
    } catch (e) {
      push({ path, kind: 'inspect-failed', error: String(e && e.message) });
    }
  };

  inspect(obj, '<root>');
  return out;
}

// Save a JSON-safe copy of a problematic object to localStorage for later
// investigation and write a minimal fallback record into Dexie so sync can
// proceed without blocking the app.
function saveFailedSyncItem(kind, obj, err) {
  try {
    const safeString = JSON.stringify(obj, function replacer(_k, v) {
      if (v && (typeof v === 'object' || typeof v === 'function') && typeof v.then === 'function') return '[Promise]';
      if (typeof v === 'function') return '[Function]';
      try { JSON.stringify(v); return v; } catch (_e) { return `[Unserializable: ${String(_e && _e.message)}]`; }
    });
    const key = `recordiq_failed_sync_${kind}_${Date.now()}`;
    try { localStorage.setItem(key, safeString); } catch (_e) { /* ignore storage errors */ }
    return key;
  } catch (e) {
    return null;
  }
}

// Create a shallow snapshot of an object's own properties and descriptors
// without invoking getters. This helps diagnose properties that may be
// non-enumerable or accessor-based and would throw when read.
function shallowDescriptorSnapshot(obj) {
  try {
    if (!obj || typeof obj !== 'object') return null;
    const out = [];
    const names = Object.getOwnPropertyNames(obj).concat(Object.getOwnPropertySymbols(obj));
    for (const n of names) {
      try {
        const desc = Object.getOwnPropertyDescriptor(obj, n) || {};
        const key = typeof n === 'symbol' ? n.toString() : String(n);
        const item = { key, descriptor: { enumerable: !!desc.enumerable, configurable: !!desc.configurable } };
        if ('value' in desc) {
          const val = desc.value;
          item.descriptor.writable = !!desc.writable;
          item.type = typeof val;
          item.isPromiseLike = !!(val && (typeof val === 'object' || typeof val === 'function') && typeof val.then === 'function');
          // For common primitives/arrays, capture a small sample
          try {
            if (Array.isArray(val)) item.sample = val.slice(0,5);
            else if (val && typeof val === 'object') item.constructorName = val.constructor && val.constructor.name;
            else item.sample = val;
          } catch (_e) { /* ignore sample errors */ }
        } else {
          // Accessor property — don't invoke getter
          item.descriptor.get = !!desc.get;
          item.descriptor.set = !!desc.set;
        }
        out.push(item);
      } catch (_e) {
        // skip problematic property
      }
    }
    return out;
  } catch (e) {
    return [{ error: String(e && e.message) }];
  }
}

// Simple event emitter for sync lifecycle events
const listeners = {};
let syncing = false;
let lastFullSyncAt = 0;
// Allow tests to override the interval for determinism
let MIN_FULL_SYNC_INTERVAL_MS = 60 * 1000; // 1 minute
let _inFlightFullSync = null;
let _queueSyncTimeout = null;

export const on = (event, cb) => {
  if (!listeners[event]) listeners[event] = new Set();
  listeners[event].add(cb);
};

export const off = (event, cb) => {
  listeners[event]?.delete(cb);
};

const emit = (event, payload) => {
  const set = listeners[event];
  if (!set || set.size === 0) return false;
  for (const cb of Array.from(set)) {
    try { cb(payload); } catch (e) { console.error('dataSyncService listener error', e); }
  }
  return true;
};

// Allow other services (e.g., syncService) to broadcast sync lifecycle events
export const broadcast = (event, payload) => {
  try { emit(event, payload); } catch (e) { console.error('dataSyncService broadcast error', e); }
};

// Request an in-app confirmation to clear local data. Returns a Promise<boolean>
export const requestClearLocalData = async ({ from, to, pendingCount = 0, timeout = 0 } = {}) => {
  // Prefer UI modal via event listeners. Modal mount timing can race with
  // the initial sign-in check. To avoid hanging or prematurely falling back
  // we poll briefly for a listener before showing a browser confirm fallback.
  const diagEntry = { when: Date.now(), from, to, pendingCount, usedFallback: false, attempts: 0 };
  try {
    const maxRetries = 50; // allow more time for modal to mount (up to ~5s)
    const delayMs = 100;
    let hadListeners = false;
    for (let i = 0; i < maxRetries; i++) {
      diagEntry.attempts = i + 1;
      hadListeners = emit('confirm:clear-local-data', {
        from,
        to,
        pendingCount,
        respond: (action) => { /* noop; we'll re-emit with real responder if needed */ },
      });
      if (hadListeners) break;
      // Wait a short time for the modal component to mount and register
      await new Promise(r => setTimeout(r, delayMs));
    }

    if (!hadListeners) {
      // Record diagnostic that fallback will be used
      diagEntry.usedFallback = true;
      try { if (typeof window !== 'undefined') { window.__syncUserChangeDiag = window.__syncUserChangeDiag || []; window.__syncUserChangeDiag.push(diagEntry); } } catch (_e) {}

      // No UI listener after retries; provide a safe fallback using window.confirm
      if (typeof window === 'undefined') return 'cancel';
      if (pendingCount > 0) {
        const ok = window.confirm(`There are ${pendingCount} pending outgoing change(s) from the previous user (${from}).\n\nPress OK to attempt uploading pending items then clear local data, or Cancel to keep local data.`);
        return ok ? 'sync' : 'cancel';
      }
      const ok = window.confirm(`Signed-in user changed from ${from} to ${to}.\n\nPress OK to clear local data (recommended), or Cancel to keep existing local data.`);
      return ok ? 'clear' : 'cancel';
    }

    // If a UI listener exists, return a Promise that resolves when the UI
    // calls the provided `respond` callback. Use a timeout if requested.
    return await new Promise((resolve) => {
      let settled = false;
      const timer = timeout > 0 ? setTimeout(() => {
        if (settled) return;
        settled = true;
        // record diagnostic timeout
        diagEntry.usedFallback = true;
        try { if (typeof window !== 'undefined') { window.__syncUserChangeDiag = window.__syncUserChangeDiag || []; window.__syncUserChangeDiag.push(diagEntry); } } catch (_e) {}
        resolve('cancel');
      }, timeout) : null;

      // Re-emit with a real respond handler that resolves the promise.
      emit('confirm:clear-local-data', {
        from,
        to,
        pendingCount,
        respond: (action) => {
          if (settled) return;
          settled = true;
          if (timer) clearTimeout(timer);
          const a = String(action || 'cancel');
          if (a === 'sync' || a === 'clear' || a === 'cancel') return resolve(a);
          return resolve('cancel');
        },
      });
    });
  } catch (e) {
    try { if (typeof window !== 'undefined') { window.__syncUserChangeDiag = window.__syncUserChangeDiag || []; diagEntry.error = String(e && e.message); window.__syncUserChangeDiag.push(diagEntry); } } catch (_e) {}
    return 'cancel';
  }
};

// Clear local IndexedDB primary tables and set the local user id marker
export const clearLocalData = async (currentUser) => {
  try {
    await Promise.all([
      db.invoices.clear(),
      db.records.clear(),
      db.customers.clear(),
      db.payments.clear(),
      db.utilityServices.clear(),
      db.syncQueue.clear(),
    ]);
    try { localStorage.setItem(LOCAL_USER_KEY, String(currentUser)); } catch (e) { /* ignore */ }
    return true;
  } catch (err) {
    console.error('[DataSync] clearLocalData failed', err);
    return false;
  }
};

export const isSyncing = () => syncing;

const setSyncing = (val) => {
  syncing = Boolean(val);
};

export const syncAllData = async () => {
  // Coalesce concurrent calls: return the in-flight promise if present
  if (_inFlightFullSync) return _inFlightFullSync;

  _inFlightFullSync = (async () => {
    // Avoid repeated full-syncs in short succession
    const now = Date.now();
    if (now - lastFullSyncAt < MIN_FULL_SYNC_INTERVAL_MS) {
      if (import.meta.env.DEV) {
        console.log('[DataSync] Skipping full sync; ran recently.');
      }
      return;
    }

    console.log('[DataSync] Starting full data synchronization...');
    setSyncing(true);
    emit('sync:start');
    try {
      // Fetch current authenticated user id to guard persisted data
      let currentUser = null;
      try {
        const who = await api.get('/auth/whoami');
        currentUser = who?.data?.userId || null;
        if (import.meta.env.DEV) console.debug('[DataSync] whoami userId=', currentUser);
      } catch (e) {
        if (import.meta.env.DEV) console.warn('[DataSync] whoami lookup failed', e);
      }

        // Helper: detect whether local DB contains items owned by a different user
        const localHasForeignData = async (userId) => {
          if (!userId) return { hasForeign: false, samples: [] };
          try {
            const tablesToCheck = ['invoices','customers','records','utilityServices'];
            const samples = [];
            for (const t of tablesToCheck) {
              try {
                if (!db[t] || typeof db[t].toArray !== 'function') continue;
                const items = await db[t].toArray();
                for (const it of items || []) {
                  try {
                    // determine owner-like fields
                    let owners = [];
                    if (t === 'customers') {
                      if (Array.isArray(it.users)) owners = owners.concat(it.users);
                      if (it.user) owners.push(it.user);
                      if (it.userId) owners.push(it.userId);
                      if (it.sellerId) owners.push(it.sellerId);
                    } else if (t === 'invoices') {
                      if (it.user) owners.push(it.user);
                      if (it.userId) owners.push(it.userId);
                      if (it.sellerId) owners.push(it.sellerId);
                      if (it.owner) owners.push(it.owner);
                      if (it.ownerId) owners.push(it.ownerId);
                    } else {
                      if (it.user) owners.push(it.user);
                      if (it.userId) owners.push(it.userId);
                      if (it.sellerId) owners.push(it.sellerId);
                    }
                    // normalize and dedupe
                    owners = owners.filter(o => o !== undefined && o !== null).map(o => String(o));
                    if (owners.length === 0) continue;
                    const belongsToCurrent = owners.some(o => String(o) === String(userId));
                    if (!belongsToCurrent) {
                      samples.push({ table: t, _id: it._id || it.id || null, owners });
                      // once we find one, we can return early for speed
                      return { hasForeign: true, samples };
                    }
                  } catch (_e) { continue; }
                }
              } catch (_e) { continue; }
            }
            return { hasForeign: false, samples: [] };
          } catch (e) {
            if (import.meta.env.DEV) console.warn('[DataSync] localHasForeignData check failed', e);
            return { hasForeign: false, samples: [] };
          }
        };

        // If the local DB contains items belonging to another user (e.g., previous clerk), prompt for clearing
        try {
          if (currentUser) {
            const foreign = await localHasForeignData(currentUser);
            if (foreign.hasForeign) {
              const stored = localStorage.getItem(LOCAL_USER_KEY);
              const from = stored || (foreign.samples && foreign.samples[0] && foreign.samples[0].owners ? String(foreign.samples[0].owners[0]) : 'unknown');
              const to = currentUser;
              try {
                const pendingCount = await (db.syncQueue && typeof db.syncQueue.count === 'function' ? db.syncQueue.count() : 0);
                if (!pendingCount) {
                  if (import.meta.env.DEV) console.debug('[DataSync] foreign local data detected — clearing local DB', { from, to, foreign });
                  await clearLocalData(currentUser);
                } else {
                  const action = await requestClearLocalData({ from, to, pendingCount });
                  if (action === 'clear') {
                    if (import.meta.env.DEV) console.debug('[DataSync] User chose to clear local DB due to foreign data', { from, to, pendingCount, foreign });
                    await clearLocalData(currentUser);
                  } else if (action === 'sync') {
                    if (import.meta.env.DEV) console.debug('[DataSync] User chose to sync outgoing items before clearing (foreign data)', { from, to, pendingCount, foreign });
                    try {
                      await syncWithServer();
                      await clearLocalData(currentUser);
                    } catch (syncErr) {
                      console.error('[DataSync] Sync failed when attempting to flush outgoing items before clear (foreign data)', syncErr);
                      setSyncing(false);
                      return;
                    }
                  } else {
                    if (import.meta.env.DEV) console.warn('[DataSync] User cancelled clearing local DB despite foreign data; aborting sync');
                    setSyncing(false);
                    return;
                  }
                }
              } catch (e) {
                if (import.meta.env.DEV) console.warn('[DataSync] foreign-data requestClearLocalData or clearLocalData failed', e);
                setSyncing(false);
                return;
              }
            }
          }
        } catch (e) {
          if (import.meta.env.DEV) console.warn('[DataSync] foreign-owner detection failed', e);
        }

      // Detect user change and optionally clear local DB to avoid cross-user leakage
      try {
        const stored = localStorage.getItem(LOCAL_USER_KEY);
        if (currentUser && stored && stored !== String(currentUser)) {
          // Hybrid: if there are no pending outgoing items, auto-clear; otherwise ask user for action
          const from = stored;
          const to = currentUser;
          try {
            const pendingCount = await (db.syncQueue && typeof db.syncQueue.count === 'function' ? db.syncQueue.count() : 0);
            if (!pendingCount) {
              if (import.meta.env.DEV) console.debug('[DataSync] No pending outgoing items — clearing local DB', { from, to });
              await clearLocalData(currentUser);
            } else {
              const action = await requestClearLocalData({ from, to, pendingCount });
              if (action === 'clear') {
                if (import.meta.env.DEV) console.debug('[DataSync] User chose to clear local DB', { from, to, pendingCount });
                await clearLocalData(currentUser);
              } else if (action === 'sync') {
                if (import.meta.env.DEV) console.debug('[DataSync] User chose to sync outgoing items before clearing', { from, to, pendingCount });
                try {
                  await syncWithServer();
                  // After successful sync, clear to avoid cross-account leakage
                  await clearLocalData(currentUser);
                } catch (syncErr) {
                  console.error('[DataSync] Sync failed when attempting to flush outgoing items before clear', syncErr);
                  setSyncing(false);
                  return;
                }
              } else {
                if (import.meta.env.DEV) console.warn('[DataSync] User cancelled clearing local DB; aborting sync');
                setSyncing(false);
                return;
              }
            }
          } catch (e) {
            if (import.meta.env.DEV) console.warn('[DataSync] requestClearLocalData or clearLocalData failed', e);
            setSyncing(false);
            return;
          }
        } else if (currentUser && !stored) {
          // First time store
          localStorage.setItem(LOCAL_USER_KEY, String(currentUser));
        }
      } catch (e) {
        if (import.meta.env.DEV) console.warn('[DataSync] user-change detection failed', e);
      }
      // Use allSettled so one failing endpoint won't abort the entire full-sync
      const results = await Promise.allSettled([
        getInvoices(),
        getRecords(),
        getCustomers(),
        getUtilityServices(),
      ]);
      const invoicesResponse = results[0].status === 'fulfilled' ? results[0].value : null;
      const recordsResponse = results[1].status === 'fulfilled' ? results[1].value : null;
      const customersResponse = results[2].status === 'fulfilled' ? results[2].value : null;
      const utilityServicesResponse = results[3].status === 'fulfilled' ? results[3].value : null;
      if (import.meta.env.DEV) {
        results.forEach((r, i) => {
          if (r.status === 'rejected') console.warn('[DataSync] fetch failed for resource index', i, r.reason);
        });
      }

    const invoices = Array.isArray(invoicesResponse) ? invoicesResponse : invoicesResponse?.invoices || [];
    const records = Array.isArray(recordsResponse) ? recordsResponse : recordsResponse?.records || [];
    const customers = Array.isArray(customersResponse) ? customersResponse : customersResponse?.customers || [];
    const utilityServices = Array.isArray(utilityServicesResponse) ? utilityServicesResponse : utilityServicesResponse?.services || [];

    // Sanitize and save invoices
    if (import.meta.env.DEV) console.debug('[DataSync] invoices fetched count:', invoices?.length);
    // DEV diagnostic: scan raw fetched invoices for non-cloneable fields before any sanitization
    if (import.meta.env.DEV) {
      try {
        for (const rawInv of invoices) {
          try {
            const diag = detectNonCloneablePaths(rawInv) || [];
            if (diag.length) {
              const full = gatherCloneabilityInfo(rawInv);
              console.warn('[DataSync][DEV] raw invoice contains non-cloneable fields', { id: rawInv?._id || rawInv?.id, diag, full });
              try { if (typeof window !== 'undefined') window.__lastRawInvoiceDiag = { id: rawInv?._id || rawInv?.id, diag, full, raw: rawInv }; } catch (_e) {}
              break;
            }
          } catch (_e) { /* ignore per-item inspection errors */ }
        }
      } catch (_e) { /* ignore */ }
    }
    const sanitizedInvoices = sanitizeArrayForDb(invoices, { flattenCustomer: true });
    for (const invoice of sanitizedInvoices) {
      try {
        // Drop any top-level thenables (e.g., an `id` Promise) before async sanitization
        pruneTopLevelThenables(invoice);
        // Deep sanitize and ensure no Promise/object fields remain
        const cleanInvoice = await deepSanitizeAsync(invoice);
        const normalizedInvoice = typeof cleanInvoice === 'object' ? sanitizeArrayForDb([cleanInvoice], { flattenCustomer: true })[0] : cleanInvoice;

        // Normalize/remove problematic `id` field
        try {
          if (normalizedInvoice && Object.prototype.hasOwnProperty.call(normalizedInvoice, 'id')) {
            const val = normalizedInvoice.id;
            const t = typeof val;
            if (t === 'string' || t === 'number') {
              if (!normalizedInvoice._id) normalizedInvoice._id = String(val);
              delete normalizedInvoice.id;
            } else if (val && typeof val === 'object') {
              try {
                if (typeof val.toString === 'function') {
                  const s = String(val.toString());
                  if (s && s !== '[object Object]') {
                    if (!normalizedInvoice._id) normalizedInvoice._id = s;
                    delete normalizedInvoice.id;
                  } else {
                    delete normalizedInvoice.id;
                  }
                } else {
                  delete normalizedInvoice.id;
                }
              } catch (e) { delete normalizedInvoice.id; }
            }
          }
        } catch (normErr) { if (import.meta.env.DEV) console.warn('[DataSync] invoice id normalization failed', normErr); }

        // Guard: if invoice has owner-like fields and none match current user, skip saving locally
        if (currentUser && normalizedInvoice) {
          const owners = [];
          try {
            if (normalizedInvoice.user) owners.push(normalizedInvoice.user);
            if (normalizedInvoice.userId) owners.push(normalizedInvoice.userId);
            if (normalizedInvoice.sellerId) owners.push(normalizedInvoice.sellerId);
            if (normalizedInvoice.owner) owners.push(normalizedInvoice.owner);
            if (normalizedInvoice.ownerId) owners.push(normalizedInvoice.ownerId);
          } catch (_e) {}
          if (owners.length > 0) {
            const ok = owners.some(o => String(o) === String(currentUser));
            if (!ok) {
              if (import.meta.env.DEV) console.warn('[DataSync] Skipping invoice that belongs to different user', { owners, currentUser, _id: normalizedInvoice._id });
              continue;
            }
          }
        }

        // Ensure a string `_id` exists so Dexie unique index doesn't receive `undefined`
        try {
          if (!normalizedInvoice._id) normalizedInvoice._id = makeTempId ? makeTempId() : `client_${Date.now()}_${Math.random().toString(36).slice(2,9)}`;
          normalizedInvoice._id = String(normalizedInvoice._id);
        } catch (e) {
          if (import.meta.env.DEV) console.warn('[DataSync] failed to ensure invoice._id is string', e);
          // fallback to a timestamp-based id
          normalizedInvoice._id = String(Date.now()) + '_' + Math.random().toString(36).slice(2,9);
        }

        const existing = await firstOrUndefined(db.invoices.where('_id').equals(String(normalizedInvoice._id)));
        if (existing) {
          // Use a minimal whitelist serializer to guarantee cloneability.
          const toWrite = pickInvoiceForDb(normalizedInvoice);
          // Use the more aggressive ensureCloneable pass which prunes thenables
          // and performs structuredClone-friendly conversion.
          let safeToWrite = toWrite;
          try { safeToWrite = ensureCloneable(toWrite); } catch (_e) { try { safeToWrite = makeCloneSafe(pruneSyncNonCloneable(toWrite)); } catch (_ee) { /* fallback to toWrite */ } }
          try {
            if (typeof window !== 'undefined') { window.__dataSyncDiag = window.__dataSyncDiag || []; window.__dataSyncDiag.push({ step: 'invoice-update', id: normalizedInvoice._id, safeSnapshot: safeToWrite }); }
          } catch (_e) {}
          await db.invoices.update(existing.id, safeToWrite);
        } else {
          try {
            // DEV-only: capture a shallow descriptor snapshot to avoid invoking getters
            try { if (typeof window !== 'undefined' && import.meta.env.DEV) window.__lastAddAttempt = { when: 'invoice-add', snapshot: shallowDescriptorSnapshot(normalizedInvoice) }; } catch (_e) {}
              // Use whitelist serializer before persisting to avoid DataCloneError
              const toWrite = pickInvoiceForDb(normalizedInvoice);
              let safeToWrite = toWrite;
              try { safeToWrite = ensureCloneable(toWrite); } catch (_e) { try { safeToWrite = makeCloneSafe(pruneSyncNonCloneable(toWrite)); } catch (_ee) { /* fallback to toWrite */ } }
              // Extra guard: remove any thenable fields that survived transformations
              pruneTopLevelThenables(safeToWrite);
              try {
                if (typeof window !== 'undefined') { window.__dataSyncDiag = window.__dataSyncDiag || []; window.__dataSyncDiag.push({ step: 'invoice-add', id: toWrite && toWrite._id, safeSnapshot: safeToWrite }); }
              } catch (_e) {}
              await db.invoices.add(safeToWrite);
          } catch (addErr) {
            try {
              const diag = detectNonCloneablePaths(normalizedInvoice) || [];
              const fullDiag = (diag.length === 0) ? gatherCloneabilityInfo(normalizedInvoice) : diag;
              if (import.meta.env.DEV) console.error('[DataSync] Failed to add invoice to IndexedDB', { normalizedInvoice, diagnostic: diag, diagnosticFull: fullDiag }, addErr);
              try { if (typeof window !== 'undefined') window.__lastDataSyncFailure = { when: 'invoice-add', normalizedInvoice, diagnostic: diag, diagnosticFull: fullDiag, err: String(addErr && addErr.message) }; } catch (_e) {}
              try { if (typeof window !== 'undefined' && import.meta.env.DEV) window.__lastAddAttempt = { when: 'invoice-add', snapshot: shallowDescriptorSnapshot(normalizedInvoice), addError: String(addErr && addErr.message) }; } catch (_e) {}
            } catch (_e) {
              console.error('[DataSync] Failed to add invoice to IndexedDB (and diagnostic failed)', { normalizedInvoice }, addErr);
            }

            // Non-blocking fallback: save a minimal invoice placeholder and store
            // the original problematic payload to localStorage for later analysis.
            try {
              const fallbackKey = saveFailedSyncItem('invoice', normalizedInvoice, addErr);
              const fallback = {
                _id: normalizedInvoice._id || (`failed_${Date.now()}`),
                invoiceNumber: normalizedInvoice.invoiceNumber || null,
                total: normalizedInvoice.total || null,
                createdAt: normalizedInvoice.createdAt || new Date().toISOString(),
                _failedSync: true,
                _failedSyncKey: fallbackKey || null,
              };
              try { await db.invoices.put(fallback); } catch (_putErr) { if (import.meta.env.DEV) console.warn('[DataSync] fallback put also failed', _putErr); }
            } catch (_e) { /* ignore fallback errors */ }
            // Continue without throwing so full sync completes
          }
        }
      } catch (err) {
        console.warn('Failed to sync invoice:', err);
      }
    }

    // Sanitize and save records
    if (import.meta.env.DEV) console.debug('[DataSync] records fetched count:', records?.length);
    const sanitizedRecords = sanitizeArrayForDb(records);
    for (const record of sanitizedRecords) {
      try {
        // Remove top-level thenables before sanitization (some APIs may return promises)
        pruneTopLevelThenables(record);
        const cleanRecord = await deepSanitizeAsync(record);
        const normalizedRecord = typeof cleanRecord === 'object' ? sanitizeArrayForDb([cleanRecord])[0] : cleanRecord;
        // Remove problematic id field if present
        try { if (normalizedRecord && Object.prototype.hasOwnProperty.call(normalizedRecord, 'id')) delete normalizedRecord.id; } catch(e){}

        // Find existing by the string _id index (not by primary key)
        // Guard: ensure record.user matches current user if present
        if (currentUser && normalizedRecord && normalizedRecord.user) {
          if (String(normalizedRecord.user) !== String(currentUser)) {
            if (import.meta.env.DEV) console.warn('[DataSync] Skipping record for different user', { owner: normalizedRecord.user, currentUser, _id: normalizedRecord._id });
            continue;
          }
        }

        // Ensure _id exists and is a string to avoid adding `undefined` into the unique index
        try {
          if (!normalizedRecord._id) normalizedRecord._id = makeTempId ? makeTempId() : `client_${Date.now()}_${Math.random().toString(36).slice(2,9)}`;
          normalizedRecord._id = String(normalizedRecord._id);
        } catch (e) {
          if (import.meta.env.DEV) console.warn('[DataSync] failed to ensure record._id is string', e);
          normalizedRecord._id = String(Date.now()) + '_' + Math.random().toString(36).slice(2,9);
        }

        const existing = await firstOrUndefined(db.records.where('_id').equals(String(normalizedRecord._id)));
        if (existing && existing.id !== undefined) {
          const toWrite = ensureCloneable(normalizedRecord);
          pruneTopLevelThenables(toWrite);
          await db.records.update(existing.id, toWrite);
        } else {
          try {
            const toWrite = ensureCloneable(normalizedRecord);
            await db.records.add(toWrite);
          } catch (addErr) {
            try {
              const diag = detectNonCloneablePaths(normalizedRecord) || [];
              const fullDiag = (diag.length === 0) ? gatherCloneabilityInfo(normalizedRecord) : diag;
              if (import.meta.env.DEV) console.error('[DataSync] Failed to add record to IndexedDB', { normalizedRecord, diagnostic: diag, diagnosticFull: fullDiag }, addErr);
              try { if (typeof window !== 'undefined') window.__lastDataSyncFailure = { when: 'record-add', normalizedRecord, diagnostic: diag, diagnosticFull: fullDiag, err: String(addErr && addErr.message) }; } catch (_e) {}
            } catch (_e) {
              console.error('[DataSync] Failed to add record to IndexedDB (and diagnostic failed)', { normalizedRecord }, addErr);
            }

            try {
              const fallbackKey = saveFailedSyncItem('record', normalizedRecord, addErr);
              const fallback = { _id: normalizedRecord._id || (`failed_record_${Date.now()}`), createdAt: normalizedRecord.createdAt || new Date().toISOString(), _failedSync: true, _failedSyncKey: fallbackKey || null };
              try { await db.records.put(fallback); } catch (_putErr) { if (import.meta.env.DEV) console.warn('[DataSync] fallback put for record failed', _putErr); }
            } catch (_e) { /* ignore */ }
            // Continue without throwing so full sync completes
          }
        }
      } catch (err) {
        console.warn('Failed to sync record:', err);
      }
    }

    // Sanitize and save customers
    if (import.meta.env.DEV) console.debug('[DataSync] customers fetched count:', customers?.length);
    const sanitizedCustomers = sanitizeArrayForDb(customers);
    for (const customer of sanitizedCustomers) {
      try {
        // Remove top-level thenables before sanitization
        pruneTopLevelThenables(customer);
        // Deep-sanitize incoming customer to resolve any Promise fields and strip functions
        const cleanCustomer = await deepSanitizeAsync(customer);
        const normalized = typeof cleanCustomer === 'object' ? sanitizeArrayForDb([cleanCustomer])[0] : cleanCustomer;
        // Normalize/remove problematic `id` field that may be a Mongo/ObjectId or nested object
        try {
          if (normalized && Object.prototype.hasOwnProperty.call(normalized, 'id')) {
            const val = normalized.id;
            const t = typeof val;
            // If it's a primitive, map it to _id
            if (t === 'string' || t === 'number') {
              if (!normalized._id) normalized._id = String(val);
              delete normalized.id;
              if (import.meta.env.DEV) console.debug('[DataSync] normalized customer.id -> _id', { _id: normalized._id });
            } else if (val && typeof val === 'object') {
              // Try common ObjectId accessors
              try {
                if (typeof val.toString === 'function') {
                  const s = String(val.toString());
                  if (s && s !== '[object Object]') {
                    if (!normalized._id) normalized._id = s;
                    delete normalized.id;
                    if (import.meta.env.DEV) console.debug('[DataSync] converted nested customer.id to string _id', { _id: normalized._id });
                  } else {
                    // Unknown object shape; remove it to avoid cloning issues
                    delete normalized.id;
                    if (import.meta.env.DEV) console.debug('[DataSync] removed non-serializable customer.id');
                  }
                } else {
                  delete normalized.id;
                  if (import.meta.env.DEV) console.debug('[DataSync] removed non-serializable customer.id (no toString)');
                }
              } catch (e) {
                delete normalized.id;
                if (import.meta.env.DEV) console.debug('[DataSync] removed problematic customer.id during normalization', e);
              }
            }
          }
        } catch (normErr) {
          if (import.meta.env.DEV) console.warn('[DataSync] customer id normalization failed', normErr);
        }
        // Guard: customers may have `users` array (multiple sellers) or single-owner fields.
        if (currentUser && normalized) {
          try {
            if (Array.isArray(normalized.users)) {
              const has = normalized.users.some(u => String(u) === String(currentUser));
              if (!has) {
                if (import.meta.env.DEV) console.warn('[DataSync] Skipping customer not linked to current user', { users: normalized.users, currentUser, _id: normalized._id });
                continue;
              }
            } else if (normalized.user || normalized.userId || normalized.sellerId) {
              const owner = normalized.user || normalized.userId || normalized.sellerId;
              if (String(owner) !== String(currentUser)) {
                if (import.meta.env.DEV) console.warn('[DataSync] Skipping customer for different user', { owner, currentUser, _id: normalized._id });
                continue;
              }
            }
          } catch (_e) {
            // on inspection errors, don't skip — safer to include
          }
        }

        // Ensure _id exists and is a string to avoid adding `undefined` into the unique index
        try {
          if (!normalized._id) normalized._id = makeTempId ? makeTempId() : `client_${Date.now()}_${Math.random().toString(36).slice(2,9)}`;
          normalized._id = String(normalized._id);
        } catch (e) {
          if (import.meta.env.DEV) console.warn('[DataSync] failed to ensure customer._id is string', e);
          normalized._id = String(Date.now()) + '_' + Math.random().toString(36).slice(2,9);
        }

        const existing = await firstOrUndefined(db.customers.where('_id').equals(String(normalized._id)));
        if (existing) {
          const toWrite = ensureCloneable(normalized);
          pruneTopLevelThenables(toWrite);
          await db.customers.update(existing.id, toWrite);
        } else {
          try {
            const toWrite = ensureCloneable(normalized);
            await db.customers.add(toWrite);
          } catch (addErr) {
            try {
              const diag = detectNonCloneablePaths(normalized) || [];
              const fullDiag = (diag.length === 0) ? gatherCloneabilityInfo(normalized) : diag;
              if (import.meta.env.DEV) console.error('[DataSync] Failed to add customer to IndexedDB', { normalized, diagnostic: diag, diagnosticFull: fullDiag }, addErr);
              try { if (typeof window !== 'undefined') window.__lastDataSyncFailure = { when: 'customer-add', normalized, diagnostic: diag, diagnosticFull: fullDiag, err: String(addErr && addErr.message) }; } catch (_e) {}
            } catch (_e) {
              console.error('[DataSync] Failed to add customer to IndexedDB (and diagnostic failed)', { normalized }, addErr);
            }

            try {
              const fallbackKey = saveFailedSyncItem('customer', normalized, addErr);
              const fallback = { _id: normalized._id || (`failed_customer_${Date.now()}`), name: normalized.name || normalized.customerName || null, _failedSync: true, _failedSyncKey: fallbackKey || null };
              try { await db.customers.put(fallback); } catch (_putErr) { if (import.meta.env.DEV) console.warn('[DataSync] fallback put for customer failed', _putErr); }
            } catch (_e) { /* ignore */ }
            // Continue without throwing so full sync completes
          }
        }
      } catch (err) {
        console.warn('Failed to sync customer:', err);
      }
    }

    // Sanitize and save utility services
    if (import.meta.env.DEV) console.debug('[DataSync] utilityServices fetched count:', utilityServices?.length);
    const sanitizedUtilityServices = sanitizeArrayForDb(utilityServices);
    for (const service of sanitizedUtilityServices) {
      try {
        pruneTopLevelThenables(service);
        const cleanService = await deepSanitizeAsync(service);
        const normalizedService = typeof cleanService === 'object' ? sanitizeArrayForDb([cleanService])[0] : cleanService;
        // Ensure _id exists and is a string
        if (!normalizedService._id) normalizedService._id = makeTempId ? makeTempId() : String(Date.now());
        try { normalizedService._id = String(normalizedService._id); } catch (e) { normalizedService._id = String(normalizedService._id || Date.now()); }

        // Guard: utility services belong to a user
        if (currentUser && normalizedService && normalizedService.user) {
          if (String(normalizedService.user) !== String(currentUser)) {
            if (import.meta.env.DEV) console.warn('[DataSync] Skipping utilityService for different user', { owner: normalizedService.user, currentUser, _id: normalizedService._id });
            continue;
          }
        }

        const existing = await firstOrUndefined(db.utilityServices.where('_id').equals(String(normalizedService._id)));
        if (existing && existing.id !== undefined) {
          const toWrite = ensureCloneable(normalizedService);
          pruneTopLevelThenables(toWrite);
          await db.utilityServices.update(existing.id, toWrite);
        } else {
          try {
            const toWrite = ensureCloneable(normalizedService);
            await db.utilityServices.put(toWrite);
          } catch (addErr) {
            try {
              const diag = detectNonCloneablePaths(normalizedService) || [];
              const fullDiag = (diag.length === 0) ? gatherCloneabilityInfo(normalizedService) : diag;
              if (import.meta.env.DEV) console.error('[DataSync] Failed to add utilityService to IndexedDB', { normalizedService, diagnostic: diag, diagnosticFull: fullDiag }, addErr);
              try { if (typeof window !== 'undefined') window.__lastDataSyncFailure = { when: 'utilityService-add', normalizedService, diagnostic: diag, diagnosticFull: fullDiag, err: String(addErr && addErr.message) }; } catch (_e) {}
            } catch (_e) {
              console.error('[DataSync] Failed to add utilityService to IndexedDB (and diagnostic failed)', { normalizedService }, addErr);
            }

            try {
              const fallbackKey = saveFailedSyncItem('utilityService', normalizedService, addErr);
              const fallback = { _id: normalizedService._id || (`failed_service_${Date.now()}`), name: normalizedService.name || normalizedService.description || null, _failedSync: true, _failedSyncKey: fallbackKey || null };
              try { await db.utilityServices.put(fallback); } catch (_putErr) { if (import.meta.env.DEV) console.warn('[DataSync] fallback put for utilityService failed', _putErr); }
            } catch (_e) { /* ignore */ }
            // Continue without throwing so full sync completes
          }
        }
      } catch (err) {
        console.warn('Failed to sync utility service:', err);
      }
    }

      console.log('[DataSync] Full data synchronization complete.');
      lastFullSyncAt = Date.now();
      emit('sync:finished');
      // Also broadcast an explicit data-refreshed event so UI components can reload cached views
      try { broadcast('data:refreshed'); } catch (e) { /* ignore */ }
    } catch (error) {
      console.error('Full data synchronization failed:', error);
      emit('sync:error', error);
    } finally {
      setSyncing(false);
    }
  })();

  try {
    return await _inFlightFullSync;
  } finally {
    _inFlightFullSync = null;
  }
};

// Test helpers (safe to call in tests only)
export const _testHelpers = {
  resetLastFullSyncAt: () => { lastFullSyncAt = 0; },
  setMinFullSyncIntervalMs: (ms) => { MIN_FULL_SYNC_INTERVAL_MS = Number(ms) || 0; },
};

let _autoSyncHandler = null;

export const startAutoSync = () => {
  if (_autoSyncHandler) return; // already started

  // Debounced helper to process outgoing queue when items are created
  const scheduleQueueSync = () => {
    if (_queueSyncTimeout) clearTimeout(_queueSyncTimeout);
    _queueSyncTimeout = setTimeout(async () => {
      try {
        if (navigator.onLine) {
          await syncWithServer();
        }
      } catch (e) {
        console.warn('[DataSync] scheduled syncWithServer failed', e);
      }
    }, 300); // debounce 300ms
  };

  _autoSyncHandler = async () => {
    try {
      if (navigator.onLine) {
        // First process any queued outgoing changes
        try { await syncWithServer(); } catch (e) { console.warn('[DataSync] syncWithServer failed during auto-sync', e); }
        // Then refresh local cache from server
        try { await syncAllData(); } catch (e) { console.warn('[DataSync] syncAllData failed during auto-sync', e); }
      }
    } catch (e) {
      console.error('[DataSync] auto-sync handler error', e);
    }
  };

  window.addEventListener('online', _autoSyncHandler);

  // Also listen for new items being added to the outgoing queue and attempt to sync when online
  if (db.syncQueue && typeof db.syncQueue.hook === 'function') {
    try {
      db.syncQueue.hook('creating', () => {
        // Schedule a queue sync (debounced)
        scheduleQueueSync();
      });
    } catch (e) {
      if (import.meta.env.DEV) console.warn('[DataSync] failed to attach syncQueue hook', e);
    }
  } else {
    if (import.meta.env.DEV) console.debug('[DataSync] syncQueue hook not available in this environment');
  }
};

export const stopAutoSync = () => {
  if (!_autoSyncHandler) return;
  window.removeEventListener('online', _autoSyncHandler);
  _autoSyncHandler = null;
};
