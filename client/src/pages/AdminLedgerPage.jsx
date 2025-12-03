import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowLeftIcon,
  FunnelIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline';
import adminService from '../services/adminService';
import CenteredLoader from '../components/CenteredLoader';
import { useTheme } from '../context/ThemeContext';

/**
 * Admin Payment Ledger Page
 * View and filter all payment transactions
 */
export default function AdminLedgerPage() {
  const { theme } = useTheme();
  const [entries, setEntries] = useState([]);
  const [summary, setSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    type: '',
    status: '',
    seller: '',
    startDate: '',
    endDate: '',
    limit: 100,
    offset: 0
  });
  const [total, setTotal] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadLedger();
  }, [filters.offset]);

  const loadLedger = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('[AdminLedgerPage] Loading ledger with filters:', filters);
      const result = await adminService.getPaymentLedger(filters);
      console.log('[AdminLedgerPage] Ledger result:', result);
      
      setEntries(result.entries || []);
      setSummary(result.summary || []);
      setTotal(result.pagination?.total || 0);
    } catch (err) {
      console.error('[AdminLedgerPage] Failed to load payment ledger:', err);
      console.error('[AdminLedgerPage] Error response:', err.response);
      
      if (err.response?.status === 403) {
        setError('Access denied. Admin role required. Check your Clerk user metadata.');
      } else {
        setError(err.response?.data?.error || err.message || 'Failed to load payment ledger');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      offset: 0 // Reset to first page when filters change
    }));
  };

  const applyFilters = () => {
    loadLedger();
    setShowFilters(false);
  };

  const clearFilters = () => {
    setFilters({
      type: '',
      status: '',
      seller: '',
      startDate: '',
      endDate: '',
      limit: 100,
      offset: 0
    });
    setShowFilters(false);
  };

  const getTypeBadge = (type) => {
    const types = {
      'invoice_payment': { color: 'green', text: 'Invoice Payment' },
      'withdrawal': { color: 'blue', text: 'Withdrawal' },
      'subscription': { color: 'purple', text: 'Subscription' },
      'refund': { color: 'orange', text: 'Refund' },
      'other': { color: 'gray', text: 'Other' },
    };

    const badge = types[type] || types.other;

    return (
      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full bg-${badge.color}-100 text-${badge.color}-800 dark:bg-${badge.color}-500/20 dark:text-${badge.color}-300`}>
        {badge.text}
      </span>
    );
  };

  const getStatusBadge = (status) => {
    const statuses = {
      'completed': { color: 'green', text: 'Completed' },
      'pending': { color: 'yellow', text: 'Pending' },
      'failed': { color: 'red', text: 'Failed' },
      'rejected': { color: 'red', text: 'Rejected' },
    };

    const badge = statuses[status] || statuses.pending;

    return (
      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full bg-${badge.color}-100 text-${badge.color}-800 dark:bg-${badge.color}-500/20 dark:text-${badge.color}-300`}>
        {badge.text}
      </span>
    );
  };

  const formatCurrency = (amount) => {
    return `KES ${amount.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const totalPages = Math.ceil(total / filters.limit);
  const currentPage = Math.floor(filters.offset / filters.limit);

  if (loading && entries.length === 0) {
    return <CenteredLoader />;
  }

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link to="/admin" className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:underline dark:text-blue-400 mb-4">
            <ArrowLeftIcon className="h-4 w-4" />
            Back to Admin Dashboard
          </Link>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                Payment Ledger
              </h1>
              <p className={`mt-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                View all platform transactions and financial activity
              </p>
            </div>
            
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 font-medium"
            >
              <FunnelIcon className="h-5 w-5" />
              {showFilters ? 'Hide' : 'Show'} Filters
            </button>
          </div>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="mb-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Filter Transactions
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Transaction Type
                </label>
                <select
                  value={filters.type}
                  onChange={(e) => handleFilterChange('type', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">All Types</option>
                  <option value="invoice_payment">Invoice Payment</option>
                  <option value="withdrawal">Withdrawal</option>
                  <option value="subscription">Subscription</option>
                  <option value="refund">Refund</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Status
                </label>
                <select
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">All Statuses</option>
                  <option value="completed">Completed</option>
                  <option value="pending">Pending</option>
                  <option value="failed">Failed</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Seller ID
                </label>
                <input
                  type="text"
                  value={filters.seller}
                  onChange={(e) => handleFilterChange('seller', e.target.value)}
                  placeholder="user_xxxxx..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => handleFilterChange('startDate', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  End Date
                </label>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => handleFilterChange('endDate', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={applyFilters}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
              >
                Apply Filters
              </button>
              <button
                onClick={clearFilters}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 font-medium"
              >
                Clear Filters
              </button>
            </div>
          </div>
        )}

        {/* Summary Stats */}
        {summary.length > 0 && (
          <div className="mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {summary.map((item) => (
              <div key={item._id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">
                  {item._id.replace('_', ' ')}
                </p>
                <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">
                  {formatCurrency(item.totalAmount)}
                </p>
                <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  {item.count} transaction{item.count !== 1 ? 's' : ''}
                </div>
                <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Fees: {formatCurrency(item.totalPlatformFees + item.totalProcessingFees)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Ledger Table */}
        {entries.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
              No transactions found
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Try adjusting your filters or check back later
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Transaction ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Fees
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {entries.map((entry) => (
                    <tr key={entry.transactionId} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-mono text-gray-900 dark:text-white">
                          {entry.transactionId.slice(0, 12)}...
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getTypeBadge(entry.type)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-gray-900 dark:text-white">
                          {formatCurrency(entry.amount)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">
                          Platform: {formatCurrency(entry.platformFee || 0)}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Processing: {formatCurrency(entry.processingFee || 0)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(entry.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {formatDate(entry.transactionDate)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="bg-gray-50 dark:bg-gray-900/50 px-6 py-4 flex items-center justify-between border-t border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-700 dark:text-gray-300">
                Showing <span className="font-medium">{filters.offset + 1}</span> to{' '}
                <span className="font-medium">{Math.min(filters.offset + filters.limit, total)}</span> of{' '}
                <span className="font-medium">{total}</span> transactions
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => handleFilterChange('offset', Math.max(0, filters.offset - filters.limit))}
                  disabled={filters.offset === 0 || loading}
                  className="px-3 py-1 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => handleFilterChange('offset', Math.min(total - filters.limit, filters.offset + filters.limit))}
                  disabled={filters.offset + filters.limit >= total || loading}
                  className="px-3 py-1 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
