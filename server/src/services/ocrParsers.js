const findAmounts = (text) => {
  if (!text) return [];
  const regex = /\d{1,3}(?:[\d,]*)(?:\.\d{1,2})?/g;
  const matches = text.match(regex) || [];
  return matches.map(m => parseFloat(m.replace(/,/g, ''))).filter(n => !Number.isNaN(n));
};

// Top-level extractor: robustly search known places for structured currency totals
function extractStructuredTotalTop(rec) {
  if (!rec || typeof rec !== 'object') return null;
  const places = [];
  if (rec.ocrData) places.push(rec.ocrData);
  if (rec.fullRecord) places.push(rec.fullRecord);
  if (rec.sourceRecord) places.push(rec.sourceRecord);
  places.push(rec);

  for (const place of places) {
    const raw = (place && place.metadata && place.metadata.rawDriverResponse) || place && place.rawDriverResponse || null;
    if (!raw || !Array.isArray(raw)) continue;
    for (const doc of raw) {
      const fields = doc.fields || doc;
      if (!fields || typeof fields !== 'object') continue;
      const totalKeys = ['InvoiceTotal','InvoiceTotalAmount','InvoiceTotal.value','Total','TotalAmount','Amount','AmountDue','GrandTotal','Grand_Total','TotalDue'];
      for (const key of totalKeys) {
        if (fields[key]) {
          const f = fields[key];
          if (f && f.value && typeof f.value.amount === 'number') return { value: f.value.amount, confidence: 'high', reason: `found field ${key}` };
          if (f && f.content && typeof f.content === 'string') {
            const m = f.content.match(/\d{1,3}(?:[\d,]*)(?:\.\d{1,2})?/);
            if (m) return { value: parseFloat(m[0].replace(/,/g, '')), confidence: 'medium', reason: `parsed ${key} content` };
          }
        }
      }
      function walk(o) {
        if (!o || typeof o !== 'object') return null;
        if (o.kind && typeof o.kind === 'string' && o.kind.toLowerCase().includes('currency') && o.value && typeof o.value.amount === 'number') {
          return { value: o.value.amount, confidence: 'high', reason: 'found currency-kind value.amount' };
        }
        for (const k of Object.keys(o)) {
          const res = walk(o[k]);
          if (res) return res;
        }
        return null;
      }
      const rec = walk(fields);
      if (rec) return rec;
    }
  }
  return null;
}

function findTotalCandidate(ocrData, fullText, rec) {
  // prefer structured Document Intelligence fields when available
  try {
    const structured = extractStructuredTotalTop(rec || ocrData || {});
    if (structured) return structured;
  } catch (e) { /* ignore */ }

  const text = (fullText || '').toLowerCase();
  const tokens = ['total', 'subtotal', 'total amount', 'amount due', 'amount'];
  for (const tk of tokens) {
    const idx = text.indexOf(tk);
    if (idx !== -1) {
      const after = text.slice(idx, idx + 200);
      const nums = findAmounts(after);
      if (nums.length) return { value: nums[0], confidence: 'high', reason: `found ${tk}` };
      const before = text.slice(Math.max(0, idx - 100), idx + tk.length);
      const nums2 = findAmounts(before);
      if (nums2.length) return { value: nums2[nums2.length - 1], confidence: 'medium', reason: `found ${tk} before` };
    }
  }

  const candidates = [];
  if (ocrData && ocrData.businessAddress) candidates.push(...findAmounts(ocrData.businessAddress));
  if (ocrData && ocrData.businessName) candidates.push(...findAmounts(ocrData.businessName));
  if (fullText) candidates.push(...findAmounts(fullText));
  if (candidates.length === 0) return { value: null, confidence: 'none', reason: 'no numbers found' };
  const filtered = candidates.filter(n => {
    if (!Number.isFinite(n)) return false;
    if (Math.abs(n) > 1000000) return false;
    if (Number.isInteger(n) && Math.abs(n) >= 1000000) return false;
    return true;
  });
  if (filtered.length) {
    return { value: Math.max(...filtered), confidence: 'low', reason: 'largest numeric candidate' };
  }
  return null;
}

function extractIdsFromRawDriverResponse(ocrData, fullRecord) {
  const raw = (ocrData && ocrData.metadata && ocrData.metadata.rawDriverResponse) || (fullRecord && fullRecord.metadata && fullRecord.metadata.rawDriverResponse) || null;
  if (!raw || !Array.isArray(raw)) return {};
  const out = {};
  const keyNames = ['InvoiceId','InvoiceNo','InvoiceNumber','InvoiceID','TransactionId','TransactionNo','TransactionNumber','Transaction','TransactionID','Invoice'];
  for (const doc of raw) {
    const fields = doc.fields || doc;
    if (!fields || typeof fields !== 'object') continue;
    for (const k of Object.keys(fields)) {
      const lower = k.toLowerCase();
      for (const name of keyNames) {
        if (lower === name.toLowerCase()) {
          const f = fields[k];
          if (f && (f.value || f.content)) {
            out[name] = f.value && f.value.amount === undefined ? (f.value && f.value) : (f.content || (f.value && f.value.toString && f.value.toString()));
          }
        }
      }
    }
  }
  return out;
}

module.exports = {
  findAmounts,
  findTotalCandidate,
  extractIdsFromRawDriverResponse,
  extractStructuredTotalTop
};

// Parse a rawDriverResponse (array or wrapper) into a normalized parsed object
function parseRawDriverResponse(rawOrWrapper) {
  const raw = Array.isArray(rawOrWrapper)
    ? rawOrWrapper
    : (rawOrWrapper && rawOrWrapper.metadata && rawOrWrapper.metadata.rawDriverResponse) || null;
  if (!raw || !Array.isArray(raw)) return { total: null, items: [], fees: [], promotions: [], confidence: 'none', reason: 'no rawDriverResponse' };

  const parsed = {
    invoiceId: null,
    invoiceDate: null,
    businessName: null,
    businessAddress: null,
    items: [],
    fees: [],
    promotions: [],
    subtotal: null,
    tax: null,
    total: null,
    paymentMethod: null,
    confidence: 'low',
    reason: null
  };

  // debugging helpers to record where fields were sourced or skipped for tuning
  parsed._fieldSources = {}; // e.g. { businessName: { key: 'MerchantName', docIndex: 0 } }
  parsed._skippedFields = []; // array of { key, reason, sample }

  // helper to safely read field content/value
  const readField = (f) => {
    if (!f) return null;
    if (f.value && typeof f.value === 'object' && f.value.amount !== undefined) return f.value.amount;
    if (f.value && typeof f.value === 'string') return f.value;
    if (f.content) return f.content;
    return null;
  };

  const pickFromCandidates = (fields, candidates) => {
    if (!fields || typeof fields !== 'object') return null;
    for (const name of candidates) {
      // try exact, then case-insensitive key
      if (fields[name]) return { key: name, value: readField(fields[name]) };
      const lower = Object.keys(fields).find(k => k.toLowerCase() === name.toLowerCase());
      if (lower) return { key: lower, value: readField(fields[lower]) };
    }
    return null;
  };

  // collect candidate totals
  try {
    const structuredTotal = extractStructuredTotalTop({ metadata: { rawDriverResponse: raw } });
    if (structuredTotal && structuredTotal.value != null) {
      parsed.total = structuredTotal.value;
      parsed.confidence = structuredTotal.confidence || parsed.confidence;
      parsed.reason = structuredTotal.reason || 'structured total';
    }
  } catch (e) { /* ignore */ }

  // scan docs for items, ids, fees, promotions, payment method
  for (const doc of raw) {
    const fields = doc.fields || {};
    const docIndex = raw.indexOf(doc);
    // whitelist candidate keys for common useful metadata
    try {
      const businessCandidates = ['MerchantName','Merchant','Vendor','Seller','Company','BusinessName','TradingName','StoreName'];
      const businessAddrCandidates = ['MerchantAddress','VendorAddress','BillingAddress','BusinessAddress','CompanyAddress','Address','StoreAddress'];
      const customerCandidates = ['CustomerName','Customer','BillTo','ShipTo','RecipientName','DeliveryAddress','CustomerName1'];
      const dateCandidates = ['InvoiceDate','DocumentDate','Date','IssueDate','TransactionDate','Invoice_Date'];
      const taxCandidates = ['TotalTax','Tax','SalesTax','VAT','GST'];
      const subtotalCandidates = ['SubTotal','Subtotal','SubtotalAmount','SubTotal.value'];

      if (!parsed.businessName) {
        const pick = pickFromCandidates(fields, businessCandidates);
        if (pick && pick.value) {
          parsed.businessName = String(pick.value).trim();
          parsed._fieldSources.businessName = { key: pick.key, docIndex };
        }
      }
      if (!parsed.businessAddress) {
        const pick = pickFromCandidates(fields, businessAddrCandidates);
        if (pick && pick.value) {
          parsed.businessAddress = String(pick.value).trim();
          parsed._fieldSources.businessAddress = { key: pick.key, docIndex };
        }
      }
      if (!parsed.invoiceDate) {
        const pick = pickFromCandidates(fields, dateCandidates);
        if (pick && pick.value) {
          // try to normalize to ISO yyyy-mm-dd
          try {
            const d = new Date(pick.value);
            if (!isNaN(d.getTime())) {
              parsed.invoiceDate = d.toISOString().split('T')[0];
              parsed._fieldSources.invoiceDate = { key: pick.key, docIndex };
            } else {
              parsed.invoiceDate = String(pick.value).trim();
              parsed._fieldSources.invoiceDate = { key: pick.key, docIndex };
            }
          } catch (e) {
            parsed.invoiceDate = String(pick.value).trim();
            parsed._fieldSources.invoiceDate = { key: pick.key, docIndex };
          }
        }
      }
      if (!parsed.detectedCustomerName) {
        const pick = pickFromCandidates(fields, customerCandidates);
        if (pick && pick.value) {
          parsed.detectedCustomerName = String(pick.value).trim();
          parsed._fieldSources.detectedCustomerName = { key: pick.key, docIndex };
        }
      }
      // Extract tax if present
      if (parsed.tax == null || parsed.tax === 0) {
        const pick = pickFromCandidates(fields, taxCandidates);
        if (pick && pick.value != null) {
          const taxVal = Number(pick.value);
          if (!isNaN(taxVal)) {
            parsed.tax = taxVal;
            parsed._fieldSources.tax = { key: pick.key, docIndex };
          }
        }
      }
      // Extract subtotal if present
      if (parsed.subtotal == null) {
        const pick = pickFromCandidates(fields, subtotalCandidates);
        if (pick && pick.value != null) {
          const subVal = Number(pick.value);
          if (!isNaN(subVal)) {
            parsed.subtotal = subVal;
            parsed._fieldSources.subtotal = { key: pick.key, docIndex };
          }
        }
      }
    } catch (e) {
      // non-fatal
    }

    // If businessName still not found, attempt to extract from doc-level text/content heuristics
    try {
      if (!parsed.businessName) {
        const docText = doc.content || doc.text || (doc.pageText) || null;
        if (docText && typeof docText === 'string') {
          const lines = docText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
          if (lines.length > 0) {
            // prefer first line that looks like a name (contains letters, not just numbers)
            const candidate = lines.find(l => /[A-Za-z]/.test(l) && !/invoice|receipt|tax|total|customer|date/i.test(l));
            if (candidate && candidate.length > 2 && candidate.length < 200) {
              parsed.businessName = candidate;
              parsed._fieldSources.businessName = { key: 'doc.content:firstCandidate', docIndex };
            }
          }
        }
      }
      if (!parsed.businessAddress) {
        const docText = doc.content || doc.text || (doc.pageText) || null;
        if (docText && typeof docText === 'string') {
          const lines = docText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
          if (lines.length > 1) {
            // often the line after the business name contains an address or 'Customer Care' etc
            const maybeAddr = lines[1];
            if (maybeAddr && /[A-Za-z0-9]/.test(maybeAddr) && !/invoice|receipt|total|date/i.test(maybeAddr)) {
              parsed.businessAddress = maybeAddr;
              parsed._fieldSources.businessAddress = { key: 'doc.content:secondLine', docIndex };
            }
          }
        }
      }
    } catch (e) { /* ignore heuristics */ }
    // invoice id / date / business
    const idKeys = ['InvoiceId','InvoiceNo','InvoiceNumber','InvoiceID','Invoice'];
    for (const k of idKeys) {
      if (!parsed.invoiceId && fields[k]) parsed.invoiceId = String(readField(fields[k]));
    }
    if (!parsed.invoiceDate && fields.InvoiceDate) parsed.invoiceDate = readField(fields.InvoiceDate);
    if (!parsed.businessName && fields.BusinessName) parsed.businessName = readField(fields.BusinessName) || parsed.businessName;

    // items array (Document Intelligence 'Items')
    if (fields.Items && Array.isArray(fields.Items.values)) {
      for (const v of fields.Items.values) {
        if (!v || typeof v !== 'object') continue;
        const props = v.properties || {};
        const desc = (props.Description && readField(props.Description)) || v.content || null;
        const qty = (props.Quantity && readField(props.Quantity)) || 1;
        let amount = null;
        if (props.Amount) amount = readField(props.Amount);
        // sometimes Amount appears as 'Amount' inside properties, or 'Amount' as top-level
        const item = { description: desc ? String(desc).trim() : null, quantity: Number(qty) || 1, amount: amount != null ? Number(amount) : null };
        // classify
        const descLow = (item.description || '').toLowerCase();
        if (descLow.includes('promo') || descLow.includes('discount')) {
          parsed.promotions.push(item);
        } else if (descLow.includes('delivery') || descLow.includes('service fee') || descLow.includes('delivery charge')) {
          parsed.fees.push(item);
        } else {
          parsed.items.push(item);
        }
      }
    }

    // free-form scan: some documents put line objects under arrays or 'values'
    // sweep object tree for currency-kind entries and associated nearby Description
    function walkForLineObjects(o) {
      if (!o || typeof o !== 'object') return;
      if (o.kind === 'object' && o.properties) {
        const props = o.properties;
        const desc = (props.Description && readField(props.Description)) || o.content || null;
        const amount = (props.Amount && readField(props.Amount));
        const qty = (props.Quantity && readField(props.Quantity)) || 1;
        if (amount != null) {
          const item = { description: desc ? String(desc).trim() : null, quantity: Number(qty) || 1, amount: Number(amount) };
          const descLow = (item.description || '').toLowerCase();
          if (descLow.includes('promo') || descLow.includes('discount')) parsed.promotions.push(item);
          else if (descLow.includes('delivery') || descLow.includes('service fee') || descLow.includes('delivery charge')) parsed.fees.push(item);
          else parsed.items.push(item);
        }
      }
      for (const k of Object.keys(o)) {
        const v = o[k];
        if (Array.isArray(v)) {
          for (const a of v) walkForLineObjects(a);
        } else if (v && typeof v === 'object') walkForLineObjects(v);
      }
    }
    walkForLineObjects(fields);

    // look for standalone currency entries with labels (e.g. Mpesa on Delivery, PROMO CODE)
    if (fields.Items && Array.isArray(fields.Items.values) === false) {
      // no-op
    }

    // detect payment method-like lines
    for (const k of Object.keys(fields)) {
      const keyLower = k.toLowerCase();
      if (keyLower.includes('payment') || keyLower.includes('mpesa') || keyLower.includes('paymentmethod')) {
        const v = readField(fields[k]);
        if (v) parsed.paymentMethod = String(v);
      }
      // record skipped short/empty fields for tuning
      const vSample = readField(fields[k]);
      if (vSample == null || (typeof vSample === 'string' && vSample.trim() === '')) {
        // skip silently
      } else {
        // if key looks like an address/name/date/business but we didn't pick it into parsed, note it
        const look = k.toLowerCase();
        const interesting = /merchant|vendor|seller|company|store|business|customer|billto|shipto|address|invoice|date/;
        if (interesting.test(look)) {
          // check if already recorded as source for any parsed field
          const alreadyUsed = Object.values(parsed._fieldSources).some(src => src && src.key && src.key.toLowerCase() === k.toLowerCase());
          if (!alreadyUsed) {
            parsed._skippedFields.push({ key: k, sample: (typeof vSample === 'string' ? vSample.slice(0, 200) : String(vSample)), reason: 'candidate not picked' });
          }
        }
      }
    }
  }

  // compute numeric aggregates
  // deduplicate line items (some driver responses included repeated sections)
  function dedupeLines(arr) {
    if (!Array.isArray(arr) || arr.length === 0) return [];
    const seen = new Map();
    const out = [];
    for (const it of arr) {
      const desc = (it.description || '').trim().toLowerCase();
      const amt = (it.amount === null || it.amount === undefined) ? '' : String(it.amount);
      const qty = (it.quantity === null || it.quantity === undefined) ? '' : String(it.quantity);
      const key = `${desc}|${amt}|${qty}`;
      if (!seen.has(key)) {
        seen.set(key, true);
        out.push(it);
      }
    }
    return out;
  }

  parsed.items = dedupeLines(parsed.items || []);
  parsed.fees = dedupeLines(parsed.fees || []);
  parsed.promotions = dedupeLines(parsed.promotions || []);

  const itemSum = parsed.items.reduce((s, it) => s + (it.amount || 0), 0);
  const feesSum = parsed.fees.reduce((s, it) => s + (it.amount || 0), 0);
  const promosSum = parsed.promotions.reduce((s, it) => s + (it.amount || 0), 0);
  if (parsed.subtotal == null) parsed.subtotal = itemSum || null;
  if (parsed.tax == null) parsed.tax = 0;

  // computedTotal: derived from items, fees, tax, promotions
  const computedTotal = (parsed.subtotal || 0) + feesSum + (parsed.tax || 0) - promosSum;
  parsed.computedTotal = Number.isFinite(computedTotal) ? computedTotal : null;
  parsed.promoSum = promosSum || 0;

  // if structured total exists we keep it, but also provide an adjusted value that subtracts promotions
  if (parsed.total == null && parsed.subtotal != null) {
    parsed.total = parsed.computedTotal;
    parsed.reason = parsed.reason || 'computed from items/fees/promos';
  }

  // totalAfterPromotions: when promotions are present, give a suggested adjusted total
  if (parsed.total != null) {
    parsed.totalAfterPromotions = Number.isFinite(parsed.total - parsed.promoSum) ? parsed.total - parsed.promoSum : parsed.total;
  } else {
    parsed.totalAfterPromotions = parsed.computedTotal;
  }

  // finalize confidence
  if (parsed.total != null && parsed.confidence === 'low') parsed.confidence = 'medium';
  if (parsed.items.length && parsed.confidence === 'none') parsed.confidence = 'low';

  return parsed;
}

module.exports.parseRawDriverResponse = parseRawDriverResponse;
