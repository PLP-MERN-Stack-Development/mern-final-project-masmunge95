/**
 * Table Helper Utilities
 * Functions for working with table data in RecordDetailPage
 */

/**
 * Save table edits with OCR metadata preservation
 */
export const buildTableUpdatePayload = (record, localTables, getRecordTypeLabel) => {
  // Include OCR-detected metadata so they persist when saving table edits
  const detectedName = record.customerName || record.ocrData?.customerName || record.customer || record.customerId;
  const detectedPhone = record.customerPhone || record.ocrData?.customerPhone || record.ocrData?.mobileNumber;
  const statementDate = record.statementDate || record.ocrData?.statementDate || record.ocrData?.statement_date;
  const statementPeriod = record.statementPeriod || record.ocrData?.statementPeriod || record.ocrData?.statement_period;

  const description = `${getRecordTypeLabel(record.recordType || record.type)} for ${detectedName || 'Unknown'}`;

  return {
    tables: localTables,
    customerName: detectedName,
    customerPhone: detectedPhone,
    statementDate,
    statementPeriod,
    description,
    syncStatus: 'pending',
  };
};

/**
 * Build initial data for AddRecordForm edit mode
 */
export const buildRecordFormInitialData = (record, parsedTables) => {
  return {
    data: {
      ...(record.ocrData || {}),
      tables: record.tables || record.ocrData?.tables || parsedTables,
      items: record.items || [],
      businessName: record.businessName,
      businessAddress: record.businessAddress,
      subtotal: record.subtotal,
      tax: record.tax,
      total: record.total,
      utilityProvider: record.utilityProvider,
      accountNumber: record.accountNumber,
      utilityAmountDue: record.utilityAmountDue,
      utilityDueDate: record.utilityDueDate,
      meterReading: record.meterReading,
      customerName: record.customerName,
      customerPhone: record.customerPhone,
      statementDate: record.statementDate,
      statementPeriod: record.statementPeriod,
      keyValuePairs: record.keyValuePairs || (record.ocrData && record.ocrData.keyValuePairs),
    },
    documentType: record.recordType || record.type,
  };
};

/**
 * Build invoice data for AddInvoiceForm edit mode
 */
export const buildInvoiceFormData = (record) => {
  return {
    customer: record.customerId || record.customer || record.customerName,
    dueDate: record.dueDate || record.invoiceDate || record.recordDate,
    items: record.items || [],
  };
};
