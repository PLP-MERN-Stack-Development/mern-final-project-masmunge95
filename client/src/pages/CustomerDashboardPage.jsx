import React, { useState, useEffect } from 'react';
import { useUser, useAuth } from '@clerk/clerk-react';
import { Link } from 'react-router-dom';
import { getMyInvoices } from '../services/portalService';
import api from '../services/api';
import * as dataSyncService from '../services/dataSyncService';
import db from '../db';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import OcrUploader from '../components/OcrUploader';
import Button from '../components/Button';
import AddRecordForm from '../components/AddRecordForm'; // Import the reusable form
import QueueStatus from '../components/QueueStatus';
import CenteredLoader from '../components/CenteredLoader';

const CustomerAddRecordForm = ({ onAdd, onCancel, theme }) => {
  const [recordType, setRecordType] = useState('payment');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onAdd({ type: recordType, description, amount, invoiceNumber });
  };

  return (
    <form onSubmit={handleSubmit} className={`p-4 my-4 border rounded-lg ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
      <h3 className={`text-xl font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Add Record Manually</h3>
      <div className="space-y-4">
        <div>
          <label className={`block mb-1 text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Record Type</label>
          <select value={recordType} onChange={(e) => setRecordType(e.target.value)} className={`w-full p-2 border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-300'}`}>
            <option value="payment">Proof of Payment</option>
            <option value="utility">Utility Reading</option>
          </select>
        </div>
        <div>
          <label className={`block mb-1 text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Invoice Number (Optional)</label>
          <input type="text" placeholder="e.g., INV-1001" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} className={`w-full p-2 border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-300'}`} />
        </div>
        <div>
          <label className={`block mb-1 text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Description</label>
          <input type="text" placeholder="e.g., Payment for Invoice #123" value={description} onChange={(e) => setDescription(e.target.value)} required className={`w-full p-2 border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-300'}`} />
        </div>
        <div>
          <label className={`block mb-1 text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{recordType === 'utility' ? 'Reading Value' : 'Amount'}</label>
          <input type="text" placeholder={recordType === 'utility' ? 'e.g., 12345 kWh' : 'e.g., 50.00'} value={amount} onChange={(e) => setAmount(e.target.value)} required className={`w-full p-2 border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-300'}`} />
        </div>
      </div>
      <div className="flex justify-end gap-4 mt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="primary">Submit for Review</Button>
      </div>
    </form>
  );
};

const CustomerDashboardPage = () => {
  const { user } = useUser();
  const { theme } = useTheme();
  const { toast } = useToast();
  const { isLoaded } = useAuth();
  const [invoices, setInvoices] = useState([]); // To hold invoices for this customer
  const [sellerFilter, setSellerFilter] = useState('');
  const [serviceFilter, setServiceFilter] = useState('');
  // Derived options for dropdowns
  const extractInvoiceServices = (inv) => {
    const out = new Set();
    try {
      if (inv.service && String(inv.service).trim()) out.add(String(inv.service).trim());
      if (Array.isArray(inv.items)) {
        inv.items.forEach(it => {
          if (!it) return;
          const cand = (it.service || it.name || it.description || it.title || '').trim();
          // Exclude fee-like items from service suggestions
          if (cand && !String(cand).toLowerCase().includes('fee')) out.add(cand);
        });
      }
      // fallback to invoice-level description
      if (inv.description && String(inv.description).trim() && !String(inv.description).toLowerCase().includes('fee')) out.add(String(inv.description).trim());
    } catch (e) {}
    return Array.from(out);
  };

  const sellerOptions = Array.from(new Set(invoices.map(i => i.sellerName).filter(Boolean)).values());
  // Ensure services do not include fee-like labels
  const serviceOptions = Array.from(new Set(invoices.flatMap(i => extractInvoiceServices(i)).filter(s => !String(s).toLowerCase().includes('fee'))).values());
  const PAGE_SIZE = 5;
  // pagination via search params for back/forward support
  const urlParams = new URLSearchParams(window.location.search);
  const pageParam = parseInt(urlParams.get('page') || '1', 10);
  const currentPage = Number.isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;
  const [page, setPage] = useState(currentPage);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [ocrData, setOcrData] = useState({}); // Use the same state structure as RecordsPage
  const [serverFilteredInvoices, setServerFilteredInvoices] = useState(null);

  // Use offline-first hook to load invoices into local DB and keep UI updated
  useEffect(() => {
    let mounted = true;
    const loadLocalAndFilter = async () => {
      try {
        setLoading(true);
        const all = await db.invoices.toArray();
        if (!mounted) return;
        const email = user?.primaryEmailAddress?.emailAddress || (user?.emailAddresses && user.emailAddresses[0]?.emailAddress) || '';
        const filtered = (all || []).filter(inv => {
          if (!inv) return false;
          if (inv.customerId && user?.id && String(inv.customerId) === String(user.id)) return true;
          if (inv.customer && String(inv.customer) === String(user.id)) return true;
          if (inv.customerEmail && email && inv.customerEmail === email) return true;
          return Boolean(inv.isPortal || inv.portalOwner === user?.id);
        });
        setInvoices(filtered);
        setLoading(false);
      } catch (e) {
        console.error('Failed to read local invoices for customer dashboard', e);
        setError('Failed to load invoices.');
        setLoading(false);
      }

      // Per-page full-sync removed: central `dataSyncService` handles syncing.
    };

    // Load local cache first so the UI appears quickly, then try to fetch server-side portal invoices
    loadLocalAndFilter();

    let cancelled = false;
    let timer = null;

    const fetchServerPortalInvoices = async () => {
      try {
        setLoading(true);
        const serverInvoices = await getMyInvoices();
        // If the service returned an object with `invoices`, use it; else expect an array
        const list = Array.isArray(serverInvoices) ? serverInvoices : (serverInvoices?.invoices || []);
        if (!mounted) return;

        // Normalize and persist into local Dexie store for offline viewing
        for (const inv of list) {
          try {
            const normalized = { ...inv };
            // Ensure a stable, unique string primary key for Dexie
            if (!normalized._id) {
              if (normalized.id) normalized._id = String(normalized.id);
              else if (normalized._id && typeof normalized._id === 'object') normalized._id = String(normalized._id);
              else {
                // fallback: generate a server-prefixed id to avoid collisions with null/undefined
                normalized._id = `server_${normalized.invoiceNumber || Date.now()}_${Math.random().toString(36).slice(2,9)}`;
              }
            } else {
              normalized._id = String(normalized._id);
            }

            try {
              await db.invoices.put(normalized);
            } catch (putErr) {
              // Dexie ConstraintError can happen when keys are invalid/duplicated; log with context
              console.warn('Failed to put portal invoice into local DB', putErr, { _id: normalized._id, invoiceNumber: normalized.invoiceNumber });
            }
          } catch (inner) { console.warn('Normalization error for portal invoice', inner); }
        }

        // Update UI from server-provided list (prefer server canonical ordering)
        setInvoices(list);
        setLoading(false);
      } catch (e) {
        console.warn('Failed to fetch portal invoices from server', e);
        // Keep local invoices if server fetch fails
        setLoading(false);
      }
    };

    // When customer-side filters change, query the portal endpoint (debounced)
    const fetchFiltered = async () => {
      try {
        if (!sellerFilter && !serviceFilter) {
          if (!cancelled) setServerFilteredInvoices(null);
          return;
        }
        const params = {};
        if (sellerFilter) params.seller = sellerFilter;
        if (serviceFilter) params.service = serviceFilter;
        const resp = await getMyInvoices(params);
        const list = Array.isArray(resp) ? resp : (resp.invoices || resp);
        if (!cancelled) {
          for (const inv of list) {
            try {
              const normalized = { ...inv };
              if (!normalized._id && normalized.id) normalized._id = String(normalized.id);
              if (normalized._id) normalized._id = String(normalized._id);
              try { await db.invoices.put(normalized); } catch (e) {}
            } catch (e) {}
          }
          setServerFilteredInvoices(list);
        }
      } catch (e) {
        console.warn('[CustomerDashboard] server-side filter fetch failed', e);
        if (!cancelled) setServerFilteredInvoices(null);
      }
    };

    // Fetch server invoices for portal users immediately
    fetchServerPortalInvoices();

    // debounce filter fetch
    timer = setTimeout(fetchFiltered, 300);

    return () => { cancelled = true; if (timer) clearTimeout(timer); mounted = false; };
  }, [user, isLoaded, sellerFilter, serviceFilter]);

  const handleOcrComplete = (result) => { // This now mirrors the seller's page
    console.log('Customer OCR Data:', result);
    // Pass the full result to AddRecordForm (includes parsed, data, recordId, analysisId, localDraft, etc.)
    setOcrData(result);
    setShowAddForm(true); // Set to true to show the AddRecordForm
  };

  // Derive a quick seller list from invoices so the customer uploader has immediate options
  const derivedSellers = React.useMemo(() => {
    try {
      const map = new Map();
      (serverFilteredInvoices || invoices || []).forEach(inv => {
        const sid = inv.user || inv.userId || inv.sellerId || inv.seller || null;
        if (!sid) return;
        if (!map.has(sid)) {
          const name = inv.sellerName || inv.sellerPrefix || (inv.user && String(inv.user).slice(0,6)) || sid;
          map.set(sid, { sellerId: sid, name, services: Array.isArray(inv.services) ? inv.services : [] });
        }
      });
      return Array.from(map.values());
    } catch (e) { return []; }
  }, [invoices, serverFilteredInvoices]);

  // Seller candidates shown in the uploader (seeded from derivedSellers, can be refreshed from server)
  const [sellerCandidates, setSellerCandidates] = React.useState([]);
  React.useEffect(() => {
    if (Array.isArray(derivedSellers) && derivedSellers.length > 0) {
      setSellerCandidates(derivedSellers);
    }
  }, [derivedSellers]);

  // Refresh server-provided services when a background full-sync completes
  React.useEffect(() => {
    const handler = () => {
      try {
        // merge server services into existing candidates
        refreshPortalSellers();
      } catch (e) { console.debug('[CustomerDashboard] failed to refresh portal sellers on sync finish', e); }
    };
    try {
      dataSyncService.on('sync:finished', handler);
      dataSyncService.on('data:refreshed', handler);
    } catch (e) {}
    return () => {
      try {
        dataSyncService.off('sync:finished', handler);
        dataSyncService.off('data:refreshed', handler);
      } catch (e) {}
    };
  }, []);

  // Seed seller candidates from local customer records (customers that contain seller user ids)
  React.useEffect(() => {
    let mounted = true;
    const seedFromLocalCustomers = async () => {
      try {
        const localCustomers = await db.customers.toArray();
        if (!mounted) return;
        const myEmail = user?.primaryEmailAddress?.emailAddress || (user?.emailAddresses && user.emailAddresses[0]?.emailAddress) || '';
        const map = new Map();
        (localCustomers || []).forEach(c => {
          try {
            // Only consider customer profiles that match this logged-in user by email
            if (!c) return;
            if (c.email && myEmail && String(c.email).toLowerCase() !== String(myEmail).toLowerCase()) return;
            const owners = Array.isArray(c.users) ? c.users : [];
            owners.forEach(sid => {
              if (!sid) return;
              if (!map.has(sid)) {
                // try to derive a human-friendly name from local invoices
                const matchingInvoice = (invoices || []).find(inv => (inv.user || inv.userId || inv.sellerId || inv.seller) === sid);
                const derivedName = matchingInvoice ? (matchingInvoice.sellerName || matchingInvoice.sellerPrefix || sid) : (c.name || sid);
                map.set(sid, { sellerId: sid, name: derivedName, services: [] });
              }
            });
          } catch (e) {}
        });
        const arr = Array.from(map.values());
        if (arr.length > 0) {
          setSellerCandidates(arr);
          // Try to enrich these candidates with server-side services when possible
          try {
            // fire-and-forget: refreshPortalSellers will merge services when response arrives
            refreshPortalSellers();
          } catch (e) {
            console.debug('[CustomerDashboard] refreshPortalSellers initial merge failed', e);
          }
        }
      } catch (e) {
        console.debug('[CustomerDashboard] failed to seed sellers from local customers', e);
      }
    };
    seedFromLocalCustomers();
    return () => { mounted = false; };
  }, [user]);

  const refreshPortalSellers = async () => {
    try {
      const resp = await api.get('/portal/sellers');
      if (resp && Array.isArray(resp.data)) {
        const serverList = resp.data;
        // Merge server-provided services into existing candidates, preserving local derived names when possible
        const map = new Map();
        // seed with existing candidates
        (sellerCandidates || []).forEach(c => { if (c && c.sellerId) map.set(c.sellerId, { ...c }); });
        // merge server entries
        serverList.forEach(s => {
          const id = s.sellerId || s.id || s._id;
          if (!id) return;
          const existing = map.get(id) || { sellerId: id, name: s.name || id, services: [] };
          existing.name = existing.name || s.name || id;
          existing.services = (s.services && Array.isArray(s.services)) ? s.services : (existing.services || []);
          map.set(id, existing);
        });
        const merged = Array.from(map.values());
        setSellerCandidates(merged);
      } else {
        // if empty, reflect server result but don't clobber local candidates
        // leave sellerCandidates as-is
        console.debug('[CustomerDashboard] portal sellers returned empty list');
      }
    } catch (e) {
      console.warn('[CustomerDashboard] failed to refresh portal sellers', e);
    }
  };

  const handleAddRecord = (recordData) => {
    // This function will now be used by AddRecordForm
    // TODO: Implement logic to save the record (e.g., call createRecord service)
    console.log('Record Data to be submitted:', recordData);
    toast.success('Record submitted for review!');
    setShowAddForm(false);
    setOcrData({}); // Clear the OCR data
  }

  const textColor = theme === 'dark' ? 'text-white' : 'text-gray-900';
  const secondaryTextColor = theme === 'dark' ? 'text-gray-300' : 'text-gray-600';
  const cardBg = theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';

  // Pagination calculations
  const items = serverFilteredInvoices || invoices;
  const totalPages = Math.max(1, Math.ceil((items || []).length / PAGE_SIZE));

  useEffect(() => {
    // Ensure page is within range when items change
    if (page > totalPages) setPage(totalPages);
  }, [items.length, totalPages]);

  const startIdx = (page - 1) * PAGE_SIZE;
  const displayedInvoices = (items || []).slice(startIdx, startIdx + PAGE_SIZE);

  const gotoPage = (n) => {
    const p = Math.max(1, Math.min(totalPages, n));
    setPage(p);
    const params = new URLSearchParams(window.location.search);
    params.set('page', String(p));
    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) {}
  };

  return (
    <div className="px-3 sm:px-4 md:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Welcome Banner */}
      <div className={`mb-8 p-8 rounded-2xl shadow-xl backdrop-blur-sm ${theme === 'dark' ? 'bg-gray-800/90 border border-gray-700/50' : 'bg-white/90 border border-gray-200/50'}`}>
        <h1 className={`text-4xl font-bold ${textColor} mb-2`}>
          <span className="inline-flex items-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-10 w-10 ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Welcome, {user?.firstName || 'Customer'}!
          </span>
        </h1>
        <p className={`text-lg ${secondaryTextColor}`}>Manage your invoices and upload documents for review</p>
      </div>

      {/* Central queue / sync status */}
      <QueueStatus onDismiss={() => setError(null)} />

      {/* Quick Actions Section */}
      <div className={`mb-6 p-6 rounded-xl shadow-md ${cardBg} border`}>
        <h2 className={`text-xl font-semibold ${textColor} mb-4`}>Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <Link to="/shared-records" className="block">
            <Button variant="primary" className="w-full">
              <span className="flex items-center justify-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                View Shared Records
              </span>
            </Button>
          </Link>
          <Link to="/customer-records" className="block">
            <Button variant="secondary" className="w-full">
              <span className="flex items-center justify-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                My Uploaded Records
              </span>
            </Button>
          </Link>
        </div>
        
        {/* Info box explaining what customers can see */}
        <div className={`mt-4 p-4 rounded-lg ${theme === 'dark' ? 'bg-blue-900/20 border border-blue-800' : 'bg-blue-50 border border-blue-200'}`}>
          <div className="flex items-start gap-3">
            <svg className={`w-5 h-5 flex-shrink-0 mt-0.5 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className={`text-sm ${theme === 'dark' ? 'text-blue-300' : 'text-blue-800'}`}>
              <p className="font-medium mb-1">About Your Records</p>
              <ul className="space-y-1 list-disc list-inside">
                <li><strong>My Uploaded Records:</strong> Documents you've uploaded to your seller (utility bills, payments, etc.)</li>
                <li><strong>Shared Records:</strong> Records your seller has shared with you for verification</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end mb-4">
        {!showAddForm && ( // Only show manual add button if the form isn't already open
          <Button onClick={() => setShowAddForm(true)} variant="primary">
            Add Record Manually
          </Button>
        )}
      </div>

      {showAddForm && ( // This now renders the main, reusable form
        <AddRecordForm onAddRecord={handleAddRecord} onCancel={() => setShowAddForm(false)} initialData={ocrData} />
      )}

      {!showAddForm && (
        <>
          {(!sellerCandidates || sellerCandidates.length === 0) && (
            <div className="mb-3 text-sm text-yellow-700">
              No seller options detected. This can happen if you have no invoices yet
              or your account isn't linked to a seller profile. Try refreshing sellers or ask the seller to add you as a customer.
              <div className="mt-2">
                <Button variant="secondary" size="sm" onClick={refreshPortalSellers}>Refresh Sellers</Button>
              </div>
            </div>
          )}
          <OcrUploader onOcrComplete={handleOcrComplete} userRole="customer" initialSellers={sellerCandidates} />
        </>
      )}

      {/* Invoices Section */}
      <div className={`mt-8 p-6 rounded-xl shadow-md backdrop-blur-sm ${theme === 'dark' ? 'bg-gray-800/80 border border-gray-700/50' : 'bg-white/80 border border-gray-200/50'}`}>
        <h2 className={`text-2xl font-semibold ${textColor} mb-6 flex items-center gap-2`}>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          My Invoices
        </h2>

        {/* Filters for customers: seller and service (dropdowns derived from invoices) */}
        <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={`block text-sm font-medium ${secondaryTextColor} mb-1`}>Filter by Seller</label>
            <select value={sellerFilter} onChange={(e) => setSellerFilter(e.target.value)} className={`w-full p-2 rounded border ${theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200'}`}>
              <option value="">All sellers</option>
              {sellerOptions.map((s, idx) => <option key={idx} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className={`block text-sm font-medium ${secondaryTextColor} mb-1`}>Filter by Service</label>
            <select value={serviceFilter} onChange={(e) => setServiceFilter(e.target.value)} className={`w-full p-2 rounded border ${theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200'}`}>
              <option value="">All services</option>
              {serviceOptions.map((s, idx) => <option key={idx} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* Active filter pills + clear button */}
        {(sellerFilter || serviceFilter) && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {sellerFilter && (
              <div className={`${theme === 'dark' ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-800'} inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm`}> 
                <strong className="mr-1">Seller:</strong>
                <span>{sellerFilter}</span>
                <button onClick={() => setSellerFilter('')} className="ml-2 text-xs text-gray-400 hover:text-gray-600">✕</button>
              </div>
            )}
            {serviceFilter && (
              <div className={`${theme === 'dark' ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-800'} inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm`}> 
                <strong className="mr-1">Service:</strong>
                <span>{serviceFilter}</span>
                <button onClick={() => setServiceFilter('')} className="ml-2 text-xs text-gray-400 hover:text-gray-600">✕</button>
              </div>
            )}
            <Button variant="secondary" size="sm" onClick={() => { setSellerFilter(''); setServiceFilter(''); setPage(1); }} className="ml-2">
              Clear Filters
            </Button>
          </div>
        )}

        {loading ? (
          <CenteredLoader message="Loading your invoices..." />
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-500 text-lg">{error}</p>
          </div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-12">
            <div className={`w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center ${
              theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-100'
            }`}>
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-10 w-10 ${secondaryTextColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className={`text-2xl font-bold ${textColor} mb-2`}>No Invoices Yet</h3>
            <p className={`text-lg ${secondaryTextColor}`}>Your invoices will appear here when they're created</p>
          </div>
        ) : (
          <div className="space-y-4">
            {displayedInvoices.map((invoice) => (
              <Link
                key={invoice._id}
                to={`/invoices/${invoice._id}`}
                className={`block p-6 rounded-lg shadow-md border transition-all hover:shadow-lg ${
                  theme === 'dark'
                    ? 'bg-gray-700/50 border-gray-600/50 hover:bg-gray-700/70'
                    : 'bg-white border-gray-200 hover:border-red-300'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                      theme === 'dark' ? 'bg-red-900/40' : 'bg-red-100'
                    }`}>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className={`text-xl font-semibold ${textColor} mb-1`}>
                        Invoice #{invoice.invoiceNumber}
                      </h3>
                      {/* Show seller attribution so customers can distinguish sellers */}
                      {(invoice.sellerName || invoice.sellerPrefix) && (
                        <div className="text-sm text-gray-500 dark:text-gray-300">
                          From: <span className={`font-medium ${textColor}`}>{invoice.sellerName || invoice.sellerPrefix}</span>
                          {invoice.sellerPrefix && invoice.sellerName && (
                            <span className="ml-2 text-xs text-gray-400">({invoice.sellerPrefix})</span>
                          )}
                        </div>
                      )}
                      <div className="flex items-center gap-2 mb-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${secondaryTextColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <p className={`text-sm ${secondaryTextColor}`}>
                          Due: {new Date(invoice.dueDate).toLocaleDateString()}
                        </p>
                      </div>
                      {/* Service info (try invoice.service or items-derived services) */}
                      {(() => {
                        try {
                          const sList = extractInvoiceServices(invoice) || [];
                          if (invoice.service || (sList && sList.length > 0)) {
                            const primary = invoice.service ? invoice.service : (sList[0] || null);
                            return (
                              <div className="text-sm text-gray-500 dark:text-gray-300 mt-1">Service: <span className={`font-medium ${textColor}`}>{primary}</span></div>
                            );
                          }
                        } catch (e) {}
                        return null;
                      })()}
                      <div className="flex flex-wrap gap-2 mt-2">
                        <span className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium ${
                          invoice.status === 'paid'
                            ? theme === 'dark' ? 'bg-green-900/40 text-green-300' : 'bg-green-100 text-green-800'
                            : invoice.status === 'sent' || invoice.status === 'pending'
                            ? theme === 'dark' ? 'bg-yellow-900/40 text-yellow-300' : 'bg-yellow-100 text-yellow-800'
                            : theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {invoice.status === 'paid' ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                            </svg>
                          )}
                          {invoice.status === 'sent' ? 'Pending' : invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                        </span>
                        
                        {/* Dispute Badge */}
                        {invoice.disputeStatus && invoice.disputeStatus !== 'none' && (
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
                            invoice.disputeStatus === 'disputed' 
                              ? theme === 'dark' ? 'bg-orange-900/40 text-orange-300' : 'bg-orange-100 text-orange-800'
                              : invoice.disputeStatus === 'under-review'
                              ? theme === 'dark' ? 'bg-purple-900/40 text-purple-300' : 'bg-purple-100 text-purple-800'
                              : theme === 'dark' ? 'bg-blue-900/40 text-blue-300' : 'bg-blue-100 text-blue-800'
                          }`}>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            {invoice.disputeStatus.replace('-', ' ').toUpperCase()}
                            {invoice.disputes && invoice.disputes.length > 0 && ` (${invoice.disputes.length})`}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-left md:text-right">
                    <p className={`text-3xl font-bold ${theme === 'dark' ? 'text-red-400' : 'text-red-600'} mb-2`}>
                      KSH {(Number(invoice.total) || 0).toFixed(2)}
                    </p>
                    <Button variant="primary" size="sm">
                      <span className="flex items-center gap-1">
                        View Details
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                      </span>
                    </Button>
                  </div>
                </div>
              </Link>
            ))}
            {items && items.length > PAGE_SIZE && (
              <div className="mt-4 flex items-center justify-between">
                <div>
                  <Button variant="secondary" onClick={() => gotoPage(page - 1)} disabled={page <= 1}>Previous</Button>
                </div>
                <div className={`text-sm ${secondaryTextColor}`}>
                  Page {page} of {totalPages}
                </div>
                <div>
                  <Button variant="secondary" onClick={() => gotoPage(page + 1)} disabled={page >= totalPages}>Next</Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerDashboardPage;