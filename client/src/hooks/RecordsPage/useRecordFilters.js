import { useState } from 'react';

/**
 * Custom hook to manage record filtering
 * Handles source, record type, and service filters
 */
export const useRecordFilters = (userRole) => {
  const [filterSource, setFilterSource] = useState('all'); // 'all', 'my-records', 'customer-uploads'
  const [filterRecordType, setFilterRecordType] = useState('all');
  const [filterService, setFilterService] = useState('all');

  const clearFilters = () => {
    setFilterSource('all');
    setFilterRecordType('all');
    setFilterService('all');
  };

  const applyFilters = (records) => {
    return records.filter(record => {
      // Source filter (for sellers only)
      if (userRole === 'seller') {
        if (filterSource === 'my-records' && record.uploadReason !== 'seller_added') return false;
        if (filterSource === 'customer-uploads' && record.uploadReason !== 'customer_uploaded') return false;
      }
      
      // Record type filter
      if (filterRecordType !== 'all' && record.recordType !== filterRecordType) return false;
      
      // Service filter
      if (filterService !== 'all' && record.service !== filterService) return false;
      
      return true;
    });
  };

  return {
    filterSource,
    setFilterSource,
    filterRecordType,
    setFilterRecordType,
    filterService,
    setFilterService,
    clearFilters,
    applyFilters,
  };
};
