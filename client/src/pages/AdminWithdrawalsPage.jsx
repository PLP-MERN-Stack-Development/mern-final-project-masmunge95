import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  CheckCircleIcon, 
  XCircleIcon, 
  ClockIcon,
  ExclamationTriangleIcon,
  ArrowLeftIcon
} from '@heroicons/react/24/outline';
import adminService from '../services/adminService';
import CenteredLoader from '../components/CenteredLoader';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';

/**
 * Admin Withdrawals Management Page
 * View, approve, and reject withdrawal requests
 * Handle manual review cases from auto-withdrawal system
 */
export default function AdminWithdrawalsPage() {
  const { theme } = useTheme();
  const { toast } = useToast();
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('pending'); // pending, approved, rejected, all
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);

  useEffect(() => {
    loadWithdrawals();
  }, [filter]);

  const loadWithdrawals = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const filterParam = filter === 'all' ? undefined : filter;
      const result = await adminService.listWithdrawalRequests(filterParam, 100, 0);
      
      setWithdrawals(result.requests || []);
    } catch (err) {
      console.error('Failed to load withdrawals:', err);
      setError(err.response?.data?.error || 'Failed to load withdrawal requests');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (request) => {
    if (!confirm(`Approve withdrawal of KES ${request.amount.toLocaleString()} for ${request.seller}?`)) {
      return;
    }

    try {
      setActionLoading(true);
      await adminService.approveWithdrawal(request.requestId);
      
      toast.success('Withdrawal approved and payout initiated');
      loadWithdrawals();
    } catch (err) {
      console.error('Failed to approve withdrawal:', err);
      toast.error(err.response?.data?.error || 'Failed to approve withdrawal');
    } finally {
      setActionLoading(false);
    }
  };

  const openRejectModal = (request) => {
    setSelectedRequest(request);
    setRejectionReason('');
    setShowRejectModal(true);
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast.warning('Please provide a rejection reason');
      return;
    }

    try {
      setActionLoading(true);
      await adminService.rejectWithdrawal(selectedRequest.requestId, rejectionReason);
      
      toast.success('Withdrawal rejected and funds refunded to wallet');
      setShowRejectModal(false);
      loadWithdrawals();
    } catch (err) {
      console.error('Failed to reject withdrawal:', err);
      toast.error(err.response?.data?.error || 'Failed to reject withdrawal');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: { color: 'yellow', text: 'Pending Review', icon: ClockIcon },
      processing: { color: 'blue', text: 'Processing', icon: ClockIcon },
      completed: { color: 'green', text: 'Completed', icon: CheckCircleIcon },
      rejected: { color: 'red', text: 'Rejected', icon: XCircleIcon },
      failed: { color: 'orange', text: 'Failed', icon: ExclamationTriangleIcon },
    };

    const badge = badges[status] || badges.pending;
    const Icon = badge.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-${badge.color}-100 text-${badge.color}-800 dark:bg-${badge.color}-500/20 dark:text-${badge.color}-300`}>
        <Icon className="h-3.5 w-3.5" />
        {badge.text}
      </span>
    );
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

  if (loading) {
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
          
          <h1 className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            Withdrawal Management
          </h1>
          <p className={`mt-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
            Review and process seller withdrawal requests
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex space-x-8">
            {[
              { value: 'pending', label: 'Pending Review' },
              { value: 'processing', label: 'Processing' },
              { value: 'completed', label: 'Completed' },
              { value: 'rejected', label: 'Rejected' },
              { value: 'all', label: 'All Requests' }
            ].map((tab) => (
              <button
                key={tab.value}
                onClick={() => setFilter(tab.value)}
                className={`
                  py-2 px-1 border-b-2 font-medium text-sm
                  ${filter === tab.value
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }
                `}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Withdrawals List */}
        {withdrawals.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <ClockIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
              No withdrawal requests
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              No {filter !== 'all' ? filter : ''} requests found.
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Request ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Seller
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Method
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {withdrawals.map((request) => (
                    <tr key={request.requestId} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-mono text-gray-900 dark:text-white">
                          {request.requestId.slice(0, 8)}...
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {request.seller}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-gray-900 dark:text-white">
                          KES {request.amount.toLocaleString()}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Net: KES {request.netAmount.toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white capitalize">
                          {request.withdrawalMethod}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(request.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {formatDate(request.createdAt)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {request.status === 'pending' && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleApprove(request)}
                              disabled={actionLoading}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium"
                            >
                              <CheckCircleIcon className="h-4 w-4" />
                              Approve
                            </button>
                            <button
                              onClick={() => openRejectModal(request)}
                              disabled={actionLoading}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium"
                            >
                              <XCircleIcon className="h-4 w-4" />
                              Reject
                            </button>
                          </div>
                        )}
                        {request.status !== 'pending' && request.processedBy && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            By: {request.processedBy === 'SYSTEM_AUTO_APPROVAL' ? 'Auto' : 'Admin'}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Withdrawal Details Expandable Section */}
        {withdrawals.length > 0 && (
          <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Security Notes & Admin Actions
            </h3>
            <div className="space-y-4">
              {withdrawals
                .filter(w => w.adminNotes || w.rejectionReason)
                .map((request) => (
                  <div key={request.requestId} className="border-l-4 border-yellow-400 pl-4 py-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {request.requestId.slice(0, 12)}... - KES {request.amount.toLocaleString()}
                        </p>
                        {request.adminNotes && (
                          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                            <span className="font-medium">Security Issues:</span> {request.adminNotes}
                          </p>
                        )}
                        {request.rejectionReason && (
                          <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                            <span className="font-medium">Rejection Reason:</span> {request.rejectionReason}
                          </p>
                        )}
                      </div>
                      {getStatusBadge(request.status)}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Reject Withdrawal Request
            </h3>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Request ID: {selectedRequest?.requestId}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Amount: KES {selectedRequest?.amount.toLocaleString()}
              </p>
              
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Rejection Reason (required)
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="e.g., Suspicious withdrawal pattern detected, Invalid M-Pesa number, etc."
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleReject}
                disabled={actionLoading || !rejectionReason.trim()}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {actionLoading ? 'Rejecting...' : 'Reject Withdrawal'}
              </button>
              <button
                onClick={() => setShowRejectModal(false)}
                disabled={actionLoading}
                className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white px-4 py-2 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
