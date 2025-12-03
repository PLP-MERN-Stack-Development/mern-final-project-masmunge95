import { useState } from 'react';
import db from '../../db';
import { enqueue, deepSanitizeAsync } from '../../services/queueService';
import { firstOrUndefined, pruneSyncNonCloneable } from '../../utils/dbUtils';

/**
 * useRecordEdit - Handle record editing with sync queue integration
 * Supports both regular records and invoice records
 */
export const useRecordEdit = (recordId, setRecord, toast) => {
  const [showEditModal, setShowEditModal] = useState(false);

  const saveRecordEdit = async (localUpdate) => {
    try {
      const existing = await firstOrUndefined(db.records.where('_id').equals(String(recordId)));
      const clean = await deepSanitizeAsync(localUpdate);
      const toWrite = pruneSyncNonCloneable(clean);

      if (existing && existing.id !== undefined) {
        await db.records.update(existing.id, toWrite);
      } else {
        await db.records.put(Object.assign({ _id: recordId }, toWrite));
      }

      await enqueue({
        entity: 'records',
        action: 'update',
        entityId: recordId,
        payload: localUpdate,
        timestamp: new Date().toISOString(),
      });

      setRecord(prev => ({ ...prev, ...localUpdate }));
      setShowEditModal(false);
    } catch (e) {
      console.error('Failed to save record edit', e);
      toast.error('Failed to save changes. Please try again.');
      throw e;
    }
  };

  const saveInvoiceEdit = async (invoiceData) => {
    const localUpdate = {
      items: invoiceData.items || [],
      subtotal: invoiceData.subTotal ?? invoiceData.subtotal,
      total: invoiceData.total,
      customerId: invoiceData.customerId || invoiceData.customer,
      invoiceDate: invoiceData.dueDate || invoiceData.invoiceDate,
      syncStatus: 'pending',
    };

    await saveRecordEdit(localUpdate);
  };

  const saveFormEdit = async (formData) => {
    const payload = Object.fromEntries(formData.entries());
    const localUpdate = { ...payload, syncStatus: 'pending' };

    // Parse JSON strings if needed
    if (localUpdate.items && typeof localUpdate.items === 'string') {
      try {
        localUpdate.items = JSON.parse(localUpdate.items);
      } catch (e) {
        // ignore
      }
    }
    if (localUpdate.ocrData && typeof localUpdate.ocrData === 'string') {
      try {
        localUpdate.ocrData = JSON.parse(localUpdate.ocrData);
      } catch (e) {
        // ignore
      }
    }

    await saveRecordEdit(localUpdate);
  };

  return {
    showEditModal,
    setShowEditModal,
    saveRecordEdit,
    saveInvoiceEdit,
    saveFormEdit,
  };
};
