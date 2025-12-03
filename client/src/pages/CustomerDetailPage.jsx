import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useAuth, useUser } from '@clerk/clerk-react';
import Button from '../components/Button';
import db from '../db';
import { sanitizeForDb, firstOrUndefined } from '../utils/dbUtils';
import { deepSanitizeAsync } from '../services/queueService';
import { getCustomers } from '../services/customerService';
import { getInvoices } from '../services/invoiceService';
import * as dataSyncService from '../services/dataSyncService';
import QueueStatus from '../components/QueueStatus';
import CenteredLoader from '../components/CenteredLoader';
import { enqueue } from '../services/queueService';

const CustomerDetailPage = () => {
  const { id } = useParams();
  const { theme } = useTheme();
  const { isLoaded } = useAuth();
  const { user } = useUser();

  const [customer, setCustomer] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '' });

  useEffect(() => {
    if (!isLoaded) return;
    // We rely on useOfflineFirst (below) to populate customers and invoices in the local DB.
    // Here we just read the latest local values for immediate UI.
    const readLocal = async () => {
      try {
        setLoading(true);
        const localCustomer = await db.customers.where('_id').equals(String(id)).first();
        if (localCustomer) {
          setCustomer(localCustomer);
          setFormData({ name: localCustomer.name || '', email: localCustomer.email || '', phone: localCustomer.phone || '' });
        }

        const customerInvoices = await db.invoices
          .where('customerId')
          .equals(String(id))
          .toArray();
        setInvoices(customerInvoices.sort((a, b) => new Date(b.dueDate) - new Date(a.dueDate)));
        setError(null);
      } catch (err) {
        console.error('Failed to read local customer details:', err);
        setError('Failed to load customer details.');
      } finally {
        setLoading(false);
      }
    };

    readLocal();
  }, [id, isLoaded]);

  // Per-page full-sync removed: central `dataSyncService` handles syncing.

  const handleUpdateCustomer = async (e) => {
    e.preventDefault();
    if (!customer) return;

    try {
      // Update in local DB
      const existing = await firstOrUndefined(db.customers.where('_id').equals(String(id)));
      const localData = Object.assign({}, formData, { syncStatus: 'pending' });
      const cleanLocal = await deepSanitizeAsync(localData);
      if (existing && existing.id !== undefined) {
        await db.customers.update(existing.id, cleanLocal);
      } else {
        await db.customers.put(Object.assign({ _id: id }, cleanLocal));
      }

      // Queue for server sync
      await enqueue({
        entity: 'customers',
        action: 'update',
        entityId: id,
        payload: formData,
        timestamp: new Date().toISOString(),
      });

      // Reload customer data
      const updated = await firstOrUndefined(db.customers.where('_id').equals(String(id)));
      setCustomer(updated);
      setEditMode(false);
    } catch (err) {
      setError('Failed to update customer.');
      console.error('Update error:', err);
    }
  };

  const textColor = theme === 'dark' ? 'text-white' : 'text-gray-900';
  const secondaryTextColor = theme === 'dark' ? 'text-gray-300' : 'text-gray-600';
  const inputBg = theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-gray-900';
  const cardBg = theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';
  const focusRing = 'focus:border-red-500 focus:ring-red-500';

  if (loading) return <CenteredLoader message="Loading customer details..." />;
  if (!customer) return (
    <div className="p-8 text-center">
      <p className={textColor}>Customer not found.</p>
      <Link to="/customers" className="text-red-600 dark:text-red-400 hover:underline mt-4">← Back to Customers</Link>
    </div>
  );

  return (
    <div className="px-3 sm:px-4 md:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Back Navigation */}
      <div className="mb-6">
        <Link to="/customers" className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:underline dark:text-blue-400">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
          Back to Customers
        </Link>
      </div>

      {/* Central queue / sync status */}
      <QueueStatus onDismiss={() => setError(null)} />

      {error && (
        <div className="mb-6 p-4 bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300 rounded-lg border border-red-200 dark:border-red-800">
          {error}
        </div>
      )}

      {/* Customer Info Card */}
      <div className={`p-8 rounded-2xl shadow-xl backdrop-blur-sm mb-8 ${theme === 'dark' ? 'bg-gray-800/90 border border-gray-700/50' : 'bg-white/90 border border-gray-200/50'}`}>
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6 mb-6">
          <div className="flex items-start gap-4">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0 ${
              theme === 'dark' ? 'bg-red-900/40' : 'bg-red-100'
            }`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <h1 className={`text-4xl font-bold ${textColor} mb-2`}>{customer.name}</h1>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${
                customer.isActive
                  ? theme === 'dark' ? 'bg-green-900/40 text-green-300' : 'bg-green-100 text-green-800'
                  : theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-800'
              }`}>
                <span className={`w-2 h-2 rounded-full ${customer.isActive ? 'bg-green-500' : 'bg-gray-500'}`}></span>
                {customer.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
          {!editMode && (
            <Button onClick={() => setEditMode(true)} variant="secondary">
              <span className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                </svg>
                Edit
              </span>
            </Button>
          )}
        </div>

        {editMode ? (
          <form onSubmit={handleUpdateCustomer} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={`block mb-2 text-sm font-medium ${secondaryTextColor}`}>Full Name</label>
                <input
                  type="text"
                  placeholder="Name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className={`w-full px-4 py-3 border rounded-lg transition-all ${inputBg} ${focusRing}`}
                />
              </div>
              <div>
                <label className={`block mb-2 text-sm font-medium ${secondaryTextColor}`}>Email Address</label>
                <input
                  type="email"
                  placeholder="Email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className={`w-full px-4 py-3 border rounded-lg transition-all ${inputBg} ${focusRing}`}
                />
              </div>
              <div>
                <label className={`block mb-2 text-sm font-medium ${secondaryTextColor}`}>Phone Number</label>
                <input
                  type="tel"
                  placeholder="Phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className={`w-full px-4 py-3 border rounded-lg transition-all ${inputBg} ${focusRing}`}
                />
              </div>
            </div>
            <div className="flex justify-end gap-4 pt-4">
              <Button type="button" variant="secondary" onClick={() => setEditMode(false)}>Cancel</Button>
              <Button type="submit" variant="primary">Save Changes</Button>
            </div>
          </form>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className={`p-4 rounded-lg border ${theme === 'dark' ? 'bg-gray-700/30 border-gray-600/50' : 'bg-gray-50/50 border-gray-200/50'}`}>
              <div className="flex items-start gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 mt-0.5 ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <div>
                  <p className={`text-sm font-medium ${secondaryTextColor} mb-1`}>Email Address</p>
                  <p className={`text-base font-semibold ${textColor}`}>{customer.email || 'Not provided'}</p>
                </div>
              </div>
            </div>
            <div className={`p-4 rounded-lg border ${theme === 'dark' ? 'bg-gray-700/30 border-gray-600/50' : 'bg-gray-50/50 border-gray-200/50'}`}>
              <div className="flex items-start gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 mt-0.5 ${theme === 'dark' ? 'text-purple-400' : 'text-purple-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <div>
                  <p className={`text-sm font-medium ${secondaryTextColor} mb-1`}>Phone Number</p>
                  <p className={`text-base font-semibold ${textColor}`}>{customer.phone || 'Not provided'}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Invoice Statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
        <div className={`p-6 rounded-xl shadow-md backdrop-blur-sm transition-all hover:shadow-lg ${theme === 'dark' ? 'bg-gray-800/80 border border-gray-700/50' : 'bg-white/80 border border-gray-200/50'}`}>
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              theme === 'dark' ? 'bg-blue-900/40' : 'bg-blue-100'
            }`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <p className={`text-sm font-medium ${secondaryTextColor}`}>Total Invoices</p>
              <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-1">{invoices.length}</p>
            </div>
          </div>
        </div>
        <div className={`p-6 rounded-xl shadow-md backdrop-blur-sm transition-all hover:shadow-lg ${theme === 'dark' ? 'bg-gray-800/80 border border-gray-700/50' : 'bg-white/80 border border-gray-200/50'}`}>
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              theme === 'dark' ? 'bg-green-900/40' : 'bg-green-100'
            }`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-600 dark:text-green-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <p className={`text-sm font-medium ${secondaryTextColor}`}>Paid</p>
              <p className="text-3xl font-bold text-green-600 dark:text-green-400 mt-1">{invoices.filter(inv => inv.status === 'paid').length}</p>
            </div>
          </div>
        </div>
        <div className={`p-6 rounded-xl shadow-md backdrop-blur-sm transition-all hover:shadow-lg ${theme === 'dark' ? 'bg-gray-800/80 border border-gray-700/50' : 'bg-white/80 border border-gray-200/50'}`}>
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              theme === 'dark' ? 'bg-purple-900/40' : 'bg-purple-100'
            }`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className={`text-sm font-medium ${secondaryTextColor}`}>Total Value</p>
              <p className="text-3xl font-bold text-purple-600 dark:text-purple-400 mt-1">KSH {invoices.reduce((sum, inv) => sum + (Number(inv.total) || 0), 0).toFixed(0)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Invoice History */}
      <div className={`p-6 rounded-xl shadow-md backdrop-blur-sm ${theme === 'dark' ? 'bg-gray-800/80 border border-gray-700/50' : 'bg-white/80 border border-gray-200/50'}`}>
        <h2 className={`text-2xl font-semibold ${textColor} mb-6 flex items-center gap-2`}>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          Invoice History
        </h2>
        {invoices.length > 0 ? (
          <div className="space-y-4">
            {invoices.map((invoice) => (
              <Link
                key={invoice._id}
                to={`/invoices/${invoice._id}`}
                className={`block p-6 rounded-lg shadow-md border transition-all hover:shadow-lg ${
                  theme === 'dark'
                    ? 'bg-gray-700/50 border-gray-600/50 hover:bg-gray-700/70'
                    : 'bg-white border-gray-200 hover:border-red-300'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                      theme === 'dark' ? 'bg-red-900/40' : 'bg-red-100'
                    }`}>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className={`text-xl font-semibold ${textColor} mb-1`}>Invoice #{invoice.invoiceNumber}</h3>
                      <div className="flex items-center gap-2 mb-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${secondaryTextColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <p className={`text-sm ${secondaryTextColor}`}>Due: {new Date(invoice.dueDate).toLocaleDateString()}</p>
                      </div>
                      <span className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium ${
                        invoice.status === 'paid'
                          ? theme === 'dark' ? 'bg-green-900/40 text-green-300' : 'bg-green-100 text-green-800'
                          : invoice.status === 'sent'
                          ? theme === 'dark' ? 'bg-blue-900/40 text-blue-300' : 'bg-blue-100 text-blue-800'
                          : theme === 'dark' ? 'bg-yellow-900/40 text-yellow-300' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {invoice.status === 'paid' ? (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                          </svg>
                        )}
                        {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                      </span>
                    </div>
                  </div>
                  <div className="text-left md:text-right">
                    <p className={`text-3xl font-bold ${theme === 'dark' ? 'text-red-400' : 'text-red-600'} mb-2`}>
                      KSH {(Number(invoice.total) || 0).toFixed(2)}
                    </p>
                    <Button variant="primary" size="sm">
                      <span className="flex items-center gap-1">
                        View Invoice
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                      </span>
                    </Button>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className={`w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center ${
              theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-100'
            }`}>
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-10 w-10 ${secondaryTextColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className={`text-2xl font-bold ${textColor} mb-2`}>No Invoices Yet</h3>
            <p className={`text-lg ${secondaryTextColor} mb-4`}>This customer doesn't have any invoices</p>
            <Link to="/invoices">
              <Button variant="primary">Create First Invoice</Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerDetailPage;
