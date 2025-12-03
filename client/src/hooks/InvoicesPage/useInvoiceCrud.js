import { useState } from 'react';
import db from '../../db';
import { sanitizeForDb } from '../../utils/dbUtils';
import { enqueue, deepSanitizeAsync } from '../../services/queueService';

const makeId = () => (typeof crypto !== 'undefined' && crypto.randomUUID) 
  ? crypto.randomUUID() 
  : `client_${Date.now()}_${Math.random().toString(36).slice(2,9)}`;

/**
 * Custom hook to manage invoice CRUD operations
 * Handles create, delete with optimistic updates
 */
export const useInvoiceCrud = () => {
  const [isCreating, setIsCreating] = useState(false);
  const [deletingInvoiceId, setDeletingInvoiceId] = useState(null);

  const handleAddInvoice = async (invoiceData) => {
    setIsCreating(true);
    try {
      const localId = crypto.randomUUID();
      
      console.debug('[useInvoiceCrud] incoming invoiceData preview', 
        Object.fromEntries(Object.keys(invoiceData || {}).map(k => [k, typeof invoiceData[k]])));
      
      if (invoiceData && Object.prototype.hasOwnProperty.call(invoiceData, 'id')) {
        console.debug('[useInvoiceCrud] invoiceData.id value (preview):', invoiceData.id);
      }

      // Detect Promise-valued fields early
      try {
        const promiseFields = [];
        for (const [k, v] of Object.entries(invoiceData || {})) {
          if (v && (typeof v === 'object' || typeof v === 'function') && typeof v.then === 'function') {
            promiseFields.push(k);
          }
        }
        if (promiseFields.length) {
          console.warn('[useInvoiceCrud] Detected Promise-valued invoiceData fields:', promiseFields);
        }
      } catch (pfErr) { /* ignore diagnostic failures */ }

      // Prepare payload and ensure numeric totals and string _id
      let payload = sanitizeForDb({ 
        _id: localId, 
        ...invoiceData, 
        status: 'draft', 
        syncStatus: 'pending' 
      }, { flattenCustomer: true });

      // Deep-sanitize payload before writing to Dexie
      const cleanPayload = await deepSanitizeAsync(payload);
      
      if (!cleanPayload) {
        console.warn('[useInvoiceCrud] payload sanitized to null/undefined, aborting add', payload);
        throw new Error('Invoice payload not safe to persist');
      }

      // Write to local DB
      await db.invoices.put(cleanPayload);
      console.debug('[useInvoiceCrud] Successfully wrote invoice to local DB:', localId);

      // Enqueue for server sync
      enqueue('createInvoice', {
        invoiceId: localId,
        data: cleanPayload
      });

      setIsCreating(false);
      return cleanPayload;
    } catch (err) {
      console.error('[useInvoiceCrud] Failed to add invoice:', err);
      setIsCreating(false);
      throw err;
    }
  };

  const handleDeleteInvoice = async (invoiceId) => {
    setDeletingInvoiceId(invoiceId);
    try {
      await db.invoices.delete(invoiceId);
      console.debug('[useInvoiceCrud] Successfully deleted invoice from local DB:', invoiceId);
      
      enqueue('deleteInvoice', { invoiceId });
      
      setDeletingInvoiceId(null);
    } catch (err) {
      console.error('[useInvoiceCrud] Failed to delete invoice:', err);
      setDeletingInvoiceId(null);
      throw err;
    }
  };

  return {
    isCreating,
    setIsCreating,
    deletingInvoiceId,
    handleAddInvoice,
    handleDeleteInvoice,
  };
};
