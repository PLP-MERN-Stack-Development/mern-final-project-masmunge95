import React from 'react';

/**
 * Header component for InvoicesPage
 * Shows title, create button, and action buttons
 */
export const InvoiceHeader = ({ 
  onCreateClick, 
  onPrintClick, 
  onDownloadCSV, 
  showAddForm,
  queueLength = 0 
}) => {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Invoices
        </h1>
        {queueLength > 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {queueLength} pending sync operation{queueLength !== 1 ? 's' : ''}
          </p>
        )}
      </div>
      
      <div className="flex gap-2">
        {!showAddForm && (
          <button
            onClick={onCreateClick}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 
                       transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Create Invoice
          </button>
        )}
        
        <button
          onClick={onPrintClick}
          className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 
                     transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500"
          title="Print Invoices"
        >
          Print
        </button>
        
        <button
          onClick={onDownloadCSV}
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 
                     transition-colors focus:outline-none focus:ring-2 focus:ring-green-500"
          title="Download CSV"
        >
          CSV
        </button>
      </div>
    </div>
  );
};
