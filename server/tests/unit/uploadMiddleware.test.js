const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Import the upload middleware configuration
const { upload, ensureOcrUserFolder, getDocumentTypeFolder, uploadDir } = require('../../src/middleware/uploadMiddleware');

describe('Upload Middleware', () => {
  describe('Module exports', () => {
    it('should export upload multer instance', () => {
      expect(upload).toBeDefined();
      expect(typeof upload).toBe('object');
    });

    it('should export ensureOcrUserFolder function', () => {
      expect(ensureOcrUserFolder).toBeDefined();
      expect(typeof ensureOcrUserFolder).toBe('function');
    });

    it('should export getDocumentTypeFolder function', () => {
      expect(getDocumentTypeFolder).toBeDefined();
      expect(typeof getDocumentTypeFolder).toBe('function');
    });

    it('should export uploadDir path', () => {
      expect(uploadDir).toBeDefined();
      expect(typeof uploadDir).toBe('string');
      expect(uploadDir).toContain('uploads');
    });
  });

  describe('Upload multer configuration', () => {
    it('should have single file handler', () => {
      expect(upload.single).toBeDefined();
      expect(typeof upload.single).toBe('function');
    });

    it('should accept receipt field name', () => {
      const middleware = upload.single('receipt');
      expect(middleware).toBeDefined();
    });

    it('should have array handler for multiple files', () => {
      expect(upload.array).toBeDefined();
      expect(typeof upload.array).toBe('function');
    });

    it('should have fields handler for multiple fields', () => {
      expect(upload.fields).toBeDefined();
      expect(typeof upload.fields).toBe('function');
    });
  });

  describe('ensureOcrUserFolder', () => {
    it('should create user folder for userId', () => {
      const userId = 'test-user-123';
      const documentType = 'receipt';
      
      const result = ensureOcrUserFolder(userId, documentType);
      
      expect(result).toContain('ocr');
      expect(result).toContain(userId);
      expect(result).toContain(documentType);
      expect(fs.existsSync(result)).toBe(true);
      
      // Cleanup
      fs.rmSync(path.join(uploadDir, 'ocr', userId), { recursive: true, force: true });
    });

    it('should handle document type mapping', () => {
      const userId = 'test-user-456';
      const documentType = 'invoice';
      
      const result = ensureOcrUserFolder(userId, documentType);
      
      expect(result).toContain(userId);
      expect(result).toContain(documentType);
      
      // Cleanup
      fs.rmSync(path.join(uploadDir, 'ocr', userId), { recursive: true, force: true });
    });

    it('should default to general folder when no document type', () => {
      const userId = 'test-user-789';
      
      const result = ensureOcrUserFolder(userId);
      
      expect(result).toContain(userId);
      expect(result).toContain('general');
      
      // Cleanup
      fs.rmSync(path.join(uploadDir, 'ocr', userId), { recursive: true, force: true });
    });

    it('should be idempotent (safe to call multiple times)', () => {
      const userId = 'test-user-idempotent';
      const documentType = 'utility';
      
      const result1 = ensureOcrUserFolder(userId, documentType);
      const result2 = ensureOcrUserFolder(userId, documentType);
      
      expect(result1).toBe(result2);
      expect(fs.existsSync(result1)).toBe(true);
      
      // Cleanup
      fs.rmSync(path.join(uploadDir, 'ocr', userId), { recursive: true, force: true });
    });
  });

  describe('getDocumentTypeFolder', () => {
    it('should map receipt to receipts', () => {
      expect(getDocumentTypeFolder('receipt')).toBe('receipts');
    });

    it('should map invoice to invoices', () => {
      expect(getDocumentTypeFolder('invoice')).toBe('invoices');
    });

    it('should map utility to utilities', () => {
      expect(getDocumentTypeFolder('utility')).toBe('utilities');
    });

    it('should map inventory to inventory', () => {
      expect(getDocumentTypeFolder('inventory')).toBe('inventory');
    });

    it('should map customer to customers', () => {
      expect(getDocumentTypeFolder('customer')).toBe('customers');
    });

    it('should map customer-consumption to consumption', () => {
      expect(getDocumentTypeFolder('customer-consumption')).toBe('consumption');
    });

    it('should map business-record to business-records', () => {
      expect(getDocumentTypeFolder('business-record')).toBe('business-records');
    });

    it('should default to general for unknown types', () => {
      expect(getDocumentTypeFolder('unknown-type')).toBe('general');
      expect(getDocumentTypeFolder(null)).toBe('general');
      expect(getDocumentTypeFolder(undefined)).toBe('general');
    });
  });

  describe('Storage configuration', () => {
    it('should have storage property', () => {
      expect(upload.storage).toBeDefined();
    });

    it('should create uploads directory on initialization', () => {
      expect(fs.existsSync(uploadDir)).toBe(true);
    });

    it('should create subdirectories on initialization', () => {
      expect(fs.existsSync(path.join(uploadDir, 'records'))).toBe(true);
      expect(fs.existsSync(path.join(uploadDir, 'invoices'))).toBe(true);
      expect(fs.existsSync(path.join(uploadDir, 'ocr'))).toBe(true);
    });
  });

  describe('Filename generation', () => {
    it('should generate unique filenames with timestamp', () => {
      const storage = upload.storage;
      
      const mockReq = {};
      const mockFile = { originalname: 'receipt.jpg' };
      
      storage.getFilename(mockReq, mockFile, (err, filename) => {
        expect(err).toBeNull();
        expect(filename).toBeDefined();
        expect(filename).toContain('receipt.jpg');
        expect(filename).toMatch(/^\d+-receipt\.jpg$/);
      });
    });

    it('should preserve original filename in generated name', () => {
      const storage = upload.storage;
      
      const testCases = [
        'invoice.pdf',
        'utility-bill.png',
        'business-record.jpeg',
      ];

      testCases.forEach((originalname) => {
        storage.getFilename({}, { originalname }, (err, filename) => {
          expect(err).toBeNull();
          expect(filename).toContain(originalname);
        });
      });
    });
  });

  describe('Destination routing', () => {
    it('should route to records folder for record uploads', () => {
      const storage = upload.storage;
      
      const mockReq = { baseUrl: '/api/records' };
      const mockFile = { originalname: 'record.jpg' };
      
      storage.getDestination(mockReq, mockFile, (err, destination) => {
        expect(err).toBeNull();
        expect(destination).toContain('records');
      });
    });

    it('should route to invoices folder for invoice uploads', () => {
      const storage = upload.storage;
      
      const mockReq = { baseUrl: '/api/invoices' };
      const mockFile = { originalname: 'invoice.pdf' };
      
      storage.getDestination(mockReq, mockFile, (err, destination) => {
        expect(err).toBeNull();
        expect(destination).toContain('invoices');
      });
    });

    it('should default to base uploadDir for other routes', () => {
      const storage = upload.storage;
      
      const mockReq = { baseUrl: '/api/other' };
      const mockFile = { originalname: 'file.jpg' };
      
      storage.getDestination(mockReq, mockFile, (err, destination) => {
        expect(err).toBeNull();
        expect(destination).toBe(uploadDir);
      });
    });
  });
});
