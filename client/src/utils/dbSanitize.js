// Utilities for making objects safe for IndexedDB structured-clone

// Synchronous prune to remove functions and Promise-like objects
export function pruneSyncNonCloneable(obj, depth = 0, maxDepth = 6, seen = new WeakSet()) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean' || obj instanceof Date) return obj;
  if (depth > maxDepth) return undefined;
  if (typeof obj === 'function') return undefined;
  if (obj && (typeof obj === 'object')) {
    if (seen.has(obj)) return undefined;
    seen.add(obj);
    if (Array.isArray(obj)) {
      const out = [];
      for (const el of obj) {
        try {
          const pr = pruneSyncNonCloneable(el, depth + 1, maxDepth, seen);
          if (pr !== undefined) out.push(pr);
        } catch (e) { /* skip */ }
      }
      return out;
    }
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      try {
        if (v && (typeof v === 'object' || typeof v === 'function') && typeof v.then === 'function') continue;
        if (typeof v === 'function') continue;
        const pr = pruneSyncNonCloneable(v, depth + 1, maxDepth, seen);
        if (pr !== undefined) out[k] = pr;
      } catch (e) { /* skip */ }
    }
    return out;
  }
  return undefined;
}

// Conservative replacer: convert accessors/thenables to placeholders
export function makeCloneSafe(obj, depth = 0, maxDepth = 6, seen = new WeakMap()) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean' || obj instanceof Date) return obj;
  if (depth > maxDepth) return '<<max-depth>>';
  if (typeof obj === 'function') return '<<function>>';
  if (obj && (typeof obj === 'object')) {
    if (seen.has(obj)) return seen.get(obj);
    const out = Array.isArray(obj) ? [] : {};
    seen.set(obj, out);
    const keys = Object.keys(obj);
    for (const k of keys) {
      let val;
      try {
        // Protect getters by reading via safe try/catch
        val = obj[k];
      } catch (e) {
        out[k] = '<<getter-threw>>';
        continue;
      }
      try {
        if (val && (typeof val === 'object' || typeof val === 'function') && typeof val.then === 'function') {
          out[k] = '<<thenable>>';
          continue;
        }
        if (typeof val === 'function') { out[k] = '<<function>>'; continue; }
        out[k] = makeCloneSafe(val, depth + 1, maxDepth, seen);
      } catch (e) {
        out[k] = '<<sanitize-error>>';
      }
    }
    return out;
  }
  return obj;
}

// Safe JSON stringify that replaces functions/thenables and handles cycles
export function safeStringify(obj) {
  const seen = new WeakSet();
  return JSON.stringify(obj, function (k, v) {
    if (v && (typeof v === 'object')) {
      if (seen.has(v)) return '<<circular>>';
      seen.add(v);
    }
    if (typeof v === 'function') return '<<function>>';
    if (v && (typeof v === 'object' || typeof v === 'function') && typeof v.then === 'function') return '<<thenable>>';
    return v;
  });
}

// Whitelist serializer for invoices
export function pickInvoiceForDb(inv) {
  if (!inv || typeof inv !== 'object') return null;
  const out = {
    _id: inv._id ? String(inv._id) : (inv.id ? String(inv.id) : `local_${Date.now()}`),
    invoiceNumber: inv.invoiceNumber || inv.number || null,
    customerId: inv.customerId || (inv.customer && inv.customer._id) || null,
    customerName: (inv.customer && inv.customer.name) || inv.customerName || null,
    issueDate: inv.issueDate || inv.createdAt || null,
    dueDate: inv.dueDate || null,
    status: inv.status || 'draft',
    subTotal: typeof inv.subTotal === 'number' ? inv.subTotal : (typeof inv.total === 'number' ? inv.total : 0),
    tax: typeof inv.tax === 'number' ? inv.tax : 0,
    total: typeof inv.total === 'number' ? inv.total : null,
    items: Array.isArray(inv.items) ? inv.items.map(i => ({ description: i.description || i.name || '', qty: i.qty || i.quantity || 1, unitPrice: i.unitPrice || i.price || 0 })) : [],
    syncSafe: true
  };
  return out;
}

export default {
  pruneSyncNonCloneable,
  makeCloneSafe,
  safeStringify,
  pickInvoiceForDb
};
