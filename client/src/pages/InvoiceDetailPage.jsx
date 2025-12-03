import React, { useState, useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { useAuth, useUser } from '@clerk/clerk-react';
import Button from '../components/Button';
import { makePayment } from '../services/paymentService';
import { getInvoice, sendInvoice, updateInvoice } from '../services/invoiceService';
import * as dataSyncService from '../services/dataSyncService';
import api from '../services/api';
import PaymentForm from '../components/PaymentForm';
import AddInvoiceForm from '../components/AddInvoiceForm';
import InvoiceDisputeForm from '../components/InvoiceDisputeForm';
import db from '../db'; // Import the Dexie database instance
import { sanitizeForDb, firstOrUndefined, pruneSyncNonCloneable } from '../utils/dbUtils';
import { deepSanitizeAsync } from '../services/queueService';
import QueueStatus from '../components/QueueStatus';
import ConfirmModal from '../components/ConfirmModal';
import Modal from '../components/Modal';
import CenteredLoader from '../components/CenteredLoader';
import { enqueue } from '../services/queueService';

const InvoiceDetailPage = () => {
  const { id } = useParams();
  const { theme } = useTheme();
  const { toast } = useToast();
  const { isLoaded } = useAuth();
  const { user } = useUser();
  const pollIntervalRef = useRef(null);

  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showConfirmSend, setShowConfirmSend] = useState(false);
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const disputesRef = useRef(null);

  // Prepare a wrapper that returns an array (useOfflineFirst expects array or items)
  const fetchWrapper = async () => {
    try {
      if (!isLoaded) return [];
      const userRole = user?.publicMetadata?.role;
      if (userRole === 'seller') {
        const serverInvoice = await getInvoice(id);
        return [serverInvoice];
      } else {
        const response = await api.get(`/portal/invoices/${id}`);
        return [response.data];
      }
    } catch (e) {
      return [];
    }
  };

  // Per-page full-sync removed: central `dataSyncService` handles syncing.

  useEffect(() => {
    if (!isLoaded) return;

    // Local-first read for immediate UI
    const readLocal = async () => {
      try {
        setLoading(true);
        const localInvoice = await firstOrUndefined(db.invoices.where('_id').equals(id));
        if (localInvoice) {
          const resolvedName = await (async () => {
            if (localInvoice.customerName) return localInvoice.customerName;
            const byId = await firstOrUndefined(db.customers.where('_id').equals(String(localInvoice.customerId)));
            if (byId && byId.name) return byId.name;
            try { const byPk = await db.customers.get(localInvoice.customerId); if (byPk && byPk.name) return byPk.name; } catch (e) { }
            return '[Deleted Customer]';
          })();
          setInvoice({ ...localInvoice, customerName: resolvedName });
        }
      } catch (err) {
        console.error('Failed to read local invoice:', err);
        setError('Failed to load invoice.');
      } finally {
        setLoading(false);
      }
    };

    readLocal();
    
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [id, isLoaded, user]);

  const handlePayNow = () => {
    setShowPaymentForm(true);
  };

  const handlePrint = () => {
    // Set document title for print
    const originalTitle = document.title;
    document.title = `Invoice-${invoice.invoiceNumber}`;
    
    window.print();
    
    // Restore original title
    setTimeout(() => {
      document.title = originalTitle;
    }, 100);
  };

  const handleDownloadPDF = () => {
    // Set document title for PDF save
    const originalTitle = document.title;
    document.title = `Invoice-${invoice.invoiceNumber}`;
    
    // Create a printable version and trigger print dialog
    // User can save as PDF from the print dialog
    window.print();
    
    // Restore original title
    setTimeout(() => {
      document.title = originalTitle;
    }, 100);
  };

  const handleDownloadJSON = () => {
    const dataStr = JSON.stringify(invoice, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `invoice-${invoice.invoiceNumber}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePaymentSubmit = async (paymentDetails) => {
    setPaymentLoading(true);
    try {
      const response = await makePayment(id, paymentDetails);
      
      // For card payments, redirect to payment URL
      if (paymentDetails.paymentMethod === 'card' && response.url) {
        window.location.href = response.url;
        return;
      }
      
      // For M-Pesa, show success message and poll for status
      toast.success('Payment initiated successfully! We will update the status once payment is confirmed.');
      setShowPaymentForm(false);

      // Clear any existing polling
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }

      const pollInterval = 5000; // 5 seconds
      const maxAttempts = 24; // 24 attempts * 5 seconds = 120 seconds (2 minutes)
      let attempts = 0;

      const poll = setInterval(async () => {
        attempts++;
        try {
          const userRole = user?.publicMetadata?.role;
          const endpoint = userRole === 'seller' ? `/invoices/${id}` : `/portal/invoices/${id}`;
          const response = await api.get(endpoint);
          
          if (response.data.status === 'paid' || attempts >= maxAttempts) {
            setInvoice(response.data); // Update with latest data regardless
            clearInterval(poll);
            pollIntervalRef.current = null;
            if (response.data.status !== 'paid' && attempts >= maxAttempts) {
              setError('Payment status check timed out. Please refresh the page to see the latest status.');
            }
          }
        } catch (err) {
          clearInterval(poll);
          pollIntervalRef.current = null;
          console.error('Polling for invoice status failed:', err);
        }
      }, pollInterval);
      pollIntervalRef.current = poll;

    } catch (err) {
      setError('Failed to initiate payment. Please try again.');
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleSendInvoice = async () => {
    setSending(true);
      try {
      // Optimistically update the local database (lookup primary key by `_id`)
      const existing = await firstOrUndefined(db.invoices.where('_id').equals(id));
      const sendLocal = { status: 'sent', syncStatus: 'pending' };
      const cleanSend = await deepSanitizeAsync(sendLocal);
      if (existing && existing.id !== undefined) {
        const toWrite = pruneSyncNonCloneable(cleanSend);
        await db.invoices.update(existing.id, toWrite);
      } else {
        // If not present, create a minimal placeholder that will be replaced by sync
        const toPut = Object.assign({ _id: id }, cleanSend);
        await db.invoices.put(pruneSyncNonCloneable(toPut));
      }

      // Add a job to the sync queue to call the 'send' endpoint
      await enqueue({
        entity: 'invoices',
        action: 'send', // We can add a custom action type if needed, or treat as update
        entityId: id,
        payload: { action: 'send' }, // Payload indicates the action
        timestamp: new Date().toISOString(),
      });

      // Update UI immediately
      setInvoice({ ...invoice, status: 'sent' });

      // Wait for sync queue to process this item (up to 10 seconds)
      let attempts = 0;
      while (attempts < 20) {
        const pending = await db.syncQueue.where('entityId').equals(id).toArray();
        if (pending.length === 0) {
          console.log('[Send] Invoice sync completed successfully');
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms before checking again
        attempts++;
      }
    } catch (err) {
      setError('Failed to update invoice locally.');
      console.error('Send invoice error:', err);
    } finally {
      setSending(false);
    }
  };

  const handleUpdateInvoice = async (invoiceData) => {
    try {
      // Optimistically update the local database (lookup primary key by `_id`)
      const existing = await firstOrUndefined(db.invoices.where('_id').equals(id));
      const localUpdate = Object.assign({}, invoiceData, { syncStatus: 'pending' });
      const cleanUpdate = await deepSanitizeAsync(localUpdate);
      if (existing && existing.id !== undefined) {
        const toWrite = pruneSyncNonCloneable(cleanUpdate);
        await db.invoices.update(existing.id, toWrite);
      } else {
        await db.invoices.put(pruneSyncNonCloneable(Object.assign({ _id: id }, cleanUpdate)));
      }

      // Add a job to the sync queue
      await enqueue({
        entity: 'invoices',
        action: 'update',
        entityId: id,
        payload: invoiceData,
        timestamp: new Date().toISOString(),
      });

      setInvoice({ ...invoice, ...invoiceData }); // Update the local state
      setShowEditForm(false); // Hide the form on success
    } catch (err) {
      setError('Failed to update invoice. Please try again.');
    }
  };

  const textColor = theme === 'dark' ? 'text-white' : 'text-gray-900';
  const secondaryTextColor = theme === 'dark' ? 'text-gray-300' : 'text-gray-600';
  const cardBg = theme === 'dark' ? 'bg-gray-800' : 'bg-white';

  if (loading) return <CenteredLoader message="Loading invoice..." />;
  if (error) return <div className={`p-8 text-center text-red-500`}>{error}</div>;
  if (!invoice) return <div className={`p-8 text-center ${textColor}`}>Invoice not found.</div>;

  // Determine if the logged-in user is the one who created the invoice
  const isInvoiceCreator = user && invoice && user.id === invoice.user;

  // Get status badge styling
  const getStatusBadge = (status, role) => {
    const displayStatus = role === 'seller' && status === 'sent' ? 'sent, pending' : status === 'sent' ? 'pending' : status;
    
    let badgeClass = '';
    let icon = null;
    
    if (status === 'paid') {
      badgeClass = theme === 'dark' ? 'bg-green-900/40 text-green-300 border-green-700' : 'bg-green-100 text-green-800 border-green-200';
      icon = (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      );
    } else if (status === 'sent') {
      badgeClass = theme === 'dark' ? 'bg-blue-900/40 text-blue-300 border-blue-700' : 'bg-blue-100 text-blue-800 border-blue-200';
      icon = (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    } else {
      badgeClass = theme === 'dark' ? 'bg-yellow-900/40 text-yellow-300 border-yellow-700' : 'bg-yellow-100 text-yellow-800 border-yellow-200';
      icon = (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      );
    }
    
    return { badgeClass, displayStatus, icon };
  };

  const statusInfo = getStatusBadge(invoice.status, user?.publicMetadata?.role);

  return (
    <div className="px-3 sm:px-4 md:px-6 lg:px-8 max-w-5xl mx-auto">
      {/* Back Navigation */}
      <div className="mb-6">
        <Link to={user?.publicMetadata?.role === 'seller' ? '/invoices' : '/customer-dashboard'} className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:underline dark:text-blue-400">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
          Back to {user?.publicMetadata?.role === 'seller' ? 'Invoices' : 'Dashboard'}
        </Link>
      </div>

      {/* Central queue / sync status */}
      <QueueStatus onDismiss={() => setError(null)} />

      {/* Payment Form Modal */}
      {showPaymentForm && (
        <PaymentForm
          invoice={invoice}
          onPayment={handlePaymentSubmit}
          onCancel={() => setShowPaymentForm(false)}
          loading={paymentLoading}
        />
      )}

      {/* Edit Form */}
      {showEditForm ? (
        <div className={`p-8 rounded-2xl shadow-xl backdrop-blur-sm ${theme === 'dark' ? 'bg-gray-800/90 border border-gray-700/50' : 'bg-white/90 border border-gray-200/50'}`}>
          <h2 className={`text-2xl font-bold ${textColor} mb-6 flex items-center gap-2`}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit Invoice
          </h2>
          <AddInvoiceForm
            invoiceToEdit={invoice}
            onSaveInvoice={handleUpdateInvoice}
            onCancel={() => setShowEditForm(false)}
          />
        </div>
      ) : (
        <div className={`p-8 rounded-2xl shadow-xl backdrop-blur-sm ${theme === 'dark' ? 'bg-gray-800/90 border border-gray-700/50' : 'bg-white/90 border border-gray-200/50'}`}>
          {/* Print Title - Hidden on screen, visible in print */}
          <title className="hidden print:block">Invoice #{invoice.invoiceNumber}</title>
          
          {/* Header Section */}
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6 pb-6 border-b border-gray-700/50 dark:border-gray-600/50">
            <div className="flex items-start gap-4">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0 ${
                theme === 'dark' ? 'bg-red-900/40' : 'bg-red-100'
              }`}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
                <div>
                <h1 className={`text-4xl font-bold ${textColor} mb-2`}>Invoice #{invoice.invoiceNumber}</h1>
                <div className="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${secondaryTextColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <p className={`text-lg ${secondaryTextColor}`}>To: <span className={`font-semibold ${textColor}`}>{invoice.customerName}</span></p>
                </div>
                {/* Show seller attribution for portal/customer views */}
                {user?.publicMetadata?.role !== 'seller' && (invoice.sellerName || invoice.sellerPrefix) && (
                  <div className="mt-2 text-sm">
                    <span className={`text-sm ${secondaryTextColor}`}>From: </span>
                    <span className={`font-medium ${textColor}`}>{invoice.sellerName || invoice.sellerPrefix}</span>
                    {invoice.sellerPrefix && invoice.sellerName && (
                      <span className={`ml-2 text-xs ${secondaryTextColor}`}>({invoice.sellerPrefix})</span>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-col items-start md:items-end gap-3">
              <span className={`inline-flex items-center gap-2 px-6 py-3 rounded-full text-base font-semibold border-2 ${statusInfo.badgeClass}`}>
                {statusInfo.icon}
                {statusInfo.displayStatus.toUpperCase()}
              </span>
              
              {/* Dispute Status Badge */}
              {invoice.disputeStatus && invoice.disputeStatus !== 'none' && (
                <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border-2 ${
                  invoice.disputeStatus === 'disputed' 
                    ? theme === 'dark' ? 'bg-orange-900/40 text-orange-300 border-orange-700' : 'bg-orange-100 text-orange-800 border-orange-200'
                    : invoice.disputeStatus === 'under-review'
                    ? theme === 'dark' ? 'bg-purple-900/40 text-purple-300 border-purple-700' : 'bg-purple-100 text-purple-800 border-purple-200'
                    : theme === 'dark' ? 'bg-blue-900/40 text-blue-300 border-blue-700' : 'bg-blue-100 text-blue-800 border-blue-200'
                }`}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  {invoice.disputeStatus.toUpperCase().replace('-', ' ')}
                  {invoice.disputes && invoice.disputes.length > 0 && (
                    <span className="ml-1">({invoice.disputes.length})</span>
                  )}
                </span>
              )}
            </div>
          </div>

          {/* Invoice Details Section */}
          <div className="py-8 border-b border-gray-700/50 dark:border-gray-600/50">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className={`p-6 rounded-xl border ${theme === 'dark' ? 'bg-gray-700/30 border-gray-600/50' : 'bg-gray-50/50 border-gray-200/50'}`}>
                <div className="flex items-start gap-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 mt-1 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <div>
                    <p className={`text-sm font-medium ${secondaryTextColor} mb-2`}>Issue Date</p>
                    <p className={`text-lg font-semibold ${textColor}`}>{new Date(invoice.issueDate || invoice.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</p>
                  </div>
                </div>
              </div>
              <div className={`p-6 rounded-xl border ${theme === 'dark' ? 'bg-gray-700/30 border-gray-600/50' : 'bg-gray-50/50 border-gray-200/50'}`}>
                <div className="flex items-start gap-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 mt-1 ${theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <div>
                    <p className={`text-sm font-medium ${secondaryTextColor} mb-2`}>Due Date</p>
                    <p className={`text-lg font-semibold ${textColor}`}>{new Date(invoice.dueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</p>
                  </div>
                </div>
              </div>
              <div className={`p-6 rounded-xl border ${theme === 'dark' ? 'bg-gray-700/30 border-gray-600/50' : 'bg-gray-50/50 border-gray-200/50'}`}>
                <div className="flex items-start gap-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 mt-1 ${theme === 'dark' ? 'text-purple-400' : 'text-purple-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <div>
                    <p className={`text-sm font-medium ${secondaryTextColor} mb-2`}>Issued By</p>
                    <p className={`text-lg font-semibold ${textColor}`}>
                      {user?.publicMetadata?.role === 'seller'
                        ? (user?.fullName || user?.firstName || 'Seller')
                        : (invoice.sellerName || invoice.sellerPrefix || 'Seller')
                      }
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Line Items Table */}
            {invoice.items && invoice.items.length > 0 && (
              <div className={`p-3 sm:p-6 rounded-xl border ${theme === 'dark' ? 'bg-gray-700/30 border-gray-600/50' : 'bg-gray-50/50 border-gray-200/50'}`}>
                <h3 className={`text-base sm:text-xl font-semibold ${textColor} mb-3 sm:mb-4 flex items-center gap-2`}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                  Items Charged
                </h3>
                <div className="overflow-x-auto -mx-3 sm:mx-0">
                  <table className="w-full min-w-[500px] sm:min-w-0">
                    <thead>
                      <tr className={`border-b ${theme === 'dark' ? 'border-gray-600' : 'border-gray-300'}`}>
                        <th className={`text-left py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm ${secondaryTextColor} font-semibold`}>Description</th>
                        <th className={`text-center py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm ${secondaryTextColor} font-semibold`}>Qty</th>
                        <th className={`text-right py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm ${secondaryTextColor} font-semibold`}>Unit Price</th>
                        <th className={`text-right py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm ${secondaryTextColor} font-semibold`}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoice.items.map((item, index) => (
                        <tr key={index} className={`border-b ${theme === 'dark' ? 'border-gray-700/50' : 'border-gray-200'}`}>
                          <td className={`py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-base ${textColor}`}>{item.description}</td>
                          <td className={`py-2 sm:py-3 px-2 sm:px-4 text-center text-xs sm:text-base ${textColor}`}>{item.quantity}</td>
                          <td className={`py-2 sm:py-3 px-2 sm:px-4 text-right text-xs sm:text-base ${textColor}`}>KSH {(Number(item.unitPrice) || 0).toFixed(2)}</td>
                          <td className={`py-2 sm:py-3 px-2 sm:px-4 text-right font-semibold text-xs sm:text-base ${textColor}`}>KSH {(Number(item.total) || 0).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className={`border-t-2 ${theme === 'dark' ? 'border-gray-600' : 'border-gray-300'}`}>
                        <td colSpan="3" className={`py-2 sm:py-3 px-2 sm:px-4 text-right font-semibold text-xs sm:text-base ${textColor}`}>Subtotal:</td>
                        <td className={`py-2 sm:py-3 px-2 sm:px-4 text-right font-semibold text-xs sm:text-base ${textColor}`}>KSH {(Number(invoice.subTotal) || 0).toFixed(2)}</td>
                      </tr>
                      {invoice.tax > 0 && (
                        <tr>
                          <td colSpan="3" className={`py-1.5 sm:py-2 px-2 sm:px-4 text-right text-xs sm:text-base ${secondaryTextColor}`}>Tax:</td>
                          <td className={`py-1.5 sm:py-2 px-2 sm:px-4 text-right text-xs sm:text-base ${secondaryTextColor}`}>KSH {(Number(invoice.tax) || 0).toFixed(2)}</td>
                        </tr>
                      )}
                      <tr className={`border-t ${theme === 'dark' ? 'border-gray-600' : 'border-gray-300'}`}>
                        <td colSpan="3" className={`py-2 sm:py-3 px-2 sm:px-4 text-right text-base sm:text-xl font-bold ${textColor}`}>Total:</td>
                        <td className={`py-2 sm:py-3 px-2 sm:px-4 text-right text-lg sm:text-2xl font-bold ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`}>KSH {(Number(invoice.total) || 0).toFixed(2)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* Fallback if no line items */}
            {(!invoice.items || invoice.items.length === 0) && (
              <div className={`p-6 rounded-xl border ${theme === 'dark' ? 'bg-gray-700/30 border-gray-600/50' : 'bg-gray-50/50 border-gray-200/50'}`}>
                <div className="flex items-start gap-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 mt-1 ${theme === 'dark' ? 'text-purple-400' : 'text-purple-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className={`text-sm font-medium ${secondaryTextColor} mb-2`}>Total Amount</p>
                    <p className={`text-4xl font-bold ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`}>KSH {(Number(invoice.total) || 0).toFixed(2)}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Actions Section */}
          <div className="pt-8 flex flex-col sm:flex-row justify-between gap-4 print:hidden">
            {/* Download/Print Actions */}
            <div className="flex flex-wrap gap-2">
              <Button onClick={handlePrint} variant="secondary" size="md">
                <span className="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  Print
                </span>
              </Button>
              <Button onClick={handleDownloadPDF} variant="secondary" size="md">
                <span className="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Save PDF
                </span>
              </Button>
              <Button onClick={handleDownloadJSON} variant="secondary" size="md">
                <span className="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  JSON
                </span>
              </Button>
            </div>
            
            {/* Invoice Management Actions */}
            <div className="flex flex-wrap gap-2 justify-end">
            {isInvoiceCreator && invoice.status === 'draft' && (
              <Button onClick={() => setShowConfirmSend(true)} disabled={sending} variant="secondary" size="lg">
                <span className="flex items-center gap-2">
                  {sending ? (
                    <>
                      <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Sending...
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      Send Invoice
                    </>
                  )}
                </span>
              </Button>
            )}
            {isInvoiceCreator && ['draft', 'sent'].includes(invoice.status) && (
              <Button onClick={() => setShowEditForm(true)} variant="secondary" size="lg">
                <span className="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
                  <span className="hidden sm:inline">Edit Invoice</span>
                </span>
              </Button>
            )}
            {isInvoiceCreator && invoice.disputes && invoice.disputes.length > 0 && (
              <Button 
                onClick={() => disputesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })} 
                variant="secondary" 
                size="lg"
              >
                <span className="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span className="hidden sm:inline">View Disputes</span>
                  {(() => {
                    const pending = invoice.disputes.filter(d => d.status === 'pending' || d.status === 'under-review').length;
                    const resolved = invoice.disputes.filter(d => d.status === 'accepted' || d.status === 'rejected').length;
                    return (
                      <span className="flex items-center gap-1">
                        {pending > 0 && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-500 text-white">{pending}</span>}
                        {resolved > 0 && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-500 text-white">{resolved}</span>}
                      </span>
                    );
                  })()}
                </span>
              </Button>
            )}
            {user?.publicMetadata?.role !== 'seller' && invoice.status !== 'paid' && (
              <>
                <Button onClick={handlePayNow} disabled={paymentLoading} variant="primary" size="lg">
                  <span className="flex items-center gap-2">
                    {paymentLoading ? (
                      <>
                        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Processing...
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                        </svg>
                        Pay Now
                      </>
                    )}
                  </span>
                </Button>
                <Button onClick={() => setShowDisputeForm(true)} variant="secondary" size="lg">
                  <span className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    Dispute
                  </span>
                </Button>
              </>
            )}
            </div>
          </div>
        </div>
      )}

      {/* Disputes Section - Show for sellers if there are disputes */}
      {isInvoiceCreator && invoice.disputes && invoice.disputes.length > 0 && (
        <div ref={disputesRef} className={`mt-6 p-8 rounded-2xl shadow-xl backdrop-blur-sm ${theme === 'dark' ? 'bg-gray-800/90 border border-gray-700/50' : 'bg-white/90 border border-gray-200/50'}`}>
          <div className="flex items-center gap-3 mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-7 w-7 ${theme === 'dark' ? 'text-orange-400' : 'text-orange-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h2 className={`text-2xl font-bold ${textColor}`}>
              Disputes ({invoice.disputes.length})
            </h2>
          </div>
          
          <div className="space-y-4">
            {invoice.disputes.map((dispute, index) => (
              <div 
                key={dispute._id || index}
                className={`p-6 rounded-lg border ${theme === 'dark' ? 'bg-gray-700/30 border-gray-600/50' : 'bg-gray-50 border-gray-200'}`}
              >
                <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-3 mb-4">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className={`text-sm font-semibold ${textColor}`}>
                        {dispute.lineItemIndex !== null && dispute.lineItemIndex !== undefined
                          ? `Line Item #${dispute.lineItemIndex + 1}`
                          : 'Entire Invoice'}
                      </span>
                      {dispute.field && (
                        <span className={`text-xs px-2 py-1 rounded whitespace-nowrap ${theme === 'dark' ? 'bg-gray-600 text-gray-300' : 'bg-gray-200 text-gray-700'}`}>
                          {dispute.field}
                        </span>
                      )}
                    </div>
                    <p className={`text-sm ${textColor} mb-2`}>{dispute.reason}</p>
                    
                    {(dispute.originalValue || dispute.suggestedValue) && (
                      <div className="flex gap-4 text-sm">
                        {dispute.originalValue && (
                          <div>
                            <span className={`${secondaryTextColor}`}>Original: </span>
                            <span className={`font-medium ${textColor}`}>{dispute.originalValue}</span>
                          </div>
                        )}
                        {dispute.suggestedValue && (
                          <div>
                            <span className={`${secondaryTextColor}`}>Suggested: </span>
                            <span className={`font-medium ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`}>
                              {dispute.suggestedValue}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div className={`text-xs ${secondaryTextColor} mt-2`}>
                      Disputed on {new Date(dispute.disputedAt).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'short', 
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>
                  
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap flex-shrink-0 ${
                    dispute.status === 'accepted'
                      ? theme === 'dark' ? 'bg-green-900/40 text-green-300' : 'bg-green-100 text-green-800'
                      : dispute.status === 'rejected'
                      ? theme === 'dark' ? 'bg-red-900/40 text-red-300' : 'bg-red-100 text-red-800'
                      : dispute.status === 'under-review'
                      ? theme === 'dark' ? 'bg-purple-900/40 text-purple-300' : 'bg-purple-100 text-purple-800'
                      : theme === 'dark' ? 'bg-yellow-900/40 text-yellow-300' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {dispute.status.toUpperCase().replace('-', ' ')}
                  </span>
                </div>
                
                {dispute.resolutionNotes && (
                  <div className={`mt-3 pt-3 border-t ${theme === 'dark' ? 'border-gray-600' : 'border-gray-200'}`}>
                    <p className={`text-xs ${secondaryTextColor} mb-1`}>Resolution:</p>
                    <p className={`text-sm ${textColor}`}>{dispute.resolutionNotes}</p>
                    {dispute.reviewedAt && (
                      <p className={`text-xs ${secondaryTextColor} mt-1`}>
                        Resolved on {new Date(dispute.reviewedAt).toLocaleDateString('en-US', { 
                          year: 'numeric', 
                          month: 'short', 
                          day: 'numeric' 
                        })}
                      </p>
                    )}
                  </div>
                )}
                
                {dispute.status === 'pending' && (
                  <div className="mt-4 flex gap-2">
                    <Button 
                      onClick={async () => {
                        try {
                          await api.put(`/invoices/${invoice._id}/resolve-dispute`, {
                            disputeId: dispute._id,
                            status: 'accepted',
                            resolutionNotes: 'Dispute accepted',
                            applyChanges: true
                          });
                          toast.success('Dispute accepted and changes applied');
                          // Reload invoice from database
                          const updated = await getInvoice(id);
                          setInvoice(updated);
                          // Force sync to update local database
                          await dataSyncService.syncInvoices();
                        } catch (err) {
                          toast.error('Failed to accept dispute');
                        }
                      }}
                      variant="primary" 
                      size="sm"
                    >
                      Accept
                    </Button>
                    <Button 
                      onClick={() => {
                        setSelectedDisputeId(dispute._id);
                        setRejectionReason('');
                        setShowRejectionModal(true);
                      }}
                      variant="secondary" 
                      size="sm"
                    >
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Confirm Send Modal */}
      <ConfirmModal
        isOpen={showConfirmSend}
        title="Send Invoice"
        message={`Are you sure you want to send this invoice? Action cannot be undone.`}
        confirmLabel="Send"
        cancelLabel="Cancel"
        onCancel={() => setShowConfirmSend(false)}
        onConfirm={async () => {
          setShowConfirmSend(false);
          try { await handleSendInvoice(); } catch (e) { console.error('Send failed from confirm modal', e); }
        }}
      />

      {/* Dispute Form Modal */}
      {showDisputeForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="max-w-4xl w-full my-8">
            <InvoiceDisputeForm
              invoice={invoice}
              onDisputeSubmitted={async () => {
                setShowDisputeForm(false);
                // Reload invoice to show updated dispute status
                const localInvoice = await firstOrUndefined(db.invoices.where('_id').equals(id));
                if (localInvoice) {
                  setInvoice(localInvoice);
                }
              }}
              onCancel={() => setShowDisputeForm(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoiceDetailPage;
