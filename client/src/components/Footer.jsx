import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { Link } from 'react-router-dom';

export default function Footer() {
  const { theme } = useTheme();
  const currentYear = new Date().getFullYear();
  return (
    <footer
      className={`border-t py-8 pb-24 md:pb-8 ${
        theme === 'dark' ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-100'
      }`}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-4">
        <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
          &copy; {currentYear} RecordIQ. All rights reserved.
        </p>
        <div className="flex items-center gap-6">
          <Link to="/about" className={`text-sm transition-colors ${theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}>
            About
          </Link>
          <Link to="/contact" className={`text-sm transition-colors ${theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}>
            Contact
          </Link>
          <Link to="/privacy-policy" className={`text-sm transition-colors ${theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}>
            Privacy Policy
          </Link>
        </div>
      </div>
    </footer>
  );
}