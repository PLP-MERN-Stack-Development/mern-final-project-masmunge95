import { useState } from 'react';
import db from '../../db';
import { sanitizeForDb, pruneSyncNonCloneable } from '../../utils/dbUtils';
import { enqueue, deepSanitizeAsync } from '../../services/queueService';
import { saveProducerSnapshot } from '../../utils/producerDiag';

/**
 * Custom hook to manage record CRUD operations
 * Handles create and delete with optimistic updates
 */
export const useRecordCrud = (ocrData) => {
  const [deletingRecordId, setDeletingRecordId] = useState(null);

  const handleAddRecord = async (formData) => {
    // Convert FormData to a plain object for Dexie and the sync queue
    const recordPayload = Object.fromEntries(formData.entries());
    const localId = crypto.randomUUID();
    
    // Ensure detected OCR customer fields are preserved even if form omitted them
    let detectedName = recordPayload.customerName || recordPayload.customer || null;
    let detectedPhone = recordPayload.customerPhone || recordPayload.customerPhone || recordPayload.mobile || null;
    
    // fallback to the uploader OCR data if available
    if ((!detectedName || !detectedPhone) && ocrData && ocrData.data) {
      const od = ocrData.data;
      if (!detectedName) detectedName = od.customerName || od.customer || od.name || od.customerName || null;
      if (!detectedPhone) detectedPhone = od.customerPhone || od.mobileNumber || od.mobile || od.phone || null;
    }

    // Prepare and deep-sanitize payload before writing to Dexie
    const rawRecord = {
      _id: localId,
      ...recordPayload,
      // canonicalize customer fields so UI reads `customerName`/`customerPhone`
      customerName: detectedName || recordPayload.customerName || recordPayload.customer || null,
      customerPhone: detectedPhone || recordPayload.customerPhone || recordPayload.mobile || null,
      amount: parseFloat(recordPayload.amount),
      recordDate: new Date(recordPayload.recordDate),
      syncStatus: 'pending',
    };
    
    const cleanRecord = await deepSanitizeAsync(sanitizeForDb(rawRecord));
    if (!cleanRecord) throw new Error('Record payload not safe to persist');
    
    // Final sync-safe prune before writing
    const toWrite = pruneSyncNonCloneable(cleanRecord);
    await db.records.add(toWrite);

    // Add a job to the sync queue
    try { 
      if (import.meta.env?.DEV) {
        saveProducerSnapshot({ 
          entity: 'records', 
          action: 'create', 
          entityId: localId, 
          payload: Object.assign({ _id: localId }, recordPayload) 
        }, 'RecordsPage.enqueue.create'); 
      } 
    } catch (e) {}
    
    await enqueue({
      entity: 'records',
      action: 'create',
      entityId: localId,
      payload: Object.assign({ _id: localId }, recordPayload, { 
        customerName: rawRecord.customerName, 
        customerPhone: rawRecord.customerPhone 
      }),
      tempId: localId,
      timestamp: new Date().toISOString(),
    });

    // Wait for sync queue to process this item (up to 10 seconds)
    let attempts = 0;
    while (attempts < 20) {
      const pending = await db.syncQueue.where('entityId').equals(localId).toArray();
      if (pending.length === 0) {
        console.log('[useRecordCrud] Record sync completed successfully');
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 500));
      attempts++;
    }

    return localId;
  };

  const handleDeleteRecord = async (recordId) => {
    setDeletingRecordId(recordId);
    try {
      // Read the local record by its `_id` index
      const local = await db.records.where('_id').equals(String(recordId)).first();
      
      // Remove local row (by _id) to give optimistic UX
      try {
        await db.records.where('_id').equals(String(recordId)).delete();
      } catch (delErr) {
        // fallback to primary-key delete if needed
        try { await db.records.delete(recordId); } catch (e) { /* ignore */ }
      }

      // Add a job to the sync queue
      const queueItem = {
        entity: 'records',
        entityId: recordId,
        action: 'delete',
        timestamp: new Date().toISOString(),
      };
      
      if (local && local.serverId) {
        queueItem.payload = { serverId: local.serverId };
      }
      
      try { 
        if (import.meta.env?.DEV) {
          saveProducerSnapshot(queueItem, 'RecordsPage.enqueue.delete'); 
        } 
      } catch (e) {}
      
      await enqueue(queueItem);
      
    } catch (err) {
      console.error('[useRecordCrud] Failed to delete record:', err);
      throw err;
    } finally {
      setDeletingRecordId(null);
    }
  };

  return {
    deletingRecordId,
    handleAddRecord,
    handleDeleteRecord,
  };
};
