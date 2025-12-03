import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import api from '../services/api';
import db from '../db';
import CenteredLoader from './CenteredLoader';
import Button from './Button';

const DisputeReviewDashboard = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('invoices'); // 'invoices' or 'records'
  const [disputes, setDisputes] = useState([]);
  const [allDisputes, setAllDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [resolvingDispute, setResolvingDispute] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'pending', 'accepted', 'rejected'
  const [customerFilter, setCustomerFilter] = useState('');
  const [serviceFilter, setServiceFilter] = useState('');
  const [uniqueCustomers, setUniqueCustomers] = useState([]);
  const [uniqueServices, setUniqueServices] = useState([]);
  const [utilityServices, setUtilityServices] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [invoiceDisputeCount, setInvoiceDisputeCount] = useState(0);
  const [recordDisputeCount, setRecordDisputeCount] = useState(0);
  const PAGE_SIZE = 5;

  useEffect(() => {
    // Load utility services from database
    const loadUtilityServices = async () => {
      try {
        const services = await db.utilityServices.toArray();
        const serviceNames = services
          .map(s => s.name && String(s.name).trim())
          .filter(Boolean)
          .sort();
        setUtilityServices(serviceNames);
      } catch (err) {
        console.error('Failed to load utility services:', err);
      }
    };

    loadUtilityServices();
  }, []);

  useEffect(() => {
    // Reset filters when switching tabs
    setCustomerFilter('');
    setServiceFilter('');
    setStatusFilter('all');
    setCurrentPage(1);
    loadDisputes();
  }, [activeTab, utilityServices]); // Add utilityServices dependency so it updates when services load

  useEffect(() => {
    setCurrentPage(1); // Reset to page 1 when filters change
    applyFilters();
  }, [statusFilter, customerFilter, serviceFilter, allDisputes]);

  const loadDisputes = async () => {
    try {
      setLoading(true);
      setError(null);

      // api service automatically handles authentication via interceptor
      if (activeTab === 'invoices') {
        const response = await api.get('/invoices/disputed');
        const invoicesData = response.data.invoices || [];
        setAllDisputes(invoicesData);
        setInvoiceDisputeCount(invoicesData.length); // Store count for tab badge
        
        // Extract unique customers
        const customers = Array.from(new Set(
          invoicesData.map(inv => inv.customerName).filter(Boolean)
        )).sort();
        setUniqueCustomers(customers);
        // Services come from utilityServices table loaded on mount
        setUniqueServices(utilityServices);
      } else {
        // Get records with disputes
        const response = await api.get('/records/shared-by-me');
        const recordsWithDisputes = (response.data.records || []).filter(
          r => r.verifications?.some(v => ['disputed', 'accepted', 'rejected'].includes(v.status))
        );
        setAllDisputes(recordsWithDisputes);
        setRecordDisputeCount(recordsWithDisputes.length); // Store count for tab badge
        
        // Extract unique customers from records
        const customers = Array.from(new Set(
          recordsWithDisputes.map(rec => rec.customerName).filter(Boolean)
        )).sort();
        setUniqueCustomers(customers);
        // For records, combine utility services with record types
        const recordTypes = Array.from(new Set(
          recordsWithDisputes
            .map(rec => rec.recordType && String(rec.recordType).trim())
            .filter(Boolean)
        )).sort();
        setUniqueServices([...utilityServices, ...recordTypes].filter((v, i, a) => a.indexOf(v) === i).sort());
      }
    } catch (err) {
      console.error('Error loading disputes:', err);
      setError(err.response?.data?.message || 'Failed to load disputes');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = allDisputes;

    if (activeTab === 'invoices') {
      // Filter by customer (exact match)
      if (customerFilter) {
        filtered = filtered.filter(inv => inv.customerName === customerFilter);
      }

      // Filter by service (exact match)
      if (serviceFilter) {
        filtered = filtered.filter(inv => inv.service === serviceFilter);
      }

      // Filter by status
      if (statusFilter !== 'all') {
        filtered = filtered.filter(inv => 
          inv.disputes?.some(d => d.status === statusFilter || 
            (statusFilter === 'pending' && d.status === 'under-review'))
        );
      }
    } else {
      // Record filters (exact match)
      if (customerFilter) {
        filtered = filtered.filter(rec => rec.customerName === customerFilter);
      }

      if (serviceFilter) {
        filtered = filtered.filter(rec => 
          rec.service === serviceFilter || rec.recordType === serviceFilter
        );
      }

      if (statusFilter !== 'all') {
        filtered = filtered.filter(rec => 
          rec.verifications?.some(v => v.status === statusFilter)
        );
      }
    }

    setDisputes(filtered);
  };

  const handleResolveInvoiceDispute = async (invoiceId, disputeId, resolution, notes, applyChanges) => {
    try {
      setResolvingDispute(disputeId);

      // api service automatically handles authentication via interceptor
      await api.put(
        `/invoices/${invoiceId}/resolve-dispute`,
        {
          disputeId,
          status: resolution,
          resolutionNotes: notes,
          applyChanges
        }
      );

      await loadDisputes();
    } catch (err) {
      console.error('Error resolving dispute:', err);
      toast.error(err.response?.data?.message || 'Failed to resolve dispute');
    } finally {
      setResolvingDispute(null);
    }
  };

  const handleResolveRecordDispute = async (recordId, verificationId, resolution, applyCorrections) => {
    try {
      setResolvingDispute(verificationId);

      // api service automatically handles authentication via interceptor
      await api.put(
        `/records/${recordId}/resolve-dispute`,
        {
          verificationId,
          resolution,
          acceptCorrections: applyCorrections
        }
      );

      await loadDisputes();
    } catch (err) {
      console.error('Error resolving dispute:', err);
      toast.error(err.response?.data?.message || 'Failed to resolve dispute');
    } finally {
      setResolvingDispute(null);
    }
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return <CenteredLoader message="Loading disputes..." />;
  }

  const textColor = theme === 'dark' ? 'text-white' : 'text-gray-900';
  const secondaryTextColor = theme === 'dark' ? 'text-gray-300' : 'text-gray-600';
  const cardBg = theme === 'dark' ? 'bg-gray-800' : 'bg-white';
  const borderColor = theme === 'dark' ? 'border-gray-700' : 'border-gray-200';

  return (
    <div className="max-w-7xl mx-auto">
      {/* Back to Dashboard Link */}
      <div className="mb-4">
        <button
          onClick={() => navigate('/seller-dashboard')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
            theme === 'dark'
              ? 'text-blue-400 hover:text-blue-300 hover:bg-gray-800'
              : 'text-blue-600 hover:text-blue-700 hover:bg-gray-100'
          }`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
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
        </button>
      </div>
      <div className="mb-6">
        <h1 className={`text-3xl font-bold ${textColor} mb-2 flex items-center gap-3`}>
          <svg className={`w-9 h-9 ${theme === 'dark' ? 'text-orange-400' : 'text-orange-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          Dispute Review Dashboard
        </h1>
        <p className={secondaryTextColor}>
          Review and resolve customer disputes on invoices and records
        </p>
      </div>

      {/* Tab Navigation */}
      <div className={`flex gap-4 mb-6 border-b ${borderColor}`}>
        <button
          onClick={() => setActiveTab('invoices')}
          className={`pb-3 px-4 font-medium transition-colors ${
            activeTab === 'invoices'
              ? `border-b-2 ${theme === 'dark' ? 'border-blue-400 text-blue-400' : 'border-blue-600 text-blue-600'}`
              : `${secondaryTextColor} ${theme === 'dark' ? 'hover:text-white' : 'hover:text-gray-900'}`
          }`}
        >
          Invoice Disputes ({invoiceDisputeCount})
        </button>
        <button
          onClick={() => setActiveTab('records')}
          className={`pb-3 px-4 font-medium transition-colors ${
            activeTab === 'records'
              ? `border-b-2 ${theme === 'dark' ? 'border-blue-400 text-blue-400' : 'border-blue-600 text-blue-600'}`
              : `${secondaryTextColor} ${theme === 'dark' ? 'hover:text-white' : 'hover:text-gray-900'}`
          }`}
        >
          Record Disputes ({recordDisputeCount})
        </button>
      </div>

      {/* Filters */}
      <div className={`mb-6 p-4 rounded-lg ${cardBg} shadow`}>
        <h3 className={`text-sm font-semibold ${textColor} mb-3`}>Filters</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className={`block text-xs font-medium ${secondaryTextColor} mb-1`}>Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={`w-full px-3 py-2 rounded-lg border text-sm ${
                theme === 'dark'
                  ? 'bg-gray-700 border-gray-600 text-white'
                  : 'bg-white border-gray-300 text-gray-900'
              }`}
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="accepted">Accepted</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <div>
            <label className={`block text-xs font-medium ${secondaryTextColor} mb-1`}>Customer</label>
            <select
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
              className={`w-full px-3 py-2 rounded-lg border text-sm ${
                theme === 'dark'
                  ? 'bg-gray-700 border-gray-600 text-white'
                  : 'bg-white border-gray-300 text-gray-900'
              }`}
            >
              <option value="">All Customers</option>
              {uniqueCustomers.map((customer, idx) => (
                <option key={idx} value={customer}>{customer}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={`block text-xs font-medium ${secondaryTextColor} mb-1`}>Service</label>
            <select
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
              className={`w-full px-3 py-2 rounded-lg border text-sm ${
                theme === 'dark'
                  ? 'bg-gray-700 border-gray-600 text-white'
                  : 'bg-white border-gray-300 text-gray-900'
              }`}
            >
              <option value="">All Services</option>
              {uniqueServices.map((service, idx) => (
                <option key={idx} value={service}>{service}</option>
              ))}
            </select>
          </div>
        </div>
        
        {/* Active filter pills + clear button */}
        {(statusFilter !== 'all' || customerFilter || serviceFilter) && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {statusFilter !== 'all' && (
              <div className={`${theme === 'dark' ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-800'} inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm`}>
                <strong className="mr-1">Status:</strong> <span>{statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}</span>
                <button onClick={() => setStatusFilter('all')} className="ml-2 text-xs text-gray-400 hover:text-gray-600">✕</button>
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
                setStatusFilter('all'); 
                setCustomerFilter(''); 
                setServiceFilter(''); 
              }} 
              className="ml-2"
            >
              Clear Filters
            </Button>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className={`mb-6 p-4 rounded-lg border ${theme === 'dark' ? 'bg-red-900/20 border-red-800 text-red-200' : 'bg-red-50 border-red-200 text-red-800'}`}>
          <p>{error}</p>
        </div>
      )}

      {/* Disputes List */}
      {disputes.length === 0 ? (
        <div className={`text-center py-12 ${cardBg} rounded-lg shadow`}>
          <svg className={`w-12 h-12 mx-auto mb-4 ${theme === 'dark' ? 'text-green-400' : 'text-green-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className={secondaryTextColor}>
            No pending disputes - all clear!
          </p>
        </div>
      ) : (
        <>
          <div className={`mb-4 px-4 py-2 rounded-lg ${theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-100/80'}`}>
            <p className={`text-sm ${secondaryTextColor}`}>
              Showing <span className="font-semibold">{Math.min((currentPage - 1) * PAGE_SIZE + 1, disputes.length)}-{Math.min(currentPage * PAGE_SIZE, disputes.length)}</span> of <span className="font-semibold">{disputes.length}</span> dispute{disputes.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="space-y-6">
          {activeTab === 'invoices' ? (
            // Invoice Disputes
            disputes.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE).map((invoice) => (
              <div
                key={invoice._id}
                className={`${cardBg} rounded-lg shadow p-6`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className={`text-xl font-semibold ${textColor}`}>
                      Invoice {invoice.publicInvoiceId || invoice.invoiceNumber}
                    </h3>
                    <p className={`text-sm ${secondaryTextColor} mt-1`}>
                      Customer: {invoice.customerName} • Total: KSH {invoice.total.toFixed(2)}
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => navigate(`/invoices/${invoice._id}`)}
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    View Invoice
                  </Button>
                </div>

                {/* Disputes */}
                <div className="space-y-4">
                  {invoice.disputes?.map((dispute) => {
                    const isPending = dispute.status === 'pending' || dispute.status === 'under-review';
                    const isResolved = dispute.status === 'accepted' || dispute.status === 'rejected';
                    const bgColor = isPending 
                      ? (theme === 'dark' ? 'bg-orange-900/20 border-orange-800' : 'bg-orange-50 border-orange-200')
                      : (theme === 'dark' ? 'bg-blue-900/20 border-blue-800' : 'bg-blue-50 border-blue-200');
                    
                    return (
                    <div
                      key={dispute._id}
                      className={`p-4 rounded-lg border ${bgColor}`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <p className={`font-medium ${textColor}`}>
                            {dispute.lineItemIndex !== null
                              ? `Line Item #${dispute.lineItemIndex + 1}: ${invoice.items[dispute.lineItemIndex]?.description}`
                              : 'Total Invoice Amount'}
                          </p>
                          {dispute.field && (
                            <p className={`text-sm ${secondaryTextColor} mt-1`}>
                              Field: {dispute.field}
                              {dispute.originalValue && ` • Current: ${dispute.originalValue}`}
                              {dispute.suggestedValue && ` → Suggested: ${dispute.suggestedValue}`}
                            </p>
                          )}
                        </div>
                        <span className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
                          isPending
                            ? 'bg-orange-500 text-white'
                            : 'bg-blue-500 text-white'
                        }`}>
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isPending ? "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" : "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"} />
                          </svg>
                          {dispute.status}
                        </span>
                      </div>

                      <div className="mb-3">
                        <p className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'} mb-1`}>
                          Customer's Reason:
                        </p>
                        <p className={`text-sm ${textColor} ${theme === 'dark' ? 'bg-gray-700' : 'bg-white'} p-3 rounded`}>
                          {dispute.reason}
                        </p>
                      </div>

                      {isPending && (
                      <div className="flex gap-2">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => {
                            const notes = prompt('Resolution notes (optional):');
                            const applyChanges = dispute.suggestedValue && confirm('Apply the suggested changes to the invoice?');
                            handleResolveInvoiceDispute(invoice._id, dispute._id, 'accepted', notes, applyChanges);
                          }}
                          disabled={resolvingDispute === dispute._id}
                        >
                          <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Accept
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            const notes = prompt('Explain why you are rejecting this dispute:');
                            if (notes) {
                              handleResolveInvoiceDispute(invoice._id, dispute._id, 'rejected', notes, false);
                            }
                          }}
                          disabled={resolvingDispute === dispute._id}
                        >
                          <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Reject
                        </Button>
                      </div>
                      )}
                      
                      {dispute.resolutionNotes && (
                        <div className={`mt-3 pt-3 border-t ${borderColor}`}>
                          <p className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'} mb-1`}>
                            Resolution Notes:
                          </p>
                          <p className={`text-sm ${textColor}`}>
                            {dispute.resolutionNotes}
                          </p>
                        </div>
                      )}
                    </div>
                    );
                  })}
                </div>
              </div>
            ))
          ) : (
            // Record Disputes
            disputes.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE).map((record) => (
              <div
                key={record._id}
                className={`${cardBg} rounded-lg shadow p-6`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className={`text-xl font-semibold ${textColor}`}>
                      {record.recordType} Record
                    </h3>
                    <p className={`text-sm ${secondaryTextColor} mt-1`}>
                      Date: {formatDate(record.recordDate)}
                      {record.description && ` • ${record.description}`}
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => navigate(`/records/${record._id}`)}
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    View Record
                  </Button>
                </div>

                {/* Verifications/Disputes */}
                <div className="space-y-4">
                  {record.verifications?.map((verification) => {
                    const isPending = verification.status === 'disputed';
                    const isResolved = verification.status === 'accepted' || verification.status === 'rejected';
                    const bgColor = isPending 
                      ? (theme === 'dark' ? 'bg-orange-900/20 border-orange-800' : 'bg-orange-50 border-orange-200')
                      : (theme === 'dark' ? 'bg-blue-900/20 border-blue-800' : 'bg-blue-50 border-blue-200');
                    
                    return (
                    <div
                      key={verification._id}
                      className={`p-4 rounded-lg border ${bgColor}`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <p className={`text-sm font-medium ${textColor}`}>Verification Status</p>
                        <span className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
                          isPending
                            ? 'bg-orange-500 text-white'
                            : 'bg-blue-500 text-white'
                        }`}>
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isPending ? "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" : "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"} />
                          </svg>
                          {verification.status}
                        </span>
                      </div>
                      <div className="mb-3">
                        <p className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'} mb-1`}>
                          Customer's Comments:
                        </p>
                        <p className={`text-sm ${textColor} ${theme === 'dark' ? 'bg-gray-700' : 'bg-white'} p-3 rounded`}>
                          {verification.comments || 'No comments provided'}
                        </p>
                      </div>

                      {verification.suggestedCorrections && Object.keys(verification.suggestedCorrections).length > 0 && (
                        <div className="mb-3">
                          <p className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                            Suggested Corrections:
                          </p>
                          <div className={`${theme === 'dark' ? 'bg-gray-700' : 'bg-white'} p-3 rounded space-y-1`}>
                            {Object.entries(verification.suggestedCorrections).map(([field, value]) => (
                              <p key={field} className={`text-sm ${textColor}`}>
                                <span className="font-medium">{field}:</span> {value}
                              </p>
                            ))}
                          </div>
                        </div>
                      )}

                      {isPending && (
                      <div className="flex gap-2">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => {
                            const applyChanges = verification.suggestedCorrections && 
                              confirm('Apply the suggested corrections to the record?');
                            handleResolveRecordDispute(record._id, verification._id, 'accepted', applyChanges);
                          }}
                          disabled={resolvingDispute === verification._id}
                        >
                          <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Accept
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            if (confirm('Reject this dispute?')) {
                              handleResolveRecordDispute(record._id, verification._id, 'rejected', false);
                            }
                          }}
                          disabled={resolvingDispute === verification._id}
                        >
                          <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Reject
                        </Button>
                      </div>
                      )}
                    </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination Controls */}
        {Math.ceil(disputes.length / PAGE_SIZE) > 1 && (
          <div className="mt-6 flex items-center justify-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className={`px-3 py-1 rounded ${currentPage === 1 ? 'opacity-50 cursor-not-allowed' : (theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300')}`}
            >
              Prev
            </button>
            {Array.from({ length: Math.ceil(disputes.length / PAGE_SIZE) }).map((_, i) => {
              const page = i + 1;
              return (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`px-3 py-1 rounded ${page === currentPage ? (theme === 'dark' ? 'bg-red-400 text-gray-900' : 'bg-red-500 text-white') : (theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-100 hover:bg-gray-200')}`}
                >
                  {page}
                </button>
              );
            })}
            <button
              onClick={() => setCurrentPage(p => Math.min(Math.ceil(disputes.length / PAGE_SIZE), p + 1))}
              disabled={currentPage === Math.ceil(disputes.length / PAGE_SIZE)}
              className={`px-3 py-1 rounded ${currentPage === Math.ceil(disputes.length / PAGE_SIZE) ? 'opacity-50 cursor-not-allowed' : (theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300')}`}
            >
              Next
            </button>
          </div>
        )}
      </>
      )}
    </div>
  );
};

export default DisputeReviewDashboard;
