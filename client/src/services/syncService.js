import db from '../db';
import { createRecord, deleteRecord } from './recordService';
import { broadcast } from './dataSyncService';
import { createInvoice, updateInvoice, deleteInvoice, sendInvoice } from './invoiceService';
import { createCustomer, deleteCustomer } from './customerService';
import { createUtilityService, updateUtilityService, deleteUtilityService } from './utilityService';
import { sanitizeForDb, makeTempId, firstOrUndefined, pruneSyncNonCloneable } from '../utils/dbUtils';

// Helper: safe put that avoids unique-index ConstraintError by using existing primary key if present.
import { deepSanitizeAsync } from '../services/queueService';

const safePut = async (tableName, obj) => {
  if (!obj || !obj._id) return;
  try {
    const table = db[tableName];
    if (!table) {
      console.warn('[Sync] safePut: unknown table', tableName);
      return;
    }
    // Deep-sanitize the object before writing to Dexie
    const cleanObj = await deepSanitizeAsync(obj);

    // DEV snapshotting removed: avoid writing debug snapshots to `window` in production
    // Defensive normalization: remove Promise-like or function `id` values
    try {
      if (cleanObj && Object.prototype.hasOwnProperty.call(cleanObj, 'id')) {
        const rawId = cleanObj.id;
        // If `id` is a Promise-like, drop it entirely (will use _id instead)
        if (rawId && (typeof rawId === 'object' || typeof rawId === 'function') && typeof rawId.then === 'function') {
          console.warn('[Sync] safePut: removed Promise-like top-level `id` before Dexie write', cleanObj._id);
          delete cleanObj.id;
        }
        // If `id` is an object (e.g., an object id), try to coerce into _id and remove `id`
        else if (rawId && typeof rawId === 'object') {
          try {
            const candidate = rawId._id ?? rawId.id ?? String(rawId);
            if (candidate) {
              cleanObj._id = String(candidate);
            }
          } catch (e) {
            // ignore coercion errors
          }
          delete cleanObj.id;
        }
        // If `id` is present and primitive, prefer moving it into _id if _id missing
        else if ((cleanObj._id === undefined || cleanObj._id === null) && (typeof rawId === 'string' || typeof rawId === 'number')) {
          try { cleanObj._id = String(rawId); } catch (e) { /* ignore */ }
          delete cleanObj.id;
        }
      }
    } catch (e) {
      // Don't let diagnostics/probing break the write path
      console.warn('[Sync] safePut: error during id normalization', e);
    }
    const existing = await firstOrUndefined(table.where('_id').equals(String(cleanObj._id)));
    if (existing && existing.id !== undefined) {
      // Use the existing primary key to ensure this becomes an update, not an add
      try {
        await table.put({ ...cleanObj, id: existing.id });
        return;
      } catch (e) {
        console.warn(`[Sync] safePut update failed for ${tableName} ${cleanObj._id}, retrying without id`, e);
      }
    }
    // No existing row found - insert normally (prune sync-only non-cloneable fields first)
    const toWrite = pruneSyncNonCloneable(cleanObj);
    try {
      await table.put(toWrite);
    } catch (putErr) {
      // If a structured-clone/DataCloneError occurred, attempt a defensive prune-and-retry
      const isDataClone = putErr && (putErr.name === 'DataCloneError' || (typeof putErr.message === 'string' && putErr.message.includes('could not be cloned')));
      if (isDataClone) {
        try {
          console.warn('[Sync] safePut: DataCloneError detected, attempting auto-prune-and-retry for', cleanObj._id);
          const pruned = pruneSyncNonCloneable(toWrite);
          // Also ensure top-level Promise-like fields removed
          for (const k of Object.keys(pruned || {})) {
            try {
              const v = pruned[k];
              if (v && (typeof v === 'object' || typeof v === 'function') && typeof v.then === 'function') {
                console.warn('[Sync] safePut: removed Promise-like top-level field', k, 'for', cleanObj._id);
                try { delete pruned[k]; } catch (e) { pruned[k] = undefined; }
              }
            } catch (e) { /* ignore per-field errors */ }
          }
          await table.put(pruned);
          console.log('[Sync] safePut: retry successful after pruning for', cleanObj._id);
        } catch (retryErr) {
          console.error('[Sync] safePut: retry after pruning failed for', cleanObj._id, retryErr);
          throw retryErr;
        }
      } else {
        throw putErr;
      }
    }
  } catch (e) {
    console.error(`[Sync] safePut ERROR for ${tableName} ${obj._id}:`, e);
    throw e;
  }
};

/**
 * Processes the synchronization queue, sending pending changes to the server.
 */
let _inFlightSync = null;

export const syncWithServer = async () => {
  // Coalesce concurrent syncWithServer calls: return the in-flight promise if present
  if (_inFlightSync) return _inFlightSync;

  _inFlightSync = (async () => {
    try {
      const allQueue = await db.syncQueue.toArray();
    // Only process items that are not permanently failed and whose nextAttemptAt (if present) is due
    const now = Date.now();
    const pendingChanges = (allQueue || []).filter(c => !c?.failed && (!c?.nextAttemptAt || new Date(c.nextAttemptAt).getTime() <= now));
    if (pendingChanges.length === 0) {
      // Nothing ready to process
      return;
    }

    console.log(`[Sync] Starting sync for ${pendingChanges.length} items.`);
    // Notify UI that queue sync is starting
    try { broadcast('sync:start'); } catch (e) { /* ignore */ }

    for (const change of pendingChanges) {
      // Increment attempts and record lastAttemptAt
      const attempts = (change.attempts || 0) + 1;
      try { await db.syncQueue.update(change.id, { attempts, lastAttemptAt: new Date().toISOString() }); } catch (e) { /* ignore */ }
      // Track whether this queue item completed successfully; only delete on success
      let itemSynced = false;
      try {
        const { entity, action, payload, entityId, tempId } = change;
        let response;

        // Normalize entity names to singular form to handle pluralization mismatches
        const normalized = (entity || '').toString().toLowerCase().replace(/s$/,'');

        // Use a switch to determine which API service to call
        switch (normalized) {
          case 'record':
            if (action === 'create') {
              response = await createRecord(payload);
              try {
                await db.records.where('_id').equals(tempId).delete();
              } catch (delErr) {
                console.warn('[Sync] Failed to delete temp record before adding final record', delErr);
              }
              if (response) {
                const sanitized = sanitizeForDb(response);
                try {
                  await safePut('records', sanitized);
                  console.log(`[Sync] Successfully wrote created record to Dexie: ${sanitized._id}`);
                } catch (putErr) {
                  console.error('[Sync] ERROR putting created record to Dexie via safePut:', putErr);
                }
              }
            }
            if (action === 'delete') {
              // If the record was never synced to the server (no serverId), skip server delete.
              try {
                  const local = await db.records.where('_id').equals(String(entityId)).first();
                  // Prefer serverId supplied in the queue payload (if present) — this is set when the user deleted
                  // a local record so the server linkage can still be removed.
                  const payloadServerId = change.payload && change.payload.serverId ? String(change.payload.serverId) : null;
                  const serverId = payloadServerId || local?.serverId || null;
                  const isLocalOnly = serverId && String(serverId).startsWith('client_');
                  if (serverId && !isLocalOnly) {
                    // Ask server to delete the canonical resource
                    await deleteRecord(serverId);
                  } else if (!serverId && !local) {
                    // No local row and no serverId — best-effort: call server with entityId
                    await deleteRecord(entityId);
                  } else {
                    // No server linkage present; nothing to delete on server
                    console.log('[Sync] Record appears local-only; skipping server delete for', entityId);
                  }

                  // Ensure any local rows referencing either the client _id or the serverId are removed
                  try { await db.records.where('_id').equals(String(entityId)).delete(); } catch (e) { /* ignore */ }
                  if (serverId) {
                    try { await db.records.where('serverId').equals(String(serverId)).delete(); } catch (e) { /* ignore */ }
                  }
              } catch (dErr) {
                console.warn('[Sync] Error while attempting to delete record on server/local:', dErr);
                // As a fallback, try the direct delete call
                try { await deleteRecord(entityId); } catch (fallbackErr) { throw fallbackErr; }
              }
            }
            break;
          case 'invoice':
            if (action === 'create') {
              response = await createInvoice(payload);
              // Atomically replace the temporary local record with the final server record.
              try {
                await db.invoices.where('_id').equals(tempId).delete();
              } catch (delErr) {
                console.warn('[Sync] Failed to delete temp invoice before adding final invoice', delErr);
              }
              // Flatten server response to match Dexie schema and ensure _id exists
              if (response) {
                const finalInvoice = sanitizeForDb(response, { flattenCustomer: true });
                try {
                  await safePut('invoices', finalInvoice);
                  console.log(`[Sync] Successfully wrote created invoice to Dexie: ${finalInvoice._id}`);
                } catch (putErr) {
                  console.error('[Sync] ERROR putting created invoice to Dexie via safePut:', putErr);
                }
              }
            }
            if (action === 'update') {
              // Send update to server and persist the server's canonical response into local DB
              try {
                console.log(`[Sync] Updating invoice on server: ${entityId}`, payload);
                response = await updateInvoice(entityId, payload);
                console.log(`[Sync] Server response for invoice update:`, response);
                if (response) {
                  const sanitized = sanitizeForDb(response, { flattenCustomer: true });
                  console.log(`[Sync] Sanitized data for invoice:`, sanitized);
                  try {
                    await safePut('invoices', sanitized);
                    console.log(`[Sync] Successfully wrote invoice to Dexie: ${sanitized._id}`);
                  } catch (putErr) {
                    console.error('[Sync] ERROR putting invoice to Dexie via safePut:', putErr);
                  }
                } else {
                  console.warn('[Sync] No response from server for invoice update');
                }
              } catch (uErr) {
                console.error('[Sync] Failed to update invoice on server:', uErr);
              }
            }
            if (action === 'send') {
              // Use the dedicated send endpoint so server-side send logic (emails, validations) runs
              try {
                console.log(`[Sync] Invoking server send endpoint for invoice: ${entityId}`);
                response = await sendInvoice(entityId);
                console.log(`[Sync] Server response for invoice send:`, response);
                if (response) {
                  const sanitized = sanitizeForDb(response, { flattenCustomer: true });
                  try {
                    await safePut('invoices', sanitized);
                    console.log(`[Sync] Successfully wrote sent invoice to Dexie: ${sanitized._id}`);
                  } catch (putErr) {
                    console.error('[Sync] ERROR putting sent invoice to Dexie via safePut:', putErr);
                  }
                } else {
                  console.warn('[Sync] No response from server for invoice send');
                }
              } catch (sErr) {
                console.error('[Sync] Failed to send invoice to server:', sErr);
              }
            }
            if (action === 'delete') {
              try {
                // Determine serverId if available (payload or local mapping)
                const local = await db.invoices.where('_id').equals(String(entityId)).first();
                const payloadServerId = change.payload && change.payload.serverId ? String(change.payload.serverId) : null;
                const serverId = payloadServerId || local?.serverId || null;
                const isLocalOnly = serverId && String(serverId).startsWith('client_');

                if (serverId && !isLocalOnly) {
                  // Ask server to delete the canonical resource
                  await deleteInvoice(serverId);
                } else if (!serverId && !local) {
                  // No local row and no serverId — best-effort: call server with entityId
                  await deleteInvoice(entityId);
                } else {
                  // No server linkage present; nothing to delete on server
                  console.log('[Sync] Invoice appears local-only; skipping server delete for', entityId);
                }

                // Ensure any local rows referencing either the client _id or the serverId are removed
                try { await db.invoices.where('_id').equals(String(entityId)).delete(); } catch (e) { /* ignore */ }
                if (serverId) {
                  try { await db.invoices.where('serverId').equals(String(serverId)).delete(); } catch (e) { /* ignore */ }
                }
              } catch (dErr) {
                console.error('[Sync] Failed to delete invoice on server/local:', dErr);
              }
            }
            break;
          case 'customer':
            if (action === 'create') {
              try {
                response = await createCustomer(payload);
                try {
                  await db.customers.where('_id').equals(tempId).delete();
                } catch (delErr) {
                  console.warn('[Sync] Failed to delete temp customer before adding final customer', delErr);
                }
                const sanitized = sanitizeForDb(response);
                console.log(`[Sync] Sanitized response for created customer:`, sanitized);
                try {
                  await safePut('customers', sanitized);
                  console.log(`[Sync] Successfully wrote created customer to Dexie: ${sanitized._id}`);
                } catch (putErr) {
                  console.error('[Sync] ERROR putting created customer to Dexie via safePut:', putErr);
                }
              } catch (cErr) {
                console.error('[Sync] Failed to create customer on server:', cErr);
              }
            }
            if (action === 'update') {
              // Add update handler for customers too
              try {
                console.log(`[Sync] Updating customer on server: ${entityId}`, payload);
                response = await updateCustomer(entityId, payload);
                console.log(`[Sync] Server response for customer update:`, response);
                if (response) {
                  const sanitized = sanitizeForDb(response);
                  console.log(`[Sync] Sanitized data for customer:`, sanitized);
                  try {
                    await safePut('customers', sanitized);
                    console.log(`[Sync] Successfully wrote customer to Dexie: ${sanitized._id}`);
                  } catch (putErr) {
                    console.error('[Sync] ERROR putting customer to Dexie via safePut:', putErr);
                  }
                } else {
                  console.warn('[Sync] No response from server for customer update');
                }
              } catch (uErr) {
                console.error('[Sync] Failed to update customer on server:', uErr);
              }
            }
            if (action === 'delete') {
              try {
                await deleteCustomer(entityId);
                await db.customers.where('_id').equals(entityId).delete();
              } catch (dErr) {
                console.error('[Sync] Failed to delete customer on server/local:', dErr);
              }
            }
            break;
          case 'utilityservice':
            if (action === 'create') {
              try {
                response = await createUtilityService(payload);
                try {
                  await db.utilityServices.where('_id').equals(tempId).delete();
                } catch (delErr) {
                  console.warn('[Sync] Failed to delete temp utility service before adding final:', delErr);
                }
                if (response) {
                  const sanitized = sanitizeForDb(response);
                  console.log(`[Sync] Sanitized response for created utility service:`, sanitized);
                  try {
                    await safePut('utilityServices', sanitized);
                    console.log(`[Sync] Successfully wrote created utility service to Dexie: ${sanitized._id}`);
                  } catch (putErr) {
                    console.error('[Sync] ERROR putting created utility service to Dexie via safePut:', putErr);
                  }
                } else {
                  console.warn('[Sync] No response from server for utility service create');
                }
              } catch (cErr) {
                console.error('[Sync] Failed to create utility service on server:', cErr);
              }
            }
            if (action === 'update') {
              try {
                console.log(`[Sync] Updating utility service on server: ${entityId}`, payload);
                response = await updateUtilityService(entityId, payload);
                console.log(`[Sync] Server response for utility service update:`, response);
                if (response) {
                  const sanitized = sanitizeForDb(response);
                  console.log(`[Sync] Sanitized data for utility service:`, sanitized);
                  try {
                    await safePut('utilityServices', sanitized);
                    console.log(`[Sync] Successfully wrote utility service to Dexie: ${sanitized._id}`);
                  } catch (putErr) {
                    console.error('[Sync] ERROR putting utility service to Dexie via safePut:', putErr);
                  }
                } else {
                  console.warn('[Sync] No response from server for utility service update');
                }
              } catch (uErr) {
                console.error('[Sync] Failed to update utility service on server:', uErr);
              }
            }
            if (action === 'delete') {
              try {
                await deleteUtilityService(entityId);
                await db.utilityServices.where('_id').equals(entityId).delete();
              } catch (dErr) {
                console.error('[Sync] Failed to delete utility service on server/local:', dErr);
              }
            }
            break;
          default:
            console.warn(`[Sync] Unknown entity type: ${entity}`);
            break;
        }

        // If we reached here without throwing, mark as synced
        itemSynced = true;
      
      // Only remove the item from the queue if it actually synced successfully
      if (itemSynced) {
        try {
          await db.syncQueue.delete(change.id);
          console.log(`[Sync] Successfully synced and removed item: ${change.entity} (${change.action})`);
        } catch (delErr) {
          console.warn('[Sync] Failed to remove synced item from queue:', delErr, change.id);
        }
      } else {
        console.log(`[Sync] Did not remove queue item ${change.id} because sync did not complete successfully.`);
      }

      } catch (error) {
        console.error(`[Sync] Failed to sync item: ${change.entity} (${change.action})`, error);
        // Determine backoff and mark nextAttemptAt or mark as permanently failed
        try {
          const MAX_ATTEMPTS = 5;
          const currentAttempts = (change.attempts || 0) + 1;
          const nextAttempts = currentAttempts;
          if (nextAttempts >= MAX_ATTEMPTS) {
            // Mark as failed so it won't be retried automatically
            await db.syncQueue.update(change.id, { failed: true, lastError: String(error?.message || error), attempts: nextAttempts, failedAt: new Date().toISOString() });
            console.warn(`[Sync] Item marked as permanently failed after ${nextAttempts} attempts:`, change);
            try { broadcast('sync:error', { item: change, error: String(error?.message || error) }); } catch (e) {}
          } else {
            // Exponential backoff (ms)
            const backoffMs = Math.min(5 * 60 * 1000, Math.pow(2, nextAttempts) * 1000); // cap at 5 minutes
            const nextAttemptAt = new Date(Date.now() + backoffMs).toISOString();
            await db.syncQueue.update(change.id, { nextAttemptAt, lastError: String(error?.message || error), attempts: nextAttempts });
            console.log(`[Sync] Scheduled retry #${nextAttempts} for item ${change.id} in ${backoffMs}ms`);
          }
        } catch (uErr) {
          console.error('[Sync] Failed to update queue item after sync failure:', uErr);
        }
        // Notify listeners that an error occurred for UI feedback
        try { broadcast('sync:error', error); } catch (e) {}
        // Continue to next item
      }
    }
      console.log('[Sync] Synchronization process finished.');
      try { broadcast('sync:finished'); } catch (e) {}
    } catch (error) {
      console.error('[Sync] Fatal sync error:', error);
      try { broadcast('sync:error', error); } catch (e) {}
      // Even if sync crashes, we shouldn't break the app
    } finally {
      // clear the in-flight marker so subsequent syncs can run
      _inFlightSync = null;
    }
  })();

  return _inFlightSync;
};

// Clear queue helpers: allow the app/UI to purge failed or all queued items.
export const clearFailed = async () => {
  try {
    const failedItems = await db.syncQueue.where('failed').equals(true).toArray();
    const count = (failedItems || []).length;
    if (count === 0) return 0;
    await Promise.all(failedItems.map(it => db.syncQueue.delete(it.id)));
    try { broadcast('sync:cleared', { type: 'failed', count }); } catch (e) {}
    return count;
  } catch (e) {
    console.error('[Sync] clearFailed error:', e);
    throw e;
  }
};

export const clearAll = async () => {
  try {
    const all = await db.syncQueue.toArray();
    const count = (all || []).length;
    if (count === 0) return 0;
    await db.syncQueue.clear();
    try { broadcast('sync:cleared', { type: 'all', count }); } catch (e) {}
    return count;
  } catch (e) {
    console.error('[Sync] clearAll error:', e);
    throw e;
  }
};

export const listFailed = async () => {
  try {
    return await db.syncQueue.where('failed').equals(true).toArray();
  } catch (e) {
    console.error('[Sync] listFailed error:', e);
    return [];
  }
};