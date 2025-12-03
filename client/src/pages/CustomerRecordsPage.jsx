import React, { useEffect, useState } from 'react';
import { useAuth, useUser } from '@clerk/clerk-react';
import { useTheme } from '../context/ThemeContext';
import * as dataSyncService from '../services/dataSyncService';
import { Link, useNavigate } from 'react-router-dom';
import { getFullImageUrl } from '../services/api';
import db from '../db';
import Button from '../components/Button';
import CenteredLoader from '../components/CenteredLoader';
import { getRecordTypeLabel, getUploadReasonLabel } from '../utils/recordTypeLabels';

const CustomerRecordsPage = () => {
  const { isLoaded } = useAuth();
  const { user } = useUser();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all'); // 'all', 'uploaded', 'shared'
  const [serviceLookup, setServiceLookup] = useState({});

  useEffect(() => {
    let mounted = true;

    const loadRecords = async () => {
      try {
        console.debug('[CustomerRecordsPage] loading records');
        setLoading(true);
        
        // Trigger sync
        try {
          if (navigator.onLine && isLoaded) {
            await dataSyncService.syncAllData();
          }
        } catch (syncErr) {
          console.warn('[CustomerRecordsPage] Sync failed:', syncErr);
        }
        
        const local = await db.records.orderBy('recordDate').reverse().toArray();
        const userId = user?.id || user?.userId || null;
        
        console.log('[CustomerRecords] Total records in DB:', local.length);
        console.log('[CustomerRecords] Current userId:', userId);
        
        if (!userId) {
          setRecords([]);
          setLoading(false);
          return;
        }
        
        // Filter to only show:
        // 1. Records created by this customer (user field matches)
        // 2. Records uploaded by this customer via portal (uploaderCustomerId matches)
        // 3. Records shared with this customer (sharedWith includes userId)
        
        console.log('[CustomerRecords] Filtering records for userId:', userId);
        
        const filtered = local.filter(r => {
          const isMyRecord = r.user === userId;
          const isMyUpload = r.uploaderCustomerId === userId;
          const isSharedWithMe = r.sharedWith && Array.isArray(r.sharedWith) && r.sharedWith.includes(userId);
          
          // Debug logging for ALL records to see what's happening
          const willShow = isMyRecord || isMyUpload || isSharedWithMe;
          
          if (r.uploaderCustomerId || r.recordType === 'utility' || r.recordType === 'receipt') {
            console.log('[CustomerRecords] Record check:', {
              recordId: r._id,
              recordType: r.recordType,
              description: r.description,
              userId,
              recordUser: r.user,
              uploaderCustomerId: r.uploaderCustomerId,
              sharedWith: r.sharedWith,
              isMyRecord,
              isMyUpload,
              isSharedWithMe,
              willShow
            });
          }
          
          return willShow;
        });
        
        console.log('[CustomerRecords] Filtered records count:', filtered.length);
        
        if (!mounted) return;
        setRecords(filtered || []);

        // Build service lookup table
        try {
          const services = await db.utilityServices.toArray();
          const lookup = {};
          services.forEach(s => {
            if (s._id && s.name) lookup[s._id] = s.name;
          });
          setServiceLookup(lookup);
        } catch (err) {
          console.debug('Could not load services:', err);
        }

        setLoading(false);

        const onChange = async () => {
          const latest = await db.records.orderBy('recordDate').reverse().toArray();
          const filteredLatest = latest.filter(r => {
            const isMyRecord = r.user === userId;
            const isMyUpload = r.uploaderCustomerId === userId;
            const isSharedWithMe = r.sharedWith && Array.isArray(r.sharedWith) && r.sharedWith.includes(userId);
            return isMyRecord || isMyUpload || isSharedWithMe;
          });
          if (mounted) setRecords(filteredLatest || []);
        };

        try {
          db.records.hook('created', onChange);
          db.records.hook('updated', onChange);
          db.records.hook('deleted', onChange);
        } catch (e) {}

      } catch (err) {
        console.error('Failed to load customer records:', err);
        setLoading(false);
      }
    };

    loadRecords();

    return () => { mounted = false; };
  }, [isLoaded, user]);

  // Apply filter
  const filteredRecords = records.filter(record => {
    const userId = user?.id || user?.userId;
    if (filterType === 'uploaded') {
      // Show records created OR uploaded by customer
      return record.user === userId || record.uploaderCustomerId === userId;
    }
    if (filterType === 'shared') {
      return record.sharedWith && Array.isArray(record.sharedWith) && record.sharedWith.includes(userId);
    }
    return true; // 'all'
  });

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const bgColor = theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50';
  const cardBg = theme === 'dark' ? 'bg-gray-800' : 'bg-white';
  const textColor = theme === 'dark' ? 'text-white' : 'text-gray-900';
  const textSecondary = theme === 'dark' ? 'text-gray-400' : 'text-gray-600';
  const borderColor = theme === 'dark' ? 'border-gray-700' : 'border-gray-200';
  const inputBg = theme === 'dark' ? 'bg-gray-700' : 'bg-white';
  const inputBorder = theme === 'dark' ? 'border-gray-600' : 'border-gray-300';

  if (loading) {
    return <CenteredLoader message="Loading your records..." />;
  }

  // Count records created/uploaded by customer vs shared with them
  const uploadedCount = records.filter(r => 
    r.user === user?.id || r.uploaderCustomerId === user?.id
  ).length;
  const sharedCount = records.filter(r => r.sharedWith?.includes(user?.id)).length;

  return (
    <div className={`min-h-screen ${bgColor} py-8`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back to Dashboard Link */}
        <div className="mb-2">
          <Link to="/customer-dashboard" className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:underline dark:text-blue-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" /></svg>
            Back to Dashboard
          </Link>
        </div>
        
        {/* Header */}
        <div className="mb-8">
          <h1 className={`text-4xl font-bold ${textColor} mb-2 flex items-center gap-3`}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            My Records
          </h1>
          <p className={textSecondary}>
            Documents you've uploaded to your seller and records shared with you
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className={`p-6 rounded-lg shadow ${cardBg} border ${borderColor}`}>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <p className={`text-sm ${textSecondary}`}>Total Records</p>
                <p className={`text-3xl font-bold ${textColor}`}>{records.length}</p>
              </div>
            </div>
          </div>

          <div className={`p-6 rounded-lg shadow ${cardBg} border ${borderColor}`}>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <div>
                <p className={`text-sm ${textSecondary}`}>Uploaded by Me</p>
                <p className={`text-3xl font-bold ${textColor}`}>{uploadedCount}</p>
              </div>
            </div>
          </div>

          <div className={`p-6 rounded-lg shadow ${cardBg} border ${borderColor}`}>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              </div>
              <div>
                <p className={`text-sm ${textSecondary}`}>Shared With Me</p>
                <p className={`text-3xl font-bold ${textColor}`}>{sharedCount}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className={`mb-6 p-4 rounded-lg shadow ${cardBg} border ${borderColor}`}>
          <div className="flex gap-2">
            <button
              onClick={() => setFilterType('all')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filterType === 'all'
                  ? 'bg-blue-600 text-white'
                  : `${textSecondary} hover:${textColor} ${theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`
              }`}
            >
              All ({records.length})
            </button>
            <button
              onClick={() => setFilterType('uploaded')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filterType === 'uploaded'
                  ? 'bg-purple-600 text-white'
                  : `${textSecondary} hover:${textColor} ${theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`
              }`}
            >
              My Uploads ({uploadedCount})
            </button>
            <button
              onClick={() => setFilterType('shared')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filterType === 'shared'
                  ? 'bg-green-600 text-white'
                  : `${textSecondary} hover:${textColor} ${theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`
              }`}
            >
              Shared ({sharedCount})
            </button>
          </div>
        </div>

        {/* Records List */}
        {filteredRecords.length === 0 ? (
          <div className={`text-center py-16 ${cardBg} rounded-lg shadow border ${borderColor}`}>
            <div className={`w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center ${theme === 'dark' ? 'bg-blue-500/20' : 'bg-blue-50'}`}>
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-10 w-10 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className={`text-2xl font-bold mb-2 ${textColor}`}>No Records Found</h3>
            <p className={`mb-6 max-w-md mx-auto ${textSecondary}`}>
              {filterType === 'uploaded' && 'You haven\'t uploaded any records yet.'}
              {filterType === 'shared' && 'No records have been shared with you yet.'}
              {filterType === 'all' && 'You don\'t have any records. Upload documents or wait for your seller to share records with you.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredRecords.map((record) => {
              const userId = user?.id || user?.userId;
              const isMyRecord = record.user === userId || record.uploaderCustomerId === userId;
              const isShared = record.sharedWith?.includes(userId);

              return (
                <div
                  key={record._id}
                  className={`${cardBg} rounded-lg shadow p-6 border ${borderColor} hover:shadow-lg transition-shadow`}
                >
                  <div className="flex items-start gap-4">
                    {/* Image Thumbnail */}
                    {record.imagePath && (
                      <div className="flex-shrink-0">
                        <img 
                          src={getFullImageUrl([record.imagePath])} 
                          alt={record.description || 'Record'} 
                          className="w-24 h-24 object-cover rounded-lg border-2 border-gray-200 dark:border-gray-700" 
                        />
                      </div>
                    )}

                    {/* Record Details */}
                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="flex-1">
                          <h3 className={`text-xl font-bold ${textColor} mb-2`}>
                            {record.description || getRecordTypeLabel(record.recordType)}
                          </h3>
                          
                          <div className="flex flex-wrap gap-2 mb-3">
                            {/* Record Type Badge */}
                            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-500 text-white dark:bg-blue-600">
                              {getRecordTypeLabel(record.recordType)}
                            </span>
                            
                            {/* Upload/Share Status Badge */}
                            {isMyRecord && (
                              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-purple-600 text-white dark:bg-purple-500">
                                My Record
                              </span>
                            )}
                            {isShared && !isMyRecord && (
                              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-600 text-white dark:bg-green-500">
                                Shared with Me
                              </span>
                            )}
                          </div>
                        </div>

                        {/* View Button */}
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => navigate(`/records/${record._id}`)}
                        >
                          <span className="flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            View Details
                          </span>
                        </Button>
                      </div>

                      {/* Record Info Grid */}
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className={`font-medium ${textSecondary}`}>Date:</span>
                          <span className={`ml-2 ${textColor}`}>{formatDate(record.recordDate)}</span>
                        </div>
                        {record.amount && (
                          <div>
                            <span className={`font-medium ${textSecondary}`}>Amount:</span>
                            <span className={`ml-2 ${textColor}`}>${Number(record.amount).toFixed(2)}</span>
                          </div>
                        )}
                        {record.service && (
                          <div>
                            <span className={`font-medium ${textSecondary}`}>Service:</span>
                            <span className={`ml-2 ${textColor}`}>{serviceLookup[record.service] || record.service}</span>
                          </div>
                        )}
                        {record.sellerName && (
                          <div>
                            <span className={`font-medium ${textSecondary}`}>Seller:</span>
                            <span className={`ml-2 ${textColor}`}>{record.sellerName}</span>
                          </div>
                        )}
                      </div>

                      {/* Reason (for uploads) */}
                      {record.reason && (
                        <div className={`mt-3 pt-3 border-t ${borderColor}`}>
                          <p className={`text-sm ${textSecondary}`}>
                            <strong>Reason:</strong> {getUploadReasonLabel(record.reason)}
                          </p>
                        </div>
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

export default CustomerRecordsPage;
