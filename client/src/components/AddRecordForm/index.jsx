import React, { useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useUser } from '@clerk/clerk-react';
import { getRecordTypeLabel } from '../../utils/recordTypeLabels';

// Custom hooks
import { useRecordFormState } from '../../hooks/AddRecordForm/useRecordFormState';
import { useOcrDataProcessing } from '../../hooks/AddRecordForm/useOcrDataProcessing';
import { useCustomerData } from '../../hooks/AddRecordForm/useCustomerData';

// Specialized forms
import ReceiptForm from './forms/ReceiptForm';
import UtilityBillForm from './forms/UtilityBillForm';

// Shared components
import DynamicFieldsEditor from './components/DynamicFieldsEditor';
import TableSelector from './components/TableSelector';
import CustomerDetailsSection from './components/CustomerDetailsSection';

// Utilities
import { formDataToRecordPayload, validateRecordForm, normalizeHeaderSignature } from '../../utils/AddRecordForm/dataTransformers';

/**
 * AddRecordForm - Main orchestrator component
 * Refactored from 1,559 lines into modular architecture
 */
const AddRecordForm = ({ onAddRecord, onCancel, initialData = {}, onFormReady }) => {
  const { user } = useUser();
  const { theme } = useTheme();
  
  // Initialize form state with custom hook
  const formState = useRecordFormState(initialData);
  
  // Fetch customers
  const { customers } = useCustomerData();
  
  // Process OCR data and populate form
  useOcrDataProcessing(initialData, formState);
  
  // Determine if current user is a seller
  const isSeller = user?.publicMetadata?.role === 'seller';

  // Notify parent that form is ready
  useEffect(() => {
    try {
      if (typeof onFormReady === 'function') {
        setTimeout(() => { 
          try { onFormReady(); } catch (e) {} 
        }, 50);
      }
    } catch (e) {}
  }, [onFormReady]);

  // Auto-calculate totals when items, fees, or tax change
  useEffect(() => {
    try {
      const computedSubtotal = (formState.items || []).reduce((acc, item) => {
        const qty = Number(item.quantity ?? 1) || 1;
        const unit = Number(item.unitPrice ?? NaN);
        const totalFromFields = Number(item.totalPrice ?? item.amount ?? NaN);
        if (!isNaN(totalFromFields)) return acc + totalFromFields;
        if (!isNaN(unit)) return acc + (unit * qty);
        return acc;
      }, 0);

      const feesTotal = (formState.fees || []).reduce((acc, f) => acc + Number(f.amount ?? 0), 0);

      // Parse promotions
      let promoSum = 0;
      try {
        const promos = (Array.isArray(formState.promotionsParsed) && formState.promotionsParsed.length > 0)
          ? formState.promotionsParsed
          : (Array.isArray(formState.promotions) ? formState.promotions : []);
        if (Array.isArray(promos)) promoSum = promos.reduce((s, p) => s + Number(p.amount ?? p.total ?? 0), 0);
      } catch (e) { promoSum = 0; }

      const computedTotal = computedSubtotal + feesTotal + Number(formState.tax || 0) - (promoSum || 0);

      formState.setSubtotal(Number(computedSubtotal || 0).toFixed(2));
      formState.setTotal(Number(computedTotal || 0).toFixed(2));
    } catch (e) { /* ignore */ }
  }, [formState.items, formState.fees, formState.tax, formState.promotions, formState.promotionsParsed]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    formState.setIsSaving(true);

    const formData = new FormData();
    formData.append('recordType', formState.recordType);
    formData.append('customerId', formState.customerId);
    formData.append('recordDate', formState.invoiceDate);
    
    if (formState.image) {
      formData.append('image', formState.image);
    } else if (formState.existingImagePath) {
      formData.append('imagePath', formState.existingImagePath);
    }

    if (formState.recordType === 'utility') {
      // Utility bill submission
      formData.append('type', 'expense');
      formData.append('amount', parseFloat(formState.utilityAmountDue || 0));
      formData.append('description', `Utility Bill from ${formState.utilityProvider} - Acct: ${formState.accountNumber}`);
      
      const ocrPayload = formState.originalOcrData ? {
        ...formState.originalOcrData,
        manufacturer: formState.utilityProvider,
        serialNumber: formState.accountNumber,
        dueDate: formState.utilityDueDate,
        ...(formState.meterReading && { usage: formState.meterReading })
      } : {
        manufacturer: formState.utilityProvider,
        serialNumber: formState.accountNumber,
        mainReading: formState.meterReading,
        dueDate: formState.utilityDueDate
      };
      formData.append('ocrData', JSON.stringify(ocrPayload));
      
      const updatedModelSpecs = {
        q3: formState.specQ3 || '',
        q3_q1_ratio: formState.specQ3Q1Ratio || '',
        pn: formState.specPN || '',
        class: formState.specClass || '',
        maxTemp: formState.specMaxTemp || '',
        orientation: formState.specOrientation || '',
        multipliers: formState.specMultipliers ? formState.specMultipliers.split(',').map(m => m.trim()).filter(m => m) : []
      };
      formData.append('modelSpecs', JSON.stringify(updatedModelSpecs));
    } else {
      // Receipt/invoice submission
      formData.append('type', 'sale');
      formData.append('amount', parseFloat(formState.total || 0));
      
      const rtLabel = getRecordTypeLabel(formState.recordType);
      let desc = '';
      if (formState.recordType === 'invoice') desc = `${rtLabel} from ${formState.businessName || formState.detectedCustomerName || 'Unknown'}`;
      else if (formState.recordType === 'receipt') desc = `${rtLabel} from ${formState.businessName || formState.detectedCustomerName || 'Unknown'}`;
      else if (formState.recordType === 'customer') desc = `${rtLabel} for ${formState.detectedCustomerName || formState.businessName || 'Unnamed'}`;
      else if (formState.recordType === 'inventory') desc = `${rtLabel}: ${formState.businessName || 'Inventory List'}`;
      else if (formState.recordType === 'customer-consumption') desc = `${rtLabel}${formState.detectedStatementDate ? ' — ' + formState.detectedStatementDate : ''}`;
      else desc = `${rtLabel} from ${formState.businessName || formState.detectedCustomerName || 'Unknown'}`;

      formData.append('description', desc);
      
      const ocrPayload = {
        items: formState.items,
        fees: formState.fees,
        subtotal: formState.subtotal,
        total: formState.total,
        businessName: formState.businessName,
        businessAddress: formState.businessAddress,
        paymentMethod: formState.paymentMethod,
        statementDate: formState.detectedStatementDate,
        statementPeriod: formState.detectedPeriodStart && formState.detectedPeriodEnd ? {
          startDate: formState.detectedPeriodStart,
          endDate: formState.detectedPeriodEnd
        } : undefined
      };
      
      if (Array.isArray(formState.promotionsParsed) && formState.promotionsParsed.length > 0) {
        ocrPayload.promotions = formState.promotionsParsed;
      } else {
        ocrPayload.promotions = formState.promotions;
      }
      
      if (formState.detectedMobileNumber) ocrPayload.customerPhone = formState.detectedMobileNumber;
      if (formState.invoiceId) ocrPayload.invoiceId = formState.invoiceId;
      if (formState.transactionId) ocrPayload.transactionId = formState.transactionId;
      
      if (formState.dynamicFields && formState.dynamicFields.length > 0) {
        ocrPayload.keyValuePairs = formState.dynamicFields;
      }
      
      if (formState.tables && formState.tables.length > 0) {
        const included = formState.tables.filter((_, idx) => formState.selectedTableIndices.has(idx));
        if (included.length > 0) {
          ocrPayload.tables = included;
          
          // Build mapped items from tables
          const mappedItems = [];
          included.forEach(tbl => {
            const groupKey = normalizeHeaderSignature(tbl.headers || []);
            let mapping = formState.columnMappings[groupKey];
            
            if (!Array.isArray(mapping) || mapping.every(m => m === 'none')) {
              const fallback = Object.keys(formState.columnMappings)
                .map(k => ({ key: k, mapping: formState.columnMappings[k] }))
                .find(o => Array.isArray(o.mapping) && o.mapping.length === (tbl.headers || []).length && o.mapping.some(v => v && v !== 'none'));
              if (fallback) mapping = fallback.mapping;
            }
            mapping = Array.isArray(mapping) ? mapping : [];

            (tbl.rows || []).forEach(r => {
              const item = {};
              (tbl.headers || []).forEach((h, ci) => {
                const mapTo = mapping[ci] || 'none';
                const val = (r[h] || '').toString();
                if (mapTo && mapTo !== 'none') {
                  if (mapTo === 'quantity') item.quantity = parseFloat(val) || 0;
                  else if (mapTo === 'unitPrice' || mapTo === 'total') item[mapTo] = parseFloat(val) || 0;
                  else item[mapTo] = val;
                }
              });
              if (Object.keys(item).length > 0) mappedItems.push(item);
            });
          });
          
          if (mappedItems.length > 0) {
            const finalItems = [...formState.items, ...mappedItems];
            formData.append('items', JSON.stringify(finalItems));
          }
        }
      }
      
      if (formState.customerId) formData.append('customerId', formState.customerId);
      else {
        if (formState.detectedCustomerName) formData.append('customerName', formState.detectedCustomerName);
        if (formState.detectedMobileNumber) formData.append('customerPhone', formState.detectedMobileNumber);
      }
      
      if (formState.detectedStatementDate) formData.append('statementDate', formState.detectedStatementDate);
      if (formState.detectedPeriodStart) formData.append('statementPeriodStart', formState.detectedPeriodStart);
      if (formState.detectedPeriodEnd) formData.append('statementPeriodEnd', formState.detectedPeriodEnd);
      
      if (formState.uploaderSellerId) formData.append('sellerId', formState.uploaderSellerId);
      if (formState.uploaderService) formData.append('service', formState.uploaderService);
      if (formState.uploaderReason) formData.append('reason', formState.uploaderReason);
      
      formData.append('ocrData', JSON.stringify(ocrPayload));
      
      if (initialData && initialData.analysisId) formData.append('analysisId', initialData.analysisId);
    }

    try {
      const maybePromise = onAddRecord(formData);
      if (maybePromise && typeof maybePromise.then === 'function') await maybePromise;
    } catch (err) {
      formState.setIsSaving(false);
      throw err;
    } finally {
      formState.setIsSaving(false);
    }
  };

  return (
    <form
      data-cy="add-record-form"
      onSubmit={handleSubmit}
      className={`p-4 border rounded ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}
    >
      <h2 className={`text-xl font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
        Add New Record
      </h2>

      {/* Debug toggles */}
      {initialData?.data?.rawText && (
        <div className={`mb-3 p-2 rounded ${theme === 'dark' ? 'bg-gray-700 border border-gray-600' : 'bg-gray-50 border border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <div className={`text-sm ${theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}`}>OCR Raw Text</div>
            <button type="button" onClick={() => formState.setShowRawText(s => !s)} className="text-xs underline">
              {formState.showRawText ? 'Hide' : 'Show'}
            </button>
          </div>
          {formState.showRawText && (
            <pre className={`mt-2 text-xs overflow-auto whitespace-pre-wrap ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`} style={{ maxHeight: 200 }}>
              {initialData.data.rawText}
            </pre>
          )}
        </div>
      )}

      {/* Record Type Selector */}
      <div className="mb-4">
        <label htmlFor="record-type" className={`block mb-1 text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
          Record Type
        </label>
        <select
          id="record-type"
          data-cy="record-type"
          value={formState.recordType}
          onChange={(e) => formState.setRecordType(e.target.value)}
          className={`w-full p-2 border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-black'}`}
        >
          <option value="receipt">Receipt</option>
          <option value="invoice">Invoice</option>
          <option value="utility">Utility Reading</option>
          <option value="inventory">Inventory / Stock List</option>
          <option value="customer">Customer Record</option>
          <option value="customer-consumption">Customer Consumption (Utility Sheets)</option>
          <option value="other">Other / Generic Document</option>
        </select>
      </div>

      {/* Customer Details Section */}
      <CustomerDetailsSection
        formState={formState}
        customers={customers}
        theme={theme}
        isSeller={isSeller}
      />

      {/* Conditional Form Rendering */}
      {formState.recordType === 'utility' ? (
        <UtilityBillForm formState={formState} theme={theme} isSeller={isSeller} />
      ) : (
        <ReceiptForm formState={formState} theme={theme} isSeller={isSeller} customers={customers} />
      )}

      {/* Image Upload */}
      <div className="mb-4">
        <label className={`block mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Image</label>
        {formState.existingImagePath && !formState.image ? (
          <div className={`p-3 border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-300'}`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                ✓ Image from OCR upload
              </span>
              <button
                type="button"
                onClick={() => formState.setExistingImagePath(null)}
                className="text-xs text-blue-500 hover:text-blue-600 underline"
              >
                Change image
              </button>
            </div>
            <div className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'} truncate`}>
              {formState.existingImagePath.split('/').pop()}
            </div>
          </div>
        ) : (
          <input
            id="record-image"
            data-cy="record-file-input"
            aria-label="record-file"
            type="file"
            onChange={(e) => formState.setImage(e.target.files[0])}
            className={`w-full p-2 border rounded text-sm ${theme === 'dark' ? 'text-gray-300 border-gray-600 bg-gray-700' : 'text-gray-500 border-gray-300 bg-gray-50'}`}
          />
        )}
      </div>

      {/* Dynamic Fields Editor */}
      <DynamicFieldsEditor
        dynamicFields={formState.dynamicFields}
        setDynamicFields={formState.setDynamicFields}
        theme={theme}
      />

      {/* Table Selector */}
      <TableSelector
        tables={formState.tables}
        setTables={formState.setTables}
        selectedTableIndices={formState.selectedTableIndices}
        setSelectedTableIndices={formState.setSelectedTableIndices}
        currentPageByGroup={formState.currentPageByGroup}
        setCurrentPageByGroup={formState.setCurrentPageByGroup}
        columnMappings={formState.columnMappings}
        setColumnMappings={formState.setColumnMappings}
        theme={theme}
      />

      {/* Form Actions */}
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded"
          disabled={formState.isSaving}
        >
          Cancel
        </button>
        <button
          type="submit"
          data-cy="submit-record"
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded"
          disabled={formState.isSaving}
        >
          {formState.isSaving ? 'Saving...' : 'Add Record'}
        </button>
      </div>
    </form>
  );
};

export default AddRecordForm;
