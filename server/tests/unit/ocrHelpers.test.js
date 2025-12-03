/**
 * Tests for OCR Helper Functions
 */

const {
    getCenterX,
    getMidY,
    isNumerical,
    isBarcode,
    calculateDistance,
    boxesOverlap,
    normalizeOcrLines,
} = require('../../src/utils/ocrHelpers');

describe('OCR Helper Functions', () => {
    describe('getCenterX', () => {
        it('should calculate center X coordinate', () => {
            const box = [100, 50, 200, 50, 200, 80, 100, 80];
            
            const centerX = getCenterX(box);
            
            expect(centerX).toBe(150); // (100+200+200+100)/4
        });

        it('should handle diagonal box', () => {
            const box = [10, 10, 50, 20, 60, 40, 20, 30];
            
            const centerX = getCenterX(box);
            
            expect(centerX).toBe(35); // (10+50+60+20)/4
        });
    });

    describe('getMidY', () => {
        it('should calculate middle Y coordinate', () => {
            const box = [100, 50, 200, 50, 200, 80, 100, 80];
            
            const midY = getMidY(box);
            
            expect(midY).toBe(65); // (50+80)/2
        });

        it('should handle different heights', () => {
            const box = [0, 100, 0, 120, 0, 140, 0, 160];
            
            const midY = getMidY(box);
            
            expect(midY).toBe(130); // (100+160)/2
        });
    });

    describe('isNumerical', () => {
        it('should return true for numeric text', () => {
            expect(isNumerical('123')).toBe(true);
            expect(isNumerical('456.78')).toBe(true);
            expect(isNumerical('0.99')).toBe(true);
        });

        it('should return false for non-numeric text', () => {
            expect(isNumerical('abc')).toBe(false);
            expect(isNumerical('12a')).toBe(false);
            expect(isNumerical('KSH 100')).toBe(false);
        });

        it('should return false for empty string', () => {
            expect(isNumerical('')).toBe(false);
        });

        it('should handle decimals only', () => {
            expect(isNumerical('.')).toBe(true);
            expect(isNumerical('...')).toBe(true);
        });
    });

    describe('isBarcode', () => {
        it('should return true for valid barcode patterns', () => {
            expect(isBarcode('12345678')).toBe(true); // 8 digits
            expect(isBarcode('1234567890123')).toBe(true); // 13 digits
            expect(isBarcode('12345678901234')).toBe(true); // 14 digits
        });

        it('should return false for invalid barcode patterns', () => {
            expect(isBarcode('123456')).toBe(false); // Too short
            expect(isBarcode('123456789012345')).toBe(false); // Too long
            expect(isBarcode('12345abc')).toBe(false); // Contains letters
        });

        it('should return false for numbers with decimals', () => {
            expect(isBarcode('12345678.90')).toBe(false);
        });
    });

    describe('calculateDistance', () => {
        it('should calculate Euclidean distance', () => {
            const point1 = { x: 0, y: 0 };
            const point2 = { x: 3, y: 4 };
            
            const distance = calculateDistance(point1, point2);
            
            expect(distance).toBe(5); // 3-4-5 triangle
        });

        it('should handle same point', () => {
            const point = { x: 10, y: 20 };
            
            const distance = calculateDistance(point, point);
            
            expect(distance).toBe(0);
        });

        it('should handle negative coordinates', () => {
            const point1 = { x: -3, y: -4 };
            const point2 = { x: 0, y: 0 };
            
            const distance = calculateDistance(point1, point2);
            
            expect(distance).toBe(5);
        });

        it('should calculate horizontal distance', () => {
            const point1 = { x: 0, y: 5 };
            const point2 = { x: 10, y: 5 };
            
            const distance = calculateDistance(point1, point2);
            
            expect(distance).toBe(10);
        });

        it('should calculate vertical distance', () => {
            const point1 = { x: 5, y: 0 };
            const point2 = { x: 5, y: 10 };
            
            const distance = calculateDistance(point1, point2);
            
            expect(distance).toBe(10);
        });
    });

    describe('boxesOverlap', () => {
        it('should detect overlapping boxes', () => {
            const box1 = [0, 0, 100, 0, 100, 50, 0, 50];
            const box2 = [50, 25, 150, 25, 150, 75, 50, 75];
            
            const overlap = boxesOverlap(box1, box2);
            
            expect(overlap).toBe(true);
        });

        it('should detect non-overlapping boxes', () => {
            const box1 = [0, 0, 50, 0, 50, 50, 0, 50];
            const box2 = [100, 100, 150, 100, 150, 150, 100, 150];
            
            const overlap = boxesOverlap(box1, box2);
            
            expect(overlap).toBe(false);
        });

        it('should detect touching boxes as overlapping', () => {
            const box1 = [0, 0, 50, 0, 50, 50, 0, 50];
            const box2 = [50, 0, 100, 0, 100, 50, 50, 50];
            
            const overlap = boxesOverlap(box1, box2);
            
            expect(overlap).toBe(true);
        });

        it('should detect contained boxes', () => {
            const box1 = [0, 0, 100, 0, 100, 100, 0, 100];
            const box2 = [25, 25, 75, 25, 75, 75, 25, 75];
            
            const overlap = boxesOverlap(box1, box2);
            
            expect(overlap).toBe(true);
        });

        it('should handle boxes separated horizontally', () => {
            const box1 = [0, 0, 50, 0, 50, 50, 0, 50];
            const box2 = [60, 0, 110, 0, 110, 50, 60, 50];
            
            const overlap = boxesOverlap(box1, box2);
            
            expect(overlap).toBe(false);
        });

        it('should handle boxes separated vertically', () => {
            const box1 = [0, 0, 50, 0, 50, 50, 0, 50];
            const box2 = [0, 60, 50, 60, 50, 110, 0, 110];
            
            const overlap = boxesOverlap(box1, box2);
            
            expect(overlap).toBe(false);
        });
    });

    describe('normalizeOcrLines', () => {
        it('should normalize OCR lines with spatial data', () => {
            const lines = [
                {
                    text: '  Hello World  ',
                    boundingBox: [0, 0, 100, 0, 100, 20, 0, 20],
                },
                {
                    text: 'Test Line',
                    boundingBox: [0, 30, 100, 30, 100, 50, 0, 50],
                },
            ];

            const normalized = normalizeOcrLines(lines);

            expect(normalized).toHaveLength(2);
            expect(normalized[0].text).toBe('Hello World');
            expect(normalized[0].upperText).toBe('HELLO WORLD');
            expect(normalized[0].midY).toBe(10); // (0+20)/2
            expect(normalized[0].centerX).toBe(50); // (0+100+100+0)/4
            expect(normalized[0].isUsed).toBe(false);
        });

        it('should filter out short lines', () => {
            const lines = [
                {
                    text: 'A', // Too short
                    boundingBox: [0, 0, 10, 0, 10, 10, 0, 10],
                },
                {
                    text: 'Valid',
                    boundingBox: [0, 20, 50, 20, 50, 30, 0, 30],
                },
            ];

            const normalized = normalizeOcrLines(lines);

            expect(normalized).toHaveLength(1);
            expect(normalized[0].text).toBe('Valid');
        });

        it('should handle empty lines array', () => {
            const lines = [];

            const normalized = normalizeOcrLines(lines);

            expect(normalized).toHaveLength(0);
        });

        it('should trim whitespace', () => {
            const lines = [
                {
                    text: '  \t  Trimmed  \n  ',
                    boundingBox: [0, 0, 100, 0, 100, 20, 0, 20],
                },
            ];

            const normalized = normalizeOcrLines(lines);

            expect(normalized[0].text).toBe('Trimmed');
        });

        it('should preserve bounding box data', () => {
            const lines = [
                {
                    text: 'Test',
                    boundingBox: [10, 20, 30, 40, 50, 60, 70, 80],
                },
            ];

            const normalized = normalizeOcrLines(lines);

            expect(normalized[0].boundingBox).toEqual([10, 20, 30, 40, 50, 60, 70, 80]);
        });

        it('should calculate correct spatial data for multiple lines', () => {
            const lines = [
                {
                    text: 'First',
                    boundingBox: [0, 0, 100, 0, 100, 20, 0, 20],
                },
                {
                    text: 'Second',
                    boundingBox: [0, 50, 100, 50, 100, 70, 0, 70],
                },
                {
                    text: 'Third',
                    boundingBox: [0, 100, 100, 100, 100, 120, 0, 120],
                },
            ];

            const normalized = normalizeOcrLines(lines);

            expect(normalized[0].midY).toBe(10);
            expect(normalized[1].midY).toBe(60);
            expect(normalized[2].midY).toBe(110);
        });
    });
});
