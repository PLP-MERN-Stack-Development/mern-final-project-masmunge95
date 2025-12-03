import { useState, useEffect } from 'react';
import { getCustomers } from '../../services/customerService';

/**
 * Custom hook to manage customer data fetching and state
 */
export const useCustomerData = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getCustomers();
        setCustomers(data);
      } catch (err) {
        console.error('[useCustomerData] Error fetching customers:', err);
        setError(err.message || 'Failed to fetch customers');
      } finally {
        setLoading(false);
      }
    };

    fetchCustomers();
  }, []);

  return {
    customers,
    loading,
    error,
  };
};
