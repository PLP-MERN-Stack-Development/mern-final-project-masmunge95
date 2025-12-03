/**
 * Utility functions for CSV export of records
 */

export const generateRecordCSV = (records) => {
  if (!records || records.length === 0) {
    return 'No records to export';
  }

  const headers = [
    'Date',
    'Service Type',
    'Account Number',
    'Previous Reading',
    'Current Reading',
    'Amount',
    'Notes'
  ];

  const csvRows = [headers.join(',')];

  for (const record of records) {
    const row = [
      record.recordDate ? new Date(record.recordDate).toLocaleDateString() : '',
      `"${(record.serviceType || '').replace(/"/g, '""')}"`,
      `"${(record.accountNumber || '').replace(/"/g, '""')}"`,
      record.previousReading || '',
      record.currentReading || '',
      record.amount || '',
      `"${(record.notes || '').replace(/"/g, '""')}"`
    ];
    csvRows.push(row.join(','));
  }

  return csvRows.join('\n');
};

export const downloadCSV = (csvContent, filename = 'records.csv') => {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
};

export const handleDownloadCSV = (records, sellerPrefix = null) => {
  const csv = generateRecordCSV(records);
  const datePart = new Date().toISOString().split('T')[0];
  let namePart = '';
  
  if (sellerPrefix) {
    namePart = `-${sellerPrefix}`;
  }
  
  const safe = (s) => String(s || '').replace(/[^a-zA-Z0-9_.-]/g, '_');
  const filename = `${safe('records')}${safe(namePart)}-${safe(datePart)}.csv`;
  
  downloadCSV(csv, filename);
};
