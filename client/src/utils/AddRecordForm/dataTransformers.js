/**
 * Data transformation utilities for AddRecordForm
 * Pure functions for transforming OCR data into form data and vice versa
 */

/**
 * Derive table headers from OCR table cells
 */
export const deriveHeadersFromTable = (table) => {
  try {
    const grid = [];
    for (let i = 0; i < (table.rowCount || 0); i++) {
      grid[i] = new Array(table.columnCount || 0).fill('');
    }
    
    (table.cells || []).forEach(cell => {
      grid[cell.rowIndex] = grid[cell.rowIndex] || new Array(table.columnCount).fill('');
      grid[cell.rowIndex][cell.columnIndex] = cell.content;
    });

    // Heuristic: prefer the first row that contains alphabetic characters (likely a header row)
    for (let r = 0; r < Math.min(grid.length, 3); r++) {
      const row = grid[r] || [];
      const hasLetters = row.some(c => typeof c === 'string' && /[A-Za-z]/.test(c));
      const hasNumbers = row.every(c => typeof c === 'string' && /^[\d\W\s]*$/.test(c));
      if (hasLetters && !hasNumbers) return row;
    }

    // Fallback to first row or generated column placeholders
    if (grid[0] && grid[0].some(c => c && c.toString().trim() !== '')) {
      return grid[0];
    }
    
    return Array.from({ length: table.columnCount || 0 }).map((_, i) => `Column ${i + 1}`);
  } catch (e) {
    console.error('[deriveHeadersFromTable] Error:', e);
    return [];
  }
};

/**
 * Build table rows from OCR table cells
 */
export const buildRowsFromTable = (table, headers = []) => {
  try {
    const grid = [];
    for (let i = 0; i < table.rowCount; i++) {
      grid[i] = new Array(table.columnCount).fill('');
    }
    
    (table.cells || []).forEach(cell => {
      grid[cell.rowIndex][cell.columnIndex] = cell.content;
    });
    
    const rows = [];
    for (let r = 1; r < grid.length; r++) { // Start at 1 to skip header row
      const rowObj = {};
      for (let c = 0; c < grid[r].length; c++) {
        const header = headers[c] || `col_${c}`;
        rowObj[header] = grid[r][c] || '';
      }
      rows.push(rowObj);
    }
    
    return rows;
  } catch (e) {
    console.error('[buildRowsFromTable] Error:', e);
    return [];
  }
};

/**
 * Normalize header signature for table grouping
 * Prevents accidental collapsing of multi-page docs
 */
export const normalizeHeaderSignature = (headers = []) => {
  try {
    const cleaned = headers.map(h => (h || '').toString().toLowerCase().trim()
      .replace(/\s+/g, ' ')
      .replace(/[\u2018\u2019\u201c\u201d"'`]/g, '')
      .replace(/[^a-z0-9 \-]/g, '')
    );
    
    const allEmpty = cleaned.every(c => 
      !c || c.trim() === '' || /^column\s?\d+/i.test(c)
    );
    
    if (allEmpty) {
      // Use stable placeholder based on column count
      return `__noheaders__::cols:${headers.length}`;
    }
    
    return cleaned.join('||');
  } catch (e) {
    return JSON.stringify(headers || []);
  }
};

/**
 * Guess column mappings from header text
 */
export const guessColumnMappings = (headers = []) => {
  return headers.map(h => {
    const hh = (h || '').toString().toLowerCase();
    
    if (/qty|quantity|qty\b/.test(hh)) return 'quantity';
    if (/price|unit ?price|unitprice/.test(hh)) return 'unitPrice';
    if (/total|amount|line ?total/.test(hh)) return 'total';
    if (/sku|code|item ?no|id\b/.test(hh)) return 'sku';
    if (/description|item|product|service|details/.test(hh)) return 'description';
    
    return 'none';
  });
};

/**
 * Transform form data to record payload for API submission
 */
export const formDataToRecordPayload = (formState, userId) => {
  const {
    recordType,
    businessName,
    businessAddress,
    customerId,
    customerAddress,
    invoiceId,
    invoiceDate,
    transactionId,
    items,
    fees,
    subtotal,
    tax,
    total,
    paymentMethod,
    promotions,
    utilityProvider,
    accountNumber,
    utilityAmountDue,
    utilityDueDate,
    meterReading,
    modelSpecs,
    specQ3,
    specQ3Q1Ratio,
    specPN,
    specClass,
    specMaxTemp,
    specOrientation,
    specMultipliers,
    detectedCustomerName,
    detectedMobileNumber,
    uploaderSellerId,
    uploaderService,
    uploaderReason,
    dynamicFields,
    tables,
    selectedTableIndices,
    existingImagePath,
  } = formState;

  const payload = {
    userId,
    documentType: recordType,
  };

  if (recordType === 'utility') {
    // Utility bill payload
    payload.data = {
      manufacturer: utilityProvider,
      serialNumber: accountNumber,
      mainReading: meterReading,
      modelSpecs: modelSpecs || {
        q3: specQ3,
        q3_q1_ratio: specQ3Q1Ratio,
        pn: specPN,
        class: specClass,
        maxTemp: specMaxTemp,
        orientation: specOrientation,
        multipliers: specMultipliers ? specMultipliers.split(',').map(s => s.trim()) : [],
      },
      dueDate: utilityDueDate,
      amountDue: utilityAmountDue,
    };
  } else {
    // Receipt/invoice payload
    payload.data = {
      businessName,
      businessAddress,
      invoiceNo: invoiceId,
      invoiceDate,
      transactionId,
      items: items.map(item => ({
        description: item.description,
        quantity: Number(item.quantity || 1),
        unitPrice: Number(item.unitPrice || 0),
        totalPrice: Number(item.totalPrice || item.amount || 0),
        sku: item.sku || '',
      })),
      fees: fees.map(fee => ({
        description: fee.description || fee.name,
        amount: Number(fee.amount || fee.totalPrice || 0),
      })),
      subtotal: Number(subtotal || 0),
      tax: Number(tax || 0),
      total: Number(total || 0),
      paymentMethod,
      promotions,
      customerName: detectedCustomerName,
      customerPhone: detectedMobileNumber,
      deliveryDetails: {
        Apartment: customerAddress?.apartment || '',
        'Delivery Area': customerAddress?.county || '',
      },
    };
  }

  // Add customer reference if selected
  if (customerId) payload.customerId = customerId;

  // Add uploader-provided fields for customer uploads
  if (uploaderSellerId) payload.sellerId = uploaderSellerId;
  if (uploaderService) payload.service = uploaderService;
  if (uploaderReason) payload.reason = uploaderReason;

  // Add dynamic fields for structured documents
  if (dynamicFields && dynamicFields.length > 0) {
    payload.data.keyValuePairs = dynamicFields;
  }

  // Add selected tables
  if (tables && tables.length > 0 && selectedTableIndices.size > 0) {
    payload.data.tables = tables
      .filter((_, idx) => selectedTableIndices.has(idx))
      .map(t => ({
        name: t.name,
        headers: t.headers,
        rows: t.rows,
      }));
  }

  // Add existing image path if available
  if (existingImagePath) {
    payload.existingImagePath = existingImagePath;
  }

  return payload;
};

/**
 * Validate record form data
 */
export const validateRecordForm = (formState) => {
  const errors = [];
  const { recordType, businessName, items, utilityProvider, accountNumber, image, existingImagePath } = formState;

  // Image validation
  if (!image && !existingImagePath) {
    errors.push('Image is required');
  }

  if (recordType === 'utility') {
    // Utility bill validation
    if (!utilityProvider || utilityProvider.trim() === '') {
      errors.push('Utility provider is required');
    }
    if (!accountNumber || accountNumber.trim() === '') {
      errors.push('Account number is required');
    }
  } else {
    // Receipt/invoice validation
    if (!businessName || businessName.trim() === '') {
      errors.push('Business name is required');
    }
    if (!items || items.length === 0) {
      errors.push('At least one item is required');
    }
  }

  return errors;
};
