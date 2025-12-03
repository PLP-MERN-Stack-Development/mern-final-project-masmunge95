import React, { useEffect } from 'react';
import { Routes, Route, Outlet, Navigate, useNavigate } from 'react-router-dom';
import Layout from './components/Layout';
import { syncWithServer } from './services/syncService';
import db from './db';
import { useSession, useClerk } from '@clerk/clerk-react';
import { App as CapacitorApp } from '@capacitor/app';

// Import the new and renamed pages
import DashboardPage from './pages/DashboardPage';
import RecordsPage from './pages/RecordsPage';
import InvoicesPage from './pages/InvoicesPage';
import InvoiceDetailPage from './pages/InvoiceDetailPage';
import CustomersPage from './pages/CustomersPage';
import CustomerDetailPage from './pages/CustomerDetailPage';
import RecordDetailPage from './pages/RecordDetailPage';
import AboutPage from './pages/AboutPage';
import ContactPage from './pages/ContactPage';
import CustomerDashboardPage from './pages/CustomerDashboardPage';
import RoleSelectionPage from './pages/RoleSelectionPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import UtilityServicesPage from './pages/UtilityServicesPage';
import SellerDashboardPage from './pages/SellerDashboardPage';
import SubscriptionPage from './pages/SubscriptionPage';
import WalletPage from './pages/WalletPage';
import SharedRecordsPage from './pages/SharedRecordsPage';
import CustomerRecordsPage from './pages/CustomerRecordsPage';
import DisputeReviewPage from './pages/DisputeReviewPage';
import CenteredLoader from './components/CenteredLoader';

// Admin pages and route protection
import AdminRoute from './components/AdminRoute';
import AdminDashboardPage from './pages/AdminDashboardPage';
import AdminWithdrawalsPage from './pages/AdminWithdrawalsPage';
import AdminWalletsPage from './pages/AdminWalletsPage';
import AdminBillingPage from './pages/AdminBillingPage';
import AdminLedgerPage from './pages/AdminLedgerPage';
import ToastDemoPage from './pages/ToastDemoPage';
import DebugInvoicesPage from './pages/DebugInvoicesPage';
import ErrorBoundary from './components/ErrorBoundary';

const AppLayout = () => (
  <Layout>
    <Outlet />
  </Layout>
);

const PrivateRoute = ({ children }) => {
  const { isLoaded, session } = useSession();

  if (!isLoaded) {
    return <CenteredLoader message="Authenticating..." />;
  }

  if (!session) {
    return <Navigate to="/" />;
  }

  return children;
};

import { syncAllData } from './services/dataSyncService';
import { useRef } from 'react';
import * as dataSyncService from './services/dataSyncService';

function App() {
  const { session, isLoaded } = useSession();
  const clerk = useClerk();
  const navigate = useNavigate();
  const initialSyncDone = useRef(false);

  // Eagerly sync all data on startup when the user is authenticated
  useEffect(() => {
    // If user is authenticated, perform a ONE-TIME initial sync only when
    // the local DB appears empty. Otherwise prefer local DB for instant access.
    const tryInitialSyncIfEmpty = async () => {
      if (!session || initialSyncDone.current) return;
      try {
        // Check whether local DB has any of the primary tables populated
        const [invCount, recCount, custCount, svcCount] = await Promise.all([
          db.invoices.count(),
          db.records.count(),
          db.customers.count(),
          db.utilityServices.count(),
        ]);

        const totalLocal = (invCount || 0) + (recCount || 0) + (custCount || 0) + (svcCount || 0);
        // If any primary table is empty, perform an initial sync so all tables populate
        const anyEmpty = (invCount || 0) === 0 || (recCount || 0) === 0 || (custCount || 0) === 0 || (svcCount || 0) === 0;
        if (anyEmpty && navigator.onLine) {
          console.log('[App] One or more local tables are empty — performing one-time initial data sync.');
          await syncAllData();
          console.log('[App] Initial data sync successful.');
        } else {
          if (import.meta.env.DEV) console.log('[App] Local DB appears sufficiently populated, skipping initial full sync.');
        }
      } catch (e) {
        console.error('[App] Initial sync-if-empty failed:', e);
      } finally {
        initialSyncDone.current = true;
      }
    };

    tryInitialSyncIfEmpty();
  }, [session]);

  // Start auto-syncing (listens for online events)
  useEffect(() => {
    dataSyncService.startAutoSync();
    return () => dataSyncService.stopAutoSync();
  }, []);

  // Handle deep links from OAuth redirects
  useEffect(() => {
    const handleAppUrlOpen = async (event) => {
      const url = event.url;
      console.log('[App] Deep link received:', url);
      
      // Check if this is a Clerk OAuth callback
      if (url && url.includes('__clerk')) {
        console.log('[App] Clerk OAuth callback detected');
        
        // Extract the full URL with query parameters
        try {
          const urlObj = new URL(url);
          const clerkHandshake = urlObj.searchParams.get('__clerk_handshake');
          
          if (clerkHandshake) {
            console.log('[App] Processing Clerk handshake...');
            // Clerk will automatically detect and process the handshake from the URL
            // We just need to wait for it to complete
            window.location.href = url; // Let Clerk process the full URL
          }
        } catch (error) {
          console.error('[App] Error processing deep link:', error);
        }
      }
    };

    // Listen for app URL open events (deep links)
    CapacitorApp.addListener('appUrlOpen', handleAppUrlOpen);

    return () => {
      CapacitorApp.removeAllListeners();
    };
  }, [clerk, navigate]);

  // Debug Clerk state on mount and when session changes
  useEffect(() => {
    if (isLoaded) {
      console.log('[App] Clerk loaded. Session:', session?.id || 'No session');
      console.log('[App] User:', session?.user?.id || 'No user');
      console.log('[App] Clerk object:', window.Clerk);
      // If the authenticated user changed, ask in-app whether to clear local DB
      try {
        const LOCAL_USER_KEY = 'recordiq_localUserId';
        const currentUser = session?.user?.id || null;
        const stored = localStorage.getItem(LOCAL_USER_KEY);
        if (currentUser && stored && String(stored) !== String(currentUser)) {
          // Hybrid: if no pending outgoing items, auto-clear; otherwise present modal with options
          (async () => {
            try {
              const pendingCount = await (db.syncQueue && typeof db.syncQueue.count === 'function' ? db.syncQueue.count() : 0);
              if (!pendingCount) {
                console.log('[App] No pending outgoing items — auto-clearing local DB due to sign-in user change', { from: stored, to: currentUser });
                await dataSyncService.clearLocalData(currentUser);
                return;
              }

              // There are pending items — ask user what to do
              const action = await dataSyncService.requestClearLocalData({ from: stored, to: currentUser, pendingCount });
              if (action === 'clear') {
                console.log('[App] User chose to clear local DB on sign-in', { from: stored, to: currentUser });
                await dataSyncService.clearLocalData(currentUser);
              } else if (action === 'sync') {
                console.log('[App] User chose to sync outgoing items on sign-in', { from: stored, to: currentUser });
                try {
                  await syncWithServer();
                  await dataSyncService.clearLocalData(currentUser);
                } catch (syncErr) {
                  console.error('[App] Sync failed when attempting to flush outgoing items before clear', syncErr);
                }
              } else {
                console.warn('[App] User cancelled clearing local DB on sign-in');
              }
            } catch (err) {
              console.error('[App] Hybrid sign-in clear flow failed', err);
            }
          })();
        }
      } catch (e) {
        console.warn('[App] user-change check failed', e);
      }
    }
  }, [isLoaded, session]);

  // Periodically sync the queue with the server (every 5 seconds)
  useEffect(() => {
    let isMounted = true;
    
    const syncInterval = setInterval(async () => {
      if (!isMounted) return;
      try {
        // Only process outgoing queue here. Full syncs are controlled centrally
        // (one-time at startup if DB empty, or via dataSyncService on online events).
        const pendingCount = await db.syncQueue.count();
        if (pendingCount > 0 && navigator.onLine) {
          if (import.meta.env.DEV) console.log(`[App] Triggering sync for ${pendingCount} pending items.`);
          await syncWithServer();
        }
      } catch (error) {
        console.error('[App] Sync error (non-blocking):', error);
        // Don't rethrow - we want sync errors to not crash the app
      }
    }, 5000); // Sync every 5 seconds if there are pending items

    return () => {
      isMounted = false;
      clearInterval(syncInterval);
    };
  }, [session]);

  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/" element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
          <Route path="/sign-in" element={<Navigate to="/" />} />
          <Route path="/sign-up" element={<Navigate to="/" />} />
          
          <Route path="records" element={<PrivateRoute><RecordsPage /></PrivateRoute>} />
          <Route path="records/:id" element={<PrivateRoute><RecordDetailPage /></PrivateRoute>} />
          <Route path="records/:id/verify" element={<PrivateRoute><RecordDetailPage /></PrivateRoute>} />
          <Route path="invoices" element={<PrivateRoute><InvoicesPage /></PrivateRoute>} />
          <Route path="invoices/:id" element={<PrivateRoute><InvoiceDetailPage /></PrivateRoute>} />
          <Route path="customers" element={<PrivateRoute><CustomersPage /></PrivateRoute>} />
          <Route path="customers/:id" element={<PrivateRoute><CustomerDetailPage /></PrivateRoute>} />
          <Route path="customer-dashboard" element={<PrivateRoute><CustomerDashboardPage /></PrivateRoute>} />
          <Route path="seller-dashboard" element={<PrivateRoute><SellerDashboardPage /></PrivateRoute>} />
          <Route path="select-role" element={<PrivateRoute><RoleSelectionPage /></PrivateRoute>} />
          <Route path="subscription" element={<PrivateRoute><SubscriptionPage /></PrivateRoute>} />
          <Route path="wallet" element={<PrivateRoute><WalletPage /></PrivateRoute>} />
          <Route path="shared-records" element={<PrivateRoute><SharedRecordsPage /></PrivateRoute>} />
          <Route path="customer-records" element={<PrivateRoute><CustomerRecordsPage /></PrivateRoute>} />
          <Route path="dispute-review" element={<PrivateRoute><DisputeReviewPage /></PrivateRoute>} />

          {/* Admin Routes - Protected by AdminRoute component */}
          <Route path="admin" element={<AdminRoute><AdminDashboardPage /></AdminRoute>} />
          <Route path="admin/withdrawals" element={<AdminRoute><AdminWithdrawalsPage /></AdminRoute>} />
          <Route path="admin/wallets" element={<AdminRoute><AdminWalletsPage /></AdminRoute>} />
          <Route path="admin/billing" element={<AdminRoute><AdminBillingPage /></AdminRoute>} />
          <Route path="admin/ledger" element={<AdminRoute><AdminLedgerPage /></AdminRoute>} />

          <Route path="about" element={<AboutPage />} />
          <Route path="contact" element={<ContactPage />} />
          <Route path="services" element={<UtilityServicesPage />} />
          <Route path="privacy-policy" element={<PrivacyPolicyPage />} />
          <Route path="toast-demo" element={<ToastDemoPage />} />
          <Route path="debug-invoices" element={<PrivateRoute><DebugInvoicesPage /></PrivateRoute>} />
        </Route>
      </Routes>
    </ErrorBoundary>
  );
}

export default App;
