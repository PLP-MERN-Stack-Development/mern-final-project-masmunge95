import api from './api';

/**
 * Get current user's wallet details
 */
export const getWallet = async () => {
  try {
    const response = await api.get('/seller/wallet');
    return response.data;
  } catch (error) {
    console.error('Error fetching wallet:', error);
    throw error;
  }
};

/**
 * Update withdrawal method (M-Pesa, Bank, IntaSend)
 */
export const updateWithdrawalMethod = async (method, details) => {
  try {
    const response = await api.put('/seller/wallet/withdrawal-method', {
      withdrawalMethod: method,
      withdrawalDetails: details,
    });
    return response.data;
  } catch (error) {
    console.error('Error updating withdrawal method:', error);
    throw error;
  }
};

/**
 * Request a withdrawal
 */
export const requestWithdrawal = async (amount) => {
  try {
    const response = await api.post('/seller/withdrawal/request', { amount });
    return response.data;
  } catch (error) {
    console.error('Error requesting withdrawal:', error);
    throw error;
  }
};

/**
 * Get withdrawal requests history
 */
export const getWithdrawalRequests = async (limit = 10) => {
  try {
    const response = await api.get(`/seller/withdrawal/requests?limit=${limit}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching withdrawal requests:', error);
    throw error;
  }
};

/**
 * Cancel a pending withdrawal request
 */
export const cancelWithdrawalRequest = async (requestId) => {
  try {
    const response = await api.post(`/seller/withdrawal/requests/${requestId}/cancel`);
    return response.data;
  } catch (error) {
    console.error('Error canceling withdrawal:', error);
    throw error;
  }
};

/**
 * Get transaction history (payment ledger)
 */
export const getTransactionHistory = async (filters = {}) => {
  try {
    const params = new URLSearchParams();
    if (filters.type) params.append('type', filters.type);
    if (filters.status) params.append('status', filters.status);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.limit) params.append('limit', filters.limit);
    if (filters.page) params.append('page', filters.page);
    
    const queryString = params.toString();
    const url = queryString ? `/seller/transactions?${queryString}` : '/seller/transactions';
    
    const response = await api.get(url);
    return response.data;
  } catch (error) {
    console.error('Error fetching transaction history:', error);
    throw error;
  }
};
