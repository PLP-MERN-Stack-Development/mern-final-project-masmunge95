import React, { useRef } from 'react';
import Header from './Header';
import Footer from './Footer';
import SubscriptionBanner from './SubscriptionBanner';
import { useTheme } from '../context/ThemeContext';

/**
 * A layout component that wraps page content with a standard Header and Footer.
 */
export default function Layout({ children }) { 
    const { theme } = useTheme();
    const scrollTargetRef = useRef(null);

    return (
        <div 
            className={`min-h-screen flex flex-col scroll-smooth ${theme === 'dark' ? 'bg-gray-900 text-gray-100' : 'bg-white text-gray-900'}`}
            style={{
                paddingTop: 'var(--safe-area-inset-top)',
                paddingRight: 'var(--safe-area-inset-right)',
                paddingBottom: 'var(--safe-area-inset-bottom)',
                paddingLeft: 'var(--safe-area-inset-left)'
            }}
        >
            <Header />
            <SubscriptionBanner />
            <main className="flex-grow container mx-auto px-3 sm:px-4 py-3 sm:py-4 md:py-6 lg:py-8 mt-14 sm:mt-16 scroll-mt-20 pb-20 md:pb-6">
                {children}
            </main>
            <Footer />
        </div>
    );
}