const {
  findTotalCandidate,
  extractIdsFromRawDriverResponse,
  findAmounts,
  extractStructuredTotalTop
} = require('../../src/services/ocrParsers');

describe('OCR Parsers Unit Tests', () => {
  
  describe('findTotalCandidate', () => {
    it('should extract total from structured Document Intelligence fields', () => {
      const ocrData = {
        metadata: {
          rawDriverResponse: [{
            fields: {
              InvoiceTotal: {
                value: { amount: 1250.50 },
                confidence: 0.95
              }
            }
          }]
        }
      };
      
      const result = findTotalCandidate(ocrData, '', { ocrData });
      expect(result).toBeDefined();
      expect(result.value).toBe(1250.50);
      expect(result.confidence).toBe('high');
    });

    it('should find total from text using "total" keyword', () => {
      const fullText = 'Thank you for your purchase\nTotal: 45.99\nPaid by card';
      
      const result = findTotalCandidate({}, fullText, {});
      expect(result).toBeDefined();
      expect(result.value).toBe(45.99);
      expect(result.confidence).toBe('high');
      expect(result.reason).toContain('total');
    });

    it('should find total from text using "amount due" keyword', () => {
      const fullText = 'Invoice #12345\nAmount Due: 250.00\nThank you';
      
      const result = findTotalCandidate({}, fullText, {});
      expect(result).toBeDefined();
      expect(result.value).toBe(250.00);
    });

    it('should return largest number when no keywords found', () => {
      const fullText = 'Item 1: 10.00\nItem 2: 25.50\nItem 3: 5.00';
      
      const result = findTotalCandidate({}, fullText, {});
      expect(result).toBeDefined();
      expect(result.value).toBe(25.50);
      expect(result.confidence).toBe('low');
    });

    it('should filter out unreasonably large numbers', () => {
      const fullText = 'Phone: 1234567890\nTotal: 45.99';
      
      const result = findTotalCandidate({}, fullText, {});
      expect(result).toBeDefined();
      expect(result.value).toBe(45.99);
    });

    it('should return null confidence when no numbers found', () => {
      const fullText = 'No numbers here at all';
      
      const result = findTotalCandidate({}, fullText, {});
      expect(result).toBeDefined();
      expect(result.value).toBeNull();
      expect(result.confidence).toBe('none');
    });

    it('should handle currency-kind values from Document Intelligence', () => {
      const ocrData = {
        metadata: {
          rawDriverResponse: [{
            fields: {
              someField: {
                kind: 'currency',
                value: { amount: 99.99 }
              }
            }
          }]
        }
      };
      
      const result = findTotalCandidate(ocrData, '', { ocrData });
      expect(result).toBeDefined();
      expect(result.value).toBe(99.99);
      expect(result.confidence).toBe('high');
    });
  });

  describe('extractIdsFromRawDriverResponse', () => {
    it('should extract InvoiceId from Document Intelligence response', () => {
      const ocrData = {
        metadata: {
          rawDriverResponse: [{
            fields: {
              InvoiceId: {
                content: 'INV-12345',
                confidence: 0.98
              }
            }
          }]
        }
      };
      
      const result = extractIdsFromRawDriverResponse(ocrData, {});
      expect(result.InvoiceId).toBe('INV-12345');
    });

    it('should extract TransactionId from raw response', () => {
      const ocrData = {
        metadata: {
          rawDriverResponse: [{
            fields: {
              TransactionId: {
                content: 'TXN-98765'
              }
            }
          }]
        }
      };
      
      const result = extractIdsFromRawDriverResponse(ocrData, {});
      expect(result.TransactionId).toBe('TXN-98765');
    });

    it('should handle case-insensitive field matching', () => {
      const ocrData = {
        metadata: {
          rawDriverResponse: [{
            fields: {
              invoiceid: {
                content: 'INV-ABC'
              }
            }
          }]
        }
      };
      
      const result = extractIdsFromRawDriverResponse(ocrData, {});
      expect(result.InvoiceId).toBe('INV-ABC');
    });

    it('should return empty object when no IDs found', () => {
      const result = extractIdsFromRawDriverResponse({}, {});
      expect(result).toEqual({});
    });

    it('should handle missing metadata gracefully', () => {
      const result = extractIdsFromRawDriverResponse(null, null);
      expect(result).toEqual({});
    });
  });

  describe('parseUtilityOcrData', () => {
    // parseUtilityOcrData is not exported, but we can test findTotalCandidate and extractIdsFromRawDriverResponse
    // which are the core parsing functions used by all document types
    it('should use findTotalCandidate for utility data', () => {
      const fullText = 'ELECTRICITY BILL\nAccount: 123456\nPrevious: 100\nCurrent: 150\nTotal: 450.00';
      
      const result = findTotalCandidate({}, fullText, {});
      expect(result).toBeDefined();
      expect(result.value).toBe(450.00);
    });
  });

  describe('parseInventoryOcrData', () => {
    it('should use findAmounts to extract numeric values from inventory', () => {
      const text = 'Product: Widget A SKU: WID-001 Quantity: 50 Price: 10.00';
      
      const amounts = findAmounts(text);
      expect(amounts).toBeDefined();
      expect(amounts.length).toBeGreaterThan(0);
      expect(amounts).toContain(50);
      expect(amounts).toContain(10.00);
    });
  });

  describe('parseReceiptOcrData', () => {
    it('should extract amounts from receipt text', () => {
      const text = 'GROCERY STORE Milk 2.99 Bread 1.50 Total 4.49';
      
      const amounts = findAmounts(text);
      expect(amounts).toBeDefined();
      expect(amounts).toContain(2.99);
      expect(amounts).toContain(1.50);
      expect(amounts).toContain(4.49);
    });
  });

  describe('parseCustomerConsumptionOcrData', () => {
    it('should extract consumption values using findAmounts', () => {
      const text = 'Customer: John Doe Previous: 1000 Current: 1250 Usage: 250';
      
      const amounts = findAmounts(text);
      expect(amounts).toBeDefined();
      expect(amounts).toContain(1000);
      expect(amounts).toContain(1250);
      expect(amounts).toContain(250);
    });
  });

  describe('findAmounts', () => {
    it('should extract all numeric amounts from text', () => {
      const text = '10.99 + 25.50 + 5 = 41.49';
      
      const amounts = findAmounts(text);
      expect(amounts).toEqual([10.99, 25.50, 5, 41.49]);
    });

    it('should handle numbers with commas', () => {
      const text = 'Total: 1,234.56';
      
      const amounts = findAmounts(text);
      expect(amounts).toContain(1234.56);
    });

    it('should return empty array for text without numbers', () => {
      const amounts = findAmounts('No numbers here');
      expect(amounts).toEqual([]);
    });

    it('should handle null or undefined input', () => {
      expect(findAmounts(null)).toEqual([]);
      expect(findAmounts(undefined)).toEqual([]);
    });
  });

  describe('extractStructuredTotalTop', () => {
    it('should extract total from nested metadata structure', () => {
      const rec = {
        ocrData: {
          metadata: {
            rawDriverResponse: [{
              fields: {
                InvoiceTotal: {
                  value: { amount: 500.00 }
                }
              }
            }]
          }
        }
      };
      
      const result = extractStructuredTotalTop(rec);
      expect(result).toBeDefined();
      expect(result.value).toBe(500.00);
    });

    it('should return null when no structured data found', () => {
      const result = extractStructuredTotalTop({});
      expect(result).toBeNull();
    });

    it('should handle invalid input gracefully', () => {
      expect(extractStructuredTotalTop(null)).toBeNull();
      expect(extractStructuredTotalTop('string')).toBeNull();
    });
  });
});
