import { useState, useEffect } from 'react';
import db from '../../db';

/**
 * useRecordDetail - Load and enrich record data with related entities
 * Handles loading record, service name, and customer name
 */
export const useRecordDetail = (recordId) => {
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [serviceName, setServiceName] = useState(null);
  const [customerName, setCustomerName] = useState(null);

  useEffect(() => {
    let mounted = true;

    const loadRecord = async () => {
      try {
        // Load the record
        let rec = null;
        try {
          rec = await db.records.where('_id').equals(String(recordId)).first();
        } catch (e) {
          try {
            rec = await db.records.get(recordId);
          } catch (e2) {
            rec = null;
          }
        }

        if (!mounted) return;

        // Enrich record with customer name if missing but customerId exists
        if (rec && !rec.customerName && rec.customerId) {
          try {
            const customer = await db.customers.where('_id').equals(String(rec.customerId)).first();
            if (customer && customer.name) {
              rec = { ...rec, customerName: customer.name };
            }
          } catch (e) {
            console.debug('Could not load customer for customerId', e);
          }
        }

        setRecord(rec || null);

        // Fetch service name if service ID exists
        if (rec && rec.service) {
          try {
            const service = await db.utilityServices.where('_id').equals(String(rec.service)).first();
            if (mounted && service) {
              setServiceName(service.name);
            }
          } catch (e) {
            console.debug('Could not load service name', e);
          }
        }

        // Fetch customer name if uploaderCustomerId exists
        if (rec && rec.uploaderCustomerId && !rec.uploaderCustomerName) {
          try {
            // Fallback: Try to match uploaderCustomerId against customer records
            const customers = await db.customers.toArray();
            const matchedCustomer = customers.find(c =>
              Array.isArray(c.users) && c.users.includes(String(rec.uploaderCustomerId))
            );
            if (mounted && matchedCustomer) {
              setCustomerName(matchedCustomer.name);
            }
          } catch (e) {
            console.debug('Could not load customer name', e);
          }
        } else if (rec && rec.uploaderCustomerName) {
          // Use the stored uploader name from the record
          setCustomerName(rec.uploaderCustomerName);
        }
      } catch (e) {
        console.error('Failed to load record', e);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadRecord();

    return () => {
      mounted = false;
    };
  }, [recordId]);

  const reloadRecord = async () => {
    try {
      let rec = null;
      try {
        rec = await db.records.where('_id').equals(String(recordId)).first();
      } catch (e) {
        try {
          rec = await db.records.get(recordId);
        } catch (e2) {
          rec = null;
        }
      }
      setRecord(rec || null);
    } catch (e) {
      console.error('Failed to reload record', e);
    }
  };

  return {
    record,
    setRecord,
    loading,
    serviceName,
    customerName,
    reloadRecord,
  };
};
