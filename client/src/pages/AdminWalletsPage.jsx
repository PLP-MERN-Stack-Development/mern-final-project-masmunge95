import { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowLeftIcon,
  MagnifyingGlassIcon,
  WalletIcon,
  BanknotesIcon
} from '@heroicons/react/24/outline';
import adminService from '../services/adminService';
import CenteredLoader from '../components/CenteredLoader';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';

/**
 * Admin Wallet Management Page
 * View seller wallets and perform manual operations
 */
export default function AdminWalletsPage() {
  const { theme } = useTheme();
  const { toast } = useToast();
  const [sellerId, setSellerId] = useState('');
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [clearPendingLoading, setClearPendingLoading] = useState(false);

  const searchWallet = async () => {
    if (!sellerId.trim()) {
      setError('Please enter a seller ID');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const result = await adminService.getSellerWallet(sellerId.trim());
      setWallet(result.wallet);
    } catch (err) {
      console.error('Failed to fetch wallet:', err);
      setError(err.response?.data?.error || 'Wallet not found');
      setWallet(null);
    } finally {
      setLoading(false);
    }
  };

  const handleClearPending = async () => {
    if (!wallet) return;

    const amount = wallet.pendingBalance;
    if (amount <= 0) {
      toast.warning('No pending balance to clear');
      return;
    }

    if (!confirm(`Clear pending balance of KES ${amount.toLocaleString()} to available for ${wallet.seller}?`)) {
      return;
    }

    try {
      setClearPendingLoading(true);
      
      await adminService.clearPendingBalance(wallet.seller);
      
      toast.success('Pending balance cleared successfully');
      
      // Refresh wallet data
      searchWallet();
    } catch (err) {
      console.error('Failed to clear pending balance:', err);
      toast.error(err.response?.data?.error || 'Failed to clear pending balance');
    } finally {
      setClearPendingLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return `KES ${amount.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link to="/admin" className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:underline dark:text-blue-400 mb-4">
            <ArrowLeftIcon className="h-4 w-4" />
            Back to Admin Dashboard
          </Link>
          
          <h1 className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            Wallet Management
          </h1>
          <p className={`mt-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
            View and manage seller wallet balances
          </p>
        </div>

        {/* Search Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Seller ID (Clerk User ID)
          </label>
          <div className="flex gap-3">
            <input
              type="text"
              value={sellerId}
              onChange={(e) => setSellerId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchWallet()}
              placeholder="user_xxxxxxxxxxxxx"
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <button
              onClick={searchWallet}
              disabled={loading}
              className="inline-flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              <MagnifyingGlassIcon className="h-5 w-5" />
              Search
            </button>
          </div>
          
          {error && (
            <div className="mt-3 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}
        </div>

        {/* Loading State */}
        {loading && <CenteredLoader />}

        {/* Wallet Details */}
        {!loading && wallet && (
          <div className="space-y-6">
            {/* Balance Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-green-800 dark:text-green-300">
                    Available Balance
                  </p>
                  <WalletIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                  {formatCurrency(wallet.availableBalance)}
                </p>
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
                    Pending Balance
                  </p>
                  <BanknotesIcon className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                </div>
                <p className="text-2xl font-bold text-yellow-900 dark:text-yellow-100">
                  {formatCurrency(wallet.pendingBalance)}
                </p>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-300">
                    Held Balance
                  </p>
                  <BanknotesIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {formatCurrency(wallet.heldBalance || 0)}
                </p>
              </div>
            </div>

            {/* Wallet Info */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Wallet Information
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Seller ID</p>
                  <p className="mt-1 text-sm font-mono text-gray-900 dark:text-white">
                    {wallet.seller}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Status</p>
                  <p className="mt-1">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      wallet.status === 'active' 
                        ? 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300'
                        : 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300'
                    }`}>
                      {wallet.status === 'active' ? 'Active' : wallet.status}
                    </span>
                  </p>
                </div>

                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Withdrawal Method</p>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white capitalize">
                    {wallet.withdrawalMethod || 'Not set'}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Created</p>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white">
                    {formatDate(wallet.createdAt)}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Last Updated</p>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white">
                    {formatDate(wallet.updatedAt)}
                  </p>
                </div>

                {wallet.withdrawalDetails && (
                  <div className="md:col-span-2">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Withdrawal Details</p>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">
                      {wallet.withdrawalMethod === 'mpesa' 
                        ? `M-Pesa: ${wallet.withdrawalDetails.phoneNumber || 'Not set'}`
                        : `Bank: ${wallet.withdrawalDetails.accountNumber || 'Not set'} (${wallet.withdrawalDetails.bankName || 'Not set'})`
                      }
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Admin Actions */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Admin Actions
              </h3>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      Clear Pending Balance
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Move {formatCurrency(wallet.pendingBalance)} from pending to available
                    </p>
                  </div>
                  <button
                    onClick={handleClearPending}
                    disabled={clearPendingLoading || wallet.pendingBalance <= 0}
                    className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    {clearPendingLoading ? 'Clearing...' : 'Clear Pending'}
                  </button>
                </div>

                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-sm text-blue-800 dark:text-blue-300">
                    <strong>Note:</strong> Pending balances are automatically cleared after 7 days or when invoices are marked as received.
                    Use manual clearing only when necessary.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && !wallet && !error && (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <WalletIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
              No wallet loaded
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Enter a seller ID to view their wallet details
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
