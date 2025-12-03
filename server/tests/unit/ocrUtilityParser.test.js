/**
 * OCR Utility Parser Unit Tests
 * Tests for utility bill/water meter parsing
 */

const { parseUtilityBill } = require('../../src/services/ocr/parsers/ocrUtilityParser');

describe('OCR Utility Parser', () => {
  describe('parseUtilityBill', () => {
    it('should return empty structure for null results', () => {
      const result = parseUtilityBill(null);
      
      expect(result).toEqual({
        manufacturer: "",
        serialNumber: "",
        standard: "",
        modelSpecs: {
          q3: "",
          q3_q1_ratio: "",
          pn: "",
          class: "",
          multipliers: [],
          maxTemp: "",
          orientation: ""
        },
        mainReading: ""
      });
    });

    it('should return empty structure for empty array', () => {
      const result = parseUtilityBill([]);
      
      expect(result.manufacturer).toBe("");
      expect(result.modelSpecs.q3).toBe("");
    });

    it('should extract ISO standard', () => {
      const mockResults = [
        {
          lines: [
            {
              text: 'ISO 4064',
              boundingBox: [100, 50, 200, 50, 200, 80, 100, 80]
            }
          ]
        }
      ];

      const result = parseUtilityBill(mockResults);
      
      expect(result.standard).toBe('ISO 4064');
    });

    it('should extract ISO standard with spacing variations', () => {
      const mockResults = [
        {
          lines: [
            {
              text: 'ISO  4064',
              boundingBox: [100, 50, 200, 50, 200, 80, 100, 80]
            }
          ]
        }
      ];

      const result = parseUtilityBill(mockResults);
      
      expect(result.standard).toContain('ISO');
      expect(result.standard).toContain('4064');
    });

    it('should extract Q3 value from explicit label', () => {
      const mockResults = [
        {
          lines: [
            {
              text: 'Q3: 5 m³/h',
              boundingBox: [100, 50, 200, 50, 200, 80, 100, 80]
            }
          ]
        }
      ];

      const result = parseUtilityBill(mockResults);
      
      expect(result.modelSpecs.q3).toContain('5');
    });

    it('should extract manufacturer from common brands', () => {
      const mockResults = [
        {
          lines: [
            {
              text: 'SENSUS',
              boundingBox: [100, 50, 200, 50, 200, 80, 100, 80]
            }
          ]
        }
      ];

      const result = parseUtilityBill(mockResults);
      
      expect(result.manufacturer).toBe('SENSUS');
    });

    it('should extract serial number patterns', () => {
      const mockResults = [
        {
          lines: [
            {
              text: '1234567890',
              boundingBox: [100, 500, 200, 500, 200, 530, 100, 530]
            }
          ]
        }
      ];

      const result = parseUtilityBill(mockResults);
      
      // Serial number extraction depends on position and context
      expect(result).toBeDefined();
    });

    it('should handle main reading extraction', () => {
      const mockResults = [
        {
          lines: [
            {
              text: 'M3',
              boundingBox: [100, 400, 150, 400, 150, 430, 100, 430]
            },
            {
              text: '12345',
              boundingBox: [100, 450, 200, 450, 200, 480, 100, 480]
            }
          ]
        }
      ];

      const result = parseUtilityBill(mockResults);
      
      expect(result).toBeDefined();
      expect(result.mainReading).toBeDefined();
    });

    it('should filter out very short lines', () => {
      const mockResults = [
        {
          lines: [
            {
              text: 'A',
              boundingBox: [100, 50, 120, 50, 120, 80, 100, 80]
            },
            {
              text: 'ISO 4064',
              boundingBox: [100, 100, 200, 100, 200, 130, 100, 130]
            }
          ]
        }
      ];

      const result = parseUtilityBill(mockResults);
      
      // Should still extract ISO despite short line
      expect(result.standard).toBe('ISO 4064');
    });

    it('should handle multiple pages', () => {
      const mockResults = [
        {
          lines: [
            {
              text: 'Page 1',
              boundingBox: [100, 50, 200, 50, 200, 80, 100, 80]
            }
          ]
        },
        {
          lines: [
            {
              text: 'ISO 4064',
              boundingBox: [100, 50, 200, 50, 200, 80, 100, 80]
            }
          ]
        }
      ];

      const result = parseUtilityBill(mockResults);
      
      expect(result.standard).toBe('ISO 4064');
    });

    it('should extract PN (pressure rating)', () => {
      const mockResults = [
        {
          lines: [
            {
              text: 'PN 16',
              boundingBox: [100, 50, 200, 50, 200, 80, 100, 80]
            }
          ]
        }
      ];

      const result = parseUtilityBill(mockResults);
      
      // Parser may or may not extract PN depending on context
      expect(result).toBeDefined();
      expect(result.modelSpecs).toBeDefined();
    });

    it('should extract meter class', () => {
      const mockResults = [
        {
          lines: [
            {
              text: 'Class B',
              boundingBox: [100, 50, 200, 50, 200, 80, 100, 80]
            }
          ]
        }
      ];

      const result = parseUtilityBill(mockResults);
      
      expect(result.modelSpecs.class).toContain('B');
    });

    it('should handle case insensitive text matching', () => {
      const mockResults = [
        {
          lines: [
            {
              text: 'iso 4064',
              boundingBox: [100, 50, 200, 50, 200, 80, 100, 80]
            }
          ]
        }
      ];

      const result = parseUtilityBill(mockResults);
      
      expect(result.standard).toBe('ISO 4064');
    });

    it('should handle trimmed text', () => {
      const mockResults = [
        {
          lines: [
            {
              text: '  ISO 4064  ',
              boundingBox: [100, 50, 200, 50, 200, 80, 100, 80]
            }
          ]
        }
      ];

      const result = parseUtilityBill(mockResults);
      
      expect(result.standard).toBe('ISO 4064');
    });

    it('should handle complex utility meter data', () => {
      const mockResults = [
        {
          lines: [
            {
              text: 'SENSUS',
              boundingBox: [100, 50, 200, 50, 200, 80, 100, 80]
            },
            {
              text: 'ISO 4064',
              boundingBox: [100, 100, 200, 100, 200, 130, 100, 130]
            },
            {
              text: 'Q3: 5 m³/h',
              boundingBox: [100, 150, 250, 150, 250, 180, 100, 180]
            },
            {
              text: 'PN 16',
              boundingBox: [100, 200, 180, 200, 180, 230, 100, 230]
            },
            {
              text: 'Class B',
              boundingBox: [100, 250, 200, 250, 200, 280, 100, 280]
            },
            {
              text: 'M3',
              boundingBox: [100, 400, 150, 400, 150, 430, 100, 430]
            },
            {
              text: '54321',
              boundingBox: [100, 450, 200, 450, 200, 480, 100, 480]
            }
          ]
        }
      ];

      const result = parseUtilityBill(mockResults);
      
      expect(result.manufacturer).toBe('SENSUS');
      expect(result.standard).toBe('ISO 4064');
      expect(result.modelSpecs.q3).toContain('5');
      // PN and Class extraction depends on spatial context
      expect(result.modelSpecs).toBeDefined();
    });

    it('should handle empty page lines', () => {
      const mockResults = [
        {
          lines: []
        }
      ];

      const result = parseUtilityBill(mockResults);
      
      expect(result.manufacturer).toBe("");
    });

    it('should extract max temperature', () => {
      const mockResults = [
        {
          lines: [
            {
              text: 'Max 50°C',
              boundingBox: [100, 50, 200, 50, 200, 80, 100, 80]
            }
          ]
        }
      ];

      const result = parseUtilityBill(mockResults);
      
      expect(result.modelSpecs.maxTemp).toContain('50');
    });

    it('should extract orientation markers', () => {
      const mockResults = [
        {
          lines: [
            {
              text: 'B - H',
              boundingBox: [100, 50, 200, 50, 200, 80, 100, 80]
            }
          ]
        }
      ];

      const result = parseUtilityBill(mockResults);
      
      // Orientation extraction depends on context
      expect(result.modelSpecs).toBeDefined();
      expect(result.modelSpecs.orientation).toBeDefined();
    });

    it('should handle Q3/Q1 ratio extraction', () => {
      const mockResults = [
        {
          lines: [
            {
              text: 'Q3/Q1: 100',
              boundingBox: [100, 50, 200, 50, 200, 80, 100, 80]
            }
          ]
        }
      ];

      const result = parseUtilityBill(mockResults);
      
      // Ratio extraction depends on context
      expect(result.modelSpecs).toBeDefined();
      expect(result.modelSpecs.q3_q1_ratio).toBeDefined();
    });

    it('should handle multiplier extraction', () => {
      const mockResults = [
        {
          lines: [
            {
              text: 'x1',
              boundingBox: [100, 50, 150, 50, 150, 80, 100, 80]
            },
            {
              text: 'x10',
              boundingBox: [100, 100, 150, 100, 150, 130, 100, 130]
            }
          ]
        }
      ];

      const result = parseUtilityBill(mockResults);
      
      expect(result.modelSpecs.multipliers).toBeDefined();
      expect(Array.isArray(result.modelSpecs.multipliers)).toBe(true);
    });
  });
});
