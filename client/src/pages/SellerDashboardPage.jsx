import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { useTheme } from '../context/ThemeContext';
import { Link } from 'react-router-dom';
import Button from '../components/Button';
import { getInvoices } from '../services/invoiceService';
import { getCustomers } from '../services/customerService';
import * as dataSyncService from '../services/dataSyncService';
import db from '../db';
import QueueStatus from '../components/QueueStatus';
import CenteredLoader from '../components/CenteredLoader';

const SellerDashboardPage = () => {
  const { user } = useUser();
  const { theme } = useTheme();
  const [stats, setStats] = useState({ totalInvoices: 0, sentInvoices: 0, paidInvoices: 0, totalRevenue: 0 });
  const [recentInvoices, setRecentInvoices] = useState([]);
  const [topCustomers, setTopCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load from local DB and rely on dataSyncService to keep data in sync
  const [allInvoices, setAllInvoices] = useState([]);
  const [allCustomers, setAllCustomers] = useState([]);
  const [invoicesLoading, setInvoicesLoading] = useState(true);
  const [customersLoading, setCustomersLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setInvoicesLoading(true);
        setCustomersLoading(true);
        const invs = await db.invoices.toArray();
        const custs = await db.customers.toArray();
        if (!mounted) return;
        setAllInvoices(invs);
        setAllCustomers(custs);
      } catch (e) {
        console.error('Failed to load local dashboard data:', e);
        setError('Failed to load dashboard data.');
      } finally {
        if (mounted) {
          setInvoicesLoading(false);
          setCustomersLoading(false);
        }
      }

      const onChange = async () => {
        try {
          const invs = await db.invoices.toArray();
          const custs = await db.customers.toArray();
          if (mounted) {
            setAllInvoices(invs);
            setAllCustomers(custs);
          }
        } catch (e) {}
      };

      try {
        db.invoices.hook('created', onChange);
        db.invoices.hook('updating', onChange);
        db.invoices.hook('deleting', onChange);
        db.customers.hook('created', onChange);
        db.customers.hook('updating', onChange);
        db.customers.hook('deleting', onChange);
      } catch (e) {}

      // Per-page full-sync removed: central `dataSyncService` handles syncing.
    };

    load();

    // Reload when a full data sync has finished so dashboard reflects fresh server state
    const onSyncFinished = async () => {
      try {
        const invs = await db.invoices.toArray();
        const custs = await db.customers.toArray();
        if (mounted) {
          setAllInvoices(invs);
          setAllCustomers(custs);
        }
      } catch (e) {
        console.warn('[SellerDashboard] reload after sync failed', e);
      }
    };
    dataSyncService.on('sync:finished', onSyncFinished);
    dataSyncService.on('data:refreshed', onSyncFinished);

    return () => { mounted = false; };
  }, []);

  const textColor = theme === 'dark' ? 'text-white' : 'text-gray-900';
  const secondaryTextColor = theme === 'dark' ? 'text-gray-300' : 'text-gray-600';
  const cardBgColor = theme === 'dark' ? 'bg-gray-800' : 'bg-white';
  const borderColor = theme === 'dark' ? 'border-gray-700' : 'border-gray-200';

  useEffect(() => {
    // Whenever our offline-first data arrays change, compute stats from them.
    setLoading(invoicesLoading || customersLoading);

    try {
      const totalInvoices = allInvoices.length;
      const sentInvoices = allInvoices.filter(inv => inv.status === 'sent').length;
      const paidInvoices = allInvoices.filter(inv => inv.status === 'paid').length;
      const totalRevenue = allInvoices
        .filter(inv => inv.status === 'paid')
        .reduce((sum, inv) => sum + (Number(inv.total) || 0), 0);

      setStats({ totalInvoices, sentInvoices, paidInvoices, totalRevenue });

      const recent = [...allInvoices]
        .sort((a, b) => new Date(b.issueDate || 0) - new Date(a.issueDate || 0))
        .slice(0, 5);
      setRecentInvoices(recent);

      const customerMap = {};
      allInvoices.forEach(inv => {
        const customerId = inv.customerId || inv.customer;
        if (!customerMap[customerId]) {
          const customerInfo = allCustomers.find(c => String(c._id) === String(customerId));
          customerMap[customerId] = {
            customerId,
            customerName: customerInfo?.name || inv.customerName || 'Unknown',
            count: 0,
            totalAmount: 0,
          };
        }
        customerMap[customerId].count += 1;
        customerMap[customerId].totalAmount += Number(inv.total) || 0;
      });

      const topCustomersList = Object.values(customerMap)
        .sort((a, b) => b.totalAmount - a.totalAmount)
        .slice(0, 5);
      setTopCustomers(topCustomersList);
      setError(null);
    } catch (err) {
      console.error('Failed to update dashboard stats:', err);
      setError('Could not load dashboard data.');
    }
  }, [allInvoices, allCustomers, invoicesLoading, customersLoading]);

  const StatCard = ({ label, value, icon, color = 'red' }) => (
    <div className={`p-6 rounded-xl shadow-md backdrop-blur-sm transition-all hover:shadow-lg ${theme === 'dark' ? 'bg-gray-800/80 border border-gray-700/50' : 'bg-white/80 border border-gray-200/50'}`}>
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
          color === 'green' ? (theme === 'dark' ? 'bg-green-900/40' : 'bg-green-100') :
          color === 'blue' ? (theme === 'dark' ? 'bg-blue-900/40' : 'bg-blue-100') :
          color === 'purple' ? (theme === 'dark' ? 'bg-purple-900/40' : 'bg-purple-100') :
          (theme === 'dark' ? 'bg-red-900/40' : 'bg-red-100')
        }`}>
          {icon}
        </div>
        <div>
          <p className={`text-sm font-medium ${secondaryTextColor}`}>{label}</p>
          <p className={`text-3xl font-bold mt-1 ${
            color === 'green' ? 'text-green-600 dark:text-green-400' :
            color === 'blue' ? 'text-blue-600 dark:text-blue-400' :
            color === 'purple' ? 'text-purple-600 dark:text-purple-400' :
            'text-red-600 dark:text-red-400'
          }`}>{value}</p>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return <CenteredLoader message="Loading dashboard..." />;
  }

  return (
    <div className="px-3 sm:px-4 md:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Welcome Banner */}
      <div className={`mb-8 p-8 rounded-2xl shadow-xl backdrop-blur-sm ${theme === 'dark' ? 'bg-gray-800/90 border border-gray-700/50' : 'bg-white/90 border border-gray-200/50'}`}>
        <h1 className={`text-4xl font-bold ${textColor} mb-2`}>
          <span className="inline-flex items-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-10 w-10 ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Welcome back, {user?.firstName || 'Seller'}!
          </span>
        </h1>
        <p className={`text-lg ${secondaryTextColor}`}>Here's a quick overview of your business performance</p>
      </div>

      {/* Central queue / sync status - show for all users like CustomerDashboard */}
      <QueueStatus onDismiss={() => setError(null)} />

      {/* Statistics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard 
          label="Total Invoices" 
          value={stats.totalInvoices}
          color="blue"
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          }
        />
        <StatCard 
          label="Pending Payment" 
          value={stats.sentInvoices}
          color="purple"
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatCard 
          label="Paid Invoices" 
          value={stats.paidInvoices}
          color="green"
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatCard 
          label="Total Revenue" 
          value={`KSH ${stats.totalRevenue.toFixed(2)}`}
          color="green"
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - Recent Invoices */}
        <div className="lg:col-span-2 space-y-6">
          <div className={`p-6 rounded-xl shadow-md backdrop-blur-sm ${theme === 'dark' ? 'bg-gray-800/80 border border-gray-700/50' : 'bg-white/80 border border-gray-200/50'}`}>
            <div className="flex justify-between items-center mb-6">
              <h2 className={`text-2xl font-semibold ${textColor} flex items-center gap-2`}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Recent Invoices
              </h2>
              <Link to="/invoices">
                <Button variant="secondary" size="sm">View All</Button>
              </Link>
            </div>

            {recentInvoices.length > 0 ? (
              <div className="flow-root">
                <ul className={`divide-y ${theme === 'dark' ? 'divide-gray-700' : 'divide-gray-200'}`}>
                  {recentInvoices.map(invoice => (
                    <li key={invoice._id} className="py-3">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div className="flex-1">
                          <Link
                            to={`/invoices/${invoice._id}`}
                            className={`text-sm font-medium ${theme === 'dark' ? 'text-red-400 hover:text-red-300' : 'text-red-600 hover:text-red-700'} transition-colors`}
                          >
                            Invoice {invoice.invoiceNumber}
                          </Link>
                          <p className={`text-sm ${secondaryTextColor} truncate`}>{invoice.customerName || 'Unknown Customer'}</p>
                        </div>
                        <div className="flex justify-between sm:justify-end items-center gap-4">
                          <div className={`text-sm font-semibold ${textColor}`}>
                            KSH {(invoice.total || 0).toFixed(2)}
                          </div>
                          <span className={`text-xs font-medium px-2 py-1 rounded ${
                            invoice.status === 'paid'
                              ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200'
                              : invoice.status === 'sent'
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                              : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
                          }`}>
                            {invoice.status?.charAt(0).toUpperCase() + invoice.status?.slice(1) || 'Draft'}
                          </span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className={`text-center ${secondaryTextColor} py-8`}>No invoices yet. Create your first invoice!</p>
            )}
          </div>
        </div>

        {/* Right column - Quick Actions & Top Customers */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className={`p-6 rounded-xl shadow-md backdrop-blur-sm ${theme === 'dark' ? 'bg-gray-800/80 border border-gray-700/50' : 'bg-white/80 border border-gray-200/50'}`}>
            <h2 className={`text-2xl font-semibold ${textColor} mb-6 flex items-center gap-2`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Quick Actions
            </h2>
            <div className="space-y-3">
              <Link to="/invoices" className="block">
                <Button variant="primary" className="w-full">
                  <span className="flex items-center justify-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                    </svg>
                    Create Invoice
                  </span>
                </Button>
              </Link>
              <Link to="/customers" className="block">
                <Button variant="secondary" className="w-full">
                  <span className="flex items-center justify-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    Manage Customers
                  </span>
                </Button>
              </Link>
              <Link to="/records" className="block">
                <Button variant="secondary" className="w-full">
                  <span className="flex items-center justify-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2zM10 8.5a.5.5 0 11-1 0 .5.5 0 011 0zm5 5a.5.5 0 11-1 0 .5.5 0 011 0z" />
                    </svg>
                    View Records
                  </span>
                </Button>
              </Link>
              <Link to="/shared-records" className="block">
                <Button variant="secondary" className="w-full">
                  <span className="flex items-center justify-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                    Shared Records
                  </span>
                </Button>
              </Link>
              <Link to="/dispute-review" className="block">
                <Button variant="danger" className="w-full">
                  <span className="flex items-center justify-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    Review Disputes
                  </span>
                </Button>
              </Link>
            </div>
          </div>

          {/* Top Customers */}
          <div className={`p-6 rounded-xl shadow-md backdrop-blur-sm ${theme === 'dark' ? 'bg-gray-800/80 border border-gray-700/50' : 'bg-white/80 border border-gray-200/50'}`}>
            <h2 className={`text-2xl font-semibold ${textColor} mb-6 flex items-center gap-2`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
              Top Customers
            </h2>
            {topCustomers.length > 0 ? (
              <ul className={`space-y-3 ${secondaryTextColor}`}>
                {topCustomers.map((customer, idx) => (
                  <li key={customer.customerId} className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${textColor}`}>{idx + 1}. {customer.customerName}</p>
                      <p className="text-xs">{customer.count} invoice{customer.count !== 1 ? 's' : ''}</p>
                    </div>
                    <span className={`text-sm font-semibold ${textColor}`}>KSH {customer.totalAmount.toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={`text-center ${secondaryTextColor} py-4 text-sm`}>No customer data yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SellerDashboardPage;
