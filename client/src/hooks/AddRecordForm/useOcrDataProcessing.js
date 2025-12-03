import { useEffect } from 'react';
import { deriveHeadersFromTable, buildRowsFromTable } from '../../utils/AddRecordForm/dataTransformers';

/**
 * Custom hook to process OCR data and populate form state
 * Handles complex data transformation from various OCR sources
 */
export const useOcrDataProcessing = (initialData, formState) => {
  useEffect(() => {
    if (!initialData.data) return;

    const {
      setRecordType,
      setExistingImagePath,
      setUploaderSellerId,
      setUploaderService,
      setUploaderReason,
      setInvoiceId,
      setTransactionId,
      setTotal,
      setItems,
      setFees,
      setPromotionsParsed,
      setPromotions,
      setSubtotal,
      setTax,
      setPaymentMethod,
      setBusinessName,
      setBusinessAddress,
      setOriginalOcrData,
      setUtilityProvider,
      setAccountNumber,
      setModelSpecs,
      setMeterReading,
      setSpecQ3,
      setSpecQ3Q1Ratio,
      setSpecPN,
      setSpecClass,
      setSpecMaxTemp,
      setSpecOrientation,
      setSpecMultipliers,
      setUtilityDueDate,
      setInvoiceDate,
      setCustomerAddress,
      setDynamicFields,
      setTables,
      setSelectedTableIndices,
      setDetectedCustomerName,
      setDetectedMobileNumber,
      setCustomerId,
    } = formState;

    try {
      console.debug('[useOcrDataProcessing] Processing initialData with keys:', Object.keys(initialData || {}));

      // Extract existing image path from OCR upload
      const imgPath = initialData.filePath || initialData.imagePath || 
        (initialData.data && (initialData.data.filePath || initialData.data.imagePath));
      if (imgPath) {
        setExistingImagePath(imgPath);
        console.debug('[useOcrDataProcessing] Using existing image path:', imgPath);
      }

      // Extract uploader-provided fields (seller/service/reason)
      if (initialData.localDraft) {
        if (initialData.localDraft.sellerId) setUploaderSellerId(initialData.localDraft.sellerId);
        if (initialData.localDraft.service) setUploaderService(initialData.localDraft.service);
        if (initialData.localDraft.reason) setUploaderReason(initialData.localDraft.reason);
      }

      // Get server-parsed normalized fields
      const serverParsed = initialData.parsed ||
        (initialData.data && (
          initialData.data.parsed ||
          (initialData.data.metadata && (initialData.data.metadata.parsedFields || initialData.data.metadata.parsed))
        )) || null;

      let serverPrefTotal = null;
      if (serverParsed) {
        if (serverParsed.invoiceId) setInvoiceId(serverParsed.invoiceId);
        if (serverParsed.transactionId) setTransactionId(serverParsed.transactionId || '');
        
        // Prefer promo-adjusted total when available
        serverPrefTotal = serverParsed.totalAfterPromotions ?? serverParsed.total ?? 
          serverParsed.computedTotal ?? serverParsed.subtotal;
        if (serverPrefTotal !== undefined && serverPrefTotal !== null) {
          const t = parseFloat(serverPrefTotal);
          if (!isNaN(t)) setTotal(t.toFixed(2));
        }

        // Prefill items/fees/promotions from server
        if (Array.isArray(serverParsed.items) && serverParsed.items.length > 0) {
          setItems(serverParsed.items);
        }
        if (Array.isArray(serverParsed.fees) && serverParsed.fees.length > 0) {
          setFees(serverParsed.fees);
        }
        if (Array.isArray(serverParsed.promotions) && serverParsed.promotions.length > 0) {
          setPromotionsParsed(serverParsed.promotions);
          setPromotions(serverParsed.promotions.map(p => 
            `${p.description || ''}: ${Number(p.amount || p.total || 0)}`).join('; '));
        }
        if (serverParsed.subtotal !== undefined && serverParsed.subtotal !== null) {
          setSubtotal(Number(serverParsed.subtotal).toFixed(2));
        }
        if (serverParsed.tax !== undefined && serverParsed.tax !== null) {
          setTax(Number(serverParsed.tax).toFixed(2));
        }
        if (serverParsed.paymentMethod) setPaymentMethod(serverParsed.paymentMethod);
        if (serverParsed.businessName) setBusinessName(serverParsed.businessName);
        if (serverParsed.businessAddress) setBusinessAddress(serverParsed.businessAddress);
      }

      const ocrData = initialData.data;
      const docType = initialData.documentType || 'receipt';
      setRecordType(docType);

      if (docType === 'utility') {
        processUtilityMeterData(ocrData, {
          setOriginalOcrData,
          setUtilityProvider,
          setAccountNumber,
          setModelSpecs,
          setMeterReading,
          setSpecQ3,
          setSpecQ3Q1Ratio,
          setSpecPN,
          setSpecClass,
          setSpecMaxTemp,
          setSpecOrientation,
          setSpecMultipliers,
          setUtilityDueDate,
        });
      } else {
        processReceiptInvoiceData(ocrData, initialData, serverParsed, serverPrefTotal, {
          setBusinessName,
          setBusinessAddress,
          setInvoiceId,
          setTransactionId,
          setTotal,
          setInvoiceDate,
          setDetectedCustomerName,
          setPaymentMethod,
          setPromotionsParsed,
          setPromotions,
          setItems,
          setFees,
          setTax,
          setSubtotal,
        });
      }

      // Map deliveryDetails to customerAddress
      setCustomerAddress({
        apartment: ocrData.deliveryDetails?.Apartment || '',
        county: ocrData.deliveryDetails?.['Delivery Area'] || ''
      });

      // Handle generic structured documents: keyValuePairs and tables
      if (ocrData.keyValuePairs && Array.isArray(ocrData.keyValuePairs)) {
        const kv = ocrData.keyValuePairs.map(k => ({ 
          key: k.key || k.name || '', 
          value: k.value || '' 
        }));
        setDynamicFields(kv);
      }

      if (ocrData.tables && Array.isArray(ocrData.tables) && ocrData.tables.length > 0) {
        const parsed = ocrData.tables.map(table => {
          const headers = table.headers || (table.rowCount && table.cells ? deriveHeadersFromTable(table) : []);
          const rows = buildRowsFromTable(table, headers);
          const name = table.name || table.title || table.titleText || table.tableTitle || table.caption || null;
          return { headers, rows, name };
        });
        setTables(parsed);
        
        // Default-select all tables
        const allIdx = new Set(parsed.map((_, i) => i));
        setSelectedTableIndices(allIdx);
      }

      // Prefill customer name/phone
      const prefCustomerName = (serverParsed && (serverParsed.customerName || serverParsed.customer)) ||
        ocrData.customerName || initialData.customerName ||
        (initialData.data && (initialData.data.customerName || initialData.data.customer)) ||
        (initialData.parsed && initialData.parsed.customerName) || '';
      if (prefCustomerName) setDetectedCustomerName(prefCustomerName);

      const prefMobile = (serverParsed && (serverParsed.customerPhone || serverParsed.mobileNumber)) ||
        ocrData.customerPhone || ocrData.mobileNumber || initialData.customerPhone ||
        (initialData.data && (initialData.data.customerPhone || initialData.data.mobileNumber)) || '';
      if (prefMobile) setDetectedMobileNumber(prefMobile);

      // Prefill customerId if available
      if (initialData.customerId) setCustomerId(initialData.customerId);
      if (ocrData.customerId) setCustomerId(ocrData.customerId);

    } catch (err) {
      console.error('[useOcrDataProcessing] Error processing OCR data:', err);
    }
  }, [initialData]); // Only run when initialData changes
};

// Helper: Process utility meter data
function processUtilityMeterData(ocrData, setters) {
  const {
    setOriginalOcrData,
    setUtilityProvider,
    setAccountNumber,
    setModelSpecs,
    setMeterReading,
    setSpecQ3,
    setSpecQ3Q1Ratio,
    setSpecPN,
    setSpecClass,
    setSpecMaxTemp,
    setSpecOrientation,
    setSpecMultipliers,
    setUtilityDueDate,
  } = setters;

  setOriginalOcrData(ocrData);
  setUtilityProvider(ocrData.manufacturer || '');
  setAccountNumber(ocrData.serialNumber || '');
  setModelSpecs(ocrData.modelSpecs || null);
  setMeterReading(ocrData.mainReading || '');

  // Initialize individual model spec fields
  if (ocrData.modelSpecs) {
    setSpecQ3(ocrData.modelSpecs.q3 || '');
    setSpecQ3Q1Ratio(ocrData.modelSpecs.q3_q1_ratio || '');
    setSpecPN(ocrData.modelSpecs.pn || '');
    setSpecClass(ocrData.modelSpecs.class || '');
    setSpecMaxTemp(ocrData.modelSpecs.maxTemp || '');
    setSpecOrientation(ocrData.modelSpecs.orientation || '');
    setSpecMultipliers(Array.isArray(ocrData.modelSpecs.multipliers) ? 
      ocrData.modelSpecs.multipliers.join(', ') : '');
  }

  // Set default date for meter readings
  if (!ocrData.dueDate) {
    const date = new Date();
    if (!isNaN(date.getTime())) {
      setUtilityDueDate(date.toISOString().split('T')[0]);
    }
  }
}

// Helper: Process receipt/invoice data
function processReceiptInvoiceData(ocrData, initialData, serverParsed, serverPrefTotal, setters) {
  const {
    setBusinessName,
    setBusinessAddress,
    setInvoiceId,
    setTransactionId,
    setTotal,
    setInvoiceDate,
    setDetectedCustomerName,
    setPaymentMethod,
    setPromotionsParsed,
    setPromotions,
    setItems,
    setFees,
    setTax,
    setSubtotal,
  } = setters;

  setBusinessName(ocrData.businessName || '');
  setBusinessAddress(ocrData.businessAddress || '');

  // Extract structured driver fields (Document Intelligence)
  let driverInvoiceId = ocrData.invoiceNo || '';
  let driverTransactionId = '';

  if (initialData?.data?.metadata?.rawDriverResponse) {
    extractDriverFields(initialData.data.metadata.rawDriverResponse, {
      driverInvoiceId,
      driverTransactionId,
      setInvoiceId,
      setTransactionId,
      setTotal,
      setInvoiceDate,
      setDetectedCustomerName,
      setBusinessName,
      setBusinessAddress,
    });
  }

  setInvoiceId(driverInvoiceId || '');
  setTransactionId(driverTransactionId || '');
  setPaymentMethod(ocrData.paymentMethod || '');

  // Handle promotions
  if (!serverParsed || !(Array.isArray(serverParsed.promotions) && serverParsed.promotions.length > 0)) {
    if (Array.isArray(ocrData.promotions) && ocrData.promotions.length > 0) {
      setPromotionsParsed(ocrData.promotions);
      setPromotions(ocrData.promotions.map(p => 
        `${p.description || ''}: ${Number(p.amount || p.total || 0)}`).join('; '));
    } else {
      setPromotions(ocrData.promotions || '');
    }
  }

  // Handle invoice date
  if (ocrData.invoiceDate) {
    const date = new Date(ocrData.invoiceDate);
    if (!isNaN(date.getTime())) {
      setInvoiceDate(date.toISOString().split('T')[0]);
    }
  }

  // Process items and fees
  const { initialItems, initialFees, initialTax } = extractItemsFeesAndTax(
    initialData, serverParsed, ocrData, setPaymentMethod
  );

  // Compute financial totals
  computeTotals(initialItems, initialFees, initialTax, serverParsed, serverPrefTotal, ocrData, {
    setItems,
    setFees,
    setTax,
    setSubtotal,
    setTotal,
  });
}

// Helper: Extract Document Intelligence fields
function extractDriverFields(rawDriverResponse, context) {
  try {
    for (const doc of rawDriverResponse) {
      const fields = doc.fields || doc;
      if (!fields || typeof fields !== 'object') continue;

      // Extract invoice/transaction IDs
      if (!context.driverInvoiceId) {
        const inv = fields.InvoiceId || fields.InvoiceNo || fields.InvoiceNumber || 
          fields.Invoice || fields.invoiceId || fields.invoiceNo;
        if (inv && (inv.content || inv.value)) {
          context.driverInvoiceId = inv.content || 
            (inv.value && (typeof inv.value === 'string' ? inv.value : JSON.stringify(inv.value)));
        }
      }

      if (!context.driverTransactionId) {
        const tx = fields.TransactionId || fields.TransactionNo || fields.TransactionNumber || 
          fields.Transaction || fields.transactionId;
        if (tx && (tx.content || tx.value)) {
          context.driverTransactionId = tx.content || 
            (tx.value && (typeof tx.value === 'string' ? tx.value : JSON.stringify(tx.value)));
        }
      }

      // Extract totals
      const totalField = fields.InvoiceTotal || fields.Total || fields.Amount || 
        fields.AmountDue || fields.GrandTotal;
      if (totalField && totalField.value && typeof totalField.value.amount === 'number') {
        const t = parseFloat(totalField.value.amount);
        if (!isNaN(t)) context.setTotal(t.toFixed(2));
      } else if (totalField && totalField.content) {
        const m = ('' + totalField.content).match(/\d{1,3}(?:[\d,]*)(?:\.\d{1,2})?/);
        if (m) context.setTotal(parseFloat(m[0].replace(/,/g, '')).toFixed(2));
      }

      // Extract other fields using helper
      extractOtherFields(fields, context);
    }
  } catch (e) {
    console.debug('[extractDriverFields] Error:', e);
  }
}

// Helper: Extract additional fields from Document Intelligence
function extractOtherFields(fields, context) {
  const extractFieldValue = (f) => {
    if (!f) return null;
    if (f.content) return f.content;
    if (f.value && typeof f.value === 'string') return f.value;
    if (f.value && typeof f.value === 'object') {
      if (f.value.date) return f.value.date;
      if (typeof f.value.amount === 'number') return String(f.value.amount);
      try { return JSON.stringify(f.value); } catch { return null; }
    }
    return null;
  };

  for (const [fldName, fldObj] of Object.entries(fields)) {
    const key = (fldName || '').toString().toLowerCase();
    const val = extractFieldValue(fldObj);
    if (!val) continue;

    // Invoice/document date
    if (/invoicedate|documentdate|date|issuedate/.test(key)) {
      try {
        const d = new Date(val);
        if (!isNaN(d.getTime())) {
          context.setInvoiceDate(d.toISOString().split('T')[0]);
        }
      } catch {}
    }

    // Customer name
    if (/customername|customer|billto|shipto|recipientname/.test(key)) {
      context.setDetectedCustomerName(val);
    }

    // Business name
    if (/merchant|vendor|seller|supplier|businessname|company|store|tradingname/.test(key)) {
      context.setBusinessName(val);
    }

    // Addresses
    if (/billingaddress|merchantaddress|vendoraddress|businessaddress|companyaddress|address/.test(key)) {
      if (/merchant|vendor|billing|business|company/.test(key)) {
        context.setBusinessAddress(val);
      }
    }
  }
}

// Helper: Extract and normalize items, fees, and tax
function extractItemsFeesAndTax(initialData, serverParsed, ocrData, setPaymentMethod) {
  // Get initial items from server or OCR
  let initialItems = [];
  if (initialData.parsed?.items?.length > 0) {
    initialItems = initialData.parsed.items.map(it => ({ 
      ...it, 
      totalPrice: it.totalPrice ?? it.amount ?? it.unitPrice ?? 0 
    }));
  } else if (serverParsed?.items?.length > 0) {
    initialItems = serverParsed.items.map(it => ({ 
      ...it, 
      totalPrice: it.totalPrice ?? it.amount ?? it.unitPrice ?? 0 
    }));
  } else if (ocrData.items?.length > 0) {
    initialItems = ocrData.items.map(it => ({ 
      ...it, 
      totalPrice: it.totalPrice ?? it.amount ?? it.unitPrice ?? 0 
    }));
  }

  let initialFees = (serverParsed?.fees?.length > 0) ? 
    serverParsed.fees.slice() : (ocrData.fees || []);

  const initialTax = (serverParsed && serverParsed.tax !== undefined && serverParsed.tax !== null) ?
    serverParsed.tax : (ocrData.tax || 0);

  // Merge barcode-only rows with descriptive rows
  initialItems = mergeBarcodeItems(initialItems);

  // Remove payment-method-like fees
  initialFees = extractPaymentMethodFees(initialFees, setPaymentMethod);

  // Remove barcode items matching fee amounts
  initialItems = removeFeeBarcodeItems(initialItems, initialFees);

  // Normalize item structure
  initialItems = normalizeItems(initialItems);

  return { initialItems, initialFees, initialTax };
}

// Helper: Merge barcode-only rows with product descriptions
function mergeBarcodeItems(items) {
  const merged = [];
  for (let i = 0; i < items.length; i++) {
    const cur = { ...items[i] };
    const next = items[i + 1];
    const desc = (cur.description || '').toString().trim();
    const isBarcodeLike = /^\d{8,}$/.test(desc.replace(/\s+/g, ''));
    
    if (isBarcodeLike && next) {
      const nextDesc = (next.description || '').toString().trim();
      const nextHasText = /[A-Za-z]/.test(nextDesc);
      
      if (nextHasText) {
        const quantity = cur.quantity ?? next.quantity ?? 1;
        const amount = next.amount ?? next.totalPrice ?? null;
        const unitPrice = (amount !== null && quantity) ? 
          (parseFloat(amount) / parseFloat(quantity || 1)) : null;
        
        merged.push({
          description: nextDesc,
          quantity: Number(quantity) || 1,
          unitPrice: unitPrice !== null ? Number(unitPrice) : null,
          totalPrice: amount !== null ? Number(amount) : null,
          amount: amount !== null ? Number(amount) : null,
        });
        i++; // Skip next since merged
        continue;
      }
    }
    
    merged.push({
      description: cur.description || '',
      quantity: cur.quantity ?? 1,
      unitPrice: cur.unitPrice ?? cur.amount ?? cur.totalPrice ?? 0,
      totalPrice: cur.totalPrice ?? cur.amount ?? 
        (cur.quantity && cur.unitPrice ? cur.quantity * cur.unitPrice : 0),
      amount: cur.amount ?? cur.totalPrice ?? 0,
    });
  }
  return merged;
}

// Helper: Extract payment method from fees
function extractPaymentMethodFees(fees, setPaymentMethod) {
  const paymentTokens = ['mpesa', 'm-pesa', 'on delivery', 'on-delivery', 'cash', 'card', 
    'visa', 'mastercard', 'mobile money', 'mobilemoney', 'paypal'];
  
  return fees.filter(f => {
    const d = (f.description || f.description === 0) ? ('' + f.description).toLowerCase() : '';
    const matched = paymentTokens.some(tok => d.includes(tok));
    
    if (matched) {
      setPaymentMethod((f.description || f.name || '').toString());
      return false; // Don't include as fee
    }
    return true;
  });
}

// Helper: Remove barcode items that match fee amounts
function removeFeeBarcodeItems(items, fees) {
  const feeAmounts = fees.map(f => Number(f.amount ?? f.totalPrice ?? 0))
    .filter(n => !isNaN(n) && n > 0);
  
  if (feeAmounts.length === 0) return items;

  return items.filter(it => {
    const desc = (it.description || '').toString().trim();
    const isBarcodeLike = /^\d{8,}$/.test(desc.replace(/\s+/g, ''));
    const amt = Number(it.totalPrice ?? it.amount ?? 0);
    
    if (isBarcodeLike && !isNaN(amt) && amt > 0) {
      const matches = feeAmounts.some(fa => Math.abs(fa - amt) < 0.01);
      if (matches) return false;
    }
    return true;
  });
}

// Helper: Normalize item structure
function normalizeItems(items) {
  return items.map(it => ({
    description: it.description || it.name || it.item || '',
    quantity: Number(it.quantity ?? it.qty ?? 1) || 1,
    unitPrice: Number(it.unitPrice ?? it.amount ?? it.price ?? 0) || 0,
    totalPrice: Number(it.totalPrice ?? it.amount ?? 
      (it.unitPrice && it.quantity ? it.unitPrice * it.quantity : 0)) || 0,
    sku: it.sku || it.code || '',
    amount: it.amount ?? it.totalPrice ?? 0,
  }));
}

// Helper: Compute and set financial totals
function computeTotals(items, fees, tax, serverParsed, serverPrefTotal, ocrData, setters) {
  const { setItems, setFees, setTax, setSubtotal, setTotal } = setters;

  setItems(items);
  setFees(fees);
  setTax(tax);

  console.info('[useOcrDataProcessing] Normalized items:', items.length);

  // Compute subtotal from items
  const newSubtotal = items.reduce((acc, item) => {
    const qty = Number(item.quantity ?? 1) || 1;
    const totalFromFields = Number(item.totalPrice ?? item.amount ?? NaN);
    if (!isNaN(totalFromFields)) return acc + totalFromFields;
    const unit = Number(item.unitPrice ?? NaN);
    if (!isNaN(unit)) return acc + (unit * qty);
    return acc;
  }, 0);

  const feesTotal = fees.reduce((acc, fee) => acc + parseFloat(fee.amount || 0), 0);
  const newTotal = newSubtotal + feesTotal + parseFloat(tax || 0);

  // Set subtotal (prefer computed from items)
  if (newSubtotal > 0) {
    setSubtotal(newSubtotal.toFixed(2));
  } else if (serverParsed?.subtotal !== undefined && serverParsed?.subtotal !== null) {
    setSubtotal(Number(serverParsed.subtotal).toFixed(2));
  } else {
    setSubtotal('0.00');
  }

  // Set total (prefer server-parsed, fallback to OCR, then computed)
  if (!serverParsed || (serverPrefTotal === undefined || serverPrefTotal === null)) {
    if (ocrData.total !== undefined && ocrData.total !== null && ocrData.total !== '') {
      const t = parseFloat(ocrData.total);
      if (!isNaN(t)) setTotal(t.toFixed(2));
      else setTotal(newTotal.toFixed(2));
    } else {
      setTotal(newTotal.toFixed(2));
    }
  }
}
