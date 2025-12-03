import api from './api';

export const getCustomers = async () => {
  try {
    const response = await api.get('/customers');
    return response.data || [];
  } catch (error) {
    // Axios treats non-2xx statuses as errors. If the server returned 304
    // Not Modified (no body), it will appear here as error.response.status === 304.
    if (error && error.response && error.response.status === 304) {
      console.warn('[customerService] Received 304 Not Modified for /customers — retrying with cache-bust');
      try {
        const retry = await api.get(`/customers?_cacheBust=${Date.now()}`, { headers: { 'Cache-Control': 'no-cache' } });
        return retry.data || [];
      } catch (retryErr) {
        console.warn('[customerService] Retry after 304 failed:', retryErr);
        // Return a safe empty array so callers don't break when no body is present
        return [];
      }
    }

    console.error('Error fetching customers:', error);
    throw error;
  }
};

export const createCustomer = async (customerData) => {
  try {
    const response = await api.post('/customers', customerData);
    return response.data;
  } catch (error) {
    console.error('Error creating customer:', error);
    throw error;
  }
};

export const deleteCustomer = async (customerId) => {
  try {
    const response = await api.delete(`/customers/${customerId}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting customer:', error);
    throw error;
  }
};
