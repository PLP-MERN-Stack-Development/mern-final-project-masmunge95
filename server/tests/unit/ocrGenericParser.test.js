/**
 * OCR Generic Parser Unit Tests
 * Tests for generic document and customer records parsing
 */

const {
  parseGenericDocument,
  parseUtilityCustomerRecords
} = require('../../src/services/ocr/parsers/ocrGenericParser');

describe('OCR Generic Parser', () => {
  describe('parseGenericDocument', () => {
    it('should return empty structure for null results', () => {
      const result = parseGenericDocument({});
      
      expect(result).toEqual({
        tables: [],
        keyValuePairs: [],
        rawText: ''
      });
    });

    it('should extract tables from Document Intelligence results', () => {
      const mockResults = {
        tables: [
          {
            rowCount: 2,
            columnCount: 3,
            cells: [
              { content: 'Header 1', rowIndex: 0, columnIndex: 0 },
              { content: 'Header 2', rowIndex: 0, columnIndex: 1 },
              { content: 'Header 3', rowIndex: 0, columnIndex: 2 },
              { content: 'Data 1', rowIndex: 1, columnIndex: 0 },
              { content: 'Data 2', rowIndex: 1, columnIndex: 1 },
              { content: 'Data 3', rowIndex: 1, columnIndex: 2 }
            ]
          }
        ]
      };

      const result = parseGenericDocument(mockResults);
      
      expect(result.tables).toHaveLength(1);
      expect(result.tables[0].rowCount).toBe(2);
      expect(result.tables[0].columnCount).toBe(3);
      expect(result.tables[0].cells).toHaveLength(6);
      expect(result.tables[0].cells[0].content).toBe('Header 1');
    });

    it('should extract key-value pairs', () => {
      const mockResults = {
        keyValuePairs: [
          {
            key: { content: 'Customer Name' },
            value: { content: 'John Doe' }
          },
          {
            key: { content: 'Account Number' },
            value: { content: '12345' }
          }
        ]
      };

      const result = parseGenericDocument(mockResults);
      
      expect(result.keyValuePairs).toHaveLength(2);
      expect(result.keyValuePairs[0]).toEqual({
        key: 'Customer Name',
        value: 'John Doe'
      });
      expect(result.keyValuePairs[1]).toEqual({
        key: 'Account Number',
        value: '12345'
      });
    });

    it('should filter out key-value pairs with missing key or value', () => {
      const mockResults = {
        keyValuePairs: [
          {
            key: { content: 'Valid Key' },
            value: { content: 'Valid Value' }
          },
          {
            key: null,
            value: { content: 'Invalid' }
          },
          {
            key: { content: 'Invalid' },
            value: null
          }
        ]
      };

      const result = parseGenericDocument(mockResults);
      
      expect(result.keyValuePairs).toHaveLength(1);
      expect(result.keyValuePairs[0].key).toBe('Valid Key');
    });

    it('should extract raw text content', () => {
      const mockResults = {
        content: 'This is the full document text content.'
      };

      const result = parseGenericDocument(mockResults);
      
      expect(result.rawText).toBe('This is the full document text content.');
    });

    it('should extract customer name from raw text', () => {
      const mockResults = {
        content: 'Customer Name: John Smith\nMobile: 1234567890'
      };

      const result = parseGenericDocument(mockResults);
      
      expect(result.customerName).toBe('John Smith');
    });

    it('should extract customer name with "Customer:" prefix', () => {
      const mockResults = {
        content: 'Customer: Jane Doe\nPhone: 123456'
      };

      const result = parseGenericDocument(mockResults);
      
      expect(result.customerName).toContain('Jane Doe');
    });

    it('should extract customer name from "Name:" pattern', () => {
      const mockResults = {
        content: 'Name: Alice Johnson\nAccount: ABC123'
      };

      const result = parseGenericDocument(mockResults);
      
      expect(result.customerName).toContain('Alice Johnson');
    });

    it('should extract mobile number from customer name line', () => {
      const mockResults = {
        content: 'Customer Name: Bob Williams Mobile 0712345678'
      };

      const result = parseGenericDocument(mockResults);
      
      expect(result.customerName).toBe('Bob Williams');
      expect(result.mobileNumber).toBe('0712345678');
    });

    it('should extract mobile number from labeled field', () => {
      const mockResults = {
        content: 'Customer: Sarah Jones\nMobile Number: +254712345678'
      };

      const result = parseGenericDocument(mockResults);
      
      expect(result.mobileNumber).toBe('+254712345678');
    });

    it('should extract mobile number without label as fallback', () => {
      const mockResults = {
        content: 'Customer: Tom Brown\nContact: 0700123456'
      };

      const result = parseGenericDocument(mockResults);
      
      expect(result.mobileNumber).toBe('0700123456');
    });

    it('should extract statement date from labeled field', () => {
      const mockResults = {
        content: 'Date of Statement: 31st 8 2025\nAccount: 12345'
      };

      const result = parseGenericDocument(mockResults);
      
      expect(result.statementDate).toBe('2025-08-31');
    });

    it('should extract statement period from labeled field', () => {
      const mockResults = {
        content: 'Statement Period: 1st 7 2025 - 31st 7 2025'
      };

      const result = parseGenericDocument(mockResults);
      
      expect(result.statementPeriod).toEqual({
        startDate: '2025-07-01',
        endDate: '2025-07-31'
      });
    });

    it('should extract dates with various formats', () => {
      const mockResults = {
        content: 'Statement Period: 15 06 2025 to 14 07 2025'
      };

      const result = parseGenericDocument(mockResults);
      
      expect(result.statementPeriod).toEqual({
        startDate: '2025-06-15',
        endDate: '2025-07-14'
      });
    });

    it('should fall back to first two dates if no labeled period', () => {
      const mockResults = {
        content: 'Document created on 1 1 2025\nValid until 31 12 2025'
      };

      const result = parseGenericDocument(mockResults);
      
      expect(result.statementDate).toBe('2025-01-01');
      expect(result.statementPeriod).toEqual({
        startDate: '2025-01-01',
        endDate: '2025-12-31'
      });
    });

    it('should handle extraction errors gracefully', () => {
      const mockResults = {
        content: null // Invalid content type
      };

      // Should not throw
      expect(() => parseGenericDocument(mockResults)).not.toThrow();
    });

    it('should handle complex document with all features', () => {
      const mockResults = {
        tables: [
          {
            rowCount: 1,
            columnCount: 2,
            cells: [
              { content: 'Item', rowIndex: 0, columnIndex: 0 },
              { content: 'Value', rowIndex: 0, columnIndex: 1 }
            ]
          }
        ],
        keyValuePairs: [
          {
            key: { content: 'Field' },
            value: { content: 'Data' }
          }
        ],
        content: 'Customer Name: Full Name\nDate of Statement: 1st 1 2025'
      };

      const result = parseGenericDocument(mockResults);
      
      expect(result.tables).toHaveLength(1);
      expect(result.keyValuePairs).toHaveLength(1);
      expect(result.rawText).toBeTruthy();
      expect(result.customerName).toContain('Full Name');
      expect(result.statementDate).toBe('2025-01-01');
    });

    it('should handle phone numbers with various formats', () => {
      const mockResults = {
        content: 'Contact: +254 (712) 345-678'
      };

      const result = parseGenericDocument(mockResults);
      
      expect(result.mobileNumber).toContain('254');
      expect(result.mobileNumber).toContain('712');
    });

    it('should handle dates with ordinal suffixes', () => {
      const mockResults = {
        content: 'Date of Statement: 1st 1 2025\nDue Date: 15th 2 2025'
      };

      const result = parseGenericDocument(mockResults);
      
      expect(result.statementDate).toBe('2025-01-01');
    });

    it('should handle empty results gracefully', () => {
      const result = parseGenericDocument({
        tables: [],
        keyValuePairs: [],
        content: ''
      });

      expect(result.tables).toEqual([]);
      expect(result.keyValuePairs).toEqual([]);
      expect(result.rawText).toBe('');
    });
  });

  describe('parseUtilityCustomerRecords', () => {
    it('should return empty structure for empty results', () => {
      const result = parseUtilityCustomerRecords({});
      
      expect(result).toEqual({
        customers: [],
        headers: [],
        rawTable: null
      });
    });

    it('should parse Document Intelligence table results', () => {
      const mockResults = {
        tables: [
          {
            rowCount: 3,
            columnCount: 4,
            cells: [
              // Headers
              { content: 'Customer Name', rowIndex: 0, columnIndex: 0 },
              { content: 'Jan', rowIndex: 0, columnIndex: 1 },
              { content: 'Feb', rowIndex: 0, columnIndex: 2 },
              { content: 'Mar', rowIndex: 0, columnIndex: 3 },
              // Row 1
              { content: 'John Doe', rowIndex: 1, columnIndex: 0 },
              { content: '150', rowIndex: 1, columnIndex: 1 },
              { content: '175', rowIndex: 1, columnIndex: 2 },
              { content: '160', rowIndex: 1, columnIndex: 3 },
              // Row 2
              { content: 'Jane Smith', rowIndex: 2, columnIndex: 0 },
              { content: '200', rowIndex: 2, columnIndex: 1 },
              { content: '225', rowIndex: 2, columnIndex: 2 },
              { content: '210', rowIndex: 2, columnIndex: 3 }
            ]
          }
        ]
      };

      const result = parseUtilityCustomerRecords(mockResults);
      
      expect(result.headers).toEqual(['Customer Name', 'Jan', 'Feb', 'Mar']);
      expect(result.customers).toHaveLength(2);
      expect(result.customers[0].name).toBe('John Doe');
      expect(result.customers[0].readings).toEqual({
        Jan: 150,
        Feb: 175,
        Mar: 160
      });
      expect(result.customers[1].name).toBe('Jane Smith');
    });

    it('should skip rows without customer name', () => {
      const mockResults = {
        tables: [
          {
            rowCount: 3,
            columnCount: 2,
            cells: [
              { content: 'Name', rowIndex: 0, columnIndex: 0 },
              { content: 'Reading', rowIndex: 0, columnIndex: 1 },
              { content: 'Customer A', rowIndex: 1, columnIndex: 0 },
              { content: '100', rowIndex: 1, columnIndex: 1 },
              { content: '', rowIndex: 2, columnIndex: 0 }, // Empty name
              { content: '200', rowIndex: 2, columnIndex: 1 }
            ]
          }
        ]
      };

      const result = parseUtilityCustomerRecords(mockResults);
      
      expect(result.customers).toHaveLength(1);
      expect(result.customers[0].name).toBe('Customer A');
    });

    it('should parse Computer Vision results (handwritten tables)', () => {
      const mockResults = [
        {
          lines: [
            // Header row
            {
              text: 'Name',
              boundingBox: [100, 50, 200, 50, 200, 80, 100, 80]
            },
            {
              text: 'Jan',
              boundingBox: [300, 50, 350, 50, 350, 80, 300, 80]
            },
            {
              text: 'Feb',
              boundingBox: [400, 50, 450, 50, 450, 80, 400, 80]
            },
            // Data row 1
            {
              text: 'Alice',
              boundingBox: [100, 150, 200, 150, 200, 180, 100, 180]
            },
            {
              text: '120',
              boundingBox: [300, 150, 350, 150, 350, 180, 300, 180]
            },
            {
              text: '130',
              boundingBox: [400, 150, 450, 150, 450, 180, 400, 180]
            }
          ]
        }
      ];

      const result = parseUtilityCustomerRecords(mockResults);
      
      expect(result.headers).toEqual(['Name', 'Jan', 'Feb']);
      expect(result.customers).toHaveLength(1);
      expect(result.customers[0].name).toBe('Alice');
      expect(result.customers[0].readings).toEqual({
        Jan: 120,
        Feb: 130
      });
    });

    it('should group lines by vertical position (same row)', () => {
      const mockResults = [
        {
          lines: [
            {
              text: 'Header1',
              boundingBox: [100, 50, 200, 50, 200, 80, 100, 80]
            },
            {
              text: 'Header2',
              boundingBox: [300, 55, 400, 55, 400, 85, 300, 85] // Slightly different Y
            },
            {
              text: 'Data1',
              boundingBox: [100, 150, 200, 150, 200, 180, 100, 180]
            },
            {
              text: 'Data2',
              boundingBox: [300, 155, 400, 155, 400, 185, 300, 185]
            }
          ]
        }
      ];

      const result = parseUtilityCustomerRecords(mockResults);
      
      expect(result.headers).toEqual(['Header1', 'Header2']);
      expect(result.customers).toHaveLength(1);
    });

    it('should sort cells by X position within rows', () => {
      const mockResults = [
        {
          lines: [
            // Headers in wrong order (by X position)
            {
              text: 'Feb',
              boundingBox: [300, 50, 350, 50, 350, 80, 300, 80]
            },
            {
              text: 'Name',
              boundingBox: [100, 50, 200, 50, 200, 80, 100, 80]
            },
            {
              text: 'Jan',
              boundingBox: [200, 50, 250, 50, 250, 80, 200, 80]
            }
          ]
        }
      ];

      const result = parseUtilityCustomerRecords(mockResults);
      
      // Should be sorted left to right
      expect(result.headers[0]).toBe('Name');
      expect(result.headers[1]).toBe('Jan');
      expect(result.headers[2]).toBe('Feb');
    });

    it('should parse numeric readings correctly', () => {
      const mockResults = {
        tables: [
          {
            rowCount: 2,
            columnCount: 3,
            cells: [
              { content: 'Name', rowIndex: 0, columnIndex: 0 },
              { content: 'Reading', rowIndex: 0, columnIndex: 1 },
              { content: 'Cost', rowIndex: 0, columnIndex: 2 },
              { content: 'Customer', rowIndex: 1, columnIndex: 0 },
              { content: '150.5', rowIndex: 1, columnIndex: 1 },
              { content: '45.25', rowIndex: 1, columnIndex: 2 }
            ]
          }
        ]
      };

      const result = parseUtilityCustomerRecords(mockResults);
      
      expect(result.customers[0].readings.Reading).toBe(150.5);
      expect(result.customers[0].readings.Cost).toBe(45.25);
    });

    it('should handle non-numeric values in readings', () => {
      const mockResults = {
        tables: [
          {
            rowCount: 2,
            columnCount: 2,
            cells: [
              { content: 'Name', rowIndex: 0, columnIndex: 0 },
              { content: 'Status', rowIndex: 0, columnIndex: 1 },
              { content: 'Customer', rowIndex: 1, columnIndex: 0 },
              { content: 'Active', rowIndex: 1, columnIndex: 1 }
            ]
          }
        ]
      };

      const result = parseUtilityCustomerRecords(mockResults);
      
      expect(result.customers[0].readings.Status).toBe('Active');
    });

    it('should handle empty table results', () => {
      const mockResults = {
        tables: []
      };

      const result = parseUtilityCustomerRecords(mockResults);
      
      expect(result.customers).toEqual([]);
      expect(result.headers).toEqual([]);
    });

    it('should handle empty Computer Vision results', () => {
      const mockResults = [{ lines: [] }];

      const result = parseUtilityCustomerRecords(mockResults);
      
      expect(result.customers).toEqual([]);
      expect(result.headers).toEqual([]);
    });

    it('should handle single-row table (headers only)', () => {
      const mockResults = {
        tables: [
          {
            rowCount: 1,
            columnCount: 3,
            cells: [
              { content: 'Name', rowIndex: 0, columnIndex: 0 },
              { content: 'Jan', rowIndex: 0, columnIndex: 1 },
              { content: 'Feb', rowIndex: 0, columnIndex: 2 }
            ]
          }
        ]
      };

      const result = parseUtilityCustomerRecords(mockResults);
      
      expect(result.headers).toEqual(['Name', 'Jan', 'Feb']);
      expect(result.customers).toEqual([]);
    });

    it('should store raw table reference', () => {
      const mockTable = {
        rowCount: 2,
        columnCount: 2,
        cells: [
          { content: 'A', rowIndex: 0, columnIndex: 0 },
          { content: 'B', rowIndex: 0, columnIndex: 1 },
          { content: 'C', rowIndex: 1, columnIndex: 0 },
          { content: 'D', rowIndex: 1, columnIndex: 1 }
        ]
      };

      const mockResults = {
        tables: [mockTable]
      };

      const result = parseUtilityCustomerRecords(mockResults);
      
      expect(result.rawTable).toBe(mockTable);
    });

    it('should handle multiple data rows', () => {
      const mockResults = [
        {
          lines: [
            { text: 'Name', boundingBox: [100, 50, 200, 50, 200, 80, 100, 80] },
            { text: 'Reading', boundingBox: [300, 50, 400, 50, 400, 80, 300, 80] },
            { text: 'Alice', boundingBox: [100, 150, 200, 150, 200, 180, 100, 180] },
            { text: '100', boundingBox: [300, 150, 400, 150, 400, 180, 300, 180] },
            { text: 'Bob', boundingBox: [100, 250, 200, 250, 200, 280, 100, 280] },
            { text: '200', boundingBox: [300, 250, 400, 250, 400, 280, 300, 280] },
            { text: 'Carol', boundingBox: [100, 350, 200, 350, 200, 380, 100, 380] },
            { text: '300', boundingBox: [300, 350, 400, 350, 400, 380, 300, 380] }
          ]
        }
      ];

      const result = parseUtilityCustomerRecords(mockResults);
      
      expect(result.customers).toHaveLength(3);
      expect(result.customers[0].name).toBe('Alice');
      expect(result.customers[1].name).toBe('Bob');
      expect(result.customers[2].name).toBe('Carol');
    });
  });
});
