import api from './api';

/**
 * Uploads a file for OCR analysis.
 * @param {File} file The file to analyze.
 * @param {string} documentType The type of document ('receipt' or 'utility').
 * @returns {Promise<any>} The response data from the server.
 */
export const uploadForOcr = async (file, documentType, localRecordId = null, createRecord = false, uploadId = null, options = {}) => {
  // Map UI upload types to server-recognized document types
  const typeMap = {
    'receipt': 'receipt',
    'utility': 'utility',
    'inventory': 'inventory',
    'customer-record': 'customer', // map UI "customer-record" to server "customer"
    'customer-consumption': 'customer-consumption',
    'other': 'inventory', // fallback to generic structured document parsing (tables/keyValuePairs)
  };

  const normalizedDocType = typeMap[documentType] || documentType || 'receipt';

  const formData = new FormData();
  formData.append('document', file);
  formData.append('documentType', normalizedDocType);
  if (localRecordId) formData.append('localRecordId', localRecordId);
  if (createRecord) formData.append('createRecord', 'true');
  if (uploadId) formData.append('uploadId', uploadId);
  // Optional metadata for server-side billing/attribution
  if (options.sellerId) formData.append('sellerId', options.sellerId);
  if (options.service) formData.append('service', options.service);
  if (options.reason) formData.append('reason', options.reason);

  try {
    const response = await api.post('/ocr/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    // Normalize server response into a consistent client-friendly shape
    const res = response.data || {};
    const normalized = {
      success: true,
      message: res.message || 'File analyzed successfully',
      documentType: res.documentType || normalizedDocType,
      fileType: res.fileType || null,
      filePath: res.filePath || null,
      fileName: res.fileName || (file && file.name) || null,
      recordId: res.recordId || null,
      analysisId: res.analysisId || null,
      // `data` contains the extracted/parsed fields (server's parsed object)
      data: res.data || null,
      // server-side normalized parser output (total, invoiceId, transactionId, confidence)
      parsed: res.parsed || null,
    };

    return normalized;
  } catch (error) {
    console.error('Error uploading for OCR:', error);
    // Normalize error shape for consumers
    const err = error?.response?.data || { message: error.message || 'Unknown error' };
    throw err;
  }
};
