import db from '../db_clean';
import * as invoiceService from './invoiceService';
import * as customerService from './customerService';
import { pickInvoiceForDb, safeStringify, pruneSyncNonCloneable, makeCloneSafe } from '../utils/dbSanitize';

/**
 * DEVELOPMENT-ONLY FULL SYNC SERVICE
 * 
 * Test implementation of full data synchronization using the clean database.
 * This service is only loaded when VITE_USE_CLEAN_DB=true is set in .env
 * 
 * Purpose: Validate sync logic in isolation before integrating with main database
 * Access: window.fullSyncClean() in browser console when feature flag is enabled
 * 
 * DO NOT USE IN PRODUCTION - use dataSyncService.syncAllData() instead.
 */
// Perform a full sync from server to local clean DB. This is intentionally
// conservative: it uses whitelist serializers and synchronous sanitizers to
// avoid structured-clone issues while we validate behaviour.
export async function fullSync({ fetchInvoices = true, fetchCustomers = true } = {}) {
  const diag = { startedAt: Date.now(), steps: [] };

  try {
    if (fetchCustomers) {
      diag.steps.push({ step: 'fetch-customers' });
      const customers = await customerService.getCustomers();
      diag.steps.push({ step: 'fetched-customers', count: Array.isArray(customers) ? customers.length : 0 });

      if (Array.isArray(customers)) {
        for (const c of customers) {
          try {
            const candidate = pruneSyncNonCloneable(c);
            const safe = makeCloneSafe(candidate);
            const toUpsert = {
              _id: String(safe._id || safe.id || (safe._id === 0 ? 0 : `srv_${Date.now()}_${Math.random().toString(36).slice(2,6)}`)),
              name: safe.name || '',
              phone: safe.phone || null,
              email: safe.email || null
            };
            await db.customers.put(toUpsert);
          } catch (e) {
            diag.steps.push({ step: 'customer-upsert-failed', error: String(e && e.message) });
          }
        }
      }
    }

    if (fetchInvoices) {
      diag.steps.push({ step: 'fetch-invoices' });
      const invResp = await invoiceService.getInvoices({ sync: true, limit: 1000 });
      // Save raw server response for debugging
      try { if (typeof window !== 'undefined') window.__fullSyncServerRaw = invResp; } catch (_e) {}

      // Support multiple response shapes: array, { items: [] }, or { invoices: [] }
      const invoices = Array.isArray(invResp)
        ? invResp
        : (invResp && Array.isArray(invResp.items))
          ? invResp.items
          : (invResp && Array.isArray(invResp.invoices))
            ? invResp.invoices
            : [];

      diag.steps.push({ step: 'fetched-invoices', count: invoices.length });

      for (const inv of invoices) {
        const invId = inv && (inv._id || inv.id) ? (inv._id || inv.id) : null;
        try {
          const picked = pickInvoiceForDb(inv);
          if (!picked) {
            diag.steps.push({ step: 'invoice-pick-empty', id: invId });
            continue;
          }

          // final synchronous sanitization to be safe
          const candidate = pruneSyncNonCloneable(picked);
          const safe = makeCloneSafe(candidate);

          await db.invoices.put(safe);
          diag.steps.push({ step: 'invoice-upsert', id: safe && safe._id ? safe._id : invId });
        } catch (e) {
          diag.steps.push({ step: 'invoice-upsert-failed', id: invId, error: String(e && e.message) });
          try {
            if (typeof window !== 'undefined') {
              window.__cleanSyncFailure = window.__cleanSyncFailure || [];
              window.__cleanSyncFailure.push({ id: invId, raw: safeStringify(inv), error: String(e && e.message), ts: Date.now() });
            }
          } catch (_e) {}
        }
      }
    }

    diag.endedAt = Date.now();
    diag.ok = true;
    try { if (typeof window !== 'undefined') window.__fullSyncDiag = diag; } catch (_e) {}
    return diag;
  } catch (e) {
    diag.endedAt = Date.now();
    diag.ok = false;
    diag.error = String(e && e.message);
    try { if (typeof window !== 'undefined') window.__fullSyncDiag = diag; } catch (_e) {}
    throw e;
  }
}

// Diagnostic helper to run a clean sync and perform a small Dexie CRUD test.
export async function runCleanDbDiag() {
  const diag = { startedAt: Date.now(), steps: [] };
  try {
    diag.steps.push({ step: 'clear-local-sample' });
    // small smoke test: add a minimal invoice
    const test = { _id: `diag_${Date.now()}`, invoiceNumber: 'DIAG-1', customerId: null, issueDate: new Date().toISOString(), dueDate: null, total: 0, status: 'draft', items: [] };
    try {
      await db.invoices.add(test);
      diag.steps.push({ step: 'local-add-ok' });
      await db.invoices.delete(test._id);
    } catch (e) {
      diag.steps.push({ step: 'local-add-failed', error: String(e && e.message) });
    }

    diag.steps.push({ step: 'run-full-sync' });
    const fs = await fullSync();
    diag.steps.push({ step: 'full-sync-result', result: fs });

    // Compare counts
    try {
      const local = await db.invoices.toArray();
      diag.steps.push({ step: 'local-count', count: local.length });
    } catch (e) {
      diag.steps.push({ step: 'local-count-failed', error: String(e && e.message) });
    }

    diag.endedAt = Date.now();
    diag.ok = true;
    try { if (typeof window !== 'undefined') window.__cleanDbDiag = diag; } catch (_e) {}
    return diag;
  } catch (e) {
    diag.endedAt = Date.now();
    diag.ok = false;
    diag.error = String(e && e.message);
    try { if (typeof window !== 'undefined') window.__cleanDbDiag = diag; } catch (_e) {}
    return diag;
  }
}

// Expose on window in DEV for convenience
try {
  if (typeof window !== 'undefined' && import.meta && import.meta.env?.DEV) {
    window.runCleanDbDiag = runCleanDbDiag;
    window.fullSyncClean = fullSync;
  }
} catch (e) { /* ignore */ }

export default {
  fullSync,
  runCleanDbDiag
};
