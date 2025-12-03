import React, { useState } from 'react';
import { useUser, useAuth } from '@clerk/clerk-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';

// Hooks
import { useInvoiceData } from '../../hooks/InvoicesPage/useInvoiceData';
import { useInvoiceFilters } from '../../hooks/InvoicesPage/useInvoiceFilters';
import { useInvoiceCrud } from '../../hooks/InvoicesPage/useInvoiceCrud';

// Components
import { InvoiceHeader } from './components/InvoiceHeader';
import { InvoiceFilters } from './components/InvoiceFilters';
import { InvoiceList } from './components/InvoiceList';
import AddInvoiceForm from '../../components/AddInvoiceForm';
import Button from '../../components/Button';
import QueueStatus from '../../components/QueueStatus';
import ConfirmModal from '../../components/ConfirmModal';
import Modal from '../../components/Modal';
import CenteredLoader from '../../components/CenteredLoader';

// Utilities
import { handleDownloadCSV } from '../../utils/InvoicesPage/csvExport';
import { printInvoices } from '../../utils/InvoicesPage/printHelpers';
import { calculateInvoiceStats } from '../../utils/InvoicesPage/invoiceHelpers';

/**
 * InvoicesPage - Refactored orchestrator
 * Manages invoice listing, creation, deletion, and filtering
 */
const InvoicesPage = () => {
  const { user } = useUser();
  const { theme } = useTheme();
  useAuth();

  // Custom hooks
  const {
    invoices,
    loading,
    error,
    setError,
    reloadLocal,
    sellerOptions,
    serviceOptions,
    customerOptions,
  } = useInvoiceData();

  const {
    sellerFilter,
    setSellerFilter,
    customerFilter,
    setCustomerFilter,
    serviceFilter,
    setServiceFilter,
    serverFilteredInvoices,
    clearFilters,
  } = useInvoiceFilters();

  const {
    isCreating,
    deletingInvoiceId,
    handleAddInvoice,
    handleDeleteInvoice,
  } = useInvoiceCrud();

  // Local UI state
  const [showErrorBanner, setShowErrorBanner] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [confirmDeleteInvoiceId, setConfirmDeleteInvoiceId] = useState(null);

  // Pagination
  const [searchParams, setSearchParams] = useSearchParams();
  const PAGE_SIZE = 5;
  const pageParam = parseInt(searchParams.get('page') || '1', 10);
  const currentPage = Number.isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;

  // Derive role and theme colors
  const role = user?.publicMetadata?.role;
  const textColor = theme === 'dark' ? 'text-white' : 'text-gray-900';
  const secondaryTextColor = theme === 'dark' ? 'text-gray-300' : 'text-gray-600';

  // Filter invoices based on current filters
  const filteredInvoices = invoices.filter(inv => {
    if (sellerFilter) {
      const sellerName = (inv.sellerName || '').toLowerCase();
      const sellerPrefix = (inv.sellerPrefix || '').toLowerCase();
      const sf = sellerFilter.toLowerCase();
      if (!sellerName.includes(sf) && !sellerPrefix.includes(sf)) return false;
    }
    if (customerFilter) {
      const cn = (inv.customerName || inv.customer || inv.customerEmail || '').toLowerCase();
      if (!cn.includes(customerFilter.toLowerCase())) return false;
    }
    if (serviceFilter) {
      const invoiceService = (inv.service || '').trim();
      if (invoiceService !== serviceFilter) return false;
    }
    return true;
  });

  // Calculate stats
  const stats = calculateInvoiceStats(filteredInvoices);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredInvoices.length / PAGE_SIZE));
  const pagedInvoices = filteredInvoices.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Use server-filtered results if available
  const displayInvoices = serverFilteredInvoices || pagedInvoices;

  // Handlers
  const handleCreateInvoice = async (invoiceData) => {
    try {
      await handleAddInvoice(invoiceData);
      await reloadLocal();
      setShowAddForm(false);
    } catch (err) {
      setError('Failed to save invoice locally.');
      setShowErrorBanner(true);
      console.error('Add invoice error:', err);
    }
  };

  const handleDelete = async (invoiceId) => {
    try {
      await handleDeleteInvoice(invoiceId);
    } catch (err) {
      setError('Failed to delete invoice locally.');
      setShowErrorBanner(true);
      console.error('Delete invoice error:', err);
    }
  };

  const handleConfirmDelete = async () => {
    const idToDelete = confirmDeleteInvoiceId;
    setConfirmDeleteInvoiceId(null);
    if (idToDelete) {
      await handleDelete(idToDelete);
    }
  };

  const handleViewInvoice = (invoiceId) => {
    // Navigation is handled by Link components in InvoiceCard
  };

  if (loading && invoices.length === 0) {
    return <CenteredLoader message="Loading invoices..." />;
  }

  return (
    <div className="px-0 sm:px-4 md:px-6 lg:px-8 max-w-7xl mx-auto">
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

      {/* Back link for mobile */}
      <div className="mb-2 md:hidden px-3 sm:px-4">
        <Link 
          to={role === 'seller' ? '/seller-dashboard' : '/customer-dashboard'} 
          className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
          Back to Dashboard
        </Link>
      </div>

      {/* Header Section */}
      <div className={`mb-4 sm:mb-6 md:mb-8 mx-3 sm:mx-0 p-4 sm:p-6 md:p-8 rounded-2xl shadow-xl backdrop-blur-sm ${theme === 'dark' ? 'bg-gray-800/90 border border-gray-700/50' : 'bg-white/90 border border-gray-200/50'}`}>
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div>
            <h1 className={`text-4xl font-bold mb-2 ${textColor}`}>
              <span className="inline-flex items-center gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-10 w-10 ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Invoice Management
              </span>
            </h1>
            <p className={`text-lg ${secondaryTextColor}`}>
              Create, track, and manage your invoices
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <InvoiceHeader
              onCreateClick={() => setShowAddForm(true)}
              onPrintClick={printInvoices}
              onDownloadCSV={() => handleDownloadCSV(filteredInvoices)}
              showAddForm={showAddForm}
            />
            
            {/* View Disputes Button */}
            <Link to="/dispute-review">
              <Button
                variant="secondary"
                className="relative whitespace-nowrap"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                View Disputes
                {(() => {
                  const pendingCount = filteredInvoices.filter(inv => 
                    inv.disputes?.some(d => d.status === 'pending' || d.status === 'under-review')
                  ).length;
                  const resolvedCount = filteredInvoices.filter(inv => 
                    inv.disputes?.some(d => d.status === 'accepted' || d.status === 'rejected')
                  ).length;
                  
                  return (
                    <span className="ml-2 flex items-center gap-1">
                      {pendingCount > 0 && (
                        <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-orange-500 text-white">
                          {pendingCount}
                        </span>
                      )}
                      {resolvedCount > 0 && (
                        <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-blue-500 text-white">
                          {resolvedCount}
                        </span>
                      )}
                    </span>
                  );
                })()}
              </Button>
            </Link>
          </div>
        </div>

        {/* Queue Status */}
        <QueueStatus onDismiss={() => setError(null)} />

        {/* Filters */}
        <div className="mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {role !== 'seller' && (
              <div>
                <label className={`block text-sm font-medium ${secondaryTextColor} mb-1`}>Filter by Seller</label>
                <select 
                  value={sellerFilter} 
                  onChange={(e) => setSellerFilter(e.target.value)} 
                  className={`w-full p-2 rounded border ${theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200'}`}
                >
                  <option value="">All sellers</option>
                  {sellerOptions.map((s, idx) => <option key={idx} value={s}>{s}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className={`block text-sm font-medium ${secondaryTextColor} mb-1`}>Filter by Customer</label>
              <select 
                value={customerFilter} 
                onChange={(e) => setCustomerFilter(e.target.value)} 
                className={`w-full p-2 rounded border ${theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200'}`}
              >
                <option value="">All customers</option>
                {customerOptions.map((c, idx) => <option key={idx} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={`block text-sm font-medium ${secondaryTextColor} mb-1`}>Filter by Service</label>
              <select 
                value={serviceFilter} 
                onChange={(e) => setServiceFilter(e.target.value)} 
                className={`w-full p-2 rounded border ${theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200'}`}
              >
                <option value="">All services</option>
                {serviceOptions.map((s, idx) => <option key={idx} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* Active filter pills */}
          {(sellerFilter || customerFilter || serviceFilter) && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {sellerFilter && (
                <div className={`${theme === 'dark' ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-800'} inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm`}>
                  <strong className="mr-1">Seller:</strong> <span>{sellerFilter}</span>
                  <button onClick={() => setSellerFilter('')} className="ml-2 text-xs text-gray-400 hover:text-gray-600">✕</button>
                </div>
              )}
              {customerFilter && (
                <div className={`${theme === 'dark' ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-800'} inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm`}>
                  <strong className="mr-1">Customer:</strong> <span>{customerFilter}</span>
                  <button onClick={() => setCustomerFilter('')} className="ml-2 text-xs text-gray-400 hover:text-gray-600">✕</button>
                </div>
              )}
              {serviceFilter && (
                <div className={`${theme === 'dark' ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-800'} inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm`}>
                  <strong className="mr-1">Service:</strong> <span>{serviceFilter}</span>
                  <button onClick={() => setServiceFilter('')} className="ml-2 text-xs text-gray-400 hover:text-gray-600">✕</button>
                </div>
              )}
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={() => { 
                  clearFilters(); 
                  setSearchParams({ page: '1' }); 
                }} 
                className="ml-2"
              >
                Clear Filters
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      {!showAddForm && invoices.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 sm:gap-4 md:gap-6 mb-6 sm:mb-8">
          <div className={`p-6 rounded-xl backdrop-blur-sm ${theme === 'dark' ? 'bg-gray-800/80 border border-gray-700/50' : 'bg-white/80 border border-gray-200/50'}`}>
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${theme === 'dark' ? 'bg-blue-900/40' : 'bg-blue-100'}`}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <p className={`text-sm ${secondaryTextColor}`}>Total Invoices</p>
                <p className={`text-3xl font-bold ${textColor}`}>{stats.total}</p>
              </div>
            </div>
          </div>

          <div className={`p-6 rounded-xl backdrop-blur-sm ${theme === 'dark' ? 'bg-gray-800/80 border border-gray-700/50' : 'bg-white/80 border border-gray-200/50'}`}>
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${theme === 'dark' ? 'bg-green-900/40' : 'bg-green-100'}`}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className={`text-sm ${secondaryTextColor}`}>Paid</p>
                <p className={`text-3xl font-bold ${textColor}`}>{stats.paid}</p>
              </div>
            </div>
          </div>

          <div className={`p-6 rounded-xl backdrop-blur-sm ${theme === 'dark' ? 'bg-gray-800/80 border border-gray-700/50' : 'bg-white/80 border border-gray-200/50'}`}>
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${theme === 'dark' ? 'bg-yellow-900/40' : 'bg-yellow-100'}`}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-yellow-600 dark:text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className={`text-sm ${secondaryTextColor}`}>Pending</p>
                <p className={`text-3xl font-bold ${textColor}`}>{stats.pending}</p>
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
                <p className={`text-sm ${secondaryTextColor}`}>Total Value</p>
                <p className={`text-3xl font-bold ${textColor}`}>
                  KSH {stats.totalAmount.toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Invoice Form */}
      {showAddForm && (
        <AddInvoiceForm
          onSaveInvoice={handleCreateInvoice}
          onCancel={() => setShowAddForm(false)}
          saving={isCreating}
        />
      )}

      {/* Invoice List */}
      {!showAddForm && (
        <>
          {invoices.length > 0 ? (
            <>
              <div className={`mb-4 px-4 py-2 rounded-lg ${theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-100/80'}`}>
                <p className={`text-sm ${secondaryTextColor}`}>
                  Showing <span className="font-semibold">{displayInvoices.length}</span> of <span className="font-semibold">{filteredInvoices.length}</span> invoice{filteredInvoices.length !== 1 ? 's' : ''}
                </p>
              </div>

              <div className="space-y-4">
                {displayInvoices.map((invoice) => {
                  const statusConfig = {
                    paid: { bg: 'bg-green-100 dark:bg-green-500', text: 'text-green-800 dark:text-white', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
                    sent: { bg: 'bg-blue-100 dark:bg-blue-500', text: 'text-blue-800 dark:text-white', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
                    overdue: { bg: 'bg-red-100 dark:bg-red-500', text: 'text-red-800 dark:text-white', icon: 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
                    draft: { bg: 'bg-yellow-100 dark:bg-yellow-500', text: 'text-yellow-800 dark:text-gray-900', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' }
                  };
                  const status = invoice.status || 'draft';
                  const config = statusConfig[status] || statusConfig.draft;

                  return (
                    <div key={invoice._id} className={`p-6 border rounded-xl shadow-md backdrop-blur-sm transition-all hover:shadow-lg ${theme === 'dark' ? 'bg-gray-800/80 border-gray-700/50' : 'bg-white/80 border-gray-200/50'}`}>
                      <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${theme === 'dark' ? 'bg-red-900/40' : 'bg-red-100'}`}>
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </div>
                            <div>
                              <Link to={`/invoices/${invoice._id}`} className={`font-bold text-2xl hover:underline ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`}>
                                #{invoice.invoiceNumber}
                              </Link>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <div className={`flex items-center gap-2 ${secondaryTextColor}`}>
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                              <span>{invoice.customerName || '[Deleted Customer]'}</span>
                            </div>
                            <div className={`flex items-center gap-2 ${textColor}`}>
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span className="text-base sm:text-xl font-bold truncate"><span className="hidden xs:inline">KSH </span>{(Number(invoice.total) || 0).toFixed(2)}</span>
                            </div>
                            {invoice.dueDate && (
                              <div className={`flex items-center gap-2 text-sm ${secondaryTextColor}`}>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                Due: {new Date(invoice.dueDate).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col gap-3 items-end">
                          <div className="flex flex-col items-end gap-2">
                            <div className={`px-4 py-2 rounded-full text-sm font-bold uppercase flex items-center gap-2 ${config.bg} ${config.text}`}>
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={config.icon} />
                              </svg>
                              {status === 'sent' ? 'Pending' : status}
                            </div>
                            
                            {/* Dispute Indicator */}
                            {invoice.disputeStatus && invoice.disputeStatus !== 'none' && (
                              <div className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 ${
                                invoice.disputeStatus === 'disputed' 
                                  ? 'bg-orange-200 text-orange-900 dark:bg-orange-600 dark:text-white'
                                  : invoice.disputeStatus === 'under-review'
                                  ? 'bg-purple-200 text-purple-900 dark:bg-purple-600 dark:text-white'
                                  : 'bg-blue-200 text-blue-900 dark:bg-blue-600 dark:text-white'
                              }`}>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                {invoice.disputeStatus.replace('-', ' ')}
                                {invoice.disputes && invoice.disputes.length > 0 && ` (${invoice.disputes.length})`}
                              </div>
                            )}
                          </div>
                          
                          <div className="flex gap-2">
                            <Link to={`/invoices/${invoice._id}`}>
                              <Button variant="secondary" size="sm">
                                <span className="flex items-center gap-2">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                  </svg>
                                  View
                                </span>
                              </Button>
                            </Link>
                            {invoice.status === 'draft' && (
                              <Button 
                                onClick={() => setConfirmDeleteInvoiceId(invoice._id)} 
                                variant="danger" 
                                size="sm" 
                                loading={deletingInvoiceId === invoice._id} 
                                disabled={deletingInvoiceId === invoice._id}
                              >
                                <span className="flex items-center gap-2">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                  Delete
                                </span>
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              {totalPages > 1 && !serverFilteredInvoices && (
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
            </>
          ) : (
            <div className={`text-center py-16 px-6 rounded-2xl ${theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-50/80'}`}>
              <div className={`w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'}`}>
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-10 w-10 ${secondaryTextColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className={`text-2xl font-bold mb-2 ${textColor}`}>No Invoices Yet</h3>
              <p className={`mb-6 max-w-md mx-auto ${secondaryTextColor}`}>
                Create your first invoice to start tracking payments and managing customer billing.
              </p>
              <Button onClick={() => setShowAddForm(true)} variant="primary">
                <span className="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                  </svg>
                  Create Your First Invoice
                </span>
              </Button>
            </div>
          )}
        </>
      )}

      {/* Confirm Delete Modal */}
      <ConfirmModal
        isOpen={Boolean(confirmDeleteInvoiceId)}
        title="Delete Invoice"
        message="Are you sure you want to delete this invoice? Action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onCancel={() => setConfirmDeleteInvoiceId(null)}
        confirmLoading={deletingInvoiceId === confirmDeleteInvoiceId}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
};

export default InvoicesPage;
