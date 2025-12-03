/**
 * Helper utilities for invoice data transformation and validation
 */

/**
 * Sanitize invoice data for display
 */
export const sanitizeInvoiceForDisplay = (invoice) => {
  if (!invoice) return null;
  
  return {
    ...invoice,
    customerName: invoice.customerName || '[Unknown Customer]',
    sellerName: invoice.sellerName || '[Unknown Seller]',
    totalAmount: parseFloat(invoice.total || invoice.totalAmount) || 0,
    status: invoice.status || 'draft',
    syncStatus: invoice.syncStatus || 'unknown'
  };
};

/**
 * Sort invoices by a given field
 */
export const sortInvoices = (invoices, sortBy = 'dueDate', order = 'desc') => {
  if (!invoices || !Array.isArray(invoices)) return [];
  
  return [...invoices].sort((a, b) => {
    let aVal, bVal;
    
    switch (sortBy) {
      case 'dueDate':
      case 'issueDate':
        aVal = new Date(a[sortBy] || 0).getTime();
        bVal = new Date(b[sortBy] || 0).getTime();
        break;
      case 'totalAmount':
        aVal = parseFloat(a.total || a.totalAmount || 0);
        bVal = parseFloat(b.total || b.totalAmount || 0);
        break;
      case 'customerName':
      case 'sellerName':
      case 'service':
        aVal = (a[sortBy] || '').toLowerCase();
        bVal = (b[sortBy] || '').toLowerCase();
        break;
      default:
        return 0;
    }

    if (order === 'asc') {
      return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
    } else {
      return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
    }
  });
};

/**
 * Filter invoices by criteria
 */
export const filterInvoices = (invoices, filters = {}) => {
  if (!invoices || !Array.isArray(invoices)) return [];
  
  const { seller, customer, service, status } = filters;
  
  return invoices.filter(inv => {
    if (seller && inv.sellerName !== seller) return false;
    if (customer && inv.customerName !== customer && inv.customerEmail !== customer) return false;
    if (service && inv.service !== service) return false;
    if (status && inv.status !== status) return false;
    return true;
  });
};

/**
 * Calculate invoice statistics
 */
export const calculateInvoiceStats = (invoices) => {
  if (!invoices || !Array.isArray(invoices)) {
    return {
      total: 0,
      totalAmount: 0,
      paid: 0,
      pending: 0,
      overdue: 0,
      draft: 0
    };
  }
  
  const stats = {
    total: invoices.length,
    totalAmount: 0,
    paid: 0,
    pending: 0,
    overdue: 0,
    draft: 0
  };
  
  for (const inv of invoices) {
    stats.totalAmount += parseFloat(inv.total || inv.totalAmount || 0);
    
    const status = (inv.status || 'draft').toLowerCase();
    if (status === 'paid') stats.paid++;
    else if (status === 'pending') stats.pending++;
    else if (status === 'overdue') stats.overdue++;
    else if (status === 'draft') stats.draft++;
  }
  
  return stats;
};

/**
 * Validate invoice data
 */
export const validateInvoiceData = (invoiceData) => {
  const errors = [];
  
  if (!invoiceData.customerId && !invoiceData.customerName) {
    errors.push('Customer is required');
  }
  
  if (!invoiceData.sellerId && !invoiceData.sellerName) {
    errors.push('Seller is required');
  }
  
  if (!invoiceData.dueDate) {
    errors.push('Due date is required');
  }
  
  if ((!invoiceData.total && !invoiceData.totalAmount) || parseFloat(invoiceData.total || invoiceData.totalAmount) <= 0) {
    errors.push('Total amount must be greater than zero');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};
