import React, { useEffect, useState } from 'react';
import { useAuth, useUser } from '@clerk/clerk-react';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { getRecords } from '../services/recordService';
import * as dataSyncService from '../services/dataSyncService';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { getFullImageUrl } from '../services/api';
import AddRecordForm from '../components/AddRecordForm';
import OcrUploader from '../components/OcrUploader';
import db from '../db'; // Import the Dexie database instance
import { sanitizeForDb, sanitizeArrayForDb, pruneSyncNonCloneable } from '../utils/dbUtils';
import { enqueue, deepSanitizeAsync } from '../services/queueService';
import { saveProducerSnapshot } from '../utils/producerDiag';
import Button from '../components/Button';
import QueueStatus from '../components/QueueStatus';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import CenteredLoader from '../components/CenteredLoader';


import { getRecordTypeLabel, getUploadReasonLabel } from '../utils/recordTypeLabels';

const RecordsPage = () => {
  const { isLoaded } = useAuth();
  const { user } = useUser();
  const { theme } = useTheme();
  const { toast } = useToast();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showErrorBanner, setShowErrorBanner] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [ocrData, setOcrData] = useState({});
  const [blockUploaderOverlay, setBlockUploaderOverlay] = useState(false);
  const [confirmDeleteRecordId, setConfirmDeleteRecordId] = useState(null);
  const [deletingRecordId, setDeletingRecordId] = useState(null);
  const [showOutdatedPathBanner, setShowOutdatedPathBanner] = useState(false);
  // OCR analyzing state
  const [ocrAnalyzing, setOcrAnalyzing] = useState(false);
  
  // Service lookup for displaying service names instead of IDs
  const [serviceLookup, setServiceLookup] = useState({});
  
  // Filters (for sellers)
  const userRole = user?.publicMetadata?.role || 'customer';
  const [filterSource, setFilterSource] = useState('all'); // 'all', 'my-records', 'customer-uploads'
  const [filterRecordType, setFilterRecordType] = useState('all');
  const [filterService, setFilterService] = useState('all');
  
  // Pagination
  const [searchParams, setSearchParams] = useSearchParams();
  const PAGE_SIZE = 5;
  const pageParam = parseInt(searchParams.get('page') || '1', 10);
  const currentPage = Number.isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;

  useEffect(() => {
    let mounted = true;

    const readLocalAndSubscribe = async () => {
      try {
        console.debug('[RecordsPage] reading local DB, isLoaded:', isLoaded);
        setLoading(true);
        
        // Trigger a sync to fetch latest records from server
        try {
          if (navigator.onLine && isLoaded) {
            console.debug('[RecordsPage] Triggering data sync...');
            await dataSyncService.syncAllData();
          }
        } catch (syncErr) {
          console.warn('[RecordsPage] Data sync failed (non-fatal):', syncErr);
        }
        
        // Guard against test DB mocks that don't implement `.count()`.
        const counts = { records: 0, syncQueue: 0 };
        try { if (typeof db.records.count === 'function') counts.records = await db.records.count(); } catch (e) { counts.records = 0; }
        try { if (typeof db.syncQueue.count === 'function') counts.syncQueue = await db.syncQueue.count(); } catch (e) { counts.syncQueue = 0; }
        console.debug('[RecordsPage] db counts:', counts);
        const local = await db.records.orderBy('recordDate').reverse().toArray();
        // Filter local records to the current authenticated user to avoid showing other users' data
        const userId = user?.id || user?.userId || null;
        const filtered = Array.isArray(local) && userId
          ? local.filter(r => String(r.user ?? r.userId ?? '') === String(userId))
          : local;
        console.debug('[RecordsPage] sample records (raw):', local.slice(0,5));
        console.debug('[RecordsPage] sample records (filtered for user):', (filtered || []).slice(0,5));
        if (!mounted) return;
        setRecords(filtered || []);
        setLoading(false);
        
        // Check if any records have outdated filesystem paths
        const hasOutdatedPaths = (filtered || []).some(r => 
          r.imagePath && (r.imagePath.includes('\\') || r.imagePath.includes('D:') || r.imagePath.includes('C:'))
        );
        setShowOutdatedPathBanner(hasOutdatedPaths);

        // Load utility services for name lookup
        const services = await db.utilityServices.toArray();
        const lookup = {};
        services.forEach(s => {
          if (s._id && s.name) lookup[s._id] = s.name;
        });
        if (mounted) setServiceLookup(lookup);

        const onChange = async () => {
          const latest = await db.records.orderBy('recordDate').reverse().toArray();
          const userId = user?.id || user?.userId || null;
          const filteredLatest = Array.isArray(latest) && userId ? latest.filter(r => String(r.user || r.userId || '') === String(userId)) : latest;
          if (mounted) setRecords(filteredLatest || []);
        };

        try {
           db.records.hook('created', onChange);
           db.records.hook('updated', onChange);
           db.records.hook('deleted', onChange);
        } catch (e) {}

        // Per-page full-sync removed: central `dataSyncService` handles syncing.
      } catch (err) {
        console.error('Failed to load local records:', err);
        setError('Failed to load records.');
        setShowErrorBanner(true);
        setLoading(false);
      }
    };

    readLocalAndSubscribe();

    return () => { mounted = false; };
  }, [isLoaded]);

  // Apply filters
  const filteredRecords = records.filter(record => {
    // Source filter
    if (userRole === 'seller') {
      // For sellers: distinguish between records they created vs customer uploads
      if (filterSource === 'my-records' && record.uploaderCustomerId) return false;
      if (filterSource === 'customer-uploads' && !record.uploaderCustomerId) return false;
    } else if (userRole === 'customer') {
      // For customers: only show records they uploaded or that were shared with them
      const isMyUpload = record.uploaderCustomerId === user?.id;
      const isSharedWithMe = record.sharedWith?.includes(user?.id);
      if (!isMyUpload && !isSharedWithMe) return false;
    }
    
    // Record type filter
    if (filterRecordType !== 'all' && record.recordType !== filterRecordType) return false;
    
    // Service filter
    if (filterService !== 'all' && record.service !== filterService) return false;
    
    return true;
  });

  // Get unique services and record types for filter dropdowns
  // Map service IDs to names for the dropdown
  const availableServices = [...new Set(records.map(r => r.service).filter(Boolean))]
    .map(serviceId => ({
      id: serviceId,
      name: serviceLookup[serviceId] || serviceId
    }));
  const availableRecordTypes = [...new Set(records.map(r => r.recordType).filter(Boolean))];

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));
  const pagedRecords = filteredRecords.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Clamp page when records change
  useEffect(() => {
    if (currentPage > totalPages) {
      setSearchParams({ page: String(totalPages) });
    }
  }, [currentPage, totalPages, setSearchParams]);

  // Helper to reload local DB (used by dismiss on the error banner)
  const reloadLocal = async () => {
    try {
      setLoading(true);
      const local = await db.records.orderBy('recordDate').reverse().toArray();
      const userId = user?.id || user?.userId || null;
      const filtered = Array.isArray(local) && userId ? local.filter(r => String(r.user || r.userId || '') === String(userId)) : local;
      setRecords(filtered || []);
      setError(null);
      setShowErrorBanner(false);
    } catch (e) {
      console.error('[RecordsPage] reloadLocal failed', e);
      setError('Failed to load records.');
      setShowErrorBanner(true);
    } finally {
      setLoading(false);
    }
  };

  const navigate = useNavigate();

  const handleConvertRecord = async (recordId) => {
  // Convert disabled: users can edit record to change type in record details

  };

  const handleAddRecord = async (formData) => {
    try {
      // Convert FormData to a plain object for Dexie and the sync queue
      const recordPayload = Object.fromEntries(formData.entries());
      const localId = crypto.randomUUID();
      
      // Ensure detected OCR customer fields are preserved even if form omitted them
      let detectedName = recordPayload.customerName || recordPayload.customer || null;
      let detectedPhone = recordPayload.customerPhone || recordPayload.customerPhone || recordPayload.mobile || null;
      // fallback to the uploader OCR data if available
      if ((!detectedName || !detectedPhone) && ocrData && ocrData.data) {
        const od = ocrData.data;
        if (!detectedName) detectedName = od.customerName || od.customer || od.name || od.customerName || null;
        if (!detectedPhone) detectedPhone = od.customerPhone || od.mobileNumber || od.mobile || od.phone || null;
      }

      // Prepare and deep-sanitize payload before writing to Dexie
      const rawRecord = {
        _id: localId,
        ...recordPayload,
        // canonicalize customer fields so UI reads `customerName`/`customerPhone`
        customerName: detectedName || recordPayload.customerName || recordPayload.customer || null,
        customerPhone: detectedPhone || recordPayload.customerPhone || recordPayload.mobile || null,
        amount: parseFloat(recordPayload.amount),
        recordDate: new Date(recordPayload.recordDate),
        syncStatus: 'pending',
      };
      const cleanRecord = await deepSanitizeAsync(sanitizeForDb(rawRecord));
      if (!cleanRecord) throw new Error('Record payload not safe to persist');
      // Final sync-safe prune before writing
      const toWrite = pruneSyncNonCloneable(cleanRecord);
      await db.records.add(toWrite);

      // Add a job to the sync queue
      try { if (import.meta.env?.DEV) saveProducerSnapshot({ entity: 'records', action: 'create', entityId: localId, payload: Object.assign({ _id: localId }, recordPayload) }, 'RecordsPage.enqueue.create'); } catch (e) {}
      await enqueue({
        entity: 'records',
        action: 'create',
        entityId: localId,
        payload: Object.assign({ _id: localId }, recordPayload, { customerName: rawRecord.customerName, customerPhone: rawRecord.customerPhone }),
        tempId: localId,
        timestamp: new Date().toISOString(),
      });

      // Wait for sync queue to process this item (up to 10 seconds)
      let attempts = 0;
      while (attempts < 20) {
        const pending = await db.syncQueue.where('entityId').equals(localId).toArray();
        if (pending.length === 0) {
          console.log('[RecordsPage] Record sync completed successfully');
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms before checking again
        attempts++;
      }

      // Manually update the UI state
      const updatedRecords = await db.records.orderBy('recordDate').reverse().toArray();
      setRecords(updatedRecords);
      setShowAddForm(false);
      setOcrData({}); // Clear OCR data after submission
    } catch (err) {
      setError('Failed to save record locally.');
      setShowErrorBanner(true);
    }
  };

  const handleDeleteRecord = async (recordId) => {
    try {
      // Read the local record by its `_id` index so we can include server linkage in the queue
      const local = await db.records.where('_id').equals(String(recordId)).first();
      // Remove local row (by _id) to give optimistic UX
      try {
        await db.records.where('_id').equals(String(recordId)).delete();
      } catch (delErr) {
        // fallback to primary-key delete if needed
        try { await db.records.delete(recordId); } catch (e) { /* ignore */ }
      }

      // Add a job to the sync queue. Include serverId when available so server-side delete
      // can be called deterministically even after the local row is removed.
      const queueItem = {
        entity: 'records',
        entityId: recordId,
        action: 'delete',
        timestamp: new Date().toISOString(),
      };
      if (local && local.serverId) queueItem.payload = { serverId: local.serverId };
      try { if (import.meta.env?.DEV) saveProducerSnapshot(queueItem, 'RecordsPage.enqueue.delete'); } catch (e) {}
      await enqueue(queueItem);

      // Update UI optimistically
      setRecords(records.filter((record) => record._id !== recordId));
    } catch (err) {
      setError('Failed to delete record locally.');
      setShowErrorBanner(true);
    }
  };

  const handleOcrComplete = (result) => {
    // Debug: show full upload payload so we can inspect server `parsed` and `data`
    try {
      // eslint-disable-next-line no-console
      console.debug('[RecordsPage] handleOcrComplete payload', result);
    } catch (e) {}
    // Preserve the full OCR result (including `analysisId`) so the
    // AddRecordForm can attach `analysisId` to the saved record and
    // avoid creating a duplicate AnalysisEvent (and double-billing).
    setOcrData(result || {});
    // show the overlay and open the form; overlay will be cleared when the form mounts
    setBlockUploaderOverlay(true);
    setShowAddForm(true);
  };

  const handleCancelAdd = () => {
    setShowAddForm(false);
    setOcrData({}); // Also clear OCR data on cancel
  };

  const handlePrint = () => {
    const originalTitle = document.title;
    document.title = 'Receipt-Records';
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 100);
  };

  const handleDownloadCSV = () => {
    // Prepare CSV headers
    const headers = ['Date', 'Service Type', 'Account Number', 'Previous Reading', 'Current Reading', 'Amount', 'Notes'];
    
    // Prepare CSV rows
    const rows = records.map(record => [
      new Date(record.recordDate).toLocaleDateString(),
      record.serviceType || '',
      record.accountNumber || '',
      record.previousReading || '',
      record.currentReading || '',
      record.amount || '',
      record.notes || ''
    ]);
    
    // Create CSV content
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    // Create and download file. Include seller prefix/name in filename when available.
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    let namePart = '';
    try {
      const uniqPrefixes = Array.from(new Set(records.map(r => (r.sellerPrefix || '').trim()).filter(Boolean)));
      const uniqNames = Array.from(new Set(records.map(r => (r.sellerName || '').trim()).filter(Boolean)));
      if (uniqPrefixes.length === 1) namePart = `-${uniqPrefixes[0]}`;
      else if (uniqNames.length === 1) namePart = `-${uniqNames[0].replace(/\s+/g, '_')}`;
    } catch (e) { /* ignore */ }
    const datePart = new Date().toISOString().split('T')[0];
    const safe = (s) => String(s || '').replace(/[^a-zA-Z0-9_\-\.]/g, '_');
    link.download = `${safe('receipt-records')}${safe(namePart)}-${safe(datePart)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (loading && !isLoaded) {
    return <CenteredLoader message="Loading authentication..." />;
  }

  if (loading) {
    return <CenteredLoader message="Loading records..." />;
  }

  // render page even if there was an error; show banner that can be dismissed

  const backTarget = user?.publicMetadata?.role === 'seller' ? '/seller-dashboard' : '/customer-dashboard';

  return (
    <div className={`px-0 sm:px-4 md:px-6 lg:px-8 max-w-7xl mx-auto min-h-screen`}>
      <div className="mb-6 px-4 pt-4">
        <Link to={backTarget} className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" /></svg>
          Back to Dashboard
        </Link>
      </div>
      <Modal isOpen={showErrorBanner} onClose={async () => { setShowErrorBanner(false); setError(null); await reloadLocal(); }}>
        <div className="flex items-center gap-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-600" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"></path></svg>
          <div>
            <div className="font-medium text-lg">Error</div>
            <div className="mt-2 text-sm">{error}</div>
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <Button onClick={async () => { setShowErrorBanner(false); setError(null); await reloadLocal(); }} variant="secondary">Dismiss</Button>
        </div>
      </Modal>
      {/* Header Section */}
      <div className={`mb-8 p-8 rounded-2xl shadow-xl backdrop-blur-sm ${theme === 'dark' ? 'bg-gray-800/90 border border-gray-700/50' : 'bg-white/90 border border-gray-200/50'}`}>
        {/* Outdated Path Banner */}
        {showOutdatedPathBanner && (
          <div className={`mb-6 p-4 rounded-lg border-l-4 ${theme === 'dark' ? 'bg-yellow-900/20 border-yellow-500 text-yellow-300' : 'bg-yellow-50 border-yellow-400 text-yellow-800'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <p className="font-medium">Outdated image paths detected</p>
                  <p className="text-sm mt-1">Some records have old file paths. Click to clear cache and sync.</p>
                </div>
              </div>
              <button
                onClick={async () => {
                  try {
                    // Clear IndexedDB records
                    await db.records.clear();
                    // Trigger fresh sync
                    await dataSyncService.syncAllData();
                    // Reload data
                    window.location.reload();
                  } catch (err) {
                    console.error('Failed to clear and sync:', err);
                    toast.error('Failed to refresh data. Please try reloading the page manually.');
                  }
                }}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${theme === 'dark' ? 'bg-yellow-600 hover:bg-yellow-700 text-white' : 'bg-yellow-500 hover:bg-yellow-600 text-white'}`}
              >
                Clear & Sync
              </button>
            </div>
          </div>
        )}
        
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div>
            <h1 className={`text-4xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              <span className="inline-flex items-center gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-10 w-10 ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2zM10 8.5a.5.5 0 11-1 0 .5.5 0 011 0zm5 5a.5.5 0 11-1 0 .5.5 0 011 0z" />
                </svg>
                Business Records
              </span>
            </h1>
            <p className={`text-lg ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
              Digitize receipts, invoices, and documents with AI-powered OCR
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {!showAddForm && records.length > 0 && (
              <>
                <Button data-cy="print-records" onClick={handlePrint} variant="secondary" size="md" className="print:hidden">
                  <span className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                    Print
                  </span>
                </Button>
                <Button data-cy="export-records" onClick={handleDownloadCSV} variant="secondary" size="md" className="print:hidden">
                  <span className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Export CSV
                  </span>
                </Button>
              </>
            )}
            {!showAddForm && (
              <Button data-cy="add-record-manual-button" onClick={() => setShowAddForm(true)} variant="primary" className="whitespace-nowrap">
                <span className="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                  </svg>
                  Add Record Manually
                </span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Sync / queue status */}
      <QueueStatus onDismiss={() => setError(null)} />

      {/* Stats Cards */}
      {!showAddForm && records.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className={`p-6 rounded-xl backdrop-blur-sm ${theme === 'dark' ? 'bg-gray-800/80 border border-gray-700/50' : 'bg-white/80 border border-gray-200/50'}`}>
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${theme === 'dark' ? 'bg-blue-900/40' : 'bg-blue-100'}`}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2zM10 8.5a.5.5 0 11-1 0 .5.5 0 011 0zm5 5a.5.5 0 11-1 0 .5.5 0 011 0z" />
                </svg>
              </div>
              <div>
                <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Total Records</p>
                <p className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{records.length}</p>
              </div>
            </div>
          </div>
          
          <div className={`p-6 rounded-xl backdrop-blur-sm ${theme === 'dark' ? 'bg-gray-800/80 border border-gray-700/50' : 'bg-white/80 border border-gray-200/50'}`}>
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${theme === 'dark' ? 'bg-green-900/40' : 'bg-green-100'}`}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>With Images</p>
                <p className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{records.filter(r => r.imagePath).length}</p>
              </div>
            </div>
          </div>
          
          <div className={`p-6 rounded-xl backdrop-blur-sm ${theme === 'dark' ? 'bg-gray-800/80 border border-gray-700/50' : 'bg-white/80 border border-gray-200/50'}`}>
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${theme === 'dark' ? 'bg-purple-900/40' : 'bg-purple-100'}`}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Total Amount</p>
                <p className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>KSH {records.reduce((sum, r) => sum + (Number(r.amount) || 0), 0).toFixed(2)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters Section */}
      {(userRole === 'seller' || userRole === 'customer') && (
        <div className={`mb-6 p-4 rounded-lg shadow ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}>
          <h3 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Filter Records</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Source/Ownership Filter */}
            {userRole === 'seller' && (
              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                  Record Source
                </label>
                <select
                  value={filterSource}
                  onChange={(e) => setFilterSource(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                >
                  <option value="all">All Records</option>
                  <option value="my-records">My Records (Created by Me)</option>
                  <option value="customer-uploads">Customer Uploads</option>
                </select>
              </div>
            )}

            {/* Record Type Filter */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                Record Type
              </label>
              <select
                value={filterRecordType}
                onChange={(e) => setFilterRecordType(e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
              >
                <option value="all">All Types</option>
                {availableRecordTypes.map(type => (
                  <option key={type} value={type}>
                    {getRecordTypeLabel(type)}
                  </option>
                ))}
              </select>
            </div>

            {/* Service Filter */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                Service
              </label>
              <select
                value={filterService}
                onChange={(e) => setFilterService(e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                disabled={availableServices.length === 0}
              >
                <option value="all">All Services</option>
                {availableServices.map(service => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          {/* Filter summary */}
          <div className={`mt-3 text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
            Showing {filteredRecords.length} of {records.length} records
            {userRole === 'customer' && records.length > 0 && (
              <span className="ml-2">
                ({records.filter(r => r.uploaderCustomerId === user?.id).length} uploaded by you, 
                {records.filter(r => r.sharedWith?.includes(user?.id)).length} shared with you)
              </span>
            )}
            {(filterSource !== 'all' || filterRecordType !== 'all' || filterService !== 'all') && (
              <button
                onClick={() => {
                  setFilterSource('all');
                  setFilterRecordType('all');
                  setFilterService('all');
                }}
                className="ml-2 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
      )}

      {/* OCR Uploader — keep mounted so buttons can follow parent's block timing; hide when form is open */}
      <div style={{ display: showAddForm ? 'none' : 'block' }}>
        <OcrUploader onOcrComplete={handleOcrComplete} externalBlock={blockUploaderOverlay} onAnalyzingChange={(v) => { try { setOcrAnalyzing(Boolean(v)); } catch (e) {} }} />
      </div>

      {/* Add Record Form */}
      {showAddForm && (
        <div>
          {/* Persistent analyzing indicator while form is open and OCR analysis still in-flight */}
          {ocrAnalyzing && (
            <div className="mb-4 p-3 rounded-lg border-l-4 border-yellow-400 bg-yellow-50 text-yellow-700">
              <div className="flex items-center gap-3">
                <svg className="h-5 w-5 animate-spin text-yellow-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path></svg>
                <div className="text-sm">Analyzing document... analysis still running — form opened for review.</div>
              </div>
            </div>
          )}
          <AddRecordForm
            onAddRecord={handleAddRecord}
            onCancel={handleCancelAdd}
            initialData={ocrData}
            onFormReady={() => setBlockUploaderOverlay(false)}
          />
        </div>
      )}

      {/* Page overlay removed per request; blockUploaderOverlay state retained to drive uploader button timing */}

      {/* Records List */}
      <div className="space-y-4 mt-6">
        {pagedRecords.length > 0 ? (
            <>
            <div className={`mb-4 px-4 py-2 rounded-lg ${theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-100/80'}`}>
              <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                Showing <span className="font-semibold">{pagedRecords.length}</span> of <span className="font-semibold">{filteredRecords.length}</span> record{filteredRecords.length !== 1 ? 's' : ''}
                {filteredRecords.length !== records.length && (
                  <span className="ml-1">({records.length} total)</span>
                )}
              </p>
            </div>
            {pagedRecords.map((record) => (
              <div key={record._id} className={`p-6 border rounded-xl shadow-md backdrop-blur-sm transition-all hover:shadow-lg ${theme === 'dark' ? 'bg-gray-800/80 border-gray-700/50' : 'bg-white/80 border-gray-200/50'}`}>
                <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-start gap-4">
                      {record.imagePath && (
                        <div className="flex-shrink-0">
                          <img 
                            src={getFullImageUrl([record.imagePath])} 
                            alt={record.description} 
                            className="w-24 h-24 object-cover rounded-lg border-2 border-gray-200 dark:border-gray-700" 
                          />
                        </div>
                      )}
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          {!record.imagePath && (
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${theme === 'dark' ? 'bg-red-900/40' : 'bg-red-100'}`}>
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2zM10 8.5a.5.5 0 11-1 0 .5.5 0 011 0zm5 5a.5.5 0 11-1 0 .5.5 0 011 0z" />
                              </svg>
                            </div>
                          )}
                          <h3 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                            <Link to={`/records/${record._id}`} className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'} hover:underline`}>{record.description || getRecordTypeLabel(record.recordType)}</Link>
                          </h3>
                          
                          {/* Record Type Badge */}
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${theme === 'dark' ? 'bg-blue-900/40 text-blue-300' : 'bg-blue-100 text-blue-800'}`}>
                            {getRecordTypeLabel(record.recordType || record.type)}
                          </span>
                          
                          {/* Customer Upload Indicator */}
                          {record.uploaderCustomerId && (
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${theme === 'dark' ? 'bg-purple-900/40 text-purple-300' : 'bg-purple-100 text-purple-800'}`}>
                              Customer Upload
                            </span>
                          )}
                        </div>
                        
                        {/* Service and Reason (for customer uploads) */}
                        {(record.service || record.reason) && (
                          <div className={`mb-2 space-y-1 text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                            {record.service && (
                              <div className="flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                                <span><strong>Service:</strong> {serviceLookup[record.service] || record.service}</span>
                              </div>
                            )}
                            {record.reason && (
                              <div className="flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                                </svg>
                                <span><strong>Reason:</strong> {getUploadReasonLabel(record.reason)}</span>
                              </div>
                            )}
                          </div>
                        )}
                        
                        <div className="space-y-1">
                          <div className={`flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-2xl font-bold">KSH {(Number(record.amount) || 0).toFixed(2)}</span>
                          </div>
                          {record.recordDate && (
                            <div className={`flex items-center gap-2 text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              {new Date(record.recordDate).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <Button onClick={() => navigate(`/records/${record._id}`)} variant="primary" size="sm" className="mr-2">
                    <span className="flex items-center gap-2">View</span>
                  </Button>
                  <Button onClick={() => setConfirmDeleteRecordId(record._id)} variant="danger" size="sm" loading={deletingRecordId === record._id} disabled={deletingRecordId === record._id}>
                    <span className="flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete
                    </span>
                  </Button>
                        
                </div>
              </div>
            ))}
          </>
        ) : (
          <div className={`text-center py-16 px-6 rounded-2xl ${theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-50/80'}`}>
            <div className={`w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'}`}>
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-10 w-10 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2zM10 8.5a.5.5 0 11-1 0 .5.5 0 011 0zm5 5a.5.5 0 11-1 0 .5.5 0 011 0z" />
              </svg>
            </div>
            <h3 className={`text-2xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {filteredRecords.length === 0 && records.length > 0 ? 'No Matching Records' : 'No Records Yet'}
            </h3>
            <p className={`mb-6 max-w-md mx-auto ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
              {filteredRecords.length === 0 && records.length > 0 
                ? 'No records match your current filters. Try adjusting them above.'
                : 'Start digitizing your receipts using our AI-powered OCR scanner or add records manually.'}
            </p>
          </div>
        )}
      </div>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <button
            onClick={() => setSearchParams({ page: String(Math.max(1, currentPage - 1)) })}
            disabled={currentPage === 1}
            className={`px-3 py-1 rounded ${currentPage === 1 ? 'opacity-50 cursor-not-allowed' : (theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300')}`}
          >
            Prev
          </button>

          {Array.from({ length: totalPages }).map((_, i) => {
            const page = i + 1;
            return (
              <button
                key={page}
                onClick={() => setSearchParams({ page: String(page) })}
                className={`px-3 py-1 rounded ${page === currentPage ? (theme === 'dark' ? 'bg-red-400 text-gray-900' : 'bg-red-500 text-white') : (theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-100 hover:bg-gray-200')}`}
              >
                {page}
              </button>
            );
          })}

          <button
            onClick={() => setSearchParams({ page: String(Math.min(totalPages, currentPage + 1)) })}
            disabled={currentPage === totalPages}
            className={`px-3 py-1 rounded ${currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : (theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300')}`}
          >
            Next
          </button>
        </div>
      )}
      {/* Confirm delete record modal */}
      <ConfirmModal
        isOpen={Boolean(confirmDeleteRecordId)}
        title="Delete Record"
        message={`Are you sure you want to delete this record? Action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onCancel={() => setConfirmDeleteRecordId(null)}
        confirmLoading={deletingRecordId === confirmDeleteRecordId}
        onConfirm={async () => {
          const id = confirmDeleteRecordId;
          setConfirmDeleteRecordId(null);
          try { setDeletingRecordId(id); await handleDeleteRecord(id); } catch (e) { console.error('Delete record failed', e); } finally { setDeletingRecordId(null); }
        }}
      />

      {/* Convert functionality removed — users can edit type from the record details page */}
    </div>
  );
};

export default RecordsPage;
