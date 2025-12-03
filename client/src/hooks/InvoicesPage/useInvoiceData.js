import { useState, useEffect } from 'react';
import db from '../../db';
import { firstOrUndefined } from '../../utils/dbUtils';

/**
 * Custom hook to manage invoice data from local database
 * Handles loading, enrichment with customer names, and real-time updates
 */
export const useInvoiceData = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [utilityServices, setUtilityServices] = useState([]);

  useEffect(() => {
    let mounted = true;

    // Load utility services from database
    const loadUtilityServices = async () => {
      try {
        const services = await db.utilityServices.toArray();
        if (mounted) setUtilityServices(services);
      } catch (err) {
        console.error('Failed to load utility services:', err);
      }
    };

    loadUtilityServices();

    const enrichInvoicesWithCustomers = async (invoiceList) => {
      return await Promise.all(invoiceList.map(async (inv) => {
        if (inv.customerName) return inv;
        try {
          const byId = await firstOrUndefined(db.customers.where('_id').equals(String(inv.customerId)));
          if (byId && byId.name) return { ...inv, customerName: byId.name };
        } catch (_e) { /* ignore per-item */ }
        return { ...inv, customerName: '[Deleted Customer]' };
      }));
    };

    const readLocalAndSubscribe = async () => {
      try {
        setLoading(true);
        const local = await db.invoices.toArray();
        if (!mounted) return;

        const enriched = await enrichInvoicesWithCustomers(local);
        const ordered = enriched.sort((a, b) => new Date(b.dueDate || 0) - new Date(a.dueDate || 0));
        
        setInvoices(ordered);
        setLoading(false);

        // Subscribe to DB changes
        const onChange = async () => {
          const latest = await db.invoices.toArray();
          const enrichedLatest = await enrichInvoicesWithCustomers(latest);
          const ord = enrichedLatest.sort((a, b) => new Date(b.dueDate || 0) - new Date(a.dueDate || 0));
          if (mounted) setInvoices(ord);
        };

        try {
          db.invoices.hook('created', onChange);
          db.invoices.hook('updated', onChange);
          db.invoices.hook('deleted', onChange);
        } catch (_e) { /* ignore hook attach errors */ }

      } catch (err) {
        console.error('Failed to read local invoices:', err);
        setError('Failed to load invoices.');
        setLoading(false);
      }
    };

    readLocalAndSubscribe();

    return () => { mounted = false; };
  }, []);

  const reloadLocal = async () => {
    try {
      const local = await db.invoices.toArray();
      const enriched = await Promise.all(local.map(async (inv) => {
        if (inv.customerName) return inv;
        try {
          const byId = await firstOrUndefined(db.customers.where('_id').equals(String(inv.customerId)));
          if (byId && byId.name) return { ...inv, customerName: byId.name };
        } catch (_e) { /* ignore */ }
        return { ...inv, customerName: '[Deleted Customer]' };
      }));
      const ordered = enriched.sort((a, b) => new Date(b.dueDate || 0) - new Date(a.dueDate || 0));
      setInvoices(ordered);
      setError(null);
    } catch (err) {
      console.error('Failed to reload invoices:', err);
      setError('Failed to reload invoices.');
    }
  };

  // Derive filter options from invoices
  const sellerOptions = Array.from(new Set(invoices.map(i => i.sellerName).filter(Boolean)));
  
  // Get services from utilityServices database table
  const serviceOptions = utilityServices
    .map(s => s.name && String(s.name).trim())
    .filter(Boolean)
    .sort();
  
  const customerOptions = Array.from(new Set(invoices.flatMap(i => [i.customerName, i.customerEmail].filter(Boolean))));

  return {
    invoices,
    loading,
    error,
    setError,
    reloadLocal,
    sellerOptions,
    serviceOptions,
    customerOptions,
  };
};
