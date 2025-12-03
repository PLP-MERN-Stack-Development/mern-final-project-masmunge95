import React, { useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';

// Hooks
import { useRecordDetail } from '../../hooks/RecordDetailPage/useRecordDetail';
import { useRecordEdit } from '../../hooks/RecordDetailPage/useRecordEdit';
import { useTableData } from '../../hooks/RecordDetailPage/useTableData';

// Components
import Button from '../../components/Button';
import AddRecordForm from '../../components/AddRecordForm';
import AddInvoiceForm from '../../components/AddInvoiceForm';
import RecordViewer from '../../components/RecordViewer';
import RecordVerificationForm from '../../components/RecordVerificationForm';
import CenteredLoader from '../../components/CenteredLoader';

// Utilities
import { buildTableUpdatePayload, buildRecordFormInitialData, buildInvoiceFormData } from '../../utils/RecordDetailPage/tableHelpers';
import { getFullImageUrl } from '../../services/api';
import { getRecordTypeLabel, getUploadReasonLabel } from '../../utils/recordTypeLabels';

/**
 * RecordDetailPage - Refactored orchestrator
 * View and edit individual record details with OCR data and tables
 */
const RecordDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isVerifyMode = location.pathname.endsWith('/verify');
  const { theme } = useTheme();
  const { toast } = useToast();

  // Custom hooks
  const { record, setRecord, loading, serviceName, customerName, reloadRecord } = useRecordDetail(id);
  const { showEditModal, setShowEditModal, saveRecordEdit, saveInvoiceEdit, saveFormEdit } = useRecordEdit(id, setRecord, toast);
  const {
    parsedTables,
    tableGroups,
    currentPageByGroup,
    setCurrentPageByGroup,
    editingTables,
    setEditingTables,
    localTables,
    localSelectedTableIndices,
    setLocalSelectedTableIndices,
    localCurrentPageByGroup,
    setLocalCurrentPageByGroup,
  } = useTableData(record);

  // Local UI state
  const [showOcrJson, setShowOcrJson] = useState(false);
  const [itemsPage, setItemsPage] = useState(0);
  const ITEMS_PER_PAGE = 8;

  // Loading state
  if (loading) return <CenteredLoader message="Loading record..." />;
  if (!record) {
    return (
      <div className={`p-6 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
        Record not found.
      </div>
    );
  }

  // Verify mode - show verification form
  if (isVerifyMode) {
    return (
      <div className={`min-h-screen ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'} py-8`}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <RecordVerificationForm
            record={record}
            onVerified={async () => {
              await reloadRecord();
              navigate(`/records/${id}`);
            }}
          />
        </div>
      </div>
    );
  }

  // Handle table edit save
  const handleSaveTableEdits = async () => {
    const localUpdate = buildTableUpdatePayload(record, localTables, getRecordTypeLabel);
    try {
      await saveRecordEdit(localUpdate);
      setEditingTables(false);
    } catch (e) {
      // Error already toasted in saveRecordEdit
    }
  };

  const cardBg = theme === 'dark' ? 'bg-gray-800/90 border border-gray-700/50' : 'bg-white/90 border border-gray-200/50';
  const textColor = theme === 'dark' ? 'text-white' : 'text-gray-900';

  return (
    <div className="px-3 sm:px-4 md:px-6 lg:px-8 max-w-5xl mx-auto">
      <div className={`p-8 rounded-2xl shadow-xl backdrop-blur-sm ${cardBg}`}>
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6 pb-6 border-b border-gray-700/50 dark:border-gray-600/50">
          <div className="flex items-start gap-4">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0 ${theme === 'dark' ? 'bg-red-900/10' : 'bg-red-50'}`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-700 dark:text-red-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h1 className={`text-3xl font-bold ${textColor} mb-2`}>
                {record.description || `${(record.recordType || record.type || 'Record').charAt(0).toUpperCase() + (record.recordType || record.type || 'Record').slice(1)}`}
              </h1>
              <div className="flex items-center gap-3">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${theme === 'dark' ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-700'}`}>
                  {getRecordTypeLabel(record.recordType || record.type || '—')}
                </span>
                {record.businessName && (
                  <div className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                    {record.businessName}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="text-left md:text-right flex items-start gap-3">
            <div className={`p-3 rounded-md ${theme === 'dark' ? 'bg-gray-700/30' : 'bg-gray-50'}`}>
              <div className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Amount</div>
              <div className={`text-2xl font-bold mt-1 ${textColor}`}>
                KSH {(Number(record.amount || record.total) || 0).toFixed(2)}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Button variant="secondary" onClick={() => navigate(-1)}>Back</Button>
              <Button variant="danger" onClick={() => setShowEditModal(true)}>Edit</Button>
            </div>
          </div>
        </div>

        {/* Customer Upload Context */}
        {record.uploaderCustomerId && (
          <div className="py-6 border-b border-gray-700/50 dark:border-gray-600/50">
            <div className={`p-6 rounded-xl border ${theme === 'dark' ? 'bg-purple-900/10 border-purple-700/50' : 'bg-purple-50 border-purple-200/50'}`}>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full flex items-center justify-center bg-purple-500/20 flex-shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className={`text-lg font-semibold ${textColor} mb-2`}>Customer Upload</h3>
                  <p className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'} mb-3`}>
                    This record was uploaded by a customer through the customer portal
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {record.service && (
                      <div>
                        <p className={`text-xs font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'} mb-1`}>Service Type</p>
                        <p className={`text-sm font-semibold ${textColor}`}>{serviceName || record.service}</p>
                      </div>
                    )}
                    {record.reason && (
                      <div>
                        <p className={`text-xs font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'} mb-1`}>Upload Reason</p>
                        <p className={`text-sm ${textColor}`}>{getUploadReasonLabel(record.reason)}</p>
                      </div>
                    )}
                    {record.uploaderCustomerId && (
                      <div>
                        <p className={`text-xs font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'} mb-1`}>Uploaded By</p>
                        <p className={`text-sm ${textColor}`}>{customerName || 'Customer'}</p>
                        {!customerName && (
                          <p className={`text-xs font-mono ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'} mt-0.5`}>
                            {record.uploaderCustomerId}
                          </p>
                        )}
                      </div>
                    )}
                    {record.createdAt && (
                      <div>
                        <p className={`text-xs font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'} mb-1`}>Uploaded At</p>
                        <p className={`text-sm ${textColor}`}>{new Date(record.createdAt).toLocaleString()}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Original Image */}
        {record.imagePath && (
          <div className="py-6 border-b border-gray-700/50 dark:border-gray-600/50">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className={`text-lg font-semibold ${textColor} mb-1`}>Original Captured Image</h3>
                <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                  View the original document image for transparency and dispute resolution
                </p>
              </div>
            </div>
            <div className={`rounded-xl border overflow-hidden ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
              <img
                src={getFullImageUrl([record.imagePath])}
                alt={record.description || 'Record image'}
                className="w-full h-auto max-h-96 object-contain bg-gray-100 dark:bg-gray-800"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextElementSibling.style.display = 'flex';
                }}
              />
              <div className={`hidden items-center justify-center p-12 ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'}`}>
                <div className="text-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className={`h-16 w-16 mx-auto mb-4 ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Image not available</p>
                  {record.imagePath && (record.imagePath.includes('\\') || record.imagePath.includes('D:') || record.imagePath.includes('C:')) && (
                    <div className="mt-3">
                      <p className={`text-xs ${theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'} font-medium`}>
                        Outdated image path detected
                      </p>
                      <button
                        onClick={() => window.location.reload()}
                        className="mt-2 px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                      >
                        Reload Page
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Record Metadata */}
        <div className="py-6 border-b border-gray-700/50 dark:border-gray-600/50">
          <h3 className={`text-lg font-semibold ${textColor} mb-4`}>Record Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
              {(record.businessName || record.ocrData?.businessName || record.ocrData?.merchantName) && (
                <p className="mb-2">
                  <strong>Business:</strong> {record.businessName || record.ocrData?.businessName || record.ocrData?.merchantName}
                </p>
              )}
              {(record.businessAddress || record.ocrData?.businessAddress) && (
                <p className="mb-2">
                  <strong>Business Address:</strong> {record.businessAddress || record.ocrData?.businessAddress}
                </p>
              )}
              {(record.invoiceId || record.ocrData?.invoiceNo) && (
                <p className="mb-2">
                  <strong>Invoice #:</strong> {record.invoiceId || record.ocrData?.invoiceNo}
                </p>
              )}
              {(record.invoiceDate || record.ocrData?.invoiceDate) && (
                <p className="mb-2">
                  <strong>Invoice Date:</strong> {new Date(record.invoiceDate || record.ocrData?.invoiceDate).toLocaleDateString()}
                </p>
              )}
              {(record.statementPeriod || record.ocrData?.statementPeriod) && (
                <p className="mb-2">
                  <strong>Statement Period:</strong>{' '}
                  {record.statementPeriod?.startDate
                    ? `${new Date(record.statementPeriod.startDate).toLocaleDateString()} — ${new Date(record.statementPeriod.endDate).toLocaleDateString()}`
                    : record.ocrData?.statementPeriod?.startDate
                    ? `${new Date(record.ocrData.statementPeriod.startDate).toLocaleDateString()} — ${new Date(record.ocrData.statementPeriod.endDate).toLocaleDateString()}`
                    : ''}
                </p>
              )}
            </div>
            <div className="text-right">
              {(record.subtotal !== undefined || record.ocrData?.subtotal !== undefined) && (
                <p className="mb-2">
                  <strong>Subtotal:</strong> {record.subtotal ?? record.ocrData?.subtotal}
                </p>
              )}
              {(record.tax !== undefined || record.ocrData?.tax !== undefined) && (
                <p className="mb-2">
                  <strong>Tax:</strong> {record.tax ?? record.ocrData?.tax}
                </p>
              )}
              {(record.total !== undefined || record.ocrData?.total !== undefined) && (
                <p className="mb-2">
                  <strong>Total:</strong> {record.total ?? record.ocrData?.total}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Record Details & OCR */}
        <div className="mt-6 border-t pt-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold">Record Details</h3>
            <button className="text-sm underline" onClick={() => setShowOcrJson(s => !s)}>
              {showOcrJson ? 'Hide' : 'Show'} JSON
            </button>
          </div>

          <RecordViewer
            record={record}
            editable={showEditModal}
            onCancel={() => setShowEditModal(false)}
            onSave={saveRecordEdit}
          />

          {showOcrJson && (
            <pre
              className={`p-3 rounded mt-4 ${theme === 'dark' ? 'bg-gray-800 text-gray-200' : 'bg-gray-50 text-gray-800'}`}
              style={{ maxHeight: 400, overflow: 'auto' }}
            >
              {JSON.stringify(record.ocrData || record.extracted || {}, null, 2)}
            </pre>
          )}

          {/* Save/Cancel for table edits */}
          {editingTables && parsedTables && parsedTables.length > 0 && (
            <div className="flex gap-3 mt-3">
              <button
                type="button"
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
                onClick={handleSaveTableEdits}
              >
                Save Table Edits
              </button>
              <button
                type="button"
                className="bg-gray-300 hover:bg-gray-400 text-black px-4 py-2 rounded"
                onClick={() => {
                  setShowEditModal(false);
                  setEditingTables(false);
                }}
              >
                Cancel
              </button>
            </div>
          )}

          {/* Detected Tables - Display Only (editing handled in separate modal/section) */}
          {parsedTables && parsedTables.length > 0 && !editingTables && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">Detected Tables</h3>
              {Object.keys(tableGroups).map((groupKey, gIdx) => {
                const group = tableGroups[groupKey];
                const page = currentPageByGroup[groupKey] ?? 0;
                const total = group.items.length;
                const current = group.items[page];

                return (
                  <div key={gIdx} className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-medium">
                        Table Format {gIdx + 1} — Columns: {group.headers.join(', ') || 'N/A'}
                      </div>
                      {total > 1 && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setCurrentPageByGroup(prev => ({
                                ...prev,
                                [groupKey]: Math.max(0, (prev[groupKey] || 0) - 1),
                              }))
                            }
                            className={`px-2 py-1 rounded ${theme === 'dark' ? 'bg-gray-700 text-white' : 'bg-white text-black border border-gray-200'}`}
                          >
                            Prev
                          </button>
                          <span className="text-sm">
                            {page + 1} / {total}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setCurrentPageByGroup(prev => ({
                                ...prev,
                                [groupKey]: Math.min(total - 1, (prev[groupKey] || 0) + 1),
                              }))
                            }
                            className={`px-2 py-1 rounded ${theme === 'dark' ? 'bg-gray-700 text-white' : 'bg-white text-black border border-gray-200'}`}
                          >
                            Next
                          </button>
                        </div>
                      )}
                    </div>

                    {current && (
                      <div className={`overflow-auto border rounded ${theme === 'dark' ? 'border-gray-600/30 bg-gray-800/30' : 'border-gray-300 bg-white'}`}>
                        <table className="min-w-full">
                          <thead>
                            <tr>
                              {current.table.headers?.map((h, i) => (
                                <th key={i} className={`border px-2 py-1 ${theme === 'dark' ? 'bg-gray-700/50 text-gray-200' : 'bg-gray-100 text-gray-800'}`}>
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {current.table.rows?.map((row, rIdx) => (
                              <tr key={rIdx}>
                                {current.table.headers?.map((h, cIdx) => (
                                  <td key={cIdx} className={`border px-2 py-1 ${theme === 'dark' ? 'bg-transparent text-gray-300' : 'bg-white text-gray-900'}`}>
                                    {row[h] || ''}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Items Table (for invoices) */}
          {record.items && record.items.length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-3">Invoice Items</h3>
              <table className={`w-full border ${theme === 'dark' ? 'border-gray-600' : 'border-gray-300'}`}>
                <thead>
                  <tr>
                    <th className={`border px-2 py-1 ${theme === 'dark' ? 'bg-gray-700/50 text-gray-200' : 'bg-gray-100 text-gray-800'}`}>Description</th>
                    <th className={`border px-2 py-1 ${theme === 'dark' ? 'bg-gray-700/50 text-gray-200' : 'bg-gray-100 text-gray-800'}`}>Qty</th>
                    <th className={`border px-2 py-1 ${theme === 'dark' ? 'bg-gray-700/50 text-gray-200' : 'bg-gray-100 text-gray-800'}`}>Unit</th>
                    <th className={`border px-2 py-1 ${theme === 'dark' ? 'bg-gray-700/50 text-gray-200' : 'bg-gray-100 text-gray-800'}`}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {record.items.slice(itemsPage * ITEMS_PER_PAGE, (itemsPage + 1) * ITEMS_PER_PAGE).map((it, i) => (
                    <tr key={i}>
                      <td className={`border px-2 py-1 ${theme === 'dark' ? 'bg-transparent text-gray-300' : 'bg-white text-gray-900'}`}>{it.description}</td>
                      <td className={`border px-2 py-1 ${theme === 'dark' ? 'bg-transparent text-gray-300' : 'bg-white text-gray-900'}`}>{it.quantity}</td>
                      <td className={`border px-2 py-1 ${theme === 'dark' ? 'bg-transparent text-gray-300' : 'bg-white text-gray-900'}`}>{it.unitPrice}</td>
                      <td className={`border px-2 py-1 ${theme === 'dark' ? 'bg-transparent text-gray-300' : 'bg-white text-gray-900'}`}>{it.totalPrice}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {record.items.length > ITEMS_PER_PAGE && (
                <div className="mt-3 flex items-center justify-end gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setItemsPage(p => Math.max(0, p - 1))} disabled={itemsPage === 0}>
                    Prev
                  </Button>
                  <div className="text-sm">
                    Page {itemsPage + 1} / {Math.ceil(record.items.length / ITEMS_PER_PAGE)}
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setItemsPage(p => Math.min(Math.ceil(record.items.length / ITEMS_PER_PAGE) - 1, p + 1))}
                    disabled={itemsPage >= Math.ceil(record.items.length / ITEMS_PER_PAGE) - 1}
                  >
                    Next
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RecordDetailPage;
