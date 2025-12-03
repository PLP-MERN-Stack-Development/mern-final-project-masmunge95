/**
 * OCR Generic Document Parser
 * Parses generic documents (customer records, inventory lists, tables)
 * Extracted from ocrController.js for better testability
 */

const { getCenterX, getMidY } = require('../../../utils/ocrHelpers');

/**
 * Parse generic document using Document Intelligence layout
 * Extracts tables and key-value pairs automatically
 * @param {Object} results - OCR analysis results from Azure Document Intelligence
 * @returns {Object} Extracted document data
 */
const parseGenericDocument = (results) => {
  const extractedData = {
    tables: [],
    keyValuePairs: [],
    rawText: ''
  };

  // Handle Document Intelligence layout results
  if (results.tables) {
    extractedData.tables = results.tables.map(table => ({
      rowCount: table.rowCount,
      columnCount: table.columnCount,
      cells: table.cells.map(cell => ({
        content: cell.content,
        rowIndex: cell.rowIndex,
        columnIndex: cell.columnIndex
      }))
    }));
  }

  // Extract key-value pairs (useful for forms, customer records)
  if (results.keyValuePairs) {
    extractedData.keyValuePairs = results.keyValuePairs
      .filter(pair => pair.key && pair.value)
      .map(pair => ({
        key: pair.key.content,
        value: pair.value.content
      }));
  }

  // Get raw text content
  if (results.content) {
    extractedData.rawText = results.content;
  }

  // Extract basic customer name heuristics from raw text when present
  try {
    if (extractedData.rawText && typeof extractedData.rawText === 'string') {
      const rt = extractedData.rawText;
      // Common patterns: 'Customer Name:\nNAME', 'Customer Name: NAME', 'Customer:\nNAME'
      const nameMatch = rt.match(/Customer\s*Name\s*[:\-]?\s*\n?\s*([A-Z][A-Za-z\s\.-]{2,60})/i)
        || rt.match(/Customer\s*[:\-]?\s*\n?\s*([A-Z][A-Za-z\s\.-]{2,60})/i)
        || rt.match(/Name\s*[:\-]\s*([A-Z][A-Za-z\s\.-]{2,60})/i);

      if (nameMatch && nameMatch[1]) {
        let name = nameMatch[1].toString().trim();

        // If OCR accidentally concatenated labels like 'Mobile' or phone digits into the name, split them out
        const mobileLabelIdx = name.search(/mobile|phone|tel/i);
        if (mobileLabelIdx !== -1) {
          const left = name.substring(0, mobileLabelIdx).trim();
          const right = name.substring(mobileLabelIdx);
          name = left || name; // prefer cleaned left side
          const numMatch = right.match(/(\+?\d[\d\-\s\(\)]{6,}\d)/);
          if (numMatch && numMatch[1]) {
            extractedData.mobileNumber = numMatch[1].replace(/\s+/g, '');
          }
        }

        extractedData.customerName = name;
      }

      // If we still don't have a mobile number, look for explicit Mobile/Phone labels or general phone-like sequences
      if (!extractedData.mobileNumber) {
        const mobileLabelMatch = rt.match(/Mobile\s*(?:Number)?\s*[:\-]?\s*(\+?\d[\d\-\s\(\)]{6,}\d)/i);
        if (mobileLabelMatch && mobileLabelMatch[1]) {
          extractedData.mobileNumber = mobileLabelMatch[1].replace(/\s+/g, '');
        } else {
          // Fallback: pick the first phone-like sequence (7+ digits ignoring separators)
          const phones = rt.match(/(\+?\d[\d\-\s\(\)]{6,}\d)/g);
          if (phones && phones.length > 0) {
            extractedData.mobileNumber = phones[0].replace(/\s+/g, '');
          }
        }
      }
    }
  } catch (e) {
    // best-effort; don't fail parsing
    console.warn('[OCR Debug] customerName extraction failed', e);
  }

  // Extract statement dates and periods from raw text when present
  try {
    const rt = extractedData.rawText || '';
    if (rt && typeof rt === 'string') {
      // Helper to convert day/month/year numeric triples into ISO date string
      const makeIso = (dStr, mStr, yStr) => {
        const day = parseInt(dStr.replace(/[^0-9]/g, ''), 10);
        const month = parseInt(mStr.replace(/[^0-9]/g, ''), 10);
        const year = parseInt(yStr.replace(/[^0-9]/g, ''), 10);
        if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
          const mm = String(month).padStart(2, '0');
          const dd = String(day).padStart(2, '0');
          return `${year}-${mm}-${dd}`;
        }
        return null;
      };

      // Find date triples like '31st 8 2025' possibly separated by newlines
      const tripleRegex = /(\d{1,2})(?:st|nd|rd|th)?[\s\n,\/\-]+(\d{1,2})[\s\n,\/\-]+(\d{4})/g;

      // Try 'Date of Statement' label first
      const dosMatch = rt.match(/Date\s*of\s*Statement\s*[:\-]?\s*([\s\S]{0,60})/i);
      if (dosMatch && dosMatch[1]) {
        const sub = dosMatch[1];
        const m = tripleRegex.exec(sub);
        if (m) {
          const iso = makeIso(m[1], m[2], m[3]);
          if (iso) extractedData.statementDate = iso;
        }
        tripleRegex.lastIndex = 0;
      }

      // Try 'Statement Period' label -> expect two date triples separated by a dash
      const spMatch = rt.match(/Statement\s*Period\s*[:\-]?\s*([\s\S]{0,200})/i);
      if (spMatch && spMatch[1]) {
        const sub = spMatch[1];
        const dates = [];
        let m2;
        while ((m2 = tripleRegex.exec(sub)) !== null && dates.length < 2) {
          const iso = makeIso(m2[1], m2[2], m2[3]);
          if (iso) dates.push(iso);
        }
        tripleRegex.lastIndex = 0;
        if (dates.length === 2) {
          extractedData.statementPeriod = { startDate: dates[0], endDate: dates[1] };
        }
      }

      // Fallback: if no labeled period found, try to grab first two date triples in document
      if (!extractedData.statementDate || !extractedData.statementPeriod) {
        const allDates = [];
        let m3;
        while ((m3 = tripleRegex.exec(rt)) !== null && allDates.length < 3) {
          const iso = makeIso(m3[1], m3[2], m3[3]);
          if (iso) allDates.push(iso);
        }
        tripleRegex.lastIndex = 0;
        if (!extractedData.statementDate && allDates.length > 0) extractedData.statementDate = allDates[0];
        if (!extractedData.statementPeriod && allDates.length >= 2) extractedData.statementPeriod = { startDate: allDates[0], endDate: allDates[1] };
      }
    }
  } catch (e) {
    console.warn('[OCR Debug] statement date extraction failed', e);
  }

  return extractedData;
};

/**
 * Parse utility customer consumption records (tables with customer names and monthly readings)
 * Works for both handwritten records (images) and Excel sheets
 * @param {Object|Array} results - OCR analysis results
 * @returns {Object} Extracted customer consumption data
 */
const parseUtilityCustomerRecords = (results) => {
  const extractedData = {
    customers: [],
    headers: [],
    rawTable: null
  };

  // Handle Document Intelligence layout results (Excel/PDF tables)
  if (results.tables && results.tables.length > 0) {
    const table = results.tables[0]; // Use first table
    extractedData.rawTable = table;

    // Build a grid from cells
    const grid = [];
    for (let i = 0; i < table.rowCount; i++) {
      grid[i] = new Array(table.columnCount).fill('');
    }

    table.cells.forEach(cell => {
      grid[cell.rowIndex][cell.columnIndex] = cell.content;
    });

    // First row is typically headers (Customer Name, Jan, Feb, Mar, etc.)
    if (grid.length > 0) {
      extractedData.headers = grid[0];
    }

    // Subsequent rows are customer data
    for (let i = 1; i < grid.length; i++) {
      const row = grid[i];
      if (row[0] && row[0].trim()) { // First cell should have customer name
        const customer = {
          name: row[0].trim(),
          readings: {}
        };

        // Map remaining columns to readings (assuming headers are months)
        for (let j = 1; j < row.length && j < extractedData.headers.length; j++) {
          const header = extractedData.headers[j];
          const value = row[j];
          if (header && value) {
            // Try to parse as number (consumption value)
            const numValue = parseFloat(value.replace(/[^\d.-]/g, ''));
            customer.readings[header] = isNaN(numValue) ? value : numValue;
          }
        }

        extractedData.customers.push(customer);
      }
    }
  }
  // Handle Computer Vision results (handwritten images)
  else if (results && Array.isArray(results) && results.length > 0) {
    // For handwritten tables, OCR returns lines of text
    // We need to detect table structure from spatial positioning
    const allLines = results.flatMap(page => page.lines || [])
      .map(line => ({
        text: line.text.trim(),
        midY: getMidY(line.boundingBox),
        centerX: getCenterX(line.boundingBox),
        boundingBox: line.boundingBox
      }))
      .sort((a, b) => a.midY - b.midY); // Sort by vertical position

    if (allLines.length > 0) {
      // Group lines by similar Y position (same row)
      const rows = [];
      let currentRow = [allLines[0]];
      const rowThreshold = 50; // pixels

      for (let i = 1; i < allLines.length; i++) {
        const line = allLines[i];
        const prevLine = allLines[i - 1];
        
        if (Math.abs(line.midY - prevLine.midY) < rowThreshold) {
          currentRow.push(line);
        } else {
          // Sort current row by X position (left to right)
          currentRow.sort((a, b) => a.centerX - b.centerX);
          rows.push(currentRow.map(l => l.text));
          currentRow = [line];
        }
      }
      // Add last row
      if (currentRow.length > 0) {
        currentRow.sort((a, b) => a.centerX - b.centerX);
        rows.push(currentRow.map(l => l.text));
      }

      // First row as headers
      if (rows.length > 0) {
        extractedData.headers = rows[0];
      }

      // Parse customer data rows
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.length > 0 && row[0]) {
          const customer = {
            name: row[0],
            readings: {}
          };

          for (let j = 1; j < row.length && j < extractedData.headers.length; j++) {
            const header = extractedData.headers[j];
            const value = row[j];
            if (header && value) {
              const numValue = parseFloat(value.replace(/[^\d.-]/g, ''));
              customer.readings[header] = isNaN(numValue) ? value : numValue;
            }
          }

          extractedData.customers.push(customer);
        }
      }
    }
  }

  return extractedData;
};

module.exports = { parseGenericDocument, parseUtilityCustomerRecords };
