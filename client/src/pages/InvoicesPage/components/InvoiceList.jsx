import React, { useState } from 'react';
import { InvoiceCard } from './InvoiceCard';

/**
 * List component for displaying invoices
 * Handles empty states, loading, and invoice rendering
 */
export const InvoiceList = ({ 
  invoices, 
  loading, 
  error,
  onDeleteInvoice,
  onViewInvoice,
  deletingInvoiceId 
}) => {
  const [sortBy, setSortBy] = useState('dueDate'); // dueDate, totalAmount, customerName
  const [sortOrder, setSortOrder] = useState('desc'); // asc, desc

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="ml-3 text-gray-600 dark:text-gray-400">Loading invoices...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 
                      rounded-lg p-4 text-red-700 dark:text-red-400">
        <p className="font-semibold">Error loading invoices</p>
        <p className="text-sm mt-1">{error}</p>
      </div>
    );
  }

  if (!invoices || invoices.length === 0) {
    return (
      <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 
                      rounded-lg p-8 text-center">
        <p className="text-gray-600 dark:text-gray-400 text-lg">No invoices found</p>
        <p className="text-gray-500 dark:text-gray-500 text-sm mt-2">
          Create your first invoice to get started
        </p>
      </div>
    );
  }

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const sortedInvoices = [...invoices].sort((a, b) => {
    let aVal, bVal;
    
    switch (sortBy) {
      case 'dueDate':
        aVal = new Date(a.dueDate || 0).getTime();
        bVal = new Date(b.dueDate || 0).getTime();
        break;
      case 'totalAmount':
        aVal = parseFloat(a.totalAmount || 0);
        bVal = parseFloat(b.totalAmount || 0);
        break;
      case 'customerName':
        aVal = (a.customerName || '').toLowerCase();
        bVal = (b.customerName || '').toLowerCase();
        break;
      default:
        return 0;
    }

    if (sortOrder === 'asc') {
      return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
    } else {
      return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
    }
  });

  const SortIcon = ({ field }) => {
    if (sortBy !== field) return <span className="text-gray-400">↕</span>;
    return <span className="text-blue-600">{sortOrder === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th 
                onClick={() => handleSort('dueDate')}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 
                           uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                Due Date <SortIcon field="dueDate" />
              </th>
              <th 
                onClick={() => handleSort('customerName')}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 
                           uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                Customer <SortIcon field="customerName" />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Service
              </th>
              <th 
                onClick={() => handleSort('totalAmount')}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 
                           uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                Amount <SortIcon field="totalAmount" />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {sortedInvoices.map((invoice) => (
              <InvoiceCard
                key={invoice._id}
                invoice={invoice}
                onDelete={onDeleteInvoice}
                onView={onViewInvoice}
                isDeleting={deletingInvoiceId === invoice._id}
              />
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="bg-gray-50 dark:bg-gray-900 px-6 py-3 text-sm text-gray-600 dark:text-gray-400">
        Showing {sortedInvoices.length} invoice{sortedInvoices.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
};
