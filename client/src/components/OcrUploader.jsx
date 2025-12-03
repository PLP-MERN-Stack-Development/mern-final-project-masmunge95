import React, { useState, useRef, useEffect } from 'react';
/* eslint-disable no-empty, no-unused-vars, react-hooks/exhaustive-deps */
import { useTheme } from '../context/ThemeContext';
import { uploadForOcr } from '../services/ocrService';
import { saveProducerSnapshot } from '../utils/producerDiag';
import Button from './Button';

const OcrUploader = (props) => {
  const { onOcrComplete, onAnalyzingChange, userRole = 'seller', externalBlock = false, initialSellers = [] } = props || {};
  const { theme } = useTheme();
  const [fileToUpload, setFileToUpload] = useState(null);
  const [uploadType, setUploadType] = useState(''); // 'receipt' or 'utility'
  const [sellers, setSellers] = useState([]);
  const [selectedSeller, setSelectedSeller] = useState('');
  const [sellerSearch, setSellerSearch] = useState('');
  const [serviceOption, setServiceOption] = useState('');
  const [reasonOption, setReasonOption] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const uploadIdRef = useRef(null);
  const inFlightUploadsRef = useRef(new Set());
  const fileInputRef = useRef(null);
  const keepAnalyzingRef = useRef(false);
  const [persistAnalyzing, setPersistAnalyzing] = useState(false);
  const processingTypeRef = useRef('');
  const [processingType, setProcessingType] = useState('');
  const cancelFallbackRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Reset per-file upload id when a new file is selected
      uploadIdRef.current = null;
      setFileToUpload(file);
      // clear cancel fallback since a file was chosen
      try { if (cancelFallbackRef.current) { clearTimeout(cancelFallbackRef.current); cancelFallbackRef.current = null; } } catch (e) {}
    }
  };

  const triggerFileUpload = (type) => {
    // Immediately show analyzing state for the clicked type so users get instant feedback
    try {
      processingTypeRef.current = type;
      setProcessingType(type);
      setPersistAnalyzing(true);
      setLoading(true);
      if (typeof onAnalyzingChange === 'function') onAnalyzingChange(true);
    } catch (e) {}

    // Clear any previous fallback
    try { if (cancelFallbackRef.current) clearTimeout(cancelFallbackRef.current); } catch (e) {}
    // If the user cancels the file picker dialog, ensure we don't stay blocked forever
    cancelFallbackRef.current = setTimeout(() => {
      try { setPersistAnalyzing(false); } catch (e) {}
      try { setLoading(false); } catch (e) {}
      try { processingTypeRef.current = ''; setProcessingType(''); } catch (e) {}
      try { if (typeof onAnalyzingChange === 'function') onAnalyzingChange(false); } catch (e) {}
    }, 6000);

    setUploadType(type);
    fileInputRef.current.click();
  };

  // react to external block requests from parent (useful when parent wants uploader buttons disabled while it opens a form)
  useEffect(() => {
    // If a customer uploader, try to fetch allowed sellers for this customer
    const fetchSellers = async () => {
      if (userRole !== 'customer') return;
      // If parent provided initial sellers (derived from local invoices), use them immediately
      if (Array.isArray(initialSellers) && initialSellers.length > 0) {
        setSellers(initialSellers);
        if (!selectedSeller) setSelectedSeller(initialSellers[0].sellerId || initialSellers[0].id || initialSellers[0]._id || '');
      }
      try {
        const resp = await fetch('/api/portal/sellers', { credentials: 'include' });
        if (!resp.ok) throw new Error('failed');
        const json = await resp.json();
        if (Array.isArray(json)) {
          console.debug('[OcrUploader] loaded sellers', json);
          setSellers(json);
          if (json.length > 0) setSelectedSeller(json[0].sellerId || json[0].id || json[0]._id || '');
        }
      } catch (err) {
        // If endpoint not available or unauthorized, leave sellers empty — user can still upload
        console.debug('[OcrUploader] no seller list available for customer', err);
      }
    };
    fetchSellers();

    try {
      if (externalBlock) {
        setPersistAnalyzing(true);
        setLoading(true);
        // retain processingType if parent didn't provide one; keep it for button labels
      } else {
        // clear any external block after a short delay to avoid flicker
        setTimeout(() => {
          setPersistAnalyzing(false);
          setLoading(false);
          setProcessingType('');
          processingTypeRef.current = '';
        }, 50);
      }
    } catch (e) {}
  // include `initialSellers` so this effect re-runs and seeds `sellers` when parent provides them asynchronously
  }, [externalBlock, initialSellers]);

  // Helper: exclude fee-like services from lists
  const filterOutFees = (services) => {
    if (!Array.isArray(services)) return [];
    return services.filter(svc => {
      try {
        const name = (svc && (svc.name || svc.title || svc.id || '')).toString().toLowerCase();
        // Exclude entries that look like fees ("fee", "fees", "service fee", etc.)
        if (!name) return true; // keep unnamed services (rare)
        if (name.includes('fee')) return false;
        return true;
      } catch (e) { return true; }
    });
  };

  // When a seller is selected, fetch their services from the server
  useEffect(() => {
    const enrichSelectedSeller = async () => {
      if (!selectedSeller) return;
      // Always fetch fresh seller data when selection changes to ensure services are loaded
      try {
        const resp = await fetch('/api/portal/sellers', { credentials: 'include' });
        if (!resp.ok) return;
        const json = await resp.json();
        if (!Array.isArray(json)) return;
        // Merge server sellers with current sellers preserving any local names
        const map = new Map();
        (sellers || []).forEach(s => { const id = s.sellerId || s.id || s._id; if (id) map.set(id, { ...s }); });
        json.forEach(s => {
          const id = s.sellerId || s.id || s._id;
          if (!id) return;
          const existing = map.get(id) || { sellerId: id, name: s.name || id, services: [] };
          existing.name = existing.name || s.name || id;
          existing.services = (s.services && Array.isArray(s.services)) ? s.services : (existing.services || []);
          map.set(id, existing);
        });
        const merged = Array.from(map.values());
        setSellers(merged);
      } catch (e) {
        console.debug('[OcrUploader] failed to enrich selected seller services', e);
      }
    };
    enrichSelectedSeller();
  }, [selectedSeller]);
  useEffect(() => {
    const handleUpload = async () => {
      if (fileToUpload && uploadType) {
        setLoading(true);
        try { if (typeof onAnalyzingChange === 'function') onAnalyzingChange(true); } catch (e) {}
        setError('');
        // Use a stable per-file upload id so React StrictMode double-invocation
        // or re-renders reuse the same id and server-side dedupe works.
        if (!uploadIdRef.current) {
          uploadIdRef.current = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `client_${Date.now()}_${Math.random().toString(36).slice(2,9)}`;
        }
        const localId = uploadIdRef.current;

        // Prevent concurrent uploads for the same uploadId
        if (inFlightUploadsRef.current.has(localId)) {
          // Another upload is already in progress for this file; skip duplicate call
          setLoading(false);
          return;
        }
      inFlightUploadsRef.current.add(localId);
        try {
          // Determine an effective upload type (tests may select the hidden file input directly)
          const effectiveUploadType = uploadType || 'receipt';
          // remember the processing type so UI labels can continue to show which button is analyzing
          processingTypeRef.current = effectiveUploadType;
          setProcessingType(effectiveUploadType);
          // Debug: indicate upload start in console for Cypress logs
          console.debug('[OcrUploader] starting upload for', effectiveUploadType, fileToUpload && fileToUpload.name);
          // User-visible status
          try { setStatusMessage('Analyzing document...'); } catch (e) {}
          // Do NOT send a localRecordId by default — server should only create records
          // when explicitly requested (createRecord=true). Keep localId only as a
          // transient client-side draft id for preview correlation.
          // Send a client-side idempotency key (uploadId) and optional metadata so server can dedupe and attribute billing
          const uploadOptions = { sellerId: selectedSeller || undefined, service: serviceOption || undefined, reason: reasonOption || undefined };
          // When a customer is uploading and has selected a seller, persist the
          // record server-side so the seller receives and can act on it immediately.
          const createRecordFlag = (userRole === 'customer');
          const result = await uploadForOcr(fileToUpload, effectiveUploadType, null, createRecordFlag, localId, uploadOptions);
          // Debug: expose full server response to browser console for troubleshooting
          try {
            console.debug('[OcrUploader] full server result', result);
          } catch (e) {}

          // Attach a transient draft object so callers can show a preview without it being saved to IndexedDB
          const payload = {
            ...result,
            localDraft: {
              _id: localId,
              description: fileToUpload.name || 'Uploaded document',
              recordDate: new Date(),
              sellerId: selectedSeller || null,
              service: serviceOption || null,
              reason: reasonOption || null,
            }
          };

          try { if (import.meta.env?.DEV) saveProducerSnapshot(payload, 'OcrUploader.afterUpload'); } catch (e) {}

          // Log server-side parsed tables info to help debug multi-page documents (visible in browser console)
          try {
            const tableCount = Array.isArray(result?.data?.tables) ? result.data.tables.length : 0;
            console.info('[OcrUploader] OCR upload result - documentType:', result?.documentType, 'tables:', tableCount, 'file:', result?.fileName || fileToUpload?.name);
          } catch (e) {
            // ignore logging errors
          }

          if (onOcrComplete) {
            console.debug('[OcrUploader] calling onOcrComplete with payload', payload && { documentType: payload.documentType, hasData: !!payload.data });
            try {
              onOcrComplete(payload); // Pass the parsed result + transient draft
              // Keep the UI showing that analysis completed and the form is opening until parent surfaces the form.
              keepAnalyzingRef.current = true;
              setPersistAnalyzing(true);
              setStatusMessage(result?.message || 'Analysis complete — opening form...');
              // keep loading true so upload buttons remain disabled until the AddRecordForm is surfaced (parent will unmount this component)
              setLoading(true);
              try { if (typeof onAnalyzingChange === 'function') onAnalyzingChange(true); } catch (e) {}
            } catch (e) {
              // If parent callback throws synchronously, still show completed message
              setStatusMessage(result?.message || 'Analysis complete');
            }
          }
        } catch (err) {
          console.error('[OcrUploader] upload error', err);
          try { setStatusMessage(''); } catch (e) {}
          // Try to surface a helpful user-facing message for subscription/quota vs network errors
          const raw = err?.message || err?.response?.data?.message || (err && String(err)) || '';
          const lowered = String(raw).toLowerCase();
          if (lowered.includes('quota') || lowered.includes('subscription') || lowered.includes('limit') || lowered.includes('exhaust')) {
            setError('Upload failed: OCR quota or subscription limit reached. Please upgrade your plan or try again later.');
          } else if (err?.status === 402 || err?.response?.status === 402) {
            setError('Upload failed: Payment required or plan limit exceeded.');
          } else if (lowered.includes('network') || lowered.includes('fetch') || lowered.includes('failed to fetch')) {
            setError('No internet connection. Please check your network and try again.');
          } else {
            setError('Failed to analyze document. Please try again.');
          }
        } finally {
          // clear in-flight marker for this uploadId
          try { inFlightUploadsRef.current.delete(localId); } catch (e) {}
          // If parent has been notified and will surface the AddRecordForm, keep the "analyzing/opening form" UI
          if (keepAnalyzingRef.current || persistAnalyzing) {
            // Keep the UI disabled for a short fallback window in case the parent doesn't unmount quickly.
            setFileToUpload(null);
            // do not clear uploadType yet — keep processingType for button labels
            // Clear the analyzing UI after a safe timeout so we don't get stuck indefinitely
            setTimeout(() => {
              try { setLoading(false); } catch (e) {}
              try { setStatusMessage(''); } catch (e) {}
              keepAnalyzingRef.current = false;
              setPersistAnalyzing(false);
              processingTypeRef.current = '';
              setProcessingType('');
              // clear uploadType as final cleanup
              try { setUploadType(''); } catch (e) {}
              try { if (typeof onAnalyzingChange === 'function') onAnalyzingChange(false); } catch (e) {}
            }, 12000);
          } else {
            setLoading(false);
            setFileToUpload(null);
            setUploadType('');
            processingTypeRef.current = '';
            setProcessingType('');
            try { if (typeof onAnalyzingChange === 'function') onAnalyzingChange(false); } catch (e) {}
          }
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
          // reset uploadIdRef so next selected file gets a fresh id
          uploadIdRef.current = null;
          // clear transient status after a short delay so users see the result (only when not keeping analyzing)
          try { if (!keepAnalyzingRef.current) setTimeout(() => { setStatusMessage(''); }, 4000); } catch (e) {}
        }
      }
    };

    handleUpload();
  }, [fileToUpload, uploadType, onOcrComplete]);

  return (
    <div className={`relative my-4 p-4 border rounded-lg shadow-sm ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
      <h3 className={`text-lg font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Scan a New Document</h3>
        <p className={`text-sm mb-3 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
        {userRole === 'customer' 
          ? 'Upload payment proofs or utility meter readings for verification.'
          : 'Upload any document type: photos, receipts, PDFs, Word docs, Excel sheets, or handwritten notes.'
        }
      </p>
      
      {/* Disclaimers */}
      <div className={`mb-4 p-3 rounded-lg border ${theme === 'dark' ? 'bg-yellow-900/20 border-yellow-700/50' : 'bg-yellow-50 border-yellow-200'}`}>
        <div className="flex items-start gap-2">
          <span className="text-yellow-600 text-lg flex-shrink-0">⚠️</span>
          <div className="flex-1">
            <p className={`text-sm font-medium mb-1 ${theme === 'dark' ? 'text-yellow-400' : 'text-yellow-800'}`}>Important Notes:</p>
            <ul className={`text-xs space-y-1 ${theme === 'dark' ? 'text-yellow-300' : 'text-yellow-700'}`}>
              <li>• <strong>Ensure documents are oriented vertically</strong> (not sideways or upside-down) for best accuracy</li>
              <li>• Internet connection required for document analysis</li>
              <li>• Extracted data may not be 100% accurate</li>
              <li>• Please review and verify all information before saving</li>
            </ul>
          </div>
        </div>
      </div>

      {userRole === 'customer' && (
        <div className="mb-4 w-full">
          <div className="flex flex-col sm:flex-row gap-2 mb-2 w-full">
                <div className="flex-1">
                  <label className="text-xs block mb-1">Seller</label>
                  <select className={`w-full p-2 rounded border ${theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200'}`} value={selectedSeller} onChange={(e) => { setSelectedSeller(e.target.value); setServiceOption(''); }}>
                    <option value="">(Optional) Select seller to attribute billing</option>
                    {sellers && sellers.length > 0 && sellers.map(s => (
                      <option key={s.sellerId || s.id || s._id} value={s.sellerId || s.id || s._id}>{s.name || s.sellerId || s.id}</option>
                    ))}
                  </select>
                </div>
            <div className="w-40">
              <label className="text-xs block mb-1">Service</label>
              <select className={`w-full p-2 rounded border ${theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200'}`} value={serviceOption} onChange={(e) => setServiceOption(e.target.value)}>
                <option value="">Select service</option>
                {/* If a seller is selected, show only that seller's services; otherwise show all available services across sellers */}
                {(() => {
                  const available = (() => {
                    if (selectedSeller) {
                      const found = sellers.find(s => (s.sellerId || s.id || s._id) === selectedSeller);
                      return filterOutFees((found && Array.isArray(found.services)) ? found.services : []);
                    }
                    // aggregate unique services across all sellers
                    const map = new Map();
                    (sellers || []).forEach(s => {
                      if (Array.isArray(s.services)) {
                        s.services.forEach(svc => {
                          if (!map.has(svc.id)) map.set(svc.id, svc);
                        });
                      }
                    });
                    return filterOutFees(Array.from(map.values()));
                  })();
                  return available.map(svc => (
                    <option key={svc.id} value={svc.id}>{svc.name}</option>
                  ));
                })()}
              </select>
            </div>
            <div className="w-40">
              <label className="text-xs block mb-1">Reason</label>
              <select className={`w-full p-2 rounded border ${theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200'}`} value={reasonOption} onChange={(e) => { setReasonOption(e.target.value); }}>
                <option value="">Select reason</option>
                <option value="proof_of_payment">Proof of Payment</option>
                <option value="meter_reading">Meter Reading</option>
                <option value="billing_dispute">Billing Dispute</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
        </div>
      )}
      {/* Show warning if customer hasn't selected a seller */}
      {userRole === 'customer' && !selectedSeller && (
        <div className={`mb-3 p-2 rounded border ${theme === 'dark' ? 'bg-blue-900/20 border-blue-700/50 text-blue-300' : 'bg-blue-50 border-blue-200 text-blue-700'} text-sm`}>
          ℹ️ Please select a seller above to enable document upload
        </div>
      )}
      
      <div className={`flex flex-col sm:flex-row gap-4 ${persistAnalyzing ? 'opacity-70 pointer-events-none' : ''}`}>
        <Button data-cy="upload-receipt" onClick={() => triggerFileUpload('receipt')} variant="primary" className="flex-1" disabled={loading || persistAnalyzing || (userRole === 'customer' && !selectedSeller)} loading={loading || persistAnalyzing}>
          {(loading || persistAnalyzing) && processingType === 'receipt' ? 'Analyzing...' : '📄 Receipt / Invoice'}
        </Button>
        <Button data-cy="upload-utility" onClick={() => triggerFileUpload('utility')} variant="secondary" className="flex-1" disabled={loading || persistAnalyzing || (userRole === 'customer' && !selectedSeller)} loading={loading || persistAnalyzing}>
          {(loading || persistAnalyzing) && processingType === 'utility' ? 'Analyzing...' : '💡 Utility Reading'}
        </Button>
        {userRole === 'seller' && (
          <>
            <Button data-cy="upload-inventory" onClick={() => triggerFileUpload('inventory')} variant="secondary" className="flex-1" disabled={loading || persistAnalyzing} loading={loading || persistAnalyzing}>
              {(loading || persistAnalyzing) && processingType === 'inventory' ? 'Analyzing...' : '📦 Inventory / Stock List'}
            </Button>
            <Button data-cy="upload-customer-record" onClick={() => triggerFileUpload('customer-record')} variant="secondary" className="flex-1" disabled={loading || persistAnalyzing} loading={loading || persistAnalyzing}>
              {(loading || persistAnalyzing) && processingType === 'customer-record' ? 'Analyzing...' : '📊 Customer Records / Contracts'}
            </Button>
          </>
        )}
          {/* Generic fallback for other record types */}
          <Button data-cy="upload-other" onClick={() => triggerFileUpload('other')} variant="secondary" className="flex-1" disabled={loading || persistAnalyzing || (userRole === 'customer' && !selectedSeller)} loading={loading || persistAnalyzing}>
            {(loading || persistAnalyzing) && processingType === 'other' ? 'Analyzing...' : '📁 Other Records'}
          </Button>
      </div>
      {/* overlay removed; uploader will keep buttons disabled via persistAnalyzing */}
      <input
          type="file"
          data-cy="ocr-file-input"
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={handleFileChange}
          accept="image/*,application/pdf,.docx,.xlsx,.pptx"
      />
      <p className={`text-xs mt-2 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
        Supported: JPG, PNG, PDF, Word (.docx), Excel (.xlsx), PowerPoint (.pptx), handwritten notes
      </p>
      {statusMessage && <p className="text-sm mt-2 text-blue-600">{statusMessage}</p>}
      {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
    </div>
  );
};

export default OcrUploader;