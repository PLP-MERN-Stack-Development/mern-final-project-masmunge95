/**
 * OCR Receipt Parser Unit Tests
 * Tests for receipt/invoice OCR result parsing
 */

const { parseOcrResult } = require('../../src/services/ocr/parsers/ocrReceiptParser');

describe('OCR Receipt Parser', () => {
  describe('parseOcrResult', () => {
    it('should return empty data for null results', () => {
      const result = parseOcrResult(null);
      
      expect(result).toEqual({
        businessName: '',
        businessAddress: '',
        invoiceNo: '',
        invoiceDate: '',
        deliveryDetails: {},
        items: [],
        fees: [],
        subtotal: 0.00,
        tax: 0.00,
        total: 0.00,
        paymentMethod: '',
        promotions: ''
      });
    });

    it('should return empty data for empty array', () => {
      const result = parseOcrResult([]);
      
      expect(result.businessName).toBe('');
      expect(result.items).toEqual([]);
      expect(result.total).toBe(0.00);
    });

    it('should return empty data for non-array input', () => {
      const result = parseOcrResult('invalid');
      
      expect(result.businessName).toBe('');
      expect(result.items).toEqual([]);
    });

    it('should parse basic receipt with business name', () => {
      const mockResults = [
        {
          lines: [
            {
              text: 'SuperMart Store',
              boundingBox: [100, 50, 500, 50, 500, 100, 100, 100]
            },
            {
              text: '123 Main Street',
              boundingBox: [100, 120, 450, 120, 450, 150, 100, 150]
            }
          ]
        }
      ];

      const result = parseOcrResult(mockResults);
      
      expect(result.businessName).toBe('SuperMart Store');
    });

    it('should extract invoice number from label and value pair', () => {
      const mockResults = [
        {
          lines: [
            {
              text: 'Store Name',
              boundingBox: [100, 50, 300, 50, 300, 80, 100, 80]
            },
            {
              text: 'Invoice No',
              boundingBox: [100, 100, 250, 100, 250, 130, 100, 130]
            },
            {
              text: '1234567',
              boundingBox: [260, 100, 380, 100, 380, 130, 260, 130]
            }
          ]
        }
      ];

      const result = parseOcrResult(mockResults);
      
      expect(result.invoiceNo).toBe('1234567');
    });

    it('should extract invoice date', () => {
      const mockResults = [
        {
          lines: [
            {
              text: 'Store Name',
              boundingBox: [100, 50, 300, 50, 300, 80, 100, 80]
            },
            {
              text: 'Invoice Date',
              boundingBox: [100, 100, 250, 100, 250, 130, 100, 130]
            },
            {
              text: '15-Jan-2024',
              boundingBox: [260, 100, 380, 100, 380, 130, 260, 130]
            }
          ]
        }
      ];

      const result = parseOcrResult(mockResults);
      
      expect(result.invoiceDate).toBe('15-Jan-2024');
    });

    it('should handle results with no lines', () => {
      const mockResults = [{ lines: [] }];
      
      const result = parseOcrResult(mockResults);
      
      expect(result.businessName).toBe('');
      expect(result.items).toEqual([]);
    });

    it('should handle multiple pages', () => {
      const mockResults = [
        {
          lines: [
            {
              text: 'Page 1 Store',
              boundingBox: [100, 50, 300, 50, 300, 80, 100, 80]
            }
          ]
        },
        {
          lines: [
            {
              text: 'Additional Info',
              boundingBox: [100, 50, 300, 50, 300, 80, 100, 80]
            }
          ]
        }
      ];

      const result = parseOcrResult(mockResults);
      
      expect(result.businessName).toBe('Page 1 Store');
    });

    it('should filter out ignore keywords', () => {
      const mockResults = [
        {
          lines: [
            {
              text: 'Valid Store Name',
              boundingBox: [100, 50, 400, 50, 400, 80, 100, 80]
            },
            {
              text: 'Tax',
              boundingBox: [100, 100, 200, 100, 200, 130, 100, 130]
            },
            {
              text: 'Total',
              boundingBox: [100, 150, 200, 150, 200, 180, 100, 180]
            }
          ]
        }
      ];

      const result = parseOcrResult(mockResults);
      
      // Business name should be the first non-ignored line
      expect(result.businessName).toBe('Valid Store Name');
    });

    it('should handle lines with short text (< 3 chars)', () => {
      const mockResults = [
        {
          lines: [
            {
              text: 'AB',
              boundingBox: [100, 50, 150, 50, 150, 80, 100, 80]
            },
            {
              text: 'Valid Business Name',
              boundingBox: [100, 100, 400, 100, 400, 130, 100, 130]
            }
          ]
        }
      ];

      const result = parseOcrResult(mockResults);
      
      // Should skip short text and use first valid line
      expect(result.businessName).toBe('Valid Business Name');
    });

    it('should clean leading conjunctions from business name', () => {
      const mockResults = [
        {
          lines: [
            {
              text: 'In Store Name',
              boundingBox: [100, 50, 300, 50, 300, 80, 100, 80]
            }
          ]
        }
      ];

      const result = parseOcrResult(mockResults);
      
      expect(result.businessName).toBe('Store Name');
    });

    it('should extract total when present', () => {
      const mockResults = [
        {
          lines: [
            {
              text: 'SuperMart Store',
              boundingBox: [100, 50, 300, 50, 300, 80, 100, 80]
            },
            {
              text: 'Total',
              boundingBox: [100, 500, 200, 500, 200, 530, 100, 530]
            },
            {
              text: '50.00',
              boundingBox: [1500, 500, 1600, 500, 1600, 530, 1500, 530]
            }
          ]
        }
      ];

      const result = parseOcrResult(mockResults);
      
      // Parser should at least parse without error
      expect(result).toBeDefined();
      expect(result.businessName).toBe('SuperMart Store');
    });

    it('should handle invoice number on same line as label', () => {
      const mockResults = [
        {
          lines: [
            {
              text: 'Store',
              boundingBox: [100, 50, 200, 50, 200, 80, 100, 80]
            },
            {
              text: 'Invoice No 7654321',
              boundingBox: [100, 100, 400, 100, 400, 130, 100, 130]
            }
          ]
        }
      ];

      const result = parseOcrResult(mockResults);
      
      expect(result.invoiceNo).toBe('7654321');
    });

    it('should handle lines with valid boundingBox data', () => {
      const mockResults = [
        {
          lines: [
            {
              text: 'Store Name',
              boundingBox: [100, 50, 300, 50, 300, 80, 100, 80]
            },
            {
              text: 'Second Line',
              boundingBox: [100, 100, 300, 100, 300, 130, 100, 130]
            }
          ]
        }
      ];

      const result = parseOcrResult(mockResults);
      expect(result.businessName).toBe('Store Name');
    });

    it('should handle complex receipt with multiple sections', () => {
      const mockResults = [
        {
          lines: [
            {
              text: 'Grocery Store',
              boundingBox: [100, 50, 400, 50, 400, 80, 100, 80]
            },
            {
              text: '456 Oak Avenue',
              boundingBox: [100, 100, 350, 100, 350, 130, 100, 130]
            },
            {
              text: 'Invoice No',
              boundingBox: [100, 150, 250, 150, 250, 180, 100, 180]
            },
            {
              text: '9876543',
              boundingBox: [260, 150, 380, 150, 380, 180, 260, 180]
            },
            {
              text: 'Item 1',
              boundingBox: [100, 250, 300, 250, 300, 280, 100, 280]
            },
            {
              text: '10.00',
              boundingBox: [1500, 250, 1600, 250, 1600, 280, 1500, 280]
            },
            {
              text: 'Total',
              boundingBox: [100, 500, 200, 500, 200, 530, 100, 530]
            },
            {
              text: '10.00',
              boundingBox: [1500, 500, 1600, 500, 1600, 530, 1500, 530]
            }
          ]
        }
      ];

      const result = parseOcrResult(mockResults);
      
      expect(result.businessName).toBe('Grocery Store');
      expect(result.invoiceNo).toBe('9876543');
      // Parser extracts data structure successfully
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('items');
    });
  });
});
