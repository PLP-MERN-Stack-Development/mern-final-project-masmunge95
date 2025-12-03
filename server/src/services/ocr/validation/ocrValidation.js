/**
 * OCR Validation Service
 * File type validation, document type detection, input validation
 */

/**
 * Supported MIME types for different OCR services
 */
const DOCUMENT_INTELLIGENCE_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/msword',
  'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
  'text/html',
  'image/tiff',
  'image/bmp'
];

const IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/bmp',
  'image/tiff'
];

const SUPPORTED_DOCUMENT_TYPES = [
  'receipt',
  'invoice',
  'utility',
  'utility-bill',
  'inventory',
  'customer',
  'customer-consumption',
  'generic'
];

/**
 * Validate file upload request
 * @param {Object} file - Multer file object
 * @param {string} documentType - Document type from request body
 * @returns {Object} Validation result { valid: boolean, error?: string }
 */
function validateFileUpload(file, documentType) {
  if (!file) {
    return { valid: false, error: 'Please upload a file' };
  }

  const mimeType = file.mimetype;
  
  // Check if file type is supported
  const isSupported = DOCUMENT_INTELLIGENCE_TYPES.includes(mimeType) || IMAGE_TYPES.includes(mimeType);
  
  if (!isSupported) {
    return {
      valid: false,
      error: 'Unsupported file type. Supported: Images (JPG, PNG), PDF, Word (.docx), Excel (.xlsx), PowerPoint (.pptx)'
    };
  }

  // Validate document type if provided
  if (documentType && !SUPPORTED_DOCUMENT_TYPES.includes(documentType)) {
    return {
      valid: false,
      error: `Invalid document type. Supported: ${SUPPORTED_DOCUMENT_TYPES.join(', ')}`
    };
  }

  // File size validation (optional, adjust as needed)
  const maxSize = 50 * 1024 * 1024; // 50MB
  if (file.size > maxSize) {
    return {
      valid: false,
      error: 'File size exceeds 50MB limit'
    };
  }

  return { valid: true };
}

/**
 * Determine which OCR service to use based on document type and mime type
 * @param {string} documentType - Document type
 * @param {string} mimeType - File MIME type
 * @param {string} userTier - User subscription tier
 * @returns {Object} Service selection { service: string, model: string }
 */
function determineOcrService(documentType, mimeType, userTier = 'trial') {
  // Document types that prefer Document Intelligence
  const docTypesPreferDocInt = new Set([
    'receipt',
    'invoice',
    'inventory',
    'customer',
    'customer-consumption'
  ]);

  const preferDocIntByType = documentType && docTypesPreferDocInt.has(documentType);

  // Enterprise tier gets premium prebuilt-invoice model
  const usePrebuiltInvoice = (documentType === 'receipt' || documentType === 'invoice') && userTier === 'enterprise';

  if (usePrebuiltInvoice) {
    return {
      service: 'document-intelligence',
      model: 'prebuilt-invoice'
    };
  }

  if (preferDocIntByType && (documentType === 'inventory' || documentType === 'customer' || documentType === 'customer-consumption')) {
    return {
      service: 'document-intelligence',
      model: 'prebuilt-layout' // Table extraction
    };
  }

  if (preferDocIntByType || DOCUMENT_INTELLIGENCE_TYPES.includes(mimeType)) {
    return {
      service: 'document-intelligence',
      model: 'prebuilt-read'
    };
  }

  if (mimeType && mimeType.startsWith('image/')) {
    return {
      service: 'computer-vision',
      model: 'read'
    };
  }

  // Default fallback
  return {
    service: 'computer-vision',
    model: 'read'
  };
}

/**
 * Determine document type folder name for organization
 * @param {string} documentType - Document type
 * @returns {string} Folder name
 */
function getDocumentTypeFolder(documentType) {
  const folderMap = {
    'receipt': 'receipts',
    'invoice': 'invoices',
    'utility': 'utility-bills',
    'utility-bill': 'utility-bills',
    'inventory': 'inventory',
    'customer': 'customer-records',
    'customer-consumption': 'customer-consumption',
    'generic': 'documents'
  };

  return folderMap[documentType] || 'documents';
}

/**
 * Validate customer upload request
 * @param {Object} authUser - Clerk auth user object
 * @param {string} requestedSellerId - Seller ID from request body
 * @returns {Object} Validation result { valid: boolean, error?: string, sellerId?: string }
 */
function validateCustomerUpload(authUser, requestedSellerId) {
  const authRole = authUser?.publicMetadata?.role || null;

  if (authRole !== 'customer') {
    return { valid: true, sellerId: null }; // Not a customer upload
  }

  if (!requestedSellerId) {
    return {
      valid: false,
      error: 'Missing sellerId: customers must select which seller to send this upload to'
    };
  }

  return {
    valid: true,
    sellerId: requestedSellerId,
    isCustomerUpload: true
  };
}

/**
 * Extract uploader information from auth user
 * @param {Object} authUser - Clerk auth user object
 * @returns {Object} Uploader info { type: string, name: string, id: string }
 */
function extractUploaderInfo(authUser) {
  const authRole = authUser?.publicMetadata?.role || null;
  const userId = authUser?.id || null;

  if (authRole === 'customer') {
    const firstName = authUser.firstName || '';
    const lastName = authUser.lastName || '';
    const fullName = `${firstName} ${lastName}`.trim();
    const email = authUser.emailAddresses?.[0]?.emailAddress || '';
    const uploaderName = fullName || authUser.username || email || null;

    return {
      type: 'customer',
      name: uploaderName,
      id: userId
    };
  }

  return {
    type: 'seller',
    name: authUser.username || authUser.firstName || null,
    id: userId
  };
}

/**
 * Validate seller profile
 * @param {Object} sellerProfile - Clerk user profile
 * @returns {boolean} Whether profile is valid seller
 */
function validateSellerProfile(sellerProfile) {
  if (!sellerProfile) {
    return false;
  }

  const role = sellerProfile?.publicMetadata?.role;
  return role === 'seller';
}

/**
 * Sanitize OCR results for safe MongoDB persistence
 * @param {any} results - Raw OCR results
 * @returns {Object} Sanitized results
 */
function sanitizeOcrResults(results) {
  try {
    return JSON.parse(JSON.stringify(results));
  } catch (e) {
    return { _serializationError: String(e) };
  }
}

/**
 * Create deep copy of OCR results for debugging
 * @param {any} results - OCR results
 * @returns {Object} Deep copy
 */
function createResultsCopy(results) {
  try {
    return JSON.parse(JSON.stringify(results));
  } catch (e) {
    return results;
  }
}

module.exports = {
  DOCUMENT_INTELLIGENCE_TYPES,
  IMAGE_TYPES,
  SUPPORTED_DOCUMENT_TYPES,
  validateFileUpload,
  determineOcrService,
  getDocumentTypeFolder,
  validateCustomerUpload,
  extractUploaderInfo,
  validateSellerProfile,
  sanitizeOcrResults,
  createResultsCopy
};
