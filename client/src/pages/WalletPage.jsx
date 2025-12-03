import { useState, useEffect } from 'react';
import { useAuth, useUser } from '@clerk/clerk-react';
import { Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import CenteredLoader from '../components/CenteredLoader';
import db from '../db';
import * as walletService from '../services/walletService';
import { enqueue } from '../services/queueService';

const WalletPage = () => {
  const { isLoaded } = useAuth();
  const { user } = useUser();
  const { theme } = useTheme();
  const { toast } = useToast();
  const [wallet, setWallet] = useState(null);
  const [withdrawalRequests, setWithdrawalRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [withdrawalMethod, setWithdrawalMethod] = useState('mpesa');
  const [withdrawalDetails, setWithdrawalDetails] = useState({
    mpesaNumber: '',
    bankName: '',
    accountNumber: '',
    accountName: '',
    branchCode: '',
  });
  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  const [showWithdrawalForm, setShowWithdrawalForm] = useState(false);

  useEffect(() => {
    if (!isLoaded || !user) return;
    loadWalletFromLocal();
  }, [isLoaded, user]);

  const loadWalletFromLocal = async () => {
    try {
      setLoading(true);
      const sellerId = user.id;
      
      // Try to get wallet from local DB first
      const localWallet = await db.wallets.where('seller').equals(sellerId).first();
      
      if (localWallet) {
        setWallet(localWallet);
        setWithdrawalMethod(localWallet.withdrawalMethod || 'mpesa');
        setWithdrawalDetails(localWallet.withdrawalDetails || {});
      }

      // Load withdrawal requests from local DB
      const localRequests = await db.withdrawalRequests
        .where('seller')
        .equals(sellerId)
        .reverse()
        .limit(10)
        .toArray();
      setWithdrawalRequests(localRequests);

      // Fetch fresh data from server and update local DB
      try {
        const serverWallet = await walletService.getWallet();
        if (serverWallet.success && serverWallet.wallet) {
          const walletData = {
            ...serverWallet.wallet,
            seller: sellerId,
            syncStatus: 'synced'
          };
          
          // Update or add to local DB - preserve existing id if present
          if (localWallet?.id) {
            walletData.id = localWallet.id;
          }
          await db.wallets.put(walletData);
          setWallet(walletData);
          setWithdrawalMethod(walletData.withdrawalMethod || 'mpesa');
          setWithdrawalDetails(walletData.withdrawalDetails || {});
        }

        // Fetch withdrawal requests
        const serverRequests = await walletService.getWithdrawalRequests(10);
        if (serverRequests.success && serverRequests.requests) {
          // Update local DB
          for (const req of serverRequests.requests) {
            await db.withdrawalRequests.put({
              ...req,
              syncStatus: 'synced'
            });
          }
          setWithdrawalRequests(serverRequests.requests);
        }
      } catch (serverError) {
        console.warn('Server fetch failed, using cached data:', serverError);
        // If server fails, we already have local data loaded
        if (!localWallet) {
          toast.error('Failed to load wallet data. Please check your connection.');
        }
      }
    } catch (error) {
      console.error('Error loading wallet:', error);
      toast.error('Failed to load wallet');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveWithdrawalMethod = async () => {
    try {
      const sellerId = user.id;
      
      // Optimistically update local DB
      const updatedWallet = {
        ...(wallet || {}),
        seller: sellerId,
        withdrawalMethod,
        withdrawalDetails,
        syncStatus: 'pending'
      };
      
      await db.wallets.put(updatedWallet);
      setWallet(updatedWallet);

      // Queue the update for server sync
      await enqueue('wallets', sellerId, 'update', {
        withdrawalMethod,
        withdrawalDetails
      });

      toast.success('Withdrawal method updated successfully');

      // Try to sync with server immediately
      try {
        const data = await walletService.updateWithdrawalMethod(withdrawalMethod, withdrawalDetails);
        if (data.success) {
          const syncedWallet = { ...data.wallet, seller: sellerId, syncStatus: 'synced' };
          await db.wallets.put(syncedWallet);
          setWallet(syncedWallet);
        }
      } catch (serverError) {
        console.warn('Server update failed, queued for later sync:', serverError);
      }
    } catch (error) {
      console.error('Error updating withdrawal method:', error);
      toast.error('Failed to update withdrawal method');
    }
  };

  const handleRequestWithdrawal = async () => {
    try {
      const amount = parseFloat(withdrawalAmount);
      if (isNaN(amount) || amount <= 0) {
        toast.error('Please enter a valid amount');
        return;
      }

      if (amount < wallet?.minimumWithdrawal) {
        toast.error(`Minimum withdrawal is ${wallet.currency} ${wallet.minimumWithdrawal}`);
        return;
      }

      if (amount > wallet?.availableBalance) {
        toast.error('Insufficient balance');
        return;
      }

      // Create withdrawal request
      const requestId = crypto.randomUUID();
      const newRequest = {
        requestId,
        seller: user.id,
        amount,
        status: 'pending',
        createdAt: new Date().toISOString(),
        syncStatus: 'pending'
      };

      // Optimistically add to local DB
      await db.withdrawalRequests.put(newRequest);
      setWithdrawalRequests([newRequest, ...withdrawalRequests]);

      // Update wallet balance optimistically
      const updatedWallet = {
        ...wallet,
        availableBalance: wallet.availableBalance - amount,
        syncStatus: 'pending'
      };
      await db.wallets.put(updatedWallet);
      setWallet(updatedWallet);

      // Queue for server sync
      await enqueue('withdrawalRequests', requestId, 'create', newRequest);

      toast.success('Withdrawal requested successfully');
      setWithdrawalAmount('');
      setShowWithdrawalForm(false);

      // Try immediate server sync
      try {
        const data = await walletService.requestWithdrawal(amount);
        if (data.success) {
          // Update with server response
          await loadWalletFromLocal();
        }
      } catch (serverError) {
        console.warn('Server request failed, queued for later sync:', serverError);
      }
    } catch (error) {
      console.error('Error requesting withdrawal:', error);
      toast.error('Failed to request withdrawal');
    }
  };

  const handleCancelWithdrawal = async (requestId) => {
    if (!confirm('Are you sure you want to cancel this withdrawal request?')) {
      return;
    }

    try {
      // Optimistically update local DB
      await db.withdrawalRequests.where('requestId').equals(requestId).modify({ status: 'cancelled', syncStatus: 'pending' });
      setWithdrawalRequests(requests => 
        requests.map(r => r.requestId === requestId ? { ...r, status: 'cancelled' } : r)
      );

      // Queue for server sync
      await enqueue('withdrawalRequests', requestId, 'update', { status: 'cancelled' });

      toast.success('Withdrawal cancelled successfully');

      // Try immediate server sync
      try {
        const data = await walletService.cancelWithdrawalRequest(requestId);
        if (data.success) {
          await loadWalletFromLocal();
        }
      } catch (serverError) {
        console.warn('Server cancellation failed, queued for later sync:', serverError);
      }
    } catch (error) {
      console.error('Error cancelling withdrawal:', error);
      toast.error('Failed to cancel withdrawal');
    }
  };

  if (loading) {
    return <CenteredLoader message="Loading wallet..." />;
  }

  const textColor = theme === 'dark' ? 'text-white' : 'text-gray-900';
  const cardBg = theme === 'dark' ? 'bg-gray-800' : 'bg-white';
  const borderColor = theme === 'dark' ? 'border-gray-700' : 'border-gray-200';

  return (
    <div className={`container mx-auto px-4 py-8 ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'} min-h-screen`}>
      {/* Back to Dashboard Link */}
      <div className="mb-4">
        <Link
          to="/dashboard"
          className={`inline-flex items-center gap-2 text-sm font-medium transition-colors ${
            theme === 'dark'
              ? 'text-blue-500 hover:text-blue-600'
              : 'text-blue-600 hover:text-blue-700'
          }`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          Back to Dashboard
        </Link>
      </div>
      
      <h1 className={`text-3xl font-bold mb-8 ${textColor}`}>My Wallet</h1>

      {/* Wallet Balance */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className={`${cardBg} rounded-lg shadow-md p-6 border ${borderColor}`}>
          <h3 className={`text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Available Balance</h3>
          <p className="text-3xl font-bold text-green-600 dark:text-green-400">
            {wallet?.currency || 'KES'} {wallet?.availableBalance?.toLocaleString() || 0}
          </p>
          <p className={`text-sm mt-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Ready to withdraw</p>
        </div>

        <div className={`${cardBg} rounded-lg shadow-md p-6 border ${borderColor}`}>
          <h3 className={`text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Pending Balance</h3>
          <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
            {wallet?.currency || 'KES'} {wallet?.pendingBalance?.toLocaleString() || 0}
          </p>
          <p className={`text-sm mt-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Clearing in 7 days</p>
        </div>

        <div className={`${cardBg} rounded-lg shadow-md p-6 border ${borderColor}`}>
          <h3 className={`text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Total Earnings</h3>
          <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
            {wallet?.currency || 'KES'} {wallet?.totalEarnings?.toLocaleString() || 0}
          </p>
          <p className={`text-sm mt-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Lifetime earnings</p>
        </div>
      </div>

      {/* Withdrawal Button */}
      {!showWithdrawalForm && (
        <div className="mb-8">
          <button
            onClick={() => setShowWithdrawalForm(true)}
            disabled={!wallet?.availableBalance || wallet.availableBalance < (wallet.minimumWithdrawal || 100)}
            className="bg-white text-black px-6 py-3 rounded-lg hover:bg-gray-100 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors border border-gray-300"
          >
            Request Withdrawal
          </button>
          {wallet?.availableBalance < (wallet?.minimumWithdrawal || 100) && (
            <p className={`text-sm mt-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
              Minimum withdrawal: {wallet?.currency || 'KES'} {wallet?.minimumWithdrawal || 100}
            </p>
          )}
        </div>
      )}

      {/* Withdrawal Form */}
      {showWithdrawalForm && (
        <div className={`${cardBg} rounded-lg shadow-md p-6 mb-8 border ${borderColor}`}>
          <h2 className={`text-xl font-bold mb-4 ${textColor}`}>Request Withdrawal</h2>
          
          <div className="mb-4">
            <label className={`block text-sm font-medium mb-2 ${textColor}`}>Amount</label>
            <input
              type="number"
              value={withdrawalAmount}
              onChange={(e) => setWithdrawalAmount(e.target.value)}
              placeholder={`Min: ${wallet?.minimumWithdrawal || 100}`}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'
              }`}
            />
            <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
              Available: {wallet?.currency || 'KES'} {wallet?.availableBalance?.toLocaleString() || 0}
            </p>
          </div>

          <div className="mb-4">
            <p className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
              Platform fee (2%): {wallet?.currency || 'KES'} {(parseFloat(withdrawalAmount || 0) * 0.02).toFixed(2)}
            </p>
            <p className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
              Processing fee: {wallet?.currency || 'KES'} {withdrawalMethod === 'mpesa' ? '50' : '100'}
            </p>
            <p className={`text-sm font-bold mt-2 ${textColor}`}>
              You will receive: {wallet?.currency || 'KES'}{' '}
              {(
                parseFloat(withdrawalAmount || 0) -
                parseFloat(withdrawalAmount || 0) * 0.02 -
                (withdrawalMethod === 'mpesa' ? 50 : 100)
              ).toFixed(2)}
            </p>
          </div>

          <div className="flex gap-4">
            <button
              onClick={handleRequestWithdrawal}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Submit Request
            </button>
            <button
              onClick={() => {
                setShowWithdrawalForm(false);
                setWithdrawalAmount('');
              }}
              className={`px-6 py-2 rounded-lg transition-colors ${
                theme === 'dark' 
                  ? 'bg-gray-700 text-white hover:bg-gray-600' 
                  : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
              }`}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Withdrawal Method Settings */}
      <div className={`${cardBg} rounded-lg shadow-md p-6 mb-8 border ${borderColor}`}>
        <h2 className={`text-xl font-bold mb-4 ${textColor}`}>Withdrawal Method</h2>

        <div className="mb-4">
          <label className={`block text-sm font-medium mb-2 ${textColor}`}>Method</label>
          <select
            value={withdrawalMethod}
            onChange={(e) => setWithdrawalMethod(e.target.value)}
            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
              theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'
            }`}
          >
            <option value="mpesa">M-Pesa</option>
            <option value="bank">Bank Transfer</option>
            <option value="intasend_wallet">IntaSend Wallet</option>
          </select>
        </div>

        {withdrawalMethod === 'mpesa' && (
          <div className="mb-4">
            <label className={`block text-sm font-medium mb-2 ${textColor}`}>M-Pesa Number</label>
            <input
              type="text"
              value={withdrawalDetails.mpesaNumber || ''}
              onChange={(e) =>
                setWithdrawalDetails({ ...withdrawalDetails, mpesaNumber: e.target.value })
              }
              placeholder="254712345678"
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'
              }`}
            />
          </div>
        )}

        {withdrawalMethod === 'bank' && (
          <>
            <div className="mb-4">
              <label className={`block text-sm font-medium mb-2 ${textColor}`}>Bank Name</label>
              <input
                type="text"
                value={withdrawalDetails.bankName || ''}
                onChange={(e) =>
                  setWithdrawalDetails({ ...withdrawalDetails, bankName: e.target.value })
                }
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                  theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'
                }`}
              />
            </div>
            <div className="mb-4">
              <label className={`block text-sm font-medium mb-2 ${textColor}`}>Account Number</label>
              <input
                type="text"
                value={withdrawalDetails.accountNumber || ''}
                onChange={(e) =>
                  setWithdrawalDetails({ ...withdrawalDetails, accountNumber: e.target.value })
                }
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                  theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'
                }`}
              />
            </div>
            <div className="mb-4">
              <label className={`block text-sm font-medium mb-2 ${textColor}`}>Account Name</label>
              <input
                type="text"
                value={withdrawalDetails.accountName || ''}
                onChange={(e) =>
                  setWithdrawalDetails({ ...withdrawalDetails, accountName: e.target.value })
                }
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                  theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'
                }`}
              />
            </div>
          </>
        )}

        {withdrawalMethod === 'intasend_wallet' && (
          <div className="mb-4">
            <label className={`block text-sm font-medium mb-2 ${textColor}`}>Wallet Email</label>
            <input
              type="email"
              value={withdrawalDetails.walletEmail || ''}
              onChange={(e) =>
                setWithdrawalDetails({ ...withdrawalDetails, walletEmail: e.target.value })
              }
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'
              }`}
            />
          </div>
        )}

        <button
          onClick={handleSaveWithdrawalMethod}
          className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors"
        >
          Update Method
        </button>
      </div>

      {/* Withdrawal Requests */}
      <div className={`${cardBg} rounded-lg shadow-md p-6 border ${borderColor}`}>
        <h2 className={`text-xl font-bold mb-4 ${textColor}`}>Withdrawal Requests</h2>

        {withdrawalRequests.length === 0 ? (
          <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}>No withdrawal requests yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={`border-b ${borderColor}`}>
                  <th className={`text-left py-3 px-4 ${textColor}`}>Request ID</th>
                  <th className={`text-left py-3 px-4 ${textColor}`}>Amount</th>
                  <th className={`text-left py-3 px-4 ${textColor}`}>Net Amount</th>
                  <th className={`text-left py-3 px-4 ${textColor}`}>Status</th>
                  <th className={`text-left py-3 px-4 ${textColor}`}>Date</th>
                  <th className={`text-left py-3 px-4 ${textColor}`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {withdrawalRequests.map((request) => (
                  <tr key={request.requestId} className={`border-b ${borderColor} ${theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}>
                    <td className={`py-3 px-4 font-mono text-sm ${textColor}`}>{request.requestId}</td>
                    <td className={`py-3 px-4 ${textColor}`}>
                      {request.currency || 'KES'} {request.amount?.toLocaleString() || 0}
                    </td>
                    <td className={`py-3 px-4 ${textColor}`}>
                      {request.currency || 'KES'} {request.netAmount?.toLocaleString() || 0}
                    </td>
                    <td className={`py-3 px-4 ${textColor}`}>
                      <span
                        className={`px-2 py-1 rounded text-sm ${
                          request.status === 'completed'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                            : request.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                            : request.status === 'processing'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                            : request.status === 'rejected' || request.status === 'failed'
                            ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {request.status}
                      </span>
                    </td>
                    <td className={`py-3 px-4 ${textColor}`}>
                      {new Date(request.createdAt).toLocaleDateString()}
                    </td>
                    <td className={`py-3 px-4 ${textColor}`}>
                      {request.status === 'pending' && (
                        <button
                          onClick={() => handleCancelWithdrawal(request.requestId)}
                          className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 text-sm transition-colors"
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default WalletPage;
