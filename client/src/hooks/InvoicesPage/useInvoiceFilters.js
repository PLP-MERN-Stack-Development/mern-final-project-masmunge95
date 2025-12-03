import { useState, useEffect } from 'react';
import db from '../../db';
import { getInvoices as fetchInvoicesFromServer } from '../../services/invoiceService';
import { sanitizeForDb } from '../../utils/dbUtils';

/**
 * Custom hook to manage invoice filtering
 * Handles server-side filtering with debouncing
 */
export const useInvoiceFilters = () => {
  const [sellerFilter, setSellerFilter] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [serviceFilter, setServiceFilter] = useState('');
  const [serverFilteredInvoices, setServerFilteredInvoices] = useState(null);

  useEffect(() => {
    let timer;
    let cancelled = false;

    const doFetch = async () => {
      try {
        const params = {};
        if (sellerFilter) params.seller = sellerFilter;
        if (customerFilter) params.customer = customerFilter;
        if (serviceFilter) params.service = serviceFilter;

        if (Object.keys(params).length > 0) {
          const list = await fetchInvoicesFromServer(params);
          if (cancelled) return;

          // Normalize and update local DB
          for (const item of list || []) {
            try {
              const normalized = sanitizeForDb(item, { flattenCustomer: true });
              if (!normalized._id) {
                normalized._id = (typeof crypto !== 'undefined' && crypto.randomUUID) 
                  ? crypto.randomUUID() 
                  : `client_${Date.now()}_${Math.random().toString(36).slice(2,9)}`;
              }
              if (normalized._id) normalized._id = String(normalized._id);
              try { 
                await db.invoices.put(normalized); 
              } catch (_e) { /* ignore put errors */ }
            } catch (e) { /* ignore per-item */ }
          }
          setServerFilteredInvoices(list);
        }
      } catch (e) {
        console.warn('[useInvoiceFilters] server-side filter fetch failed', e);
        if (!cancelled) setServerFilteredInvoices(null);
      }
    };

    // Debounce
    timer = setTimeout(doFetch, 300);

    return () => { 
      cancelled = true; 
      if (timer) clearTimeout(timer); 
    };
  }, [sellerFilter, customerFilter, serviceFilter]);

  const clearFilters = () => {
    setSellerFilter('');
    setCustomerFilter('');
    setServiceFilter('');
    setServerFilteredInvoices(null);
  };

  return {
    sellerFilter,
    setSellerFilter,
    customerFilter,
    setCustomerFilter,
    serviceFilter,
    setServiceFilter,
    serverFilteredInvoices,
    clearFilters,
  };
};
