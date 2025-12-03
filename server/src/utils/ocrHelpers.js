/**
 * OCR Spatial Helper Functions
 * Utility functions for analyzing bounding boxes and text positioning
 */

/**
 * Calculate the center X coordinate of a bounding box
 * @param {Array} box - Array of 8 coordinates [x1,y1,x2,y2,x3,y3,x4,y4]
 * @returns {number} Center X coordinate
 */
const getCenterX = (box) => (box[0] + box[2] + box[4] + box[6]) / 4;

/**
 * Calculate the middle Y coordinate of a bounding box
 * @param {Array} box - Array of 8 coordinates [x1,y1,x2,y2,x3,y3,x4,y4]
 * @returns {number} Middle Y coordinate
 */
const getMidY = (box) => (box[1] + box[7]) / 2;

/**
 * Check if text is purely numerical
 * @param {string} text - Text to check
 * @returns {boolean} True if text is only digits and dots
 */
const isNumerical = (text) => /^[\d\.]+$/.test(text);

/**
 * Check if text matches barcode pattern
 * @param {string} text - Text to check
 * @returns {boolean} True if text looks like a barcode (8-14 digits)
 */
const isBarcode = (text) => /^\d{8,14}$/.test(text);

/**
 * Calculate distance between two points
 * @param {Object} point1 - First point {x, y}
 * @param {Object} point2 - Second point {x, y}
 * @returns {number} Euclidean distance
 */
const calculateDistance = (point1, point2) => {
  const dx = point1.x - point2.x;
  const dy = point1.y - point2.y;
  return Math.sqrt(dx * dx + dy * dy);
};

/**
 * Check if two bounding boxes overlap
 * @param {Array} box1 - First bounding box
 * @param {Array} box2 - Second bounding box
 * @returns {boolean} True if boxes overlap
 */
const boxesOverlap = (box1, box2) => {
  const x1Min = Math.min(box1[0], box1[2], box1[4], box1[6]);
  const x1Max = Math.max(box1[0], box1[2], box1[4], box1[6]);
  const y1Min = Math.min(box1[1], box1[3], box1[5], box1[7]);
  const y1Max = Math.max(box1[1], box1[3], box1[5], box1[7]);
  
  const x2Min = Math.min(box2[0], box2[2], box2[4], box2[6]);
  const x2Max = Math.max(box2[0], box2[2], box2[4], box2[6]);
  const y2Min = Math.min(box2[1], box2[3], box2[5], box2[7]);
  const y2Max = Math.max(box2[1], box2[3], box2[5], box2[7]);
  
  return !(x1Max < x2Min || x2Max < x1Min || y1Max < y2Min || y2Max < y1Min);
};

/**
 * Normalize OCR line data with spatial information
 * @param {Array} lines - OCR lines from results
 * @returns {Array} Normalized lines with spatial data
 */
const normalizeOcrLines = (lines) => {
  return lines
    .map(line => {
      const normalizedText = line.text.trim();
      return {
        text: normalizedText,
        upperText: normalizedText.toUpperCase(),
        midY: getMidY(line.boundingBox),
        centerX: getCenterX(line.boundingBox),
        boundingBox: line.boundingBox,
        isUsed: false,
      };
    })
    .filter(line => line.text.length >= 2);
};

module.exports = {
  getCenterX,
  getMidY,
  isNumerical,
  isBarcode,
  calculateDistance,
  boxesOverlap,
  normalizeOcrLines
};
