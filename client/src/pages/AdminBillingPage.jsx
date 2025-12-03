import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowLeftIcon,
  ArrowPathIcon,
  DocumentMagnifyingGlassIcon
} from '@heroicons/react/24/outline';
import adminService from '../services/adminService';
import CenteredLoader from '../components/CenteredLoader';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';

/**
 * Admin Billing & Reconciliation Page
 * View analysis events and reconcile subscription billing
 */
export default function AdminBillingPage() {
  const { theme } = useTheme();
  const { toast } = useToast();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [reconciling, setReconciling] = useState(false);
  const [reconcileResult, setReconcileResult] = useState(null);
  
  const limit = 50;

  useEffect(() => {
    loadAnalysisEvents();
  }, [page]);

  const loadAnalysisEvents = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('[AdminBillingPage] Loading analysis events, page:', page);
      const startTime = Date.now();
      
      const result = await adminService.listAnalysisEvents(page, limit);
      
      const loadTime = Date.now() - startTime;
      console.log('[AdminBillingPage] Loaded', result.data?.length, 'events in', loadTime, 'ms');
      
      setEvents(result.data || []);
      setTotal(result.total || 0);
    } catch (err) {
      console.error('[AdminBillingPage] Failed to load analysis events:', err);
      if (err.code === 'ECONNABORTED') {
        setError('Request timed out. The server is processing too many events. Try refreshing.');
      } else {
        setError(err.response?.data?.error || 'Failed to load analysis events');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReconcile = async () => {
    if (!confirm('Reconcile all subscription billing from analysis events? This will sync usage counters.')) {
      return;
    }

    try {
      setReconciling(true);
      setReconcileResult(null);
      
      const result = await adminService.reconcileBilling();
      
      setReconcileResult(result);
      toast.success(`Reconciliation complete: ${result.reconciled} sellers updated`);
      
      // Reload events
      loadAnalysisEvents();
    } catch (err) {
      console.error('Failed to reconcile billing:', err);
      toast.error(err.response?.data?.error || 'Failed to reconcile billing');
    } finally {
      setReconciling(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const totalPages = Math.ceil(total / limit);

  if (loading && events.length === 0) {
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
                Billing & Reconciliation
              </h1>
              <p className={`mt-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                Monitor OCR analysis events and sync subscription usage
              </p>
            </div>
            
            <button
              onClick={handleReconcile}
              disabled={reconciling}
              className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              <ArrowPathIcon className={`h-5 w-5 ${reconciling ? 'animate-spin' : ''}`} />
              {reconciling ? 'Reconciling...' : 'Reconcile Billing'}
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Reconcile Result */}
        {reconcileResult && (
          <div className="mb-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <h3 className="text-sm font-medium text-green-800 dark:text-green-300 mb-2">
              Reconciliation Complete
            </h3>
            <p className="text-sm text-green-700 dark:text-green-400">
              {reconcileResult.reconciled} seller subscriptions updated
            </p>
            {reconcileResult.details && reconcileResult.details.length > 0 && (
              <div className="mt-3 space-y-1">
                {reconcileResult.details.slice(0, 5).map((detail, idx) => (
                  <p key={idx} className="text-xs text-green-600 dark:text-green-400">
                    {detail.userId}: {detail.sellerCount} seller scans, {detail.customerCount} customer scans
                  </p>
                ))}
                {reconcileResult.details.length > 5 && (
                  <p className="text-xs text-green-600 dark:text-green-400">
                    ... and {reconcileResult.details.length - 5} more
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Stats Summary */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Events</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {total.toLocaleString()}
            </p>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Current Page</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {page + 1} / {totalPages}
            </p>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Billed to Seller</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {events.filter(e => e.billedToSeller).length}
            </p>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Billed to Customer</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {events.filter(e => e.billedToCustomer).length}
            </p>
          </div>
        </div>

        {/* Analysis Events Table */}
        {events.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <DocumentMagnifyingGlassIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
              No analysis events
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              OCR analysis events will appear here
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Event ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Seller ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Record ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Billing
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {events.map((event) => (
                    <tr key={event._id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-mono text-gray-900 dark:text-white">
                          {event._id.slice(-8)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-mono text-gray-900 dark:text-white">
                          {event.sellerId?.slice(0, 12)}...
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-mono text-gray-500 dark:text-gray-400">
                          {event.recordId ? `${event.recordId.slice(0, 8)}...` : '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300 capitalize">
                          {event.docType || 'unknown'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          {event.billedToSeller && (
                            <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300">
                              Seller
                            </span>
                          )}
                          {event.billedToCustomer && (
                            <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-300">
                              Customer
                            </span>
                          )}
                          {!event.billedToSeller && !event.billedToCustomer && (
                            <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-400">
                              None
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {formatDate(event.createdAt)}
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
                Showing <span className="font-medium">{page * limit + 1}</span> to{' '}
                <span className="font-medium">{Math.min((page + 1) * limit, total)}</span> of{' '}
                <span className="font-medium">{total}</span> events
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(Math.max(0, page - 1))}
                  disabled={page === 0 || loading}
                  className="px-3 py-1 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                  disabled={page >= totalPages - 1 || loading}
                  className="px-3 py-1 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Info Section */}
        <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h3 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">
            About Billing Reconciliation
          </h3>
          <p className="text-sm text-blue-700 dark:text-blue-400">
            Analysis events track every OCR scan performed. The "Reconcile Billing" button syncs these events with subscription usage counters.
            Events are marked as "Billed to Seller" when the seller is charged for the scan (subscription), or "Billed to Customer" when the customer pays per-scan fees.
          </p>
        </div>
      </div>
    </div>
  );
}
