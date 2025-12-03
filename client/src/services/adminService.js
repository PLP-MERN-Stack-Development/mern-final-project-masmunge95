import apiClient from './api';

/**
 * Admin service for platform management operations
 * All endpoints require admin role
 */

const adminService = {
  // Analysis Events & Billing
  listAnalysisEvents: async (page = 0, limit = 50) => {
    const response = await apiClient.get('/admin/analysis-events', {
      params: { page, limit }
    });
    return response.data;
  },

  reconcileBilling: async () => {
    const response = await apiClient.post('/admin/reconcile');
    return response.data;
  },

  // Withdrawal Management
  listWithdrawalRequests: async (status, limit = 50, offset = 0) => {
    const response = await apiClient.get('/admin/withdrawals', {
      params: { status, limit, offset }
    });
    return response.data;
  },

  approveWithdrawal: async (requestId) => {
    const response = await apiClient.post(`/admin/withdrawals/${requestId}/approve`);
    return response.data;
  },

  rejectWithdrawal: async (requestId, reason) => {
    const response = await apiClient.post(`/admin/withdrawals/${requestId}/reject`, {
      reason
    });
    return response.data;
  },

  // Wallet Management
  getSellerWallet: async (sellerId) => {
    const response = await apiClient.get(`/admin/wallets/${sellerId}`);
    return response.data;
  },

  clearPendingBalance: async (sellerId, amount = null) => {
    const response = await apiClient.post(`/admin/wallets/${sellerId}/clear-pending`, {
      amount
    });
    return response.data;
  },

  // Payment Ledger
  getPaymentLedger: async (filters = {}) => {
    const response = await apiClient.get('/admin/ledger', {
      params: {
        seller: filters.seller,
        type: filters.type,
        status: filters.status,
        startDate: filters.startDate,
        endDate: filters.endDate,
        limit: filters.limit || 100,
        offset: filters.offset || 0
      }
    });
    return response.data;
  },
};

export default adminService;
