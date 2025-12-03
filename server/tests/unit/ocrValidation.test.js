/**
 * OCR Validation Service Unit Tests
 * Tests for file validation, service selection, and helper functions
 */

const {
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
} = require('../../src/services/ocr/validation/ocrValidation');

describe('OCR Validation Service', () => {
  describe('validateFileUpload', () => {
    it('should reject upload with no file', () => {
      const result = validateFileUpload(null, 'receipt');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Please upload a file');
    });

    it('should accept valid image file', () => {
      const file = {
        mimetype: 'image/jpeg',
        size: 1024 * 1024 // 1MB
      };
      const result = validateFileUpload(file, 'receipt');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept valid PDF file', () => {
      const file = {
        mimetype: 'application/pdf',
        size: 2 * 1024 * 1024 // 2MB
      };
      const result = validateFileUpload(file, 'invoice');
      expect(result.valid).toBe(true);
    });

    it('should accept valid Word document', () => {
      const file = {
        mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        size: 5 * 1024 * 1024
      };
      const result = validateFileUpload(file, 'generic');
      expect(result.valid).toBe(true);
    });

    it('should reject unsupported file type', () => {
      const file = {
        mimetype: 'application/zip',
        size: 1024
      };
      const result = validateFileUpload(file, 'receipt');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unsupported file type');
    });

    it('should reject file exceeding size limit', () => {
      const file = {
        mimetype: 'image/jpeg',
        size: 51 * 1024 * 1024 // 51MB (exceeds 50MB limit)
      };
      const result = validateFileUpload(file, 'receipt');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds 50MB limit');
    });

    it('should reject invalid document type', () => {
      const file = {
        mimetype: 'image/jpeg',
        size: 1024
      };
      const result = validateFileUpload(file, 'invalid-type');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid document type');
    });

    it('should accept file without documentType', () => {
      const file = {
        mimetype: 'image/png',
        size: 1024
      };
      const result = validateFileUpload(file, null);
      expect(result.valid).toBe(true);
    });

    it('should accept all supported image types', () => {
      const imageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      
      imageTypes.forEach(mimetype => {
        const file = { mimetype, size: 1024 };
        const result = validateFileUpload(file, 'receipt');
        expect(result.valid).toBe(true);
      });
    });
  });

  describe('determineOcrService', () => {
    it('should use prebuilt-invoice for receipts on enterprise tier', () => {
      const result = determineOcrService('receipt', 'image/jpeg', 'enterprise');
      expect(result.service).toBe('document-intelligence');
      expect(result.model).toBe('prebuilt-invoice');
    });

    it('should use prebuilt-invoice for invoices on enterprise tier', () => {
      const result = determineOcrService('invoice', 'application/pdf', 'enterprise');
      expect(result.service).toBe('document-intelligence');
      expect(result.model).toBe('prebuilt-invoice');
    });

    it('should use prebuilt-layout for inventory documents', () => {
      const result = determineOcrService('inventory', 'image/jpeg', 'pro');
      expect(result.service).toBe('document-intelligence');
      expect(result.model).toBe('prebuilt-layout');
    });

    it('should use prebuilt-layout for customer records', () => {
      const result = determineOcrService('customer', 'image/png', 'basic');
      expect(result.service).toBe('document-intelligence');
      expect(result.model).toBe('prebuilt-layout');
    });

    it('should use prebuilt-layout for customer consumption', () => {
      const result = determineOcrService('customer-consumption', 'image/jpeg', 'trial');
      expect(result.service).toBe('document-intelligence');
      expect(result.model).toBe('prebuilt-layout');
    });

    it('should use prebuilt-read for receipts on trial tier', () => {
      const result = determineOcrService('receipt', 'image/jpeg', 'trial');
      expect(result.service).toBe('document-intelligence');
      expect(result.model).toBe('prebuilt-read');
    });

    it('should use document-intelligence for PDF files', () => {
      const result = determineOcrService('generic', 'application/pdf', 'trial');
      expect(result.service).toBe('document-intelligence');
      expect(result.model).toBe('prebuilt-read');
    });

    it('should use computer-vision for images without preferred doc type', () => {
      const result = determineOcrService('utility', 'image/jpeg', 'trial');
      expect(result.service).toBe('computer-vision');
      expect(result.model).toBe('read');
    });

    it('should default to computer-vision for unknown types', () => {
      const result = determineOcrService(null, null, 'trial');
      expect(result.service).toBe('computer-vision');
      expect(result.model).toBe('read');
    });

    it('should handle basic tier correctly', () => {
      const result = determineOcrService('receipt', 'image/jpeg', 'basic');
      expect(result.service).toBe('document-intelligence');
      expect(result.model).toBe('prebuilt-read');
    });

    it('should handle pro tier correctly', () => {
      const result = determineOcrService('invoice', 'application/pdf', 'pro');
      expect(result.service).toBe('document-intelligence');
      expect(result.model).toBe('prebuilt-read');
    });
  });

  describe('getDocumentTypeFolder', () => {
    it('should return "receipts" for receipt type', () => {
      expect(getDocumentTypeFolder('receipt')).toBe('receipts');
    });

    it('should return "invoices" for invoice type', () => {
      expect(getDocumentTypeFolder('invoice')).toBe('invoices');
    });

    it('should return "utility-bills" for utility type', () => {
      expect(getDocumentTypeFolder('utility')).toBe('utility-bills');
    });

    it('should return "utility-bills" for utility-bill type', () => {
      expect(getDocumentTypeFolder('utility-bill')).toBe('utility-bills');
    });

    it('should return "inventory" for inventory type', () => {
      expect(getDocumentTypeFolder('inventory')).toBe('inventory');
    });

    it('should return "customer-records" for customer type', () => {
      expect(getDocumentTypeFolder('customer')).toBe('customer-records');
    });

    it('should return "customer-consumption" for customer-consumption type', () => {
      expect(getDocumentTypeFolder('customer-consumption')).toBe('customer-consumption');
    });

    it('should return "documents" for generic type', () => {
      expect(getDocumentTypeFolder('generic')).toBe('documents');
    });

    it('should return "documents" for unknown types', () => {
      expect(getDocumentTypeFolder('unknown-type')).toBe('documents');
    });
  });

  describe('validateCustomerUpload', () => {
    it('should allow non-customer uploads without sellerId', () => {
      const authUser = {
        publicMetadata: { role: 'seller' }
      };
      const result = validateCustomerUpload(authUser, null);
      expect(result.valid).toBe(true);
      expect(result.sellerId).toBeNull();
    });

    it('should reject customer upload without sellerId', () => {
      const authUser = {
        publicMetadata: { role: 'customer' }
      };
      const result = validateCustomerUpload(authUser, null);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Missing sellerId');
    });

    it('should accept customer upload with valid sellerId', () => {
      const authUser = {
        publicMetadata: { role: 'customer' }
      };
      const result = validateCustomerUpload(authUser, 'seller_123');
      expect(result.valid).toBe(true);
      expect(result.sellerId).toBe('seller_123');
      expect(result.isCustomerUpload).toBe(true);
    });

    it('should handle missing publicMetadata', () => {
      const authUser = {};
      const result = validateCustomerUpload(authUser, null);
      expect(result.valid).toBe(true);
      expect(result.sellerId).toBeNull();
    });
  });

  describe('extractUploaderInfo', () => {
    it('should extract customer uploader info', () => {
      const authUser = {
        id: 'customer_123',
        publicMetadata: { role: 'customer' },
        firstName: 'John',
        lastName: 'Doe',
        emailAddresses: [{ emailAddress: 'john@example.com' }]
      };
      
      const result = extractUploaderInfo(authUser);
      expect(result.type).toBe('customer');
      expect(result.name).toBe('John Doe');
      expect(result.id).toBe('customer_123');
    });

    it('should use username when name not available for customer', () => {
      const authUser = {
        id: 'customer_456',
        publicMetadata: { role: 'customer' },
        username: 'johndoe',
        emailAddresses: [{ emailAddress: 'john@example.com' }]
      };
      
      const result = extractUploaderInfo(authUser);
      expect(result.type).toBe('customer');
      expect(result.name).toBe('johndoe');
    });

    it('should use email when name and username not available for customer', () => {
      const authUser = {
        id: 'customer_789',
        publicMetadata: { role: 'customer' },
        emailAddresses: [{ emailAddress: 'jane@example.com' }]
      };
      
      const result = extractUploaderInfo(authUser);
      expect(result.type).toBe('customer');
      expect(result.name).toBe('jane@example.com');
    });

    it('should extract seller uploader info', () => {
      const authUser = {
        id: 'seller_123',
        publicMetadata: { role: 'seller' },
        firstName: 'Jane',
        username: 'janeseller'
      };
      
      const result = extractUploaderInfo(authUser);
      expect(result.type).toBe('seller');
      expect(result.name).toBe('janeseller');
      expect(result.id).toBe('seller_123');
    });

    it('should handle missing publicMetadata as seller', () => {
      const authUser = {
        id: 'user_123',
        username: 'defaultuser'
      };
      
      const result = extractUploaderInfo(authUser);
      expect(result.type).toBe('seller');
      expect(result.name).toBe('defaultuser');
    });
  });

  describe('validateSellerProfile', () => {
    it('should validate seller profile with correct role', () => {
      const profile = {
        publicMetadata: { role: 'seller' }
      };
      expect(validateSellerProfile(profile)).toBe(true);
    });

    it('should reject customer profile', () => {
      const profile = {
        publicMetadata: { role: 'customer' }
      };
      expect(validateSellerProfile(profile)).toBe(false);
    });

    it('should reject null profile', () => {
      expect(validateSellerProfile(null)).toBe(false);
    });

    it('should reject profile without publicMetadata', () => {
      const profile = {};
      expect(validateSellerProfile(profile)).toBe(false);
    });

    it('should reject profile without role', () => {
      const profile = {
        publicMetadata: {}
      };
      expect(validateSellerProfile(profile)).toBe(false);
    });
  });

  describe('sanitizeOcrResults', () => {
    it('should sanitize valid object', () => {
      const input = { text: 'Hello', confidence: 0.95 };
      const result = sanitizeOcrResults(input);
      expect(result).toEqual(input);
      expect(result).not.toBe(input); // Should be a copy
    });

    it('should handle nested objects', () => {
      const input = {
        pages: [
          { lines: [{ text: 'Line 1' }] }
        ]
      };
      const result = sanitizeOcrResults(input);
      expect(result).toEqual(input);
    });

    it('should handle circular references gracefully', () => {
      const input = { text: 'Test' };
      input.self = input; // Create circular reference
      
      const result = sanitizeOcrResults(input);
      expect(result._serializationError).toBeDefined();
    });

    it('should handle arrays', () => {
      const input = [1, 2, 3, { nested: true }];
      const result = sanitizeOcrResults(input);
      expect(result).toEqual(input);
    });
  });

  describe('createResultsCopy', () => {
    it('should create deep copy of results', () => {
      const input = { data: [1, 2, 3] };
      const result = createResultsCopy(input);
      expect(result).toEqual(input);
      expect(result).not.toBe(input);
    });

    it('should handle serialization errors', () => {
      const input = { text: 'Test' };
      input.circular = input;
      
      const result = createResultsCopy(input);
      expect(result).toBe(input); // Should return original on error
    });

    it('should handle complex nested structures', () => {
      const input = {
        pages: [
          {
            lines: [
              { text: 'Hello', boundingBox: [0, 0, 100, 50] }
            ]
          }
        ]
      };
      const result = createResultsCopy(input);
      expect(result).toEqual(input);
      expect(result.pages[0]).not.toBe(input.pages[0]);
    });
  });

  describe('Constants', () => {
    it('should have correct DOCUMENT_INTELLIGENCE_TYPES', () => {
      expect(DOCUMENT_INTELLIGENCE_TYPES).toContain('application/pdf');
      expect(DOCUMENT_INTELLIGENCE_TYPES).toContain('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      expect(DOCUMENT_INTELLIGENCE_TYPES).toContain('image/tiff');
      expect(DOCUMENT_INTELLIGENCE_TYPES.length).toBeGreaterThan(5);
    });

    it('should have correct IMAGE_TYPES', () => {
      expect(IMAGE_TYPES).toContain('image/jpeg');
      expect(IMAGE_TYPES).toContain('image/png');
      expect(IMAGE_TYPES).toContain('image/gif');
      expect(IMAGE_TYPES).toContain('image/webp');
    });

    it('should have correct SUPPORTED_DOCUMENT_TYPES', () => {
      expect(SUPPORTED_DOCUMENT_TYPES).toContain('receipt');
      expect(SUPPORTED_DOCUMENT_TYPES).toContain('invoice');
      expect(SUPPORTED_DOCUMENT_TYPES).toContain('utility');
      expect(SUPPORTED_DOCUMENT_TYPES).toContain('inventory');
      expect(SUPPORTED_DOCUMENT_TYPES).toContain('customer');
      expect(SUPPORTED_DOCUMENT_TYPES).toContain('generic');
    });
  });
});
