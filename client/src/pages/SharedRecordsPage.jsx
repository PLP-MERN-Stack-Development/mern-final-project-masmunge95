import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useUser } from '@clerk/clerk-react';
import api from '../services/api';
import CenteredLoader from '../components/CenteredLoader';
import Button from '../components/Button';

const SharedRecordsPage = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { user } = useUser();
  const isSeller = user?.publicMetadata?.role === 'seller';
  const [activeTab, setActiveTab] = useState('received'); // 'received' or 'sent'
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadRecords();
  }, [activeTab]);

  const loadRecords = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const endpoint = activeTab === 'received' 
        ? '/records/shared-with-me'
        : '/records/shared-by-me';
      
      // api service automatically handles authentication via interceptor
      const response = await api.get(endpoint);
      
      setRecords(response.data.records || []);
    } catch (err) {
      console.error('Error loading shared records:', err);
      setError(err.response?.data?.message || 'Failed to load records');
    } finally {
      setLoading(false);
    }
  };

  const getVerificationStatus = (record) => {
    if (!record.verifications || record.verifications.length === 0) {
      return { status: 'pending', label: 'Pending Review', color: 'text-yellow-600' };
    }
    
    const hasDisputed = record.verifications.some(v => v.status === 'disputed');
    const allVerified = record.verifications.every(v => v.status === 'verified');
    
    if (hasDisputed) {
      return { status: 'disputed', label: 'Disputed', color: 'text-red-600' };
    }
    if (allVerified) {
      return { status: 'verified', label: 'Verified', color: 'text-green-600' };
    }
    return { status: 'pending', label: 'Pending Review', color: 'text-yellow-600' };
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getRecordTypeLabel = (recordType) => {
    const types = {
      'receipt': 'Receipt',
      'invoice': 'Invoice',
      'utility': 'Utility Reading',
      'inventory': 'Inventory',
      'customer-record': 'Customer Record',
      'business-record': 'Business Record'
    };
    return types[recordType] || recordType;
  };

  if (loading) {
    return <CenteredLoader message="Loading shared records..." />;
  }

  const bgColor = theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50';
  const cardBg = theme === 'dark' ? 'bg-gray-800' : 'bg-white';
  const textColor = theme === 'dark' ? 'text-white' : 'text-gray-900';
  const textSecondary = theme === 'dark' ? 'text-gray-400' : 'text-gray-600';
  const borderColor = theme === 'dark' ? 'border-gray-700' : 'border-gray-200';

  return (
    <div className={`min-h-screen ${bgColor} py-8`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back to Dashboard Link */}
        <div className="mb-2">
          <Link to={isSeller ? '/seller-dashboard' : '/customer-dashboard'} className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:underline dark:text-blue-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" /></svg>
            Back to Dashboard
          </Link>
        </div>
        
        <div className="mb-6">
          <h1 className={`text-3xl font-bold ${textColor} mb-2`}>
            Shared Records
          </h1>
          <p className={textSecondary}>
            View and verify records shared with you, or review records you've shared
          </p>
        </div>

        {/* Tab Navigation */}
        <div className={`flex gap-4 mb-6 border-b ${borderColor}`}>
          <button
            onClick={() => setActiveTab('received')}
            className={`pb-3 px-4 font-medium transition-colors ${
              activeTab === 'received'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : `${textSecondary} hover:${textColor}`
            }`}
          >
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Received ({records.length})</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('sent')}
            className={`pb-3 px-4 font-medium transition-colors ${
              activeTab === 'sent'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : `${textSecondary} hover:${textColor}`
            }`}
          >
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              <span>Sent ({records.length})</span>
            </div>
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
            theme === 'dark' 
              ? 'bg-red-900/20 border border-red-800 text-red-200' 
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}>
            <svg className={`w-5 h-5 ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p>{error}</p>
          </div>
        )}

        {/* Records List */}
        {records.length === 0 ? (
          <div className={`text-center py-12 ${cardBg} rounded-lg shadow`}>
            <svg className="w-12 h-12 mx-auto text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className={textSecondary}>
              {activeTab === 'received' 
                ? 'No records have been shared with you yet'
                : "You haven't shared any records yet"}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {records.map((record) => {
              const verification = getVerificationStatus(record);
              return (
                <div
                  key={record._id}
                  className={`${cardBg} rounded-lg shadow p-6 hover:shadow-lg transition-shadow`}
                >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className={`text-lg font-semibold ${textColor}`}>
                        {getRecordTypeLabel(record.recordType)}
                      </h3>
                      <span className={`text-sm font-medium ${verification.color}`}>
                        {verification.label}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                      <div>
                        <span className={textSecondary}>Date:</span>
                        <span className={`ml-2 ${textColor}`}>
                          {formatDate(record.recordDate)}
                        </span>
                      </div>
                      {record.amount && (
                        <div>
                          <span className={textSecondary}>Amount:</span>
                          <span className={`ml-2 ${textColor}`}>
                            ${record.amount.toFixed(2)}
                          </span>
                        </div>
                      )}
                      {record.description && (
                        <div className="col-span-2">
                          <span className={textSecondary}>Description:</span>
                          <span className={`ml-2 ${textColor}`}>
                            {record.description}
                          </span>
                        </div>
                      )}
                      {activeTab === 'received' && record.sharedBy && (
                        <div>
                          <span className={textSecondary}>Shared by:</span>
                          <span className={`ml-2 ${textColor}`}>
                            {record.sellerName || 'Seller'}
                          </span>
                        </div>
                      )}
                      {activeTab === 'sent' && record.sharedWith && record.sharedWith.length > 0 && (
                        <div>
                          <span className={textSecondary}>Shared with:</span>
                          <span className={`ml-2 ${textColor}`}>
                            {record.sharedWith.length} recipient(s)
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Verification Info */}
                    {record.verifications && record.verifications.length > 0 && (
                      <div className={`mt-3 pt-3 border-t ${borderColor}`}>
                        <p className={`text-xs ${textSecondary} mb-2`}>
                          Verifications: {record.verifications.length}
                        </p>
                        {record.verifications.some(v => v.status === 'disputed') && (
                          <div className={theme === 'dark' ? 'text-sm text-red-400' : 'text-sm text-red-600'}>
                            ⚠️ This record has disputes that need resolution
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 ml-4">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => navigate(`/records/${record._id}`)}
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      View
                    </Button>
                    {activeTab === 'received' && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => navigate(`/records/${record._id}/verify`)}
                      >
                        {verification.status === 'verified' ? (
                          <>
                            <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Verified
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Review
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      </div>
    </div>
  );
};

export default SharedRecordsPage;
