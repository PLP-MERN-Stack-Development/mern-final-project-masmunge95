import React, { useEffect, useState } from 'react';
import { useUser, useAuth } from '@clerk/clerk-react';
import AddInvoiceForm from '../components/AddInvoiceForm';
import { Link, useSearchParams } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import Button from '../components/Button';
import QueueStatus from '../components/QueueStatus';
import ConfirmModal from '../components/ConfirmModal';
import Modal from '../components/Modal';
import CenteredLoader from '../components/CenteredLoader';
import db from '../db'; // Import the Dexie database instance
import { sanitizeForDb, firstOrUndefined } from '../utils/dbUtils';
import { getInvoices as fetchInvoicesFromServer } from '../services/invoiceService';
import { enqueue, deepSanitizeAsync, deepSanitize } from '../services/queueService';
import { saveProducerSnapshot } from '../utils/producerDiag';

const makeId = () => (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `client_${Date.now()}_${Math.random().toString(36).slice(2,9)}`;

const InvoicesPage = () => {
  const { user } = useUser();
  const { theme } = useTheme();
  useAuth();
  const [invoices, setInvoices] = useState([]);
  const [sellerFilter, setSellerFilter] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [serviceFilter, setServiceFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showErrorBanner, setShowErrorBanner] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingInvoiceId, setDeletingInvoiceId] = useState(null);
  const [serverFilteredInvoices, setServerFilteredInvoices] = useState(null);
  const [utilityServices, setUtilityServices] = useState([]);
  // ref-based lock removed; component logic does not need the ref here
  // Derived option lists for dropdowns
  const sellerOptions = Array.from(new Set(invoices.map(i => i.sellerName).filter(Boolean)));
  const serviceOptions = utilityServices.map(s => s.name).filter(Boolean);
  const customerOptions = Array.from(new Set(invoices.flatMap(i => [i.customerName, i.customerEmail]).filter(Boolean)));
  const role = user?.publicMetadata?.role;

  useEffect(() => {
    let mounted = true;

    const readLocalAndSubscribe = async () => {
      try {
        setLoading(true);
        const local = await db.invoices.toArray();
        if (!mounted) return;
        const enriched = await Promise.all(local.map(async (inv) => {
          if (inv.customerName) return inv;
          try {
            const byId = await firstOrUndefined(db.customers.where('_id').equals(String(inv.customerId)));
            if (byId && byId.name) return { ...inv, customerName: byId.name };
          } catch (_e) { /* ignore per-item */ }
          return { ...inv, customerName: '[Deleted Customer]' };
        }));
        const ordered = enriched.sort((a, b) => new Date(b.dueDate || 0) - new Date(a.dueDate || 0));
        setInvoices(ordered);
        setLoading(false);

        // Subscribe to DB changes
        const onChange = async () => {
          const latest = await db.invoices.toArray();
          const enrichedLatest = await Promise.all(latest.map(async (inv) => {
            if (inv.customerName) return inv;
            try { const byId = await firstOrUndefined(db.customers.where('_id').equals(String(inv.customerId))); if (byId && byId.name) return { ...inv, customerName: byId.name }; } catch (_e) { /* ignore per-item */ }
            return { ...inv, customerName: '[Deleted Customer]' };
          }));
          const ord = enrichedLatest.sort((a, b) => new Date(b.dueDate || 0) - new Date(a.dueDate || 0));
          if (mounted) setInvoices(ord);
        };

        try {
          // Use post-operation hooks so our async onChange doesn't
          // return a Promise that Dexie might try to assign into the
          // object being written (causes DataCloneError when Promise
          // ends up as a field). Use the post-operation hooks which
          // run after the DB operation and are safe for async handlers.
          db.invoices.hook('created', onChange);
          db.invoices.hook('updated', onChange);
          db.invoices.hook('deleted', onChange);
        } catch (_e) { /* ignore hook attach errors */ }

        // Per-page full-sync removed: central `dataSyncService` handles syncing.
      } catch (err) {
        console.error('Failed to read local invoices:', err);
        setError('Failed to load invoices.');
        setShowErrorBanner(true);
        setLoading(false);
      }
    };

    readLocalAndSubscribe();

    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadServices = async () => {
      try {
        const services = await db.utilityServices.toArray();
        if (mounted) setUtilityServices(services);
      } catch (err) {
        console.error('Failed to load utility services:', err);
      }
    };
    loadServices();
    return () => { mounted = false; };
  }, []);

  const handleAddInvoice = async (invoiceData) => {
    setIsCreating(true);
    try {
      const localId = crypto.randomUUID();
      // DEV instrumentation removed: production flow does not install assignment Proxy
      // Debug: log incoming invoiceData keys/types to catch stray Promises
      try {
        console.debug('[InvoicesPage] incoming invoiceData preview', Object.fromEntries(Object.keys(invoiceData || {}).map(k => [k, typeof invoiceData[k]])));
        if (invoiceData && Object.prototype.hasOwnProperty.call(invoiceData, 'id')) {
          console.debug('[InvoicesPage] invoiceData.id value (preview):', invoiceData.id);
        }

        // DEV diagnostic: capture any Promise-valued top-level fields early
        try {
          const promiseFields = [];
          for (const [k, v] of Object.entries(invoiceData || {})) {
            if (v && (typeof v === 'object' || typeof v === 'function') && typeof v.then === 'function') {
              promiseFields.push(k);
            }
          }
          if (promiseFields.length) {
            console.warn('[InvoicesPage] Detected Promise-valued invoiceData fields:', promiseFields);
          }
        } catch (pfErr) { /* ignore diagnostic failures */ }
      } catch (dbg) { console.debug('[InvoicesPage] failed to log invoiceData preview', dbg); }

      // Prepare payload and ensure numeric totals and string _id
      let payload = sanitizeForDb({ _id: localId, ...invoiceData, status: 'draft', syncStatus: 'pending' }, { flattenCustomer: true });
      // No dev-only Proxy wrapping of payload in production
      // Deep-sanitize payload before writing to Dexie (remove Promises/functions)
      const cleanPayload = await deepSanitizeAsync(payload);
      // If sanitization removed fields unexpectedly, log for debugging
      if (!cleanPayload) {
        console.warn('[InvoicesPage] payload sanitized to null/undefined, aborting add', payload);
        throw new Error('Invoice payload not safe to persist');
      }
      // Diagnostic: try to find any non-cloneable nested values
      const findNonCloneable = (obj, path = '') => {
        const problems = [];
        const visit = (val, p) => {
          try {
            // Try structuredClone for accurate browser clonability test
            if (typeof structuredClone === 'function') {
              structuredClone(val);
            } else {
              // Fallback: detect Promises/functions
              if (typeof val === 'function') throw new Error('function');
              if (val && typeof val.then === 'function') throw new Error('promise');
            }
          } catch (_e) {
            problems.push({ path: p || '<root>', type: e.message || typeof val, valuePreview: val });
            return;
          }
          if (Array.isArray(val)) {
            val.forEach((it, i) => visit(it, `${p}[${i}]`));
          } else if (val && typeof val === 'object') {
            Object.entries(val).forEach(([k, v]) => visit(v, p ? `${p}.${k}` : k));
          }
        };
        visit(obj, path);
        return problems;
      };

      const problems = findNonCloneable(cleanPayload);
      if (problems.length > 0) {
        console.error('[InvoicesPage] Non-cloneable payload fields detected before db.invoices.add', problems);
      }

      // Ensure the payload is structured-clone-able before attempting to write.
      let finalPayload = cleanPayload;
      if (typeof structuredClone === 'function') {
        try {
          structuredClone(finalPayload);
        } catch (scErr) {
          console.warn('[InvoicesPage] structuredClone failed on payload, pruning fields', scErr);
          const prune = (target) => {
            if (target === null || target === undefined) return target;
            if (Array.isArray(target)) return target.map(el => prune(el)).filter(el => el !== undefined);
            if (typeof target === 'object') {
              const out = {};
              for (const [k, v] of Object.entries(target)) {
                try { structuredClone(v); out[k] = v; } catch (_e) {
                  if (v && typeof v === 'object') {
                    const pr = prune(v);
                    try { structuredClone(pr); out[k] = pr; } catch (e2) { if (import.meta.env.DEV) console.warn('[InvoicesPage] removed non-cloneable field', k, e2); }
                  } else { if (import.meta.env.DEV) console.warn('[InvoicesPage] removed non-cloneable field', k, e); }
                }
              }
              return out;
            }
            return target;
          };
          try { finalPayload = prune(finalPayload); } catch (pruneErr) { if (import.meta.env.DEV) console.warn('[InvoicesPage] prune failed', pruneErr); }
        }
      }

      try {
        // Final synchronous prune: remove any remaining Promise/function values
        const pruneSyncNonCloneable = (target) => {
          if (target === null || target === undefined) return target;
          if (typeof target === 'function') return undefined;
          if (target && typeof target === 'object' && typeof target.then === 'function') return undefined;
          if (Array.isArray(target)) return target.map(pruneSyncNonCloneable).filter(v => v !== undefined);
          if (typeof target === 'object') {
            const out = {};
            for (const [k, v] of Object.entries(target)) {
              try {
                if (v && (typeof v === 'object' || typeof v === 'function') && typeof v.then === 'function') {
                  // skip Promise-like fields
                  continue;
                }
                if (typeof v === 'function') continue;
                const pr = pruneSyncNonCloneable(v);
                if (pr !== undefined) out[k] = pr;
              } catch (_e) {
                // skip problematic field
              }
            }
            return out;
          }
          return target;
        };

        finalPayload = pruneSyncNonCloneable(finalPayload);

        // DEV instrumentation removed: no Proxy wrapping of finalPayload

        // Normalize/remove problematic `id` field if present (Promises or objects can cause DataCloneError)
        try {
          if (finalPayload && Object.prototype.hasOwnProperty.call(finalPayload, 'id')) {
            const idVal = finalPayload.id;
            // If id is a Promise, remove it
            if (idVal && (typeof idVal === 'object' || typeof idVal === 'function') && typeof idVal.then === 'function') {
              console.warn('[InvoicesPage] removing Promise-valued `id` before Dexie write');
              try { delete finalPayload.id; } catch (_e) { finalPayload.id = undefined; }
            } else if (typeof idVal === 'number' || typeof idVal === 'string') {
              // Prefer storing canonical string _id
              if (!finalPayload._id) {
                try { finalPayload._id = String(idVal); } catch (_e) { finalPayload._id = String(makeId()); }
              }
              try { delete finalPayload.id; } catch (_e) { finalPayload.id = undefined; }
            } else if (idVal && typeof idVal === 'object') {
              // Try toString, else remove
              try {
                if (typeof idVal.toString === 'function') {
                  const s = String(idVal.toString());
                  if (s && s !== '[object Object]' && !finalPayload._id) finalPayload._id = s;
                }
              } catch (_e) { /* ignore */ }
              try { delete finalPayload.id; } catch (_e) { finalPayload.id = undefined; }
            }
          }
        } catch (normErr) {
          if (import.meta.env.DEV) console.warn('[InvoicesPage] id normalization failed', normErr);
        }
        // One last structuredClone test
        try { if (typeof structuredClone === 'function') structuredClone(finalPayload); } catch (err) {
          console.warn('[InvoicesPage] final structuredClone failed after pruning', err);
        }

        // Final defensive sweep: remove any top-level Promise-like fields that might still remain
        try {
          if (finalPayload && typeof finalPayload === 'object') {
            for (const k of Object.keys(finalPayload)) {
              try {
                const v = finalPayload[k];
                if (v && (typeof v === 'object' || typeof v === 'function') && typeof v.then === 'function') {
                  console.warn('[InvoicesPage] removed top-level Promise-like field before Dexie add:', k);
                  try { delete finalPayload[k]; } catch (_e) { finalPayload[k] = undefined; }
                }
              } catch (_e) {
                // ignore per-field inspection errors
              }
            }
          }
        } catch (sweepErr) {
          if (import.meta.env.DEV) console.warn('[InvoicesPage] final sweep failed', sweepErr);
        }

        try {
          // Extra defensive guard: ensure no top-level `id` (possibly a Promise)
          // remains on the payload before attempting the Dexie add. We always
          // use `_id` as the canonical id locally so it's safe to drop `id`.
          try {
            if (finalPayload && Object.prototype.hasOwnProperty.call(finalPayload, 'id')) {
              try { delete finalPayload.id; } catch (_e) { finalPayload.id = undefined; }
            }
          } catch (guardErr) { /* keep going - don't let diagnostics block write */ }

          await db.invoices.add(finalPayload);
        } catch (addErr) {
          const isDataClone = addErr && (addErr.name === 'DataCloneError' || (typeof addErr.message === 'string' && addErr.message.includes('could not be cloned')));
          if (isDataClone) {
            try {
              console.warn('[InvoicesPage] Auto-prune detected a DataCloneError, pruning and retrying add');
              // Use the synchronous prune we already defined to remove Promise/function values
              const pruned = pruneSyncNonCloneable(finalPayload);
              // Ensure top-level Promise-like fields removed and report them
              const removed = [];
              if (pruned && typeof pruned === 'object') {
                for (const k of Object.keys(pruned)) {
                  try {
                    const v = pruned[k];
                    if (v && (typeof v === 'object' || typeof v === 'function') && typeof v.then === 'function') {
                      removed.push(k);
                      try { delete pruned[k]; } catch (_e) { pruned[k] = undefined; }
                    }
                  } catch (_e) { /* ignore per-field errors */ }
                }
              }
              if (removed.length) console.warn('[InvoicesPage] Auto-prune removed top-level fields:', removed);
              await db.invoices.add(pruned);
              finalPayload = pruned;
              console.log('[InvoicesPage] add succeeded after auto-prune');
            } catch (retryErr) {
              console.error('[InvoicesPage] add retry after auto-prune failed', retryErr);
              throw retryErr;
            }
          } else {
            throw addErr;
          }
        }
      } catch (addErr) {
        // Log helpful debugging info about the payload
        try {
          // Detailed detector: attempt structuredClone on nested paths to find the failing field
          const detectNonCloneablePaths = (obj) => {
            const issues = [];
            const tryClone = (val) => {
              try {
                if (typeof structuredClone === 'function') {
                  structuredClone(val);
                  return null;
                }
                // Fallback: detect promises/functions heuristically
                if (val && (typeof val === 'object' || typeof val === 'function') && typeof val.then === 'function') return 'promise';
                if (typeof val === 'function') return 'function';
                return null;
              } catch (e) {
                return e && e.message ? e.message : String(e);
              }
            };

            const visit = (val, path = '<root>') => {
              const reason = tryClone(val);
              if (reason) {
                issues.push({ path, reason, preview: (typeof val === 'object' ? Object.keys(val).slice(0,5) : String(val)) });
                return;
              }
              if (Array.isArray(val)) {
                for (let i = 0; i < val.length; i++) visit(val[i], `${path}[${i}]`);
              } else if (val && typeof val === 'object') {
                for (const [k, v] of Object.entries(val)) visit(v, path === '<root>' ? k : `${path}.${k}`);
              }
            };

            visit(obj, '<root>');
            return issues;
          };

          const detected = detectNonCloneablePaths(finalPayload || cleanPayload || payload);

          // Make payloads easy to inspect from browser console
          // DEV snapshot removed: do not write debugging payload to window

          console.error('[InvoicesPage] db.invoices.add failed', {
            originalPayload: payload,
            cleanPayload,
            finalPayloadPreview: Object.fromEntries(Object.keys(finalPayload || {}).map(k => [k, typeof finalPayload[k]])),
            cleanPayloadKeys: Object.keys(cleanPayload || {}),
            types: Object.fromEntries(Object.entries(cleanPayload || {}).map(([k, v]) => [k, typeof v])),
            detectedNonCloneable: detected,
          });

          // Helper to read a nested path like 'items[1].foo'
          const getAtPath = (obj, path) => {
            if (!path) return undefined;
            try {
              const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.');
              let cur = obj;
              for (const p of parts) {
                if (cur === undefined || cur === null) return cur;
                if (p === '<root>') continue;
                cur = cur[p];
              }
              return cur;
            } catch (_e) { return undefined; }
          };

          // Log the exact offending values so they're easy to inspect
          if (Array.isArray(detected) && detected.length > 0) {
            detected.forEach(d => {
              try {
                const val = getAtPath(finalPayload || cleanPayload || payload, d.path);
                console.error('[InvoicesPage] detected non-cloneable value at path', d.path, { reason: d.reason, preview: d.preview, value: val });
              } catch (e) {
                console.error('[InvoicesPage] failed to read detected path', d.path, e);
              }
            });
            console.error('[InvoicesPage] For quick inspection, check server/client logs.');
          }
          const problemsAfter = findNonCloneable(cleanPayload);
          if (problemsAfter.length > 0) console.error('[InvoicesPage] non-cloneable fields (post-check)', problemsAfter);
        } catch (logErr) {
          console.error('[InvoicesPage] failed to log payload details', logErr);
        }
        throw addErr;
      }

      // Enrich payload with resolved customer contact info and normalize dueDate/issueDate
      let resolvedCustomer = null;
      try {
        if (invoiceData && invoiceData.customerId) {
          resolvedCustomer = await firstOrUndefined(db.customers.where('_id').equals(String(invoiceData.customerId)));
        }
      } catch (e) {
        console.warn('[InvoicesPage] failed to resolve customer from local DB', e);
      }

      const customerName = resolvedCustomer?.name || invoiceData.customerName || '';
      const customerEmail = resolvedCustomer?.email || invoiceData.customerEmail || '';
      const customerPhone = resolvedCustomer?.phone || invoiceData.customerPhone || '';

      // Normalize dueDate to ISO (so server can safely parse)
      let normalizedDueDate = invoiceData.dueDate;
      try {
        if (normalizedDueDate) {
          const d = new Date(normalizedDueDate);
          if (!isNaN(d.getTime())) normalizedDueDate = d.toISOString();
        }
      } catch (_e) { /* ignore */ }

      // Attach resolved customerName into the local payload so UI shows it immediately
      finalPayload.customerName = customerName;
      finalPayload.customerEmail = customerEmail;
      finalPayload.customerPhone = customerPhone;
      if (normalizedDueDate) finalPayload.dueDate = normalizedDueDate;

      // Add a job to the sync queue (include _id and enriched customer contact info)
      const queueItem = {
        entity: 'invoices',
        action: 'create',
        entityId: localId,
        payload: {
          _id: localId,
          clientTempId: localId,
          ...invoiceData,
          customerName,
          customerEmail,
          customerPhone,
          dueDate: normalizedDueDate,
          // include an issueDate so the server will have a sensible creation timestamp
          issueDate: new Date().toISOString(),
        },
        tempId: localId, // Pass the UUID to the sync job
        timestamp: new Date().toISOString(),
      };
      try {
        // DEV: capture a shallow snapshot of the queue item before enqueue
        try { if (import.meta.env?.DEV) saveProducerSnapshot(queueItem, 'InvoicesPage.enqueue.create'); } catch (e) {}
        // Sanitize before enqueueing for extra visibility (async sanitizer will resolve Promises)
        const sanitizedForQueue = await deepSanitizeAsync(queueItem.payload);
        // Ensure the sanitized result is actually used by the queue item
        if (sanitizedForQueue) {
          queueItem.payload = sanitizedForQueue;
        }
        if (import.meta.env?.DEV) console.debug('[InvoicesPage] enqueue payload sanitized preview', { sanitizedForQueue });
        await enqueue(queueItem);
      } catch (qErr) {
        try { if (import.meta.env?.DEV) saveProducerSnapshot(queueItem, 'InvoicesPage.enqueue.create.failure'); } catch (e) {}
        console.error('[InvoicesPage] enqueue failed', { queueItem, sanitizedPreview: deepSanitize(queueItem.payload) });
        throw qErr;
      }

      // Wait for sync queue to process this item (up to 10 seconds)
      let attempts = 0;
      while (attempts < 20) {
        const pending = await db.syncQueue.where('entityId').equals(localId).toArray();
        if (pending.length === 0) {
          console.log('[InvoicesPage] Invoice sync completed successfully');
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms before checking again
        attempts++;
      }

      // Update UI
      const updatedInvoices = await db.invoices.orderBy('dueDate').reverse().toArray();
      setInvoices(updatedInvoices);
      setShowAddForm(false);
    } catch (err) {
      setError('Failed to save invoice locally.');
      setShowErrorBanner(true);
      console.error('Add invoice error:', err);
    }
    finally {
      setIsCreating(false);
    }
  };

  const handleDeleteInvoice = async (invoiceId) => {
    setDeletingInvoiceId(invoiceId);
    try {
      // Optimistically delete from the local database (delete by _id index)
      await db.invoices.where('_id').equals(String(invoiceId)).delete();
      // Update UI immediately so UX is responsive
      setInvoices(invoices.filter((invoice) => invoice._id !== invoiceId));

      // Add a job to the sync queue (best-effort). If enqueue fails we
      // log and write a minimal fallback entry directly to `db.syncQueue`
      // so the delete will still be retried later.
      try {
        await enqueue({
          entity: 'invoices',
          entityId: invoiceId,
          action: 'delete',
          timestamp: new Date().toISOString(),
        });
      } catch (enqueueErr) {
        try { if (import.meta.env?.DEV) saveProducerSnapshot({ entity: 'invoices', entityId: invoiceId, action: 'delete' }, 'InvoicesPage.enqueue.delete.failure'); } catch (e) {}
        console.error('[InvoicesPage] enqueue failed for delete; writing fallback syncQueue entry', enqueueErr, invoiceId);
        try {
          await db.syncQueue.add({
            entity: 'invoices',
            action: 'delete',
            entityId: invoiceId,
            timestamp: new Date().toISOString(),
            attempts: 0,
            failed: false,
            nextAttemptAt: null,
          });
        } catch (fallbackErr) {
          console.error('[InvoicesPage] fallback syncQueue.add also failed', fallbackErr, invoiceId);
        }
      }
    } catch (err) {
      // Local delete failed — this is unexpected. Log full error and show
      // a user-facing banner so they know the operation didn't complete.
      console.error('[InvoicesPage] Failed to delete invoice locally', err, invoiceId);
      setError('Failed to delete invoice locally.');
      setShowErrorBanner(true);
    } finally {
      setDeletingInvoiceId(null);
    }
  }

  const [confirmDeleteInvoiceId, setConfirmDeleteInvoiceId] = React.useState(null);

  const handlePrint = () => {
    const originalTitle = document.title;
    document.title = 'Invoice-List';
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 100);
  };

  const handleDownloadCSV = () => {
    // Prepare CSV headers
    const headers = ['Invoice Number', 'Customer', 'Issue Date', 'Due Date', 'Total', 'Status'];
    
    // Prepare CSV rows
    const rows = filteredInvoices.map(invoice => [
      invoice.invoiceNumber || '',
      invoice.customerName || '',
      invoice.issueDate ? new Date(invoice.issueDate).toLocaleDateString() : new Date(invoice.createdAt).toLocaleDateString(),
      invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : '',
      `KSH ${(Number(invoice.total) || 0).toFixed(2)}`,
      invoice.status || ''
    ]);
    
    // Create CSV content
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    // Create and download file. Include seller prefix/name in filename when available.
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;

    // Choose a friendly prefix: prefer explicit sellerFilter, otherwise prefer unique sellerPrefix among filteredInvoices
    let namePart = '';
    const datePart = new Date().toISOString().split('T')[0];
    try {
      if (sellerFilter && sellerFilter.trim()) {
        namePart = `-${sellerFilter.trim()}`;
      } else {
        const uniqPrefixes = Array.from(new Set(filteredInvoices.map(i => (i.sellerPrefix || '').trim()).filter(Boolean)));
        const uniqNames = Array.from(new Set(filteredInvoices.map(i => (i.sellerName || '').trim()).filter(Boolean)));
        if (uniqPrefixes.length === 1) namePart = `-${uniqPrefixes[0]}`;
        else if (uniqNames.length === 1) namePart = `-${uniqNames[0].replace(/\s+/g, '_')}`;
      }
    } catch (_e) { /* ignore */ }

    // sanitize filename
    const safe = (s) => String(s || '').replace(/[^a-zA-Z0-9_.-]/g, '_');
    link.download = `${safe('invoices')}${safe(namePart)}-${safe(datePart)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const textColor = theme === 'dark' ? 'text-white' : 'text-gray-900';
  const secondaryTextColor = theme === 'dark' ? 'text-gray-300' : 'text-gray-600';
  const cardBg = theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';

  // Confirm modal for deletes

  // Pagination
  const [searchParams, setSearchParams] = useSearchParams();
  const PAGE_SIZE = 5;
  const pageParam = parseInt(searchParams.get('page') || '1', 10);
  const currentPage = Number.isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;
  // derive filtered invoices based on seller/customer/service/status filters
  const filteredInvoices = invoices.filter(inv => {
    // Seller filter (match sellerName or sellerPrefix)
    if (sellerFilter) {
      const sellerName = (inv.sellerName || '').toLowerCase();
      const sellerPrefix = (inv.sellerPrefix || '').toLowerCase();
      const sf = sellerFilter.toLowerCase();
      if (!sellerName.includes(sf) && !sellerPrefix.includes(sf)) return false;
    }
    // Customer filter (match customerName or customerEmail)
    if (customerFilter) {
      const cn = (inv.customerName || inv.customer || inv.customerEmail || '').toLowerCase();
      if (!cn.includes(customerFilter.toLowerCase())) return false;
    }
    // Service filter (match invoice.service or any item description)
    if (serviceFilter) {
      const svc = serviceFilter.toLowerCase();
      const invoiceService = (inv.service || '').toLowerCase();
      const itemsMatch = Array.isArray(inv.items) && inv.items.some(it => (it.description || '').toLowerCase().includes(svc));
      if (!(invoiceService.includes(svc) || itemsMatch)) return false;
    }
    // Status filter (match invoice.status or disputeStatus)
    if (statusFilter) {
      if (statusFilter === 'disputed') {
        // Check disputeStatus field OR disputes array with pending/under-review items
        const hasDisputeStatus = inv.disputeStatus && ['disputed', 'under-review', 'pending'].includes(inv.disputeStatus);
        const hasActiveDisputes = Array.isArray(inv.disputes) && inv.disputes.length > 0 && 
          inv.disputes.some(d => d.status && ['pending', 'under-review', 'disputed'].includes(d.status));
        if (!hasDisputeStatus && !hasActiveDisputes) return false;
      } else {
        if (inv.status !== statusFilter) return false;
      }
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredInvoices.length / PAGE_SIZE));
  const pagedInvoices = filteredInvoices.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Clamp page when invoice list changes
  useEffect(() => {
    if (currentPage > totalPages) {
      setSearchParams({ page: String(totalPages) });
    }
  }, [currentPage, totalPages, setSearchParams]);

  const reloadLocal = async () => {
    try {
      setLoading(true);
      const local = await db.invoices.toArray();
      const enriched = await Promise.all(local.map(async (inv) => {
        if (inv.customerName) return inv;
        try { const byId = await firstOrUndefined(db.customers.where('_id').equals(String(inv.customerId))); if (byId && byId.name) return { ...inv, customerName: byId.name }; } catch (e) {}
        return { ...inv, customerName: '[Deleted Customer]' };
      }));
      const ordered = enriched.sort((a, b) => new Date(b.dueDate || 0) - new Date(a.dueDate || 0));
      setInvoices(ordered);
      setError(null);
      setShowErrorBanner(false);
    } catch (e) {
      console.error('[InvoicesPage] reloadLocal failed', e);
      setError('Failed to load invoices.');
      setShowErrorBanner(true);
    } finally {
      setLoading(false);
    }
  };

  // When filters are applied, prefer server-side filtered results (debounced)
  useEffect(() => {
    let cancelled = false;
    let timer = null;

    const doFetch = async () => {
      try {
        // If no meaningful filter, clear serverFilteredInvoices
        if (!sellerFilter && !customerFilter && !serviceFilter) {
          if (!cancelled) setServerFilteredInvoices(null);
          return;
        }

        const params = {};
        if (serviceFilter) params.service = serviceFilter;
        if (customerFilter) {
          // If customerFilter looks like an id (uuid-like), send as customerId
          if (/^[0-9a-fA-F-]{8,}$/.test(customerFilter)) params.customerId = customerFilter;
        }

        const resp = await fetchInvoicesFromServer({ ...params, sync: false, limit: 200 });
        // resp may contain { invoices, total } or an array; normalize
        const list = Array.isArray(resp) ? resp : (resp.invoices || resp);
        if (!cancelled) {
          // normalize _id and persist into local DB for offline use
          for (const inv of list) {
            try {
              const normalized = { ...inv };
              if (!normalized._id && normalized.id) normalized._id = String(normalized.id);
              if (!normalized._id) normalized._id = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : makeId();
              if (normalized._id) normalized._id = String(normalized._id);
              try { await db.invoices.put(normalized); } catch (_e) { /* ignore put errors */ }
            } catch (e) { /* ignore per-item */ }
          }
          setServerFilteredInvoices(list);
        }
      } catch (e) {
        console.warn('[InvoicesPage] server-side filter fetch failed', e);
        if (!cancelled) setServerFilteredInvoices(null);
      }
    };

    // debounce
    timer = setTimeout(doFetch, 300);

    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [sellerFilter, customerFilter, serviceFilter]);

  if (loading && invoices.length === 0) {
    return <CenteredLoader message="Loading invoices..." />;
  }

  // show inline error banner (dismiss will reload local data)

  const backTarget = user?.publicMetadata?.role === 'seller' ? '/seller-dashboard' : '/customer-dashboard';

  return (
    <div className="px-0 sm:px-4 md:px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="mb-6 px-4 pt-4">
        <Link to={backTarget} className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" /></svg>
          Back to Dashboard
        </Link>
      </div>
      <Modal isOpen={showErrorBanner} onClose={async () => { setShowErrorBanner(false); setError(null); await reloadLocal(); }}>
        <div className="flex items-center gap-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-600" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"></path></svg>
          <div>
            <div className="font-medium text-lg">Error</div>
            <div className="mt-2 text-sm">{error}</div>
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <button onClick={async () => { setShowErrorBanner(false); setError(null); await reloadLocal(); }} className="inline-flex items-center justify-center font-medium rounded focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors bg-gray-200 hover:bg-gray-300 text-gray-800 focus:ring-gray-500 px-3 py-2 text-sm">Dismiss</button>
        </div>
      </Modal>
      {/* Header Section */}
      <div className={`mb-4 sm:mb-6 md:mb-8 mx-3 sm:mx-0 p-4 sm:p-6 md:p-8 rounded-2xl shadow-xl backdrop-blur-sm ${theme === 'dark' ? 'bg-gray-800/90 border border-gray-700/50' : 'bg-white/90 border border-gray-200/50'}`}>
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div>
            <h1 className={`text-4xl font-bold mb-2 ${textColor}`}>
              <span className="inline-flex items-center gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-10 w-10 ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Invoice Management
              </span>
            </h1>
            <p className={`text-lg ${secondaryTextColor}`}>
              Create, track, and manage your invoices
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {!showAddForm && invoices.length > 0 && (
              <>
                <Button onClick={handlePrint} variant="secondary" size="md" className="print:hidden">
                  <span className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                    Print
                  </span>
                </Button>
                <Button onClick={handleDownloadCSV} variant="secondary" size="md" className="print:hidden">
                  <span className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Export CSV
                  </span>
                </Button>
              </>
            )}
            {!showAddForm && (
              <Button onClick={() => setShowAddForm(true)} variant="primary" className="whitespace-nowrap">
                <span className="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                  </svg>
                  Create Invoice
                </span>
              </Button>
            )}
          </div>
        </div>
        {/* Sync / queue status */}
        <QueueStatus onDismiss={() => setError(null)} />

        {/* Filters: seller / customer / service / status */}
        <div className="mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {role !== 'seller' && (
              <div>
                <label className={`block text-sm font-medium ${secondaryTextColor} mb-1`}>Filter by Seller</label>
                <select value={sellerFilter} onChange={(e) => setSellerFilter(e.target.value)} className={`w-full p-2 rounded border ${theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200'}`}>
                  <option value="">All sellers</option>
                  {sellerOptions.map((s, idx) => <option key={idx} value={s}>{s}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className={`block text-sm font-medium ${secondaryTextColor} mb-1`}>Filter by Customer</label>
              <select value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)} className={`w-full p-2 rounded border ${theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200'}`}>
                <option value="">All customers</option>
                {customerOptions.map((c, idx) => <option key={idx} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={`block text-sm font-medium ${secondaryTextColor} mb-1`}>Filter by Service</label>
              <select value={serviceFilter} onChange={(e) => setServiceFilter(e.target.value)} className={`w-full p-2 rounded border ${theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200'}`}>
                <option value="">All services</option>
                {serviceOptions.map((s, idx) => <option key={idx} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={`block text-sm font-medium ${secondaryTextColor} mb-1`}>Filter by Status</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={`w-full p-2 rounded border ${theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200'}`}>
                <option value="">All statuses</option>
                <option value="sent">Pending</option>
                <option value="paid">Paid</option>
                <option value="disputed">Disputed</option>
              </select>
            </div>
          </div>

          {/* Active filter pills + clear button */}
          {(sellerFilter || customerFilter || serviceFilter || statusFilter) && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {sellerFilter && (
                <div className={`${theme === 'dark' ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-800'} inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm`}>
                  <strong className="mr-1">Seller:</strong> <span>{sellerFilter}</span>
                  <button onClick={() => setSellerFilter('')} className="ml-2 text-xs text-gray-400 hover:text-gray-600">✕</button>
                </div>
              )}
              {customerFilter && (
                <div className={`${theme === 'dark' ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-800'} inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm`}>
                  <strong className="mr-1">Customer:</strong> <span>{customerFilter}</span>
                  <button onClick={() => setCustomerFilter('')} className="ml-2 text-xs text-gray-400 hover:text-gray-600">✕</button>
                </div>
              )}
              {serviceFilter && (
                <div className={`${theme === 'dark' ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-800'} inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm`}>
                  <strong className="mr-1">Service:</strong> <span>{serviceFilter}</span>
                  <button onClick={() => setServiceFilter('')} className="ml-2 text-xs text-gray-400 hover:text-gray-600">✕</button>
                </div>
              )}
              {statusFilter && (
                <div className={`${theme === 'dark' ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-800'} inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm`}>
                  <strong className="mr-1">Status:</strong> <span>{statusFilter === 'sent' ? 'Pending' : statusFilter === 'disputed' ? 'Disputed' : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}</span>
                  <button onClick={() => setStatusFilter('')} className="ml-2 text-xs text-gray-400 hover:text-gray-600">✕</button>
                </div>
              )}
              <Button variant="secondary" size="sm" onClick={() => { setSellerFilter(''); setCustomerFilter(''); setServiceFilter(''); setStatusFilter(''); setSearchParams({ page: '1' }); }} className="ml-2">
                Clear Filters
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      {!showAddForm && invoices.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 sm:gap-4 md:gap-6 mb-6 sm:mb-8">
          <div className={`p-4 sm:p-6 rounded-xl backdrop-blur-sm ${theme === 'dark' ? 'bg-gray-800/80 border border-gray-700/50' : 'bg-white/80 border border-gray-200/50'}`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center flex-shrink-0 ${theme === 'dark' ? 'bg-blue-900/40' : 'bg-blue-100'}`}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-xs sm:text-sm ${secondaryTextColor} mb-0.5`}>Total Invoices</p>
                <p className={`text-xl sm:text-2xl md:text-3xl font-bold ${textColor}`}>{filteredInvoices.length}</p>
              </div>
            </div>
          </div>
          
          <div className={`p-4 sm:p-6 rounded-xl backdrop-blur-sm ${theme === 'dark' ? 'bg-gray-800/80 border border-gray-700/50' : 'bg-white/80 border border-gray-200/50'}`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center flex-shrink-0 ${theme === 'dark' ? 'bg-green-900/40' : 'bg-green-100'}`}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-6 sm:w-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-xs sm:text-sm ${secondaryTextColor} mb-0.5`}>Paid</p>
                <p className={`text-xl sm:text-2xl md:text-3xl font-bold ${textColor}`}>{filteredInvoices.filter(inv => inv.status === 'paid').length}</p>
              </div>
            </div>
          </div>
          
          <div className={`p-4 sm:p-6 rounded-xl backdrop-blur-sm ${theme === 'dark' ? 'bg-gray-800/80 border border-gray-700/50' : 'bg-white/80 border border-gray-200/50'}`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center flex-shrink-0 ${theme === 'dark' ? 'bg-yellow-900/40' : 'bg-yellow-100'}`}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-600 dark:text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-xs sm:text-sm ${secondaryTextColor} mb-0.5`}>Pending</p>
                <p className={`text-xl sm:text-2xl md:text-3xl font-bold ${textColor}`}>{filteredInvoices.filter(inv => inv.status === 'sent').length}</p>
              </div>
            </div>
          </div>
          
          <div className={`p-4 sm:p-6 rounded-xl backdrop-blur-sm ${theme === 'dark' ? 'bg-gray-800/80 border border-gray-700/50' : 'bg-white/80 border border-gray-200/50'}`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center flex-shrink-0 ${theme === 'dark' ? 'bg-purple-900/40' : 'bg-purple-100'}`}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-xs sm:text-sm ${secondaryTextColor} mb-0.5`}>Total Value</p>
                <p className={`text-lg sm:text-xl md:text-2xl font-bold ${textColor} break-words`}>
                  KSH {filteredInvoices.reduce((sum, inv) => sum + (Number(inv.total) || 0), 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAddForm && (
        <AddInvoiceForm
          onSaveInvoice={handleAddInvoice}
          onCancel={() => setShowAddForm(false)}
          saving={isCreating}
        />
      )}

      {/* Invoice Cards */}
      <div className="space-y-4">
        {invoices.length > 0 ? (
          <>
            <div className={`mb-4 px-4 py-2 rounded-lg ${theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-100/80'}`}>
              <p className={`text-sm ${secondaryTextColor}`}>
                Showing <span className="font-semibold">{pagedInvoices.length}</span> of <span className="font-semibold">{filteredInvoices.length}</span> invoice{filteredInvoices.length !== 1 ? 's' : ''}
              </p>
            </div>
            {(serverFilteredInvoices || pagedInvoices).map((invoice) => {
              const statusConfig = {
                paid: { bg: 'bg-green-100 dark:bg-green-500', text: 'text-green-800 dark:text-white', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
                sent: { bg: 'bg-blue-100 dark:bg-blue-500', text: 'text-blue-800 dark:text-white', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
                overdue: { bg: 'bg-red-100 dark:bg-red-500', text: 'text-red-800 dark:text-white', icon: 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
                draft: { bg: 'bg-yellow-100 dark:bg-yellow-500', text: 'text-yellow-800 dark:text-gray-900', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' }
              };
              const status = invoice.status || 'draft';
              const config = statusConfig[status] || statusConfig.draft;
              
              return (
                <div key={invoice._id} className={`p-6 border rounded-xl shadow-md backdrop-blur-sm transition-all hover:shadow-lg ${theme === 'dark' ? 'bg-gray-800/80 border-gray-700/50' : 'bg-white/80 border-gray-200/50'}`}>
                  <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${theme === 'dark' ? 'bg-red-900/40' : 'bg-red-100'}`}>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div>
                          <Link to={`/invoices/${invoice._id}`} className={`font-bold text-2xl hover:underline ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`}>
                            #{invoice.invoiceNumber}
                          </Link>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <div className={`flex items-center gap-2 ${secondaryTextColor}`}>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          <span>{invoice.customerName || '[Deleted Customer]'}</span>
                        </div>
                        <div className={`flex items-center gap-2 ${textColor}`}>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="text-xl font-bold">KSH {(Number(invoice.total) || 0).toFixed(2)}</span>
                        </div>
                        {invoice.dueDate && (
                          <div className={`flex items-center gap-2 text-sm ${secondaryTextColor}`}>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            Due: {new Date(invoice.dueDate).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-3 items-end">
                      <div className="flex gap-2">
                        <div className={`px-4 py-2 rounded-full text-sm font-bold uppercase flex items-center gap-2 ${config.bg} ${config.text}`}>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={config.icon} />
                          </svg>
                          {status === 'sent' ? 'Pending' : status}
                        </div>
                        {(() => {
                          const hasActiveDisputeStatus = invoice.disputeStatus && ['disputed', 'under-review', 'pending'].includes(invoice.disputeStatus);
                          const hasActiveDisputes = Array.isArray(invoice.disputes) && invoice.disputes.length > 0 && 
                            invoice.disputes.some(d => d.status && ['pending', 'under-review', 'disputed'].includes(d.status));
                          return (hasActiveDisputeStatus || hasActiveDisputes) && (
                            <div className="px-4 py-2 rounded-full text-sm font-bold uppercase flex items-center gap-2 bg-orange-100 dark:bg-orange-500 text-orange-800 dark:text-white">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                              Disputed
                            </div>
                          );
                        })()}
                      </div>
                      <div className="flex gap-2">
                        <Link to={`/invoices/${invoice._id}`}>
                          <Button variant="secondary" size="sm">
                            <span className="flex items-center gap-2">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                              View
                            </span>
                          </Button>
                        </Link>
                        {(() => {
                          const activeDisputes = invoice.disputes?.filter(d => ['pending', 'under-review', 'disputed'].includes(d.status)) || [];
                          return activeDisputes.length > 0 && (
                            <Link to={`/invoices/${invoice._id}#disputes`}>
                              <Button variant="warning" size="sm">
                                <span className="flex items-center gap-2">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                  </svg>
                                  <span className="hidden sm:inline">View Disputes</span>
                                  <span className="sm:hidden">Disputes</span>
                                  <span className="bg-white dark:bg-gray-900 text-orange-800 dark:text-orange-300 rounded-full px-2 py-0.5 text-xs font-bold">
                                    {activeDisputes.length}
                                  </span>
                                </span>
                              </Button>
                            </Link>
                          );
                        })()}
                        {invoice.status === 'draft' && (
                          <Button onClick={() => setConfirmDeleteInvoiceId(invoice._id)} variant="danger" size="sm" loading={deletingInvoiceId === invoice._id} disabled={deletingInvoiceId === invoice._id}>
                            <span className="flex items-center gap-2">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              Delete
                            </span>
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        ) : (
          <div className={`text-center py-16 px-6 rounded-2xl ${theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-50/80'}`}>
            <div className={`w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'}`}>
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-10 w-10 ${secondaryTextColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className={`text-2xl font-bold mb-2 ${textColor}`}>No Invoices Yet</h3>
            <p className={`mb-6 max-w-md mx-auto ${secondaryTextColor}`}>
              Create your first invoice to start tracking payments and managing customer billing.
            </p>
            {!showAddForm && (
              <Button onClick={() => setShowAddForm(true)} variant="primary">
                <span className="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                  </svg>
                  Create Your First Invoice
                </span>
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <button
            onClick={() => setSearchParams({ page: String(Math.max(1, currentPage - 1)) })}
            disabled={currentPage === 1}
            className={`px-3 py-1 rounded ${currentPage === 1 ? 'opacity-50 cursor-not-allowed' : (theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300')}`}
          >
            Prev
          </button>

          {Array.from({ length: totalPages }).map((_, i) => {
            const p = i + 1;
            return (
              <button
                key={p}
                onClick={() => setSearchParams({ page: String(p) })}
                className={`px-3 py-1 rounded ${p === currentPage ? (theme === 'dark' ? 'bg-red-400 text-gray-900' : 'bg-red-500 text-white') : (theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-100 hover:bg-gray-200')}`}
              >
                {p}
              </button>
            );
          })}

          <button
            onClick={() => setSearchParams({ page: String(Math.min(totalPages, currentPage + 1)) })}
            disabled={currentPage === totalPages}
            className={`px-3 py-1 rounded ${currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : (theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300')}`}
          >
            Next
          </button>
        </div>
      )}

      {/* Confirm delete invoice modal */}
      <ConfirmModal
        isOpen={Boolean(confirmDeleteInvoiceId)}
        title="Delete Invoice"
        message={`Are you sure you want to delete this invoice? Action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onCancel={() => setConfirmDeleteInvoiceId(null)}
        confirmLoading={deletingInvoiceId === confirmDeleteInvoiceId}
        onConfirm={async () => {
          const idToDelete = confirmDeleteInvoiceId;
          setConfirmDeleteInvoiceId(null);
          try { await handleDeleteInvoice(idToDelete); } catch (e) { console.error('Delete invoice failed', e); }
        }}
      />
    </div>
  );
};

export default InvoicesPage;
