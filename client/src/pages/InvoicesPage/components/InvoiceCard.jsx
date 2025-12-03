import React, { useState } from 'react';

/**
 * Individual invoice card/row component
 * Displays invoice details and action buttons
 */
export const InvoiceCard = ({ invoice, onDelete, onView, isDeleting }) => {
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const handleDelete = async () => {
    if (!showConfirmDelete) {
      setShowConfirmDelete(true);
      return;
    }
    
    try {
      await onDelete(invoice._id);
      setShowConfirmDelete(false);
    } catch (err) {
      console.error('Failed to delete invoice:', err);
      setShowConfirmDelete(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'paid':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'overdue':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'draft':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  return (
    <tr className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
        {formatDate(invoice.dueDate)}
      </td>
      
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {invoice.customerName || '-'}
        </div>
        {invoice.customerEmail && (
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {invoice.customerEmail}
          </div>
        )}
      </td>
      
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
        {invoice.service || '-'}
      </td>
      
      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-gray-100">
        {formatCurrency(invoice.totalAmount)}
      </td>
      
      <td className="px-6 py-4 whitespace-nowrap">
        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(invoice.status)}`}>
          {invoice.status || 'draft'}
        </span>
      </td>
      
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
        <div className="flex justify-end gap-2">
          <button
            onClick={() => onView(invoice._id)}
            className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300
                       focus:outline-none focus:underline"
          >
            View
          </button>
          
          {!showConfirmDelete ? (
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300
                         focus:outline-none focus:underline disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
          ) : (
            <>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300
                           font-semibold focus:outline-none focus:underline"
              >
                Confirm
              </button>
              <button
                onClick={() => setShowConfirmDelete(false)}
                disabled={isDeleting}
                className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-300
                           focus:outline-none focus:underline"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
};
