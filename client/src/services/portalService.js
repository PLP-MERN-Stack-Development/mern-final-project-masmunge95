import api from './api';

/**
 * Fetches all invoices assigned to the currently logged-in customer.
 * @returns {Promise<Array>} A list of invoices.
 */
/**
 * Fetch portal invoices for the logged-in customer with optional filters.
 * params: { seller, service }
 */
export const getMyInvoices = async (params = {}) => {
  try {
    const query = new URLSearchParams();
    if (params.seller) query.set('seller', params.seller);
    if (params.service) query.set('service', params.service);
    const url = `/portal/invoices${query.toString() ? `?${query.toString()}` : ''}`;
    const response = await api.get(url);
    return response.data;
  } catch (error) {
    console.error('Error fetching customer invoices:', error);
    throw error;
  }
};