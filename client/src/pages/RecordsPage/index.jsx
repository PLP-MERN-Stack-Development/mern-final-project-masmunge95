import React, { useState, useEffect } from 'react';
import { useAuth, useUser } from '@clerk/clerk-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';

// Hooks
import { useRecordData } from '../../hooks/RecordsPage/useRecordData';
import { useRecordFilters } from '../../hooks/RecordsPage/useRecordFilters';
import { useRecordCrud } from '../../hooks/RecordsPage/useRecordCrud';

// Components
import AddRecordForm from '../../components/AddRecordForm';
import OcrUploader from '../../components/OcrUploader';
import Button from '../../components/Button';
import QueueStatus from '../../components/QueueStatus';
import Modal from '../../components/Modal';
import ConfirmModal from '../../components/ConfirmModal';
import CenteredLoader from '../../components/CenteredLoader';

// Utilities
import { handleDownloadCSV } from '../../utils/RecordsPage/csvExport';
import { printRecords } from '../../utils/RecordsPage/printHelpers';
import { getFilterOptions } from '../../utils/RecordsPage/recordHelpers';
import { getRecordTypeLabel, getUploadReasonLabel } from '../../utils/recordTypeLabels';
import { getFullImageUrl } from '../../services/api';
import * as dataSyncService from '../../services/dataSyncService';
import db from '../../db';

/**
 * RecordsPage - Refactored orchestrator
 * Manages business records with OCR upload, filtering, and CRUD
 */
const RecordsPage = () => {
  const { isLoaded } = useAuth();
  const { user } = useUser();
  const { theme } = useTheme();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Custom hooks
  const {
    records,
    loading,
    error,
    setError,
    serviceLookup,
    showOutdatedPathBanner,
    setShowOutdatedPathBanner,
    reloadLocal,
  } = useRecordData(user, isLoaded);

  const userRole = user?.publicMetadata?.role || 'customer';
  const {
    filterSource,
    setFilterSource,
    filterRecordType,
    setFilterRecordType,
    filterService,
    setFilterService,
    clearFilters,
    applyFilters,
  } = useRecordFilters(userRole);

  // Local UI state
  const [showErrorBanner, setShowErrorBanner] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [ocrData, setOcrData] = useState({});
  const [blockUploaderOverlay, setBlockUploaderOverlay] = useState(false);
  const [confirmDeleteRecordId, setConfirmDeleteRecordId] = useState(null);
  const [ocrAnalyzing, setOcrAnalyzing] = useState(false);

  const {
    deletingRecordId,
    handleAddRecord,
    handleDeleteRecord,
  } = useRecordCrud(ocrData);

  // Pagination
  const [searchParams, setSearchParams] = useSearchParams();
  const PAGE_SIZE = 5;
  const pageParam = parseInt(searchParams.get('page') || '1', 10);
  const currentPage = Number.isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;

  // Apply filters
  const filteredRecords = applyFilters(records);
  const { availableServices, availableRecordTypes } = getFilterOptions(records, serviceLookup);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));
  const pagedRecords = filteredRecords.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Clamp page when records change
  useEffect(() => {
    if (currentPage > totalPages) {
      setSearchParams({ page: String(totalPages) });
    }
  }, [currentPage, totalPages, setSearchParams]);

  // Handlers
  const handleAddRecordWrapper = async (formData) => {
    try {
      await handleAddRecord(formData);
      const updatedRecords = await db.records.orderBy('recordDate').reverse().toArray();
      setShowAddForm(false);
      setOcrData({});
      await reloadLocal();
    } catch (err) {
      setError('Failed to save record locally.');
      setShowErrorBanner(true);
    }
  };

  const handleDeleteRecordWrapper = async (recordId) => {
    try {
      await handleDeleteRecord(recordId);
      await reloadLocal();
    } catch (err) {
      setError('Failed to delete record locally.');
      setShowErrorBanner(true);
    }
  };

  const handleOcrComplete = (result) => {
    console.debug('[RecordsPage] handleOcrComplete payload', result);
    setOcrData(result || {});
    setBlockUploaderOverlay(true);
    setShowAddForm(true);
  };

  const handleCancelAdd = () => {
    setShowAddForm(false);
    setOcrData({});
  };

  const handleClearAndSync = async () => {
    try {
      await db.records.clear();
      await dataSyncService.syncAllData();
      window.location.reload();
    } catch (err) {
      console.error('Failed to clear and sync:', err);
      toast.error('Failed to refresh data. Please try reloading the page manually.');
    }
  };

  if (loading && records.length === 0) {
    return <CenteredLoader message="Loading records..." />;
  }

  const textColor = theme === 'dark' ? 'text-white' : 'text-gray-900';
  const secondaryTextColor = theme === 'dark' ? 'text-gray-300' : 'text-gray-600';

  return (
    <div className="px-4 md:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Error Modal */}
      <Modal 
        isOpen={showErrorBanner} 
        onClose={async () => { 
          setShowErrorBanner(false); 
          setError(null); 
          await reloadLocal(); 
        }}
      >
        <div className="flex items-center gap-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-600" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"></path>
          </svg>
          <div>
            <div className="font-medium text-lg">Error</div>
            <div className="mt-2 text-sm">{error}</div>
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <button 
            onClick={async () => { 
              setShowErrorBanner(false); 
              setError(null); 
              await reloadLocal(); 
            }} 
            className="inline-flex items-center justify-center font-medium rounded focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors bg-gray-200 hover:bg-gray-300 text-gray-800 focus:ring-gray-500 px-3 py-2 text-sm"
          >
            Dismiss
          </button>
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
                onClick={handleClearAndSync}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${theme === 'dark' ? 'bg-yellow-600 hover:bg-yellow-700 text-white' : 'bg-yellow-500 hover:bg-yellow-600 text-white'}`}
              >
                Clear & Sync
              </button>
            </div>
          </div>
        )}
        
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div>
            <h1 className={`text-4xl font-bold mb-2 ${textColor}`}>
              <span className="inline-flex items-center gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-10 w-10 ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2zM10 8.5a.5.5 0 11-1 0 .5.5 0 011 0zm5 5a.5.5 0 11-1 0 .5.5 0 011 0z" />
                </svg>
                Business Records
              </span>
            </h1>
            <p className={`text-lg ${secondaryTextColor}`}>
              Digitize receipts, invoices, and documents with AI-powered OCR
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {!showAddForm && records.length > 0 && (
              <>
                <Button data-cy="print-records" onClick={printRecords} variant="secondary" size="md" className="print:hidden">
                  <span className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                    Print
                  </span>
                </Button>
                <Button data-cy="export-records" onClick={() => handleDownloadCSV(records)} variant="secondary" size="md" className="print:hidden">
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
                <p className={`text-3xl font-bold ${textColor}`}>{records.length}</p>
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
                <p className={`text-3xl font-bold ${textColor}`}>{records.filter(r => r.imagePath).length}</p>
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
                <p className={`text-3xl font-bold ${textColor}`}>
                  KSH {records.reduce((sum, r) => sum + (Number(r.amount) || 0), 0).toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters Section */}
      {(userRole === 'seller' || userRole === 'customer') && (
        <div className={`mb-6 p-4 rounded-lg shadow ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}>
          <h3 className={`text-lg font-semibold mb-4 ${textColor}`}>Filter Records</h3>
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
            {(filterSource !== 'all' || filterRecordType !== 'all' || filterService !== 'all') && (
              <button
                onClick={() => {
                  clearFilters();
                  setSearchParams({ page: '1' });
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
        <OcrUploader 
          onOcrComplete={handleOcrComplete} 
          externalBlock={blockUploaderOverlay} 
          onAnalyzingChange={(v) => setOcrAnalyzing(Boolean(v))} 
        />
      </div>

      {/* Add Record Form */}
      {showAddForm && (
        <div>
          {/* Persistent analyzing indicator while form is open and OCR analysis still in-flight */}
          {ocrAnalyzing && (
            <div className="mb-4 p-3 rounded-lg border-l-4 border-yellow-400 bg-yellow-50 text-yellow-700">
              <div className="flex items-center gap-3">
                <svg className="h-5 w-5 animate-spin text-yellow-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                </svg>
                <div className="text-sm">Analyzing document... analysis still running — form opened for review.</div>
              </div>
            </div>
          )}
          <AddRecordForm
            onAddRecord={handleAddRecordWrapper}
            onCancel={handleCancelAdd}
            initialData={ocrData}
            onFormReady={() => setBlockUploaderOverlay(false)}
          />
        </div>
      )}

      {/* Record Cards */}
      {!showAddForm && records.length > 0 && (
        <div className="space-y-4">
          {pagedRecords.map((record) => (
            <div 
              key={record._id} 
              className={`p-6 border rounded-xl shadow-md backdrop-blur-sm transition-all hover:shadow-lg ${theme === 'dark' ? 'bg-gray-800/80 border-gray-700/50' : 'bg-white/80 border-gray-200/50'}`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`p-2 rounded-lg ${theme === 'dark' ? 'bg-red-900/20' : 'bg-red-50'}`}>
                      <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className={`text-xl font-bold ${textColor} mb-1`}>
                        {record.description || getRecordTypeLabel(record.recordType)}
                      </h3>
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${theme === 'dark' ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-700'}`}>
                          {getRecordTypeLabel(record.recordType)}
                        </span>
                        {record.uploadReason === 'customer_uploaded' && (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${theme === 'dark' ? 'bg-purple-900/30 text-purple-300' : 'bg-purple-100 text-purple-700'}`}>
                            Customer Upload
                          </span>
                        )}
                      </div>
                      
                      {/* Service and Reason */}
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
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-6 sm:w-6 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="text-base sm:text-2xl font-bold break-all"><span className="hidden xs:inline">KSH </span>{(Number(record.amount) || 0).toFixed(2)}</span>
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
                
                <div className="flex gap-2 ml-4">
                  <Button 
                    onClick={() => navigate(`/records/${record._id}`)} 
                    variant="primary" 
                    size="sm"
                  >
                    <span className="flex items-center gap-2">View</span>
                  </Button>
                  <Button 
                    variant="danger" 
                    size="sm" 
                    onClick={() => setConfirmDeleteRecordId(record._id)}
                    loading={deletingRecordId === record._id}
                    disabled={deletingRecordId === record._id}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!showAddForm && records.length === 0 && (
        <div className={`text-center py-16 px-6 rounded-2xl ${theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-50/80'}`}>
          <div className={`w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'}`}>
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-10 w-10 ${secondaryTextColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2zM10 8.5a.5.5 0 11-1 0 .5.5 0 011 0zm5 5a.5.5 0 11-1 0 .5.5 0 011 0z" />
            </svg>
          </div>
          <h3 className={`text-2xl font-bold mb-2 ${textColor}`}>No Records Yet</h3>
          <p className={`mb-6 max-w-md mx-auto ${secondaryTextColor}`}>
            Upload your first receipt or invoice to get started with AI-powered OCR.
          </p>
        </div>
      )}

      {/* Pagination controls */}
      {totalPages > 1 && !showAddForm && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <button
            onClick={() => setSearchParams({ page: String(Math.max(1, currentPage - 1)) })}
            disabled={currentPage === 1}
            className={`px-3 py-1 rounded ${currentPage === 1 ? 'opacity-50 cursor-not-allowed' : (theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300')}`}
          >
            Prev
          </button>

          {Array.from({ length: totalPages }).map((_, i) => {
            const p = i + 1;
            return (
              <button
                key={p}
                onClick={() => setSearchParams({ page: String(p) })}
                className={`px-3 py-1 rounded ${p === currentPage ? (theme === 'dark' ? 'bg-red-400 text-gray-900' : 'bg-red-500 text-white') : (theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-100 hover:bg-gray-200')}`}
              >
                {p}
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

      {/* Confirm delete modal */}
      <ConfirmModal
        isOpen={Boolean(confirmDeleteRecordId)}
        title="Delete Record"
        message="Are you sure you want to delete this record? Action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onCancel={() => setConfirmDeleteRecordId(null)}
        confirmLoading={deletingRecordId === confirmDeleteRecordId}
        onConfirm={async () => {
          const idToDelete = confirmDeleteRecordId;
          setConfirmDeleteRecordId(null);
          if (idToDelete) {
            await handleDeleteRecordWrapper(idToDelete);
          }
        }}
      />
    </div>
  );
};

export default RecordsPage;
