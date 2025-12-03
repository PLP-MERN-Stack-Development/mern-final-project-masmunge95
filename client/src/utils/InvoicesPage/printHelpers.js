/**
 * Utility functions for printing invoices
 */

export const handlePrint = () => {
  window.print();
};

export const printInvoices = () => {
  // Store original title
  const originalTitle = document.title;
  
  // Set title for print
  document.title = 'Invoices';
  
  // Trigger print dialog
  window.print();
  
  // Restore original title after print dialog closes
  setTimeout(() => {
    document.title = originalTitle;
  }, 100);
};
