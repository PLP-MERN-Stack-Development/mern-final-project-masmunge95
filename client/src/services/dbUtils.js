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
