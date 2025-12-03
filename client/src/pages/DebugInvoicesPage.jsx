import React, { useEffect, useState } from 'react';
import db from '../db';

/**
 * Debug page to check what data is in the local database
 * Navigate to /debug-invoices to see raw invoice data
 */
const DebugInvoicesPage = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch from local IndexedDB - use reverse() on id which is always indexed
        const data = await db.invoices.orderBy('id').reverse().limit(5).toArray();
        setInvoices(data || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <div className="p-8">Loading...</div>;
  if (error) return <div className="p-8 text-red-600">Error: {error}</div>;

  return (
    <div className="p-8 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
        Invoice Database Debug Output
      </h1>
      <p className="mb-4 text-gray-600 dark:text-gray-400">
        Showing last {invoices.length} invoices from local IndexedDB
      </p>

      {invoices.map((invoice) => (
        <div
          key={invoice._id}
          className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow"
        >
          <h2 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">
            Invoice: {invoice.invoiceNumber || invoice._id}
          </h2>
          
          <div className="space-y-2 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div className="text-gray-600 dark:text-gray-400">Customer:</div>
              <div className="text-gray-900 dark:text-white">{invoice.customerName || 'N/A'}</div>
              
              <div className="text-gray-600 dark:text-gray-400">Status:</div>
              <div className="text-gray-900 dark:text-white">{invoice.status || 'N/A'}</div>
              
              <div className="text-gray-600 dark:text-gray-400">Total:</div>
              <div className="text-gray-900 dark:text-white">${invoice.total || 0}</div>
              
              <div className="text-gray-600 dark:text-gray-400">Dispute Status:</div>
              <div className={`font-bold ${
                invoice.disputeStatus && invoice.disputeStatus !== 'none'
                  ? 'text-orange-600 dark:text-orange-400'
                  : 'text-green-600 dark:text-green-400'
              }`}>
                {invoice.disputeStatus || 'FIELD MISSING ❌'}
              </div>
              
              <div className="text-gray-600 dark:text-gray-400">Disputes Array:</div>
              <div className="text-gray-900 dark:text-white">
                {invoice.disputes 
                  ? `${invoice.disputes.length} dispute(s)` 
                  : 'FIELD MISSING ❌'}
              </div>
            </div>

            {invoice.disputes && invoice.disputes.length > 0 && (
              <div className="mt-4 p-3 bg-orange-50 dark:bg-orange-900/20 rounded">
                <h3 className="font-semibold mb-2 text-orange-900 dark:text-orange-300">
                  Disputes:
                </h3>
                {invoice.disputes.map((dispute, idx) => (
                  <div key={idx} className="ml-4 mb-2 text-gray-700 dark:text-gray-300">
                    <div>• Reason: {dispute.reason}</div>
                    <div>• Status: {dispute.status}</div>
                    <div>• Line Item: {dispute.lineItemIndex ?? 'N/A'}</div>
                  </div>
                ))}
              </div>
            )}

            <details className="mt-4">
              <summary className="cursor-pointer text-blue-600 dark:text-blue-400 hover:underline">
                Show Full JSON
              </summary>
              <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-700 rounded text-xs overflow-auto">
                {JSON.stringify(invoice, null, 2)}
              </pre>
            </details>
          </div>
        </div>
      ))}

      {invoices.length === 0 && (
        <div className="p-8 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
          <p className="text-yellow-800 dark:text-yellow-300">
            No invoices found. Create some invoices first.
          </p>
        </div>
      )}
    </div>
  );
};

export default DebugInvoicesPage;
