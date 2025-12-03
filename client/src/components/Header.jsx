import React, { useState, useEffect } from 'react';
import { SignedIn, SignedOut, UserButton, SignInButton, useUser } from '@clerk/clerk-react';
import { Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import Button from './Button';
import db from '../db';

const MenuIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
  </svg>
);

const CloseIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const SunIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

const MoonIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
  </svg>
);

const NavLink = ({ to, children, onClick, theme }) => (
  <Link
    to={to}
    onClick={onClick}
    className={`text-sm font-medium transition-colors ${
      theme === 'dark'
        ? 'text-gray-400 hover:text-white'
        : 'text-gray-500 hover:text-gray-900'
    }`}
  >
    {children}
  </Link>
);

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { user } = useUser();
  const isSeller = user?.publicMetadata?.role === 'seller';
  const isAdmin = user?.publicMetadata?.role === 'admin';
  const [queueCount, setQueueCount] = useState(0);

  useEffect(() => {
    let mounted = true;
    const updateCount = async () => {
      try {
        const c = await db.syncQueue.count();
        if (mounted) setQueueCount(c);
      } catch (_e) {
        /* ignore errors counting queue */
      }
    };

    updateCount();

    const hookListener = async () => { await updateCount(); };
    try {
      db.syncQueue.hook('created', hookListener);
      db.syncQueue.hook('updated', hookListener);
      db.syncQueue.hook('deleted', hookListener);
    } catch (_e) { /* ignore hook attach errors */ }

    // Poll periodically as a fallback (every 5s)
    const interval = setInterval(updateCount, 5000);

    return () => {
      mounted = false;
      clearInterval(interval);
      try {
        db.syncQueue.hook('created').unsubscribe(hookListener);
        db.syncQueue.hook('updated').unsubscribe(hookListener);
        db.syncQueue.hook('deleted').unsubscribe(hookListener);
      } catch (_e) { /* ignore unsubscribe errors */ }
    };
  }, []);

  const closeMenu = () => setIsMenuOpen(false);

  return (
    <>
      <header
        className={`sticky top-0 z-40 border-b backdrop-blur-lg ${
          theme === 'dark'
            ? 'bg-gray-900/80 border-gray-800'
            : 'bg-white/80 border-red-100'
        }`}
      >
        <div className="container mx-auto px-3 sm:px-6 lg:px-8 flex items-center justify-between h-14 sm:h-16">
          <Link to="/" className="flex items-center gap-1.5 sm:gap-2 font-bold text-base sm:text-lg md:text-xl text-red-600 hover:opacity-80 transition-opacity flex-shrink-0">
            <img src="/recordiq.svg" alt="RecordIQ" className="h-6 sm:h-7 md:h-8 w-auto" />
            <span className="hidden sm:inline">RecordIQ</span>
            {queueCount > 0 && (
              <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-red-600 text-white text-xs font-semibold" aria-label={`${queueCount} queued items`}>
                {queueCount}
              </span>
            )}
          </Link>
          <div className="hidden md:flex items-center gap-4">
            {user && isAdmin && (
              <>
                <NavLink to="/admin" theme={theme}>Admin</NavLink>
              </>
            )}
            {user && isSeller && (
              <>
                <NavLink to="/seller-dashboard" theme={theme}>Dashboard</NavLink>
                <NavLink to="/records" theme={theme}>Records</NavLink>
                <NavLink to="/invoices" theme={theme}>Invoices</NavLink>
                <NavLink to="/customers" theme={theme}>Customers</NavLink>
                <NavLink to="/services" theme={theme}>Services</NavLink>
                <NavLink to="/dispute-review" theme={theme}>Disputes</NavLink>
                <NavLink to="/wallet" theme={theme}>Wallet</NavLink>
                <NavLink to="/subscription" theme={theme}>Subscription</NavLink>
              </>
            )}
            {user && !isSeller && !isAdmin && (
              <>
                <NavLink to="/customer-dashboard" theme={theme}>My Dashboard</NavLink>
                <NavLink to="/customer-records" theme={theme}>My Records</NavLink>
                <NavLink to="/shared-records" theme={theme}>Shared Records</NavLink>
              </>
            )}
            <NavLink to="/about" theme={theme}>About</NavLink>
            <NavLink to="/contact" theme={theme}>Contact</NavLink>
            <NavLink to="/privacy-policy" theme={theme}>Privacy</NavLink>
            <Button variant="secondary" onClick={toggleTheme}>
              {theme === 'light' ? <MoonIcon /> : <SunIcon />}
            </Button>
            <SignedIn>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
          </div>
          <div className="md:hidden flex items-center gap-2">
            <Button variant="secondary" onClick={toggleTheme}>
              {theme === 'light' ? <MoonIcon /> : <SunIcon />}
            </Button>
            <Button variant="secondary" onClick={() => setIsMenuOpen(!isMenuOpen)}>
              {isMenuOpen ? <CloseIcon /> : <MenuIcon />}
            </Button>
          </div>
        </div>
        {isMenuOpen && (
          <div
            className={`md:hidden border-t flex flex-col gap-2 px-4 py-3 ${
              theme === 'dark' ? 'border-gray-800 bg-gray-800/50' : 'border-gray-200 bg-gray-50/50'
            }`}
          >
            {user && isAdmin && (
              <>
                <Link to="/admin" onClick={closeMenu} className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${theme === 'dark' ? 'text-gray-400 hover:bg-gray-700 hover:text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`}>Admin Dashboard</Link>
              </>
            )}
            {user && isSeller && (
              <>
                <Link to="/seller-dashboard" onClick={closeMenu} className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${theme === 'dark' ? 'text-gray-400 hover:bg-gray-700 hover:text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`}>Dashboard</Link>
                <Link to="/records" onClick={closeMenu} className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${theme === 'dark' ? 'text-gray-400 hover:bg-gray-700 hover:text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`}>Records</Link>
                <Link to="/invoices" onClick={closeMenu} className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${theme === 'dark' ? 'text-gray-400 hover:bg-gray-700 hover:text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`}>Invoices</Link>
                <Link to="/customers" onClick={closeMenu} className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${theme === 'dark' ? 'text-gray-400 hover:bg-gray-700 hover:text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`}>Customers</Link>
                <Link to="/services" onClick={closeMenu} className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${theme === 'dark' ? 'text-gray-400 hover:bg-gray-700 hover:text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`}>Services</Link>
                <Link to="/shared-records" onClick={closeMenu} className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${theme === 'dark' ? 'text-gray-400 hover:bg-gray-700 hover:text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`}>Shared Records</Link>
                <Link to="/dispute-review" onClick={closeMenu} className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${theme === 'dark' ? 'text-gray-400 hover:bg-gray-700 hover:text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`}>Disputes</Link>
                <Link to="/wallet" onClick={closeMenu} className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${theme === 'dark' ? 'text-gray-400 hover:bg-gray-700 hover:text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`}>Wallet</Link>
                <Link to="/subscription" onClick={closeMenu} className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${theme === 'dark' ? 'text-gray-400 hover:bg-gray-700 hover:text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`}>Subscription</Link>
              </>
            )}
            {user && !isSeller && !isAdmin && (
              <>
                <Link to="/customer-dashboard" onClick={closeMenu} className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${theme === 'dark' ? 'text-gray-400 hover:bg-gray-700 hover:text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`}>My Dashboard</Link>
                <Link to="/customer-records" onClick={closeMenu} className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${theme === 'dark' ? 'text-gray-400 hover:bg-gray-700 hover:text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`}>My Records</Link>
                <Link to="/shared-records" onClick={closeMenu} className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${theme === 'dark' ? 'text-gray-400 hover:bg-gray-700 hover:text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`}>Shared Records</Link>
              </>
            )}
            <SignedOut>
              <Link to="/" onClick={closeMenu} className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${theme === 'dark' ? 'text-gray-400 hover:bg-gray-700 hover:text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`}>Dashboard</Link>
            </SignedOut>
            <hr className={`my-1 ${theme === 'dark' ? 'border-gray-700' : 'border-gray-300'}`} />
            <Link to="/about" onClick={closeMenu} className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${theme === 'dark' ? 'text-gray-400 hover:bg-gray-700 hover:text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`}>About</Link>
            <Link to="/contact" onClick={closeMenu} className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${theme === 'dark' ? 'text-gray-400 hover:bg-gray-700 hover:text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`}>Contact</Link>
            <Link to="/privacy-policy" onClick={closeMenu} className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${theme === 'dark' ? 'text-gray-400 hover:bg-gray-700 hover:text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`}>Privacy Policy</Link>
            <hr className={`my-1 ${theme === 'dark' ? 'border-gray-700' : 'border-gray-300'}`} />
            <SignedIn>
              <div className="px-3 py-2 flex items-center justify-between">
                <span className="text-sm font-medium">Account</span>
                <UserButton afterSignOutUrl="/" />
              </div>
            </SignedIn>
            <SignedOut>
              <SignInButton mode="modal">
                <Button variant="primary" className="w-full">Sign In</Button>
              </SignInButton>
            </SignedOut>
          </div>
        )}
      </header>

      {/* Sticky Bottom Navigation for Mobile - Quick Access to Main Features (sellers only) */}
      {user && isSeller && (
        <>
          <nav className={`md:hidden fixed bottom-0 left-0 right-0 z-40 border-t ${
            theme === 'dark'
              ? 'bg-gray-900/95 border-gray-800'
              : 'bg-white/95 border-gray-200'
          }`} style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
            <div className="flex justify-around items-center h-16 px-2 pb-2">
              <Link to="/invoices" className={`flex flex-col items-center justify-center w-full h-16 gap-1 transition-colors ${theme === 'dark' ? 'text-gray-400 hover:text-red-400' : 'text-gray-600 hover:text-red-600'}`}>
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2H4a1 1 0 110-2V4z" />
                </svg>
                <span className="text-xs font-medium">Invoices</span>
              </Link>
              <Link to="/customers" className={`flex flex-col items-center justify-center w-full h-16 gap-1 transition-colors ${theme === 'dark' ? 'text-gray-400 hover:text-red-400' : 'text-gray-600 hover:text-red-600'}`}>
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10.5 1.5H4a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V6.5L10.5 1.5z" />
                </svg>
                <span className="text-xs font-medium">Customers</span>
              </Link>
              <Link to="/records" className={`flex flex-col items-center justify-center w-full h-16 gap-1 transition-colors ${theme === 'dark' ? 'text-gray-400 hover:text-red-400' : 'text-gray-600 hover:text-red-600'}`}>
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5z" />
                </svg>
                <span className="text-xs font-medium">Records</span>
              </Link>
              <Link to="/services" className={`flex flex-col items-center justify-center w-full h-16 gap-1 transition-colors ${theme === 'dark' ? 'text-gray-400 hover:text-red-400' : 'text-gray-600 hover:text-red-600'}`}>
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                </svg>
                <span className="text-xs font-medium">Services</span>
              </Link>
            </div>
          </nav>

          {/* Padding for bottom nav on mobile */}
          {/* This ensures content doesn't get hidden behind the bottom nav */}
          <div className="md:hidden h-20" />
        </>
      )}
    </>
  );
}

