/**
 * Utility functions for CSV export of invoices
 */

export const generateInvoiceCSV = (invoices) => {
  if (!invoices || invoices.length === 0) {
    return 'No invoices to export';
  }

  const headers = [
    'ID',
    'Customer Name',
    'Customer Email',
    'Seller Name',
    'Service',
    'Due Date',
    'Issue Date',
    'Total Amount',
    'Status',
    'Sync Status'
  ];

  const csvRows = [headers.join(',')];

  for (const inv of invoices) {
    const row = [
      inv._id || '',
      `"${(inv.customerName || '').replace(/"/g, '""')}"`,
      `"${(inv.customerEmail || '').replace(/"/g, '""')}"`,
      `"${(inv.sellerName || '').replace(/"/g, '""')}"`,
      `"${(inv.service || '').replace(/"/g, '""')}"`,
      inv.dueDate || '',
      inv.issueDate || '',
      inv.totalAmount || 0,
      inv.status || 'draft',
      inv.syncStatus || 'unknown'
    ];
    csvRows.push(row.join(','));
  }

  return csvRows.join('\n');
};

export const downloadCSV = (csvContent, filename = 'invoices.csv') => {
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
  }
};

export const handleDownloadCSV = (invoices) => {
  const csv = generateInvoiceCSV(invoices);
  const timestamp = new Date().toISOString().split('T')[0];
  downloadCSV(csv, `invoices-${timestamp}.csv`);
};
