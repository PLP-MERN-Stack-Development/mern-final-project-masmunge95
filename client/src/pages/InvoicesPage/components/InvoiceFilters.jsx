import React from 'react';

/**
 * Filter controls for invoices
 * Provides seller, customer, and service filter dropdowns
 */
export const InvoiceFilters = ({
  sellerFilter,
  setSellerFilter,
  customerFilter,
  setCustomerFilter,
  serviceFilter,
  setServiceFilter,
  sellerOptions = [],
  customerOptions = [],
  serviceOptions = [],
  onClearFilters
}) => {
  const hasActiveFilters = sellerFilter || customerFilter || serviceFilter;

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow mb-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Seller
          </label>
          <select
            value={sellerFilter}
            onChange={(e) => setSellerFilter(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Sellers</option>
            {sellerOptions.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>

        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Customer
          </label>
          <select
            value={customerFilter}
            onChange={(e) => setCustomerFilter(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Customers</option>
            {customerOptions.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>

        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Service
          </label>
          <select
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Services</option>
            {serviceOptions.map((svc) => (
              <option key={svc} value={svc}>{svc}</option>
            ))}
          </select>
        </div>

        {hasActiveFilters && (
          <button
            onClick={onClearFilters}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 
                       rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors
                       focus:outline-none focus:ring-2 focus:ring-gray-400"
          >
            Clear Filters
          </button>
        )}
      </div>
    </div>
  );
};
