import { useState } from 'react';

/**
 * Custom hook to manage all form state for AddRecordForm
 * Consolidates 50+ useState hooks into a single organized state manager
 */
export const useRecordFormState = (initialData = {}) => {
  // Core record metadata
  const [recordType, setRecordType] = useState(initialData.documentType || 'receipt');
  const [invoiceId, setInvoiceId] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Business/seller information
  const [businessName, setBusinessName] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');

  // Customer information
  const [customerId, setCustomerId] = useState('');
  const [customerAddress, setCustomerAddress] = useState({ apartment: '', county: '' });
  const [detectedCustomerName, setDetectedCustomerName] = useState('');
  const [detectedMobileNumber, setDetectedMobileNumber] = useState('');

  // Receipt/invoice line items and totals
  const [items, setItems] = useState([]);
  const [fees, setFees] = useState([]);
  const [subtotal, setSubtotal] = useState('');
  const [tax, setTax] = useState('');
  const [total, setTotal] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [promotions, setPromotions] = useState('');
  const [promotionsParsed, setPromotionsParsed] = useState([]);

  // Utility bill specific fields
  const [utilityProvider, setUtilityProvider] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [utilityAmountDue, setUtilityAmountDue] = useState('');
  const [utilityDueDate, setUtilityDueDate] = useState('');
  const [meterReading, setMeterReading] = useState('');

  // Utility meter model specifications
  const [modelSpecs, setModelSpecs] = useState(null);
  const [specQ3, setSpecQ3] = useState('');
  const [specQ3Q1Ratio, setSpecQ3Q1Ratio] = useState('');
  const [specPN, setSpecPN] = useState('');
  const [specClass, setSpecClass] = useState('');
  const [specMaxTemp, setSpecMaxTemp] = useState('');
  const [specOrientation, setSpecOrientation] = useState('');
  const [specMultipliers, setSpecMultipliers] = useState('');

  // Document dates (utility/statement specific)
  const [detectedStatementDate, setDetectedStatementDate] = useState('');
  const [detectedPeriodStart, setDetectedPeriodStart] = useState('');
  const [detectedPeriodEnd, setDetectedPeriodEnd] = useState('');

  // Dynamic structured data (inventory, customer records)
  const [dynamicFields, setDynamicFields] = useState([]); // [{ key, value }]
  const [tables, setTables] = useState([]); // [{ headers: [], rows: [] }]
  const [selectedTableIndices, setSelectedTableIndices] = useState(new Set());
  const [columnMappings, setColumnMappings] = useState({}); // { groupKey: [mappingPerColumn] }
  const [currentPageByGroup, setCurrentPageByGroup] = useState({});

  // Image handling
  const [image, setImage] = useState(null);
  const [existingImagePath, setExistingImagePath] = useState(null);

  // OCR data storage
  const [originalOcrData, setOriginalOcrData] = useState(null);

  // Uploader-provided fields (customer uploads)
  const [uploaderSellerId, setUploaderSellerId] = useState(
    initialData?.localDraft?.sellerId || initialData?.sellerId || ''
  );
  const [uploaderService, setUploaderService] = useState(
    initialData?.localDraft?.service || initialData?.service || ''
  );
  const [uploaderReason, setUploaderReason] = useState(
    initialData?.localDraft?.reason || initialData?.reason || ''
  );

  // Debug/dev display toggles
  const [showRawText, setShowRawText] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);
  const [showParsedJson, setShowParsedJson] = useState(false);

  // Return all state and setters organized by category
  return {
    // Core metadata
    recordType,
    setRecordType,
    invoiceId,
    setInvoiceId,
    invoiceDate,
    setInvoiceDate,
    transactionId,
    setTransactionId,
    isSaving,
    setIsSaving,

    // Business info
    businessName,
    setBusinessName,
    businessAddress,
    setBusinessAddress,

    // Customer info
    customerId,
    setCustomerId,
    customerAddress,
    setCustomerAddress,
    detectedCustomerName,
    setDetectedCustomerName,
    detectedMobileNumber,
    setDetectedMobileNumber,

    // Receipt/invoice items
    items,
    setItems,
    fees,
    setFees,
    subtotal,
    setSubtotal,
    tax,
    setTax,
    total,
    setTotal,
    paymentMethod,
    setPaymentMethod,
    promotions,
    setPromotions,
    promotionsParsed,
    setPromotionsParsed,

    // Utility bill fields
    utilityProvider,
    setUtilityProvider,
    accountNumber,
    setAccountNumber,
    utilityAmountDue,
    setUtilityAmountDue,
    utilityDueDate,
    setUtilityDueDate,
    meterReading,
    setMeterReading,

    // Model specs
    modelSpecs,
    setModelSpecs,
    specQ3,
    setSpecQ3,
    specQ3Q1Ratio,
    setSpecQ3Q1Ratio,
    specPN,
    setSpecPN,
    specClass,
    setSpecClass,
    specMaxTemp,
    setSpecMaxTemp,
    specOrientation,
    setSpecOrientation,
    specMultipliers,
    setSpecMultipliers,

    // Statement dates
    detectedStatementDate,
    setDetectedStatementDate,
    detectedPeriodStart,
    setDetectedPeriodStart,
    detectedPeriodEnd,
    setDetectedPeriodEnd,

    // Dynamic data
    dynamicFields,
    setDynamicFields,
    tables,
    setTables,
    selectedTableIndices,
    setSelectedTableIndices,
    columnMappings,
    setColumnMappings,
    currentPageByGroup,
    setCurrentPageByGroup,

    // Image
    image,
    setImage,
    existingImagePath,
    setExistingImagePath,

    // OCR data
    originalOcrData,
    setOriginalOcrData,

    // Uploader fields
    uploaderSellerId,
    setUploaderSellerId,
    uploaderService,
    setUploaderService,
    uploaderReason,
    setUploaderReason,

    // Debug toggles
    showRawText,
    setShowRawText,
    showRawJson,
    setShowRawJson,
    showParsedJson,
    setShowParsedJson,
  };
};
