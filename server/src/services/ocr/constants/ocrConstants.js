/**
 * OCR Parsing Constants
 * Centralized constants for OCR document parsing
 */

// Keywords to ignore during item extraction (noise/headers)
const IGNORE_KEYWORDS = [
  'Shift', 'Ente', 'Delete', 'Num', 'Lock', 'Home', 'PgUp', 'PgDn', 
  'Customer', 'Delivery', 'Total', 'Item Qty', 'No.'
];

// Keywords indicating fees/charges
const FEE_KEYWORDS = ['charges', 'Fee', 'Charge', 'Service'];

// Common address and metadata noise
const ADDRESS_NOISE = [
  'AK', '75', '95', '800-22/1322', '404020002859089', 
  'Order Date', 'Date', 'No.', 'In Carrefour', 'Printed On', 
  'be', '3 25', 'PROMO', 'Discount', 'Payment', 'Method'
];

// Document type detection patterns
const DOCUMENT_TYPE_PATTERNS = {
  UTILITY: {
    keywords: ['meter', 'reading', 'consumption', 'kwh', 'units', 'utility'],
    confidence: 0.7
  },
  RECEIPT: {
    keywords: ['receipt', 'total', 'tax', 'subtotal', 'payment', 'change'],
    confidence: 0.6
  },
  INVOICE: {
    keywords: ['invoice', 'bill', 'amount due', 'due date', 'invoice number'],
    confidence: 0.7
  },
  CUSTOMER: {
    keywords: ['customer', 'account', 'name', 'address', 'phone'],
    confidence: 0.5
  }
};

// Spatial search thresholds
const SPATIAL_THRESHOLDS = {
  MAX_VERTICAL_SEARCH: 350,
  MAX_HORIZONTAL_SEARCH: 250,
  LENGTH_WEIGHT_FACTOR: 50,
  ABOVE_UNIT_BONUS: 20
};

module.exports = {
  IGNORE_KEYWORDS,
  FEE_KEYWORDS,
  ADDRESS_NOISE,
  DOCUMENT_TYPE_PATTERNS,
  SPATIAL_THRESHOLDS
};
