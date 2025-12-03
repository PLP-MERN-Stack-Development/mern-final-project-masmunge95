/**
 * Helper utilities for record data transformation and statistics
 */

/**
 * Get unique services and record types for filter dropdowns
 */
export const getFilterOptions = (records, serviceLookup = {}) => {
  const availableServices = [...new Set(records.map(r => r.service).filter(Boolean))]
    .map(serviceId => ({
      id: serviceId,
      name: serviceLookup[serviceId] || serviceId
    }));
    
  const availableRecordTypes = [...new Set(records.map(r => r.recordType).filter(Boolean))];

  return {
    availableServices,
    availableRecordTypes,
  };
};

/**
 * Calculate record statistics
 */
export const calculateRecordStats = (records) => {
  if (!records || !Array.isArray(records)) {
    return {
      total: 0,
      totalAmount: 0,
      receipts: 0,
      invoices: 0,
      utilityBills: 0,
    };
  }
  
  const stats = {
    total: records.length,
    totalAmount: 0,
    receipts: 0,
    invoices: 0,
    utilityBills: 0,
  };
  
  for (const record of records) {
    stats.totalAmount += parseFloat(record.amount || 0);
    
    const recordType = (record.recordType || '').toLowerCase();
    if (recordType === 'receipt') stats.receipts++;
    else if (recordType === 'invoice') stats.invoices++;
    else if (recordType === 'utility_meter') stats.utilityBills++;
  }
  
  return stats;
};

/**
 * Sort records by a given field
 */
export const sortRecords = (records, sortBy = 'recordDate', order = 'desc') => {
  if (!records || !Array.isArray(records)) return [];
  
  return [...records].sort((a, b) => {
    let aVal, bVal;
    
    switch (sortBy) {
      case 'recordDate':
        aVal = new Date(a.recordDate || 0).getTime();
        bVal = new Date(b.recordDate || 0).getTime();
        break;
      case 'amount':
        aVal = parseFloat(a.amount || 0);
        bVal = parseFloat(b.amount || 0);
        break;
      case 'recordType':
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
