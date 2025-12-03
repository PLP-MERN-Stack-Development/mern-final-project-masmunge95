import db from '../db_clean';
import { pruneSyncNonCloneable, makeCloneSafe, safeStringify } from '../utils/dbSanitize';

/**
 * DEVELOPMENT-ONLY SYNC QUEUE SERVICE
 * 
 * Simple sync queue implementation for testing with the clean database.
 * This service is only loaded when VITE_USE_CLEAN_DB=true is set in .env
 * 
 * DO NOT USE IN PRODUCTION - use the main dataSyncService instead.
 */
// Simple sync queue service for clean DB. Exposes enqueue and processQueue.

export async function enqueue(record) {
  try {
    // Ensure we have a shallow clone-safe payload to avoid structured-clone errors
    let candidate = record;
    try { candidate = pruneSyncNonCloneable(candidate); } catch (e) { /* ignore */ }
    try { candidate = makeCloneSafe(candidate); } catch (e) { /* ignore */ }

    const entry = {
      entity: candidate && candidate.entity ? candidate.entity : (record && record.entity) || 'unknown',
      entityId: candidate && (candidate.entityId || candidate._id || candidate.id) ? String(candidate.entityId || candidate._id || candidate.id) : null,
      action: candidate && candidate.action ? candidate.action : 'upsert',
      payload: candidate && candidate.payload ? candidate.payload : (candidate.payload === undefined ? candidate : null),
      timestamp: new Date().toISOString()
    };

    // Record what we're about to write (dev-only)
    try {
      if (typeof window !== 'undefined') {
        window.__syncDiag = window.__syncDiag || [];
        window.__syncDiag.push({ step: 'enqueue-prewrite', entry, ts: Date.now() });
        try { localStorage.setItem('debug_sync_enqueue', safeStringify(entry)); } catch (_e) {}
      }
    } catch (_e) {}

    return await db.syncQueue.add(entry);
  } catch (err) {
    try {
      if (typeof window !== 'undefined') {
        window.__syncDiag = window.__syncDiag || [];
        window.__syncDiag.push({ step: 'enqueue-error', error: String(err && err.message), record });
      }
    } catch (_e) {}
    throw err;
  }
}

export async function processQueue(handler, maxItems = 10) {
  // handler receives (entry) and must return { ok: true } or throw
  try {
    const items = await db.syncQueue.toCollection().limit(maxItems).reverse().sortBy('id');
    for (const it of items) {
      try {
        if (!handler) break;
        const res = await handler(it);
        if (res && res.ok) {
          await db.syncQueue.delete(it.id);
          try { if (typeof window !== 'undefined') (window.__syncDiag = window.__syncDiag || []).push({ step: 'processed', id: it.id, entity: it.entity }); } catch (_e) {}
        } else {
          // leave for later
        }
      } catch (e) {
        try { if (typeof window !== 'undefined') (window.__syncDiag = window.__syncDiag || []).push({ step: 'process-failed', id: it.id, error: String(e && e.message) }); } catch (_e) {}
      }
    }
    return { ok: true };
  } catch (e) {
    try { if (typeof window !== 'undefined') (window.__syncDiag = window.__syncDiag || []).push({ step: 'process-iteration-failed', error: String(e && e.message) }); } catch (_e) {}
    throw e;
  }
}

export default {
  enqueue,
  processQueue
};
