// Utilities for preparing objects before writing to Dexie
export const makeTempId = () => (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `client_${Date.now()}_${Math.random().toString(36).slice(2,9)}`;

export const sanitizeForDb = (obj, options = {}) => {
  if (!obj || typeof obj !== 'object') return obj;
  const copy = { ...obj };
  const rawId = copy._id ?? copy.id ?? makeTempId();
  try { copy._id = String(rawId); } catch (e) { copy._id = makeTempId(); }
  if (copy.id !== undefined) delete copy.id;
  
  if (options.flattenCustomer) {
    // Handle case where customer is already a string (UUID) from server
    if (typeof copy.customer === 'string') {
      copy.customerId = copy.customer;
      delete copy.customer;
    }
    // Handle case where customer is an object with nested _id/name
    else if (copy.customer && typeof copy.customer === 'object') {
      copy.customerId = copy.customer._id ?? copy.customer.id ?? copy.customerId ?? null;
      copy.customerName = copy.customer.name ?? copy.customerName ?? '';
      delete copy.customer;
      if (copy.customerId !== null) copy.customerId = String(copy.customerId);
    }
  }
  return copy;
};

export const sanitizeArrayForDb = (arr, options = {}) => {
  if (!Array.isArray(arr)) return arr;
  return arr.map(item => sanitizeForDb(item, options));
};

// Synchronous pruning helper to remove Promise-like and function fields
export function pruneSyncNonCloneable(obj) {
  const MAX_DEPTH = 20;
  const seen = new WeakSet();

  function _prune(value, depth) {
    if (depth > MAX_DEPTH) return undefined;
    if (value === null || value === undefined) return value;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value instanceof Date || value instanceof File || value instanceof Blob) return value;

    if (Array.isArray(value)) {
      if (seen.has(value)) return undefined;
      seen.add(value);
      const outArr = [];
      for (let i = 0; i < value.length; i++) {
        try {
          const pr = _prune(value[i], depth + 1);
          if (pr !== undefined) outArr.push(pr);
        } catch (_e) { /* skip element */ }
      }
      return outArr;
    }

    if (typeof value === 'object') {
      if (seen.has(value)) return undefined;
      seen.add(value);
      const outObj = {};
      let names = [];
      try {
        names = Object.getOwnPropertyNames(value).concat(Object.getOwnPropertySymbols(value));
      } catch (_e) {
        // Fall back to enumerable keys if getOwnPropertyNames fails
        try { names = Object.keys(value); } catch (_e2) { return undefined; }
      }

      for (const key of names) {
        try {
          let desc;
          try { desc = Object.getOwnPropertyDescriptor(value, key); } catch (_e) { desc = null; }
          if (desc && (desc.get || desc.set)) {
            // don't invoke accessors — skip
            continue;
          }

          // Safe property read for value properties
          let propVal;
          try { propVal = value[key]; } catch (_e) { continue; }

          // Drop functions and thenables without calling them
          try {
            if (propVal && (typeof propVal === 'object' || typeof propVal === 'function') && typeof propVal.then === 'function') continue;
          } catch (_e) { continue; }
          if (typeof propVal === 'function') continue;

          const pr = _prune(propVal, depth + 1);
          if (pr !== undefined) {
            // use string keys for symbols to avoid issues when assigning
            const outKey = (typeof key === 'symbol') ? key.toString() : String(key);
            outObj[outKey] = pr;
          }
        } catch (_e) {
          // skip problematic property
        }
      }
      return outObj;
    }

    return undefined;
  }

  return _prune(obj, 0);
}

// Make a shallow deep-cloneable copy of an object by replacing non-cloneable
// values (thenables, functions, accessors) with string placeholders. This is
// a conservative, synchronous pass intended to run right before IndexedDB
// writes to ensure structuredClone will succeed.
export function makeCloneSafe(value, options = {}) {
  const MAX_DEPTH = typeof options.maxDepth === 'number' ? options.maxDepth : 20;
  const seen = new WeakSet();

  function _safe(v, depth) {
    if (depth > MAX_DEPTH) return '[MaxDepth]';
    if (v === null || v === undefined) return v;
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v;
    if (v instanceof Date) return v;
    if (v instanceof File || v instanceof Blob) return v;
    if (Array.isArray(v)) {
      if (seen.has(v)) return '[Circular]';
      seen.add(v);
      return v.map(el => _safe(el, depth + 1));
    }
    if (typeof v === 'object') {
      if (seen.has(v)) return '[Circular]';
      seen.add(v);
      const out = {};
      let names = [];
      try { names = Object.getOwnPropertyNames(v).concat(Object.getOwnPropertySymbols(v)); } catch (e) { names = Object.keys(v); }
      for (const key of names) {
        try {
          let desc;
          try { desc = Object.getOwnPropertyDescriptor(v, key); } catch (_e) { desc = null; }
          if (desc && (desc.get || desc.set)) {
            out[typeof key === 'symbol' ? key.toString() : String(key)] = '[Accessor]';
            continue;
          }
          let prop;
          try { prop = v[key]; } catch (_e) { out[typeof key === 'symbol' ? key.toString() : String(key)] = '[AccessError]'; continue; }
          try {
            if (prop && (typeof prop === 'object' || typeof prop === 'function') && typeof prop.then === 'function') {
              out[typeof key === 'symbol' ? key.toString() : String(key)] = '[Thenable]';
              continue;
            }
          } catch (_e) { out[typeof key === 'symbol' ? key.toString() : String(key)] = '[ThenableCheckError]'; continue; }
          if (typeof prop === 'function') {
            out[typeof key === 'symbol' ? key.toString() : String(key)] = '[Function]';
            continue;
          }
          out[typeof key === 'symbol' ? key.toString() : String(key)] = _safe(prop, depth + 1);
        } catch (_e) {
          // skip problematic property
        }
      }
      return out;
    }
    // Fallback for other types
    return String(v);
  }

  return _safe(value, 0);
}

// Helper for compatibility with test mocks: attempt to read the first
// matching item from a Dexie Query / WhereClause-like object. Mocks
// often implement `first()` while some test helpers may only provide
// `toArray()` or `get()`. This helper tries `first()`, then `get()`,
// then `toArray()` and returns the first element or undefined.
export async function firstOrUndefined(whereClause) {
  if (!whereClause) return undefined;
  try {
    if (typeof whereClause.first === 'function') return await whereClause.first();
  } catch (e) {
    // fallthrough
  }
  try {
    if (typeof whereClause.get === 'function') return await whereClause.get();
  } catch (e) {
    // fallthrough
  }
  try {
    if (typeof whereClause.toArray === 'function') {
      const arr = await whereClause.toArray();
      if (Array.isArray(arr)) return arr[0];
    }
  } catch (e) {
    // fallthrough
  }
  return undefined;
}

// Safely JSON-stringify an object for persistent debugging/storage.
// Replaces functions, thenables, accessors, symbols and circular refs
// with readable placeholders. This is synchronous and defensive and
// intended for use in fallback storage where preserving the payload
// as a string is preferable to failing the DB write.
export function safeStringify(obj, options = {}) {
  const maxDepth = typeof options.maxDepth === 'number' ? options.maxDepth : 50;
  const seen = new WeakMap();

  function serializer(value, depth) {
    if (depth > maxDepth) return '[[MaxDepth]]';
    if (value === null) return null;
    if (value === undefined) return '[[Undefined]]';
    const t = typeof value;
    if (t === 'string' || t === 'number' || t === 'boolean') return value;
    if (value instanceof Date) return value.toISOString();
    if (value instanceof File || value instanceof Blob) return `[[${value.constructor.name}]]`;
    if (t === 'function') return '[[Function]]';

    try {
      if (value && (typeof value === 'object' || typeof value === 'function') && typeof value.then === 'function') return '[[Thenable]]';
    } catch (e) {
      return '[[ThenableCheckError]]';
    }

    if (Array.isArray(value)) {
      if (seen.has(value)) return '[[Circular]]';
      seen.set(value, true);
      return value.map(v => serializer(v, depth + 1));
    }

    if (t === 'object') {
      if (seen.has(value)) return '[[Circular]]';
      seen.set(value, true);
      const out = {};
      let names = [];
      try { names = Object.getOwnPropertyNames(value).concat(Object.getOwnPropertySymbols(value)); } catch (e) { names = Object.keys(value); }
      for (const key of names) {
        try {
          let desc = null;
          try { desc = Object.getOwnPropertyDescriptor(value, key); } catch (e) { desc = null; }
          if (desc && (desc.get || desc.set)) {
            out[typeof key === 'symbol' ? key.toString() : String(key)] = '[[Accessor]]';
            continue;
          }
          let prop;
          try { prop = value[key]; } catch (e) { out[typeof key === 'symbol' ? key.toString() : String(key)] = '[[AccessError]]'; continue; }
          out[typeof key === 'symbol' ? key.toString() : String(key)] = serializer(prop, depth + 1);
        } catch (e) {
          // skip problematic property
        }
      }
      return out;
    }

    // fallback to string
    try { return String(value); } catch (e) { return '[[Unserializable]]'; }
  }

  try {
    const safe = serializer(obj, 0);
    return JSON.stringify(safe);
  } catch (e) {
    try { return JSON.stringify(String(obj)); } catch (e2) { return '[[StringifyFailed]]'; }
  }
}

// Pick a minimal, plain-object representation of an invoice suitable for
// IndexedDB storage. This whitelists expected fields and deeply clones
// arrays/primitive values to avoid any prototype/getter/thenable issues.
export function pickInvoiceForDb(inv = {}) {
  if (!inv || typeof inv !== 'object') return inv;
  const out = {};
  const copyString = (v) => (v === null || v === undefined) ? v : String(v);
  out._id = copyString(inv._id || inv.id || null) || (`client_${Date.now()}_${Math.random().toString(36).slice(2,9)}`);
  out.invoiceNumber = inv.invoiceNumber ? String(inv.invoiceNumber) : null;
  out.customerName = inv.customerName ? String(inv.customerName) : '';
  out.customerId = inv.customerId ? String(inv.customerId) : (inv.customer ? String(inv.customer._id || inv.customer.id || '') : null);
  out.user = inv.user || inv.userId ? String(inv.user || inv.userId) : null;
  out.items = Array.isArray(inv.items) ? inv.items.map(it => ({
    description: it && it.description ? String(it.description) : '',
    quantity: (it && (typeof it.quantity === 'number')) ? it.quantity : Number(it && it.quantity) || 0,
    unitPrice: (it && (typeof it.unitPrice === 'number')) ? it.unitPrice : Number(it && it.unitPrice) || 0,
    total: (it && (typeof it.total === 'number')) ? it.total : Number(it && it.total) || 0,
  })) : [];
  out.subTotal = typeof inv.subTotal === 'number' ? inv.subTotal : Number(inv.subTotal) || 0;
  out.tax = typeof inv.tax === 'number' ? inv.tax : Number(inv.tax) || 0;
  out.total = typeof inv.total === 'number' ? inv.total : Number(inv.total) || 0;
  out.status = inv.status ? String(inv.status) : null;
  out.issueDate = inv.issueDate ? String(inv.issueDate) : null;
  out.dueDate = inv.dueDate ? String(inv.dueDate) : null;
  out.createdAt = inv.createdAt ? String(inv.createdAt) : new Date().toISOString();
  out.updatedAt = inv.updatedAt ? String(inv.updatedAt) : new Date().toISOString();
  out.sellerName = inv.sellerName ? String(inv.sellerName) : null;
  out.sellerPrefix = inv.sellerPrefix ? String(inv.sellerPrefix) : null;
  out.publicInvoiceId = inv.publicInvoiceId ? String(inv.publicInvoiceId) : null;
  out.service = inv.service ? String(inv.service) : null;
  out.notes = inv.notes ? String(inv.notes) : null;
  
  // Dispute fields
  out.disputeStatus = inv.disputeStatus ? String(inv.disputeStatus) : 'none';
  out.disputes = Array.isArray(inv.disputes) ? inv.disputes.map(d => ({
    _id: d._id ? String(d._id) : null,
    disputedBy: d.disputedBy ? String(d.disputedBy) : null,
    lineItemIndex: typeof d.lineItemIndex === 'number' ? d.lineItemIndex : null,
    field: d.field ? String(d.field) : null,
    originalValue: d.originalValue !== undefined ? d.originalValue : null,
    suggestedValue: d.suggestedValue !== undefined ? d.suggestedValue : null,
    reason: d.reason ? String(d.reason) : '',
    status: d.status ? String(d.status) : 'pending',
    disputedAt: d.disputedAt ? String(d.disputedAt) : null,
    reviewedAt: d.reviewedAt ? String(d.reviewedAt) : null,
    reviewedBy: d.reviewedBy ? String(d.reviewedBy) : null,
    resolution: d.resolution ? String(d.resolution) : null,
    resolutionNotes: d.resolutionNotes ? String(d.resolutionNotes) : null,
  })) : [];
  
  return out;
}
