import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import ClearLocalDataModal from './components/ClearLocalDataModal';
import { BrowserRouter, useNavigate } from 'react-router-dom';
import { ClerkProvider } from '@clerk/clerk-react';
import { Capacitor } from '@capacitor/core';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import db from './db';

// Import your publishable key
const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Publishable Key")
}

// Determine if running in Capacitor (native app)
const isNative = Capacitor.isNativePlatform();

function ClerkProviderWithNavigate({ children }) {
  const navigate = useNavigate();
  
  return (
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
      appearance={{
        baseTheme: undefined,
        variables: { colorPrimary: '#4F46E5' },
        layout: { socialButtonsPlacement: 'bottom' }
      }}
      navigate={(to) => navigate(to)}
      // Use new redirect props (avoid mixing old and new)
      signInFallbackRedirectUrl="/"
      signUpFallbackRedirectUrl="/select-role"
      // Custom URL scheme for native apps only
      {...(isNative && {
        clerkJSUrl: undefined,
        signInFallbackRedirectUrl: 'recordiq://oauth-callback',
        signUpFallbackRedirectUrl: 'recordiq://oauth-callback',
      })}
      // Add error logging
      onError={(error) => {
        console.error('[Clerk Error]:', error);
        if (error.message?.includes('allowed') || error.message?.includes('403')) {
          console.error('⚠️ CLERK RESTRICTION ERROR:');
          console.error('Go to https://dashboard.clerk.com/');
          console.error('1. User & Authentication → Restrictions');
          console.error('2. DISABLE all restrictions (allowlist/blocklist)');
          console.error('3. Email, Phone, Username → Enable sign-ups');
          console.error('4. Check if you are in Development mode (not Production)');
        }
      }}
    >
      {children}
    </ClerkProvider>
  );
}

// --- Service Worker Registration ---
// This code checks if the browser supports service workers and registers our file.
// It runs once the page has loaded to avoid delaying the initial render.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then((registration) => {
        console.log('[Main] Service Worker registered with scope:', registration.scope);
      })
      .catch((error) => {
        console.error('[Main] Service Worker registration failed:', error);
      });
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ClerkProviderWithNavigate>
        <ThemeProvider>
          <ToastProvider>
            {/* Ensure the clear-local-data modal mounts before App effects run so it
                registers its event listener early and avoids race conditions where
                `requestClearLocalData` emits before the modal is ready. */}
            <ClearLocalDataModal />
            <App />
          </ToastProvider>
        </ThemeProvider>
      </ClerkProviderWithNavigate>
    </BrowserRouter>
  </StrictMode>,
)

// Expose the Dexie `db` instance to the window when running under Cypress
// so E2E tests can seed and manipulate IndexedDB deterministically.
if (typeof window !== 'undefined' && window.Cypress) {
  try {
    // eslint-disable-next-line no-underscore-dangle
    window.db = db;
    // Optional helper for seeding convenience
    // eslint-disable-next-line no-underscore-dangle
    window.__seedIndexedDB = async (storeName, items) => {
      if (!window.db || !window.db[storeName]) return;
      await window.db[storeName].clear();
      if (items && items.length) await window.db[storeName].bulkAdd(items.map(i => ({ ...i })));
    };
  } catch (e) {
    // ignore in case window/db not writable
  }
}

// Dev-only: load DB diagnostic helper so `window.runDbDiag` is available
try {
  if (typeof import.meta !== 'undefined' && import.meta.env?.DEV && typeof window !== 'undefined') {
    import('./utils/dbDiag').then((mod) => {
      // module attaches runDbDiag to window; no further action needed
    }).catch((e) => { /* ignore diag import failures */ });
  }
} catch (e) { /* ignore */ }

// Feature-flag: optionally use the clean DB + sync services for debugging.
// Set `VITE_USE_CLEAN_DB=true` in client/.env or your dev environment to enable.
try {
  if (typeof import.meta !== 'undefined' && import.meta.env?.DEV && import.meta.env?.VITE_USE_CLEAN_DB === 'true' && typeof window !== 'undefined') {
    Promise.all([
      import('./db_clean'),
      import('./services/syncQueue'),
      import('./services/fullSync')
    ]).then(([dbCleanMod, syncQueueMod, fullSyncMod]) => {
      try {
        window.dbClean = dbCleanMod.default || dbCleanMod;
      } catch (e) {}
      try { window.syncQueueClean = syncQueueMod.default || syncQueueMod; } catch (e) {}
      try { window.fullSyncClean = fullSyncMod.default || fullSyncMod; } catch (e) {}

      // Also expose convenience aliases so the app can be tested against the
      // clean DB from the console: `window.db` will point to the clean DB.
      try { window.db = window.dbClean; } catch (e) {}

      console.log('[Main] VITE_USE_CLEAN_DB enabled: clean DB and services loaded on window');
    }).catch((e) => {
      console.warn('[Main] Failed to load clean DB modules:', e);
    });
  }
} catch (e) { /* ignore */ }
