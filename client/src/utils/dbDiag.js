import db from '../db';
import api from '../services/api';
import { getInvoices } from '../services/invoiceService';
import { pickInvoiceForDb, safeStringify } from './dbUtils';

/**
 * DEVELOPMENT-ONLY DATABASE DIAGNOSTIC TOOL
 * 
 * Compares remote server data with local IndexedDB and runs CRUD smoke tests.
 * Only loaded in development mode (import.meta.env.DEV).
 * 
 * Usage: window.runDbDiag() in browser console
 * Returns: Diagnostic object with remote/local comparison and test results
 * 
 * Useful for debugging sync issues and data inconsistencies.
 */
// Developer diagnostic: compare remote invoices with local IndexedDB invoices
// and run a small CRUD smoke-test on Dexie. Exposed as `window.runDbDiag()`
// so you can call it from the browser console and paste results here.
export default async function runDbDiag() {
  const result = { time: new Date().toISOString(), remote: null, local: null, compare: null, crud: null };

  try {
    // 1) Fetch remote invoices using existing service if available
    let remoteInvoices = null;
    try {
      const data = await getInvoices();
      remoteInvoices = Array.isArray(data) ? data : (data && data.invoices) || [];
    } catch (e) {
      // fallback: call API directly
      try {
        const res = await api.get('/invoices');
        remoteInvoices = res && res.data && (Array.isArray(res.data.invoices) ? res.data.invoices : (Array.isArray(res.data) ? res.data : []));
      } catch (err) {
        result.remoteError = String(err && err.message);
        remoteInvoices = [];
      }
    }
    result.remote = { count: remoteInvoices.length, sample: remoteInvoices.slice(0,5).map(r => r._id || r.id) };
  } catch (e) {
    result.remoteError = String(e && e.message);
  }

  try {
    const local = await db.invoices.toArray();
    result.local = { count: local.length, sample: local.slice(0,5).map(i => i._id || i.id) };
  } catch (e) {
    result.localError = String(e && e.message);
  }

  try {
    // Compare IDs
    const remoteIds = new Set((result.remote && result.remote.sample) || []);
    const localAll = await db.invoices.toArray();
    const localIds = new Set(localAll.map(i => String(i._id || i.id)));
    const missingInLocal = [];
    const missingInRemote = [];
    // Build full remote list if available
    let remoteFullIds = new Set();
    try { remoteFullIds = new Set((await (async () => {
      try { const data = await getInvoices(); return Array.isArray(data) ? data : (data && data.invoices) || []; } catch (_) {
        try { const res = await api.get('/invoices'); return res && res.data && (Array.isArray(res.data.invoices) ? res.data.invoices : (Array.isArray(res.data) ? res.data : [])); } catch (__){ return []; }
      }
    })()).map(r => String(r._id || r.id))); } catch (_e) { remoteFullIds = new Set(); }

    if (remoteFullIds.size) {
      for (const id of remoteFullIds) if (!localIds.has(id)) missingInLocal.push(id);
      for (const id of localIds) if (!remoteFullIds.has(id)) missingInRemote.push(id);
    }
    result.compare = { missingInLocal, missingInRemote, remoteCount: remoteFullIds.size, localCount: localAll.length };
  } catch (e) {
    result.compareError = String(e && e.message);
  }

  try {
    // 3) Small CRUD smoke test on invoices
    const testId = `diag_test_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
    const testInvoice = pickInvoiceForDb({ _id: testId, invoiceNumber: `DIAG-${testId}`, customerName: 'Diag Tester', items: [{ description: 'diag', quantity:1, unitPrice:1, total:1 }], total: 1 });
    const crud = { add: null, update: null, delete: null };
    try {
      const addRes = await db.invoices.add(testInvoice);
      crud.add = { ok: true, res: addRes };
    } catch (addErr) {
      crud.add = { ok: false, err: String(addErr && addErr.message) };
    }
    try {
      // update some field
      const existing = await db.invoices.where('_id').equals(String(testId)).first();
      if (existing && existing.id !== undefined) {
        await db.invoices.update(existing.id, { total: 2 });
        crud.update = { ok: true };
      } else {
        crud.update = { ok: false, note: 'no-existing-after-add' };
      }
    } catch (upErr) {
      crud.update = { ok: false, err: String(upErr && upErr.message) };
    }
    try {
      const existing2 = await db.invoices.where('_id').equals(String(testId)).first();
      if (existing2 && existing2.id !== undefined) {
        await db.invoices.delete(existing2.id);
        crud.delete = { ok: true };
      } else {
        crud.delete = { ok: false, note: 'no-existing-to-delete' };
      }
    } catch (delErr) {
      crud.delete = { ok: false, err: String(delErr && delErr.message) };
    }
    result.crud = crud;
  } catch (e) {
    result.crudError = String(e && e.message);
  }

  // Persist diag in window and localStorage for copy/paste
  try { window.__dbDiag = result; } catch (_) {}
  try { localStorage.setItem('recordiq_dbDiag', safeStringify(result)); } catch (_) {}

  console.log('[dbDiag] result:', result);
  return result;
}

// Expose on window for quick runs
try { if (typeof window !== 'undefined') window.runDbDiag = runDbDiag; } catch (_e) {}
