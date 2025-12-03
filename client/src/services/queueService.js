import db from '../db';
import { sanitizeForDb, pruneSyncNonCloneable, makeCloneSafe, safeStringify } from '../utils/dbUtils';
import saveProducerSnapshot from '../utils/producerDiag';

export const isPromise = (v) => v && (typeof v === 'object' || typeof v === 'function') && typeof v.then === 'function';

function formDataToObject(fd) {
  try {
    return Object.fromEntries(fd.entries());
  } catch (e) {
    return fd;
  }
}

export function deepSanitize(obj, path = '') {
  const DEV = typeof import.meta !== 'undefined' ? import.meta.env?.DEV : false;
  if (obj === null || obj === undefined) return obj;
  // Keep File/Blob and primitive types as-is
  if (typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean' || obj instanceof File || obj instanceof Blob || obj instanceof Date) return obj;
  if (isPromise(obj)) {
    if (DEV) console.warn(`[deepSanitize] removed Promise at path: ${path || '<root>'}`, obj);
    return undefined;
  }
  if (Array.isArray(obj)) {
    const arrOut = obj.map((v, i) => deepSanitize(v, `${path}[${i}]`)).filter(v => v !== undefined);
    return arrOut;
  }
  if (typeof obj === 'object') {
    // If it's FormData convert to plain object
    if (typeof obj.entries === 'function' && typeof obj.get === 'function') {
      try { obj = formDataToObject(obj); } catch (e) { /* fallthrough */ }
    }
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      const childPath = path ? `${path}.${k}` : k;
      if (typeof v === 'function') {
        if (DEV) console.warn(`[deepSanitize] removed function at path: ${childPath}`);
        continue;
      }
      if (isPromise(v)) {
        if (DEV) console.warn(`[deepSanitize] removed Promise at path: ${childPath}`);
        continue;
      }
      const sv = deepSanitize(v, childPath);
      if (sv !== undefined) out[k] = sv;
      else if (DEV) console.warn(`[deepSanitize] removed non-cloneable value at path: ${childPath}`);
    }
    return out;
  }
  return obj;
}

export async function deepSanitizeAsync(obj, path = '') {
  const DEV = typeof import.meta !== 'undefined' ? import.meta.env?.DEV : false;
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean' || obj instanceof File || obj instanceof Blob || obj instanceof Date) return obj;
  if (isPromise(obj)) {
    try {
      const resolved = await obj;
      return deepSanitize(await resolved, path);
    } catch (e) {
      if (DEV) console.warn(`[deepSanitizeAsync] promise at path ${path || '<root>'} rejected, removing`, e);
      return undefined;
    }
  }
  if (Array.isArray(obj)) {
    const results = [];
    for (let i = 0; i < obj.length; i++) {
      const v = await deepSanitizeAsync(obj[i], `${path}[${i}]`);
      if (v !== undefined) results.push(v);
    }
    return results;
  }
  if (typeof obj === 'object') {
    if (typeof obj.entries === 'function' && typeof obj.get === 'function') {
      try { obj = formDataToObject(obj); } catch (e) { /* fallthrough */ }
    }
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      const childPath = path ? `${path}.${k}` : k;
      if (typeof v === 'function') {
        if (DEV) console.warn(`[deepSanitizeAsync] removed function at path: ${childPath}`);
        continue;
      }
      if (isPromise(v)) {
        try {
          const resolved = await v;
          const sv = await deepSanitizeAsync(resolved, childPath);
          if (sv !== undefined) out[k] = sv;
        } catch (e) {
          if (DEV) console.warn(`[deepSanitizeAsync] removed rejected Promise at path: ${childPath}`, e);
        }
        continue;
      }
      const sv = await deepSanitizeAsync(v, childPath);
      if (sv !== undefined) out[k] = sv;
    }
    // At this point `out` should be free of Promises/functions, but it still
    // may contain values that the structured clone algorithm rejects. Try a
    // full structuredClone; if it fails, prune fields that cause the failure.
    if (typeof structuredClone === 'function') {
      try {
        structuredClone(out);
        return out;
      } catch (cloneErr) {
        if (DEV) console.warn('[deepSanitizeAsync] structuredClone failed on object, pruning fields', cloneErr);

        // Recursive pruner: remove any property that cannot be cloned.
        const prune = (target) => {
          if (target === null || target === undefined) return target;
          if (Array.isArray(target)) {
            // Filter array elements that are not cloneable
            const newArr = [];
            for (let i = 0; i < target.length; i++) {
              const el = target[i];
              try { structuredClone(el); newArr.push(el); } catch (e) {
                if (el && typeof el === 'object') {
                  // Try to prune nested object
                  const pr = prune(el);
                  try { structuredClone(pr); newArr.push(pr); } catch (e2) { if (DEV) console.warn('[deepSanitizeAsync] removed non-cloneable array element', e2); }
                } else { if (DEV) console.warn('[deepSanitizeAsync] removed non-cloneable array element (primitive)', e); }
              }
            }
            return newArr;
          }

          if (typeof target === 'object') {
            const outObj = {};
            for (const [key, val] of Object.entries(target)) {
              try {
                structuredClone(val);
                outObj[key] = val;
              } catch (e) {
                if (val && typeof val === 'object') {
                  const pr = prune(val);
                  try { structuredClone(pr); outObj[key] = pr; } catch (e2) { if (DEV) console.warn('[deepSanitizeAsync] removed non-cloneable field', key, e2); }
                } else {
                  if (DEV) console.warn('[deepSanitizeAsync] removed non-cloneable field', key, e);
                }
              }
            }
            return outObj;
          }
          return target;
        };

        try {
          const pruned = prune(out);
          // After pruning, also run makeCloneSafe to replace any remaining thenables/accessors
          const safed = makeCloneSafe(pruned);
          // final attempt
          try { structuredClone(safed); return safed; } catch (finalErr) { if (DEV) console.warn('[deepSanitizeAsync] final structuredClone failed after pruning and makeCloneSafe', finalErr); }
        } catch (pruneErr) { if (DEV) console.warn('[deepSanitizeAsync] pruning failed', pruneErr); }
      }
    }

    return out;
  }
  return obj;
}

export async function enqueue(item) {
  // Ensure a plain object copy
  const copy = { ...item };
  // Deduplicate: if there's already a pending non-failed queue item for the
  // same entity/action/entityId, return that existing entry instead of
  // creating a duplicate. This prevents double-processing when multiple
  // callers schedule a sync around the same time (hooks + interval + manual).
  try {
    if (copy && copy.entity && copy.action && (copy.entityId !== undefined && copy.entityId !== null)) {
      try {
        const existing = await db.syncQueue.where('entity').equals(copy.entity).filter(q => q.action === copy.action && String(q.entityId) === String(copy.entityId) && !q.failed).first();
        if (existing) {
          if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) console.debug('[enqueue] dedupe: returning existing queue item', { entity: copy.entity, action: copy.action, entityId: copy.entityId, existingId: existing.id });
          return existing.id;
        }
      } catch (_e) {
        // ignore dedupe lookup failures and continue to add
      }
    }
  } catch (_e) {}
  // Dev-only: capture a shallow snapshot of the produced item before any
  // sanitization so we can diagnose structured-clone failures originating
  // from producers. This is safe to keep in source as the helper swallows
  // errors and only writes to window/localStorage.
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
      try { saveProducerSnapshot(copy, 'enqueue-pre-sanitize'); } catch (_e) { /* swallow */ }
    }
  } catch (_e) { /* swallow */ }
  // Do a quick synchronous prune to remove any top-level Promise/function
  // values that might have been attached by callers. This addresses cases
  // where something like `id: somePromise` slips into the queued item and
  // later causes IndexedDB's structured clone algorithm to fail.
  try {
    const prePruned = pruneSyncNonCloneable(copy);
    if (prePruned && typeof prePruned === 'object') {
      // Remove all own properties (including non-enumerable) to ensure no
      // strange fields remain (some callers or libs may attach non-enumerable
      // properties like `id` that can hold Promises).
      try {
        const ownNames = Object.getOwnPropertyNames(copy);
        for (const name of ownNames) {
          try { delete copy[name]; } catch (_e) { /* ignore */ }
        }
      } catch (_e) { /* ignore */ }
      Object.assign(copy, prePruned);
    }
  } catch (e) {
    // ignore prune errors and continue with original copy
  }
  // Normalize payload: apply a conservative, synchronous sanitizer so writes
  // never include thenables/getters/functions that break IndexedDB structured
  // clone. Also keep a serialized snapshot `payloadJson` for debugging/replay.
  if (copy.payload) {
    try {
      if (typeof safeStringify === 'function') {
        try { copy.payloadJson = safeStringify(copy.payload); } catch (_e) { /* ignore */ }
      }
    } catch (_e) { /* ignore */ }

    // Convert FormData -> plain object if needed (non-destructive)
    try {
      if (typeof copy.payload === 'object' && typeof copy.payload.entries === 'function' && typeof copy.payload.get === 'function') {
        try { copy.payload = formDataToObject(copy.payload); } catch (_e) { /* ignore */ }
      }
    } catch (_e) { /* ignore */ }

    // Synchronous conservative sanitization: replace accessors/thenables/functions
    // with safe placeholders to guarantee cloneability.
    try { copy.payload = makeCloneSafe(copy.payload); } catch (_e) { copy.payload = null; }

    // Also run sanitizeForDb shallow normalizations (string _id)
    try { if (typeof copy.payload === 'object') copy.payload = sanitizeForDb(copy.payload, { flattenCustomer: true }); } catch (_e) { /* ignore */ }
  }

  // Attach default metadata expected by syncService
  const now = new Date().toISOString();
  copy.attempts = typeof copy.attempts === 'number' ? copy.attempts : 0;
  copy.failed = !!copy.failed;
  copy.nextAttemptAt = copy.nextAttemptAt || null;
  copy.lastError = copy.lastError || null;
  copy.timestamp = copy.timestamp || now;

  // Write to Dexie
  // As a final defensive step, deep-sanitize the entire copy to ensure no
  // Promise/function values remain anywhere on the queued item. This prevents
  // IndexedDB `DataCloneError: <Promise> could not be cloned` when Dexie
  // attempts to write the object.
  try {
    const finalCopy = deepSanitize(copy);
    // Ensure payload exists (store null rather than leaving undefined)
    if (finalCopy && typeof finalCopy === 'object' && !Object.prototype.hasOwnProperty.call(finalCopy, 'payload')) finalCopy.payload = null;

    // Quick structuredClone check to fail fast and detect problematic fields
      try {
        if (typeof structuredClone === 'function') structuredClone(finalCopy);
        // Build a final safe copy that only contains own properties and omits
        // Promise/function values (covers enumerable and non-enumerable keys).
        const safeFinalCopy = {};
        try {
          const names = Object.getOwnPropertyNames(finalCopy || {}).concat(Object.getOwnPropertySymbols(finalCopy || {}));
          for (const n of names) {
            try {
              const desc = Object.getOwnPropertyDescriptor(finalCopy, n);
              let val;
              if (desc && (desc.get || desc.set)) {
                // Accessor property: attempt to read but guard against getters that throw.
                try { val = finalCopy[n]; } catch (_e) { continue; }
              } else {
                try { val = finalCopy[n]; } catch (_e) { continue; }
              }

              // Strip Promise/function values early
              if (isPromise(val) || typeof val === 'function') {
                if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) console.warn('[enqueue] stripping non-cloneable field', n, val);
                continue;
              }

              // Ensure the value is structured-cloneable: try a quick structuredClone
              let candidate = val;
              let ok = true;
              try {
                if (typeof structuredClone === 'function') structuredClone(candidate);
              } catch (cloneTestErr) {
                // Attempt synchronous prune for nested non-cloneable values
                try {
                  candidate = pruneSyncNonCloneable(candidate);
                  if (typeof structuredClone === 'function') structuredClone(candidate);
                } catch (pruneErr) {
                  ok = false;
                  if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) console.warn('[enqueue] dropping non-cloneable field after prune', n, pruneErr);
                }
              }

              if (ok) safeFinalCopy[n] = candidate;
            } catch (_e) {
              // Skip problematic property access
            }
          }
        } catch (_e) { /* ignore */ }
        if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
          try { console.debug('[enqueue] final sanitized queued item (before add)', safeFinalCopy); } catch (_e) { /* ignore logging failures */ }
          try { if (typeof window !== 'undefined') window.__lastQueuedItem = safeFinalCopy; } catch (_e) { /* ignore */ }
        }
        try {
          const res = await db.syncQueue.add(safeFinalCopy);
          return res;
        } catch (dbErr) {
          try { if (typeof saveProducerSnapshot === 'function') saveProducerSnapshot(safeFinalCopy, 'enqueue-db-add-fail'); } catch (_e) {}
          try { if (typeof window !== 'undefined') window.__lastDbAdd = safeFinalCopy; } catch (_e) {}
          throw dbErr;
        }
      } catch (cloneErr) {
      // Diagnose which nested fields cannot be cloned
      try {
        const bad = [];
        const detect = (obj, path = '<root>') => {
          try {
            if (typeof structuredClone === 'function') structuredClone(obj);
            return;
          } catch (e) {
            if (obj && typeof obj === 'object') {
              for (const [k, v] of Object.entries(obj)) detect(v, path === '<root>' ? k : `${path}.${k}`);
              return;
            }
            bad.push({ path, value: obj, reason: String(e && e.message) });
          }
        };
        detect(finalCopy);
        console.error('[enqueue] structuredClone failed on queued item; non-cloneable paths:', bad, { finalCopy, cloneErr });
      } catch (diagErr) {
        console.error('[enqueue] failed to diagnose non-cloneable fields', diagErr, cloneErr, finalCopy);
      }

      // Attempt a synchronous prune and retry
      try {
        const pruned = pruneSyncNonCloneable(finalCopy);
          try {
            if (typeof structuredClone === 'function') structuredClone(pruned);
            try {
              const res = await db.syncQueue.add(pruned);
              return res;
            } catch (dbErr2) {
              try { if (typeof saveProducerSnapshot === 'function') saveProducerSnapshot(pruned, 'enqueue-db-add-retry-fail'); } catch (_e) {}
              try { if (typeof window !== 'undefined') window.__lastDbAdd = pruned; } catch (_e) {}
              throw dbErr2;
            }
          } catch (retryErr) {
            console.warn('[enqueue] retry add after pruning still failed', retryErr);
          }
      } catch (pruneErr) {
        console.warn('[enqueue] pruneSyncNonCloneable failed', pruneErr);
      }

      // If we reach here, fall through to fallback below
      throw cloneErr;
    }
  } catch (e) {
    // If sanitization fails for any reason, fall back to writing a minimal
    // safe record so the operation is not lost.
      try {
        const fallback = {
          entity: copy.entity || 'unknown',
          entityId: copy.entityId ? String(copy.entityId) : null,
          action: copy.action || 'unknown',
          payload: null,
          // store a serialized snapshot of the original payload so we don't
          // lose data even when structured cloning fails. This is used only
          // as a fallback and kept as `payloadJson` to avoid further clone
          // attempts by Dexie.
          payloadJson: (typeof safeStringify === 'function' ? safeStringify(copy.payload) : null),
          timestamp: copy.timestamp || new Date().toISOString(),
          attempts: 0,
          failed: false,
          nextAttemptAt: null,
          lastError: `enqueue-sanitization-fallback: ${String(e && e.message)}`,
        };
        console.warn('[enqueue] writing fallback syncQueue entry due to sanitization failure', fallback, e);
        try {
          const res = await db.syncQueue.add(fallback);
          return res;
        } catch (fbErr) {
          try { if (typeof saveProducerSnapshot === 'function') saveProducerSnapshot(fallback, 'enqueue-db-add-fallback-fail'); } catch (_e) {}
          try { if (typeof window !== 'undefined') window.__lastDbAdd = fallback; } catch (_e) {}
          throw e;
        }
      } catch (inner) {
        // Give the original error back if even fallback fails
        throw e;
      }
  }
}

export default { enqueue };
