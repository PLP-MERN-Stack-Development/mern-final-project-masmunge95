import React, { useState } from 'react';
import { useUser } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import Button from '../components/Button';

const RoleSelectionPage = () => {
  const { user } = useUser();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);

  const handleRoleSelect = async (role) => {
    if (!user) return;

    setLoading(true);
    try {
      await user.update({
        unsafeMetadata: { ...user.publicMetadata, role },
      });
      // Redirect based on the newly selected role
      navigate(role === 'seller' ? '/records' : '/customer-dashboard');
    } catch (error) {
      console.error('Failed to update user role:', error);
      setLoading(false);
    }
  };

  const textColor = theme === 'dark' ? 'text-white' : 'text-gray-900';
  const secondaryTextColor = theme === 'dark' ? 'text-gray-300' : 'text-gray-600';

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl w-full">
        {/* Welcome Header */}
        <div className={`mb-8 p-8 rounded-2xl shadow-xl backdrop-blur-sm text-center ${theme === 'dark' ? 'bg-gray-800/90 border border-gray-700/50' : 'bg-white/90 border border-gray-200/50'}`}>
          <div className="flex justify-center mb-4">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center ${
              theme === 'dark' ? 'bg-red-900/40' : 'bg-red-100'
            }`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
          </div>
          <h1 className={`text-4xl font-bold ${textColor} mb-3`}>
            Welcome to RecordIQ! 🎉
          </h1>
          <p className={`text-xl ${secondaryTextColor}`}>
            Hello, {user?.firstName || 'User'}! Let's get you started.
          </p>
        </div>

        {/* Role Selection Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Seller Card */}
          <button
            onClick={() => handleRoleSelect('seller')}
            disabled={loading}
            className={`group p-8 rounded-2xl shadow-xl backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed ${
              theme === 'dark' 
                ? 'bg-gradient-to-br from-red-900/40 to-gray-800/80 border border-red-700/50 hover:border-red-600' 
                : 'bg-gradient-to-br from-red-50 to-white border border-red-200 hover:border-red-400'
            }`}
          >
            <div className="flex flex-col items-center text-center">
              <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-6 transition-transform group-hover:rotate-12 ${
                theme === 'dark' ? 'bg-red-900/60' : 'bg-red-100'
              }`}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h2 className={`text-2xl font-bold ${textColor} mb-3`}>I'm a Seller</h2>
              <p className={`text-base ${secondaryTextColor} mb-6 leading-relaxed`}>
                Manage your business, create invoices, track payments, and serve customers efficiently.
              </p>
              <div className={`w-full space-y-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                <div className="flex items-center gap-2 text-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Create & send invoices
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Manage customers
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Track payments & records
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  OCR document scanning
                </div>
              </div>
              <div className="mt-6 flex items-center gap-2 text-red-600 dark:text-red-400 font-semibold">
                Get Started
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transition-transform group-hover:translate-x-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          </button>

          {/* Customer Card */}
          <button
            onClick={() => handleRoleSelect('customer')}
            disabled={loading}
            className={`group p-8 rounded-2xl shadow-xl backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed ${
              theme === 'dark' 
                ? 'bg-gradient-to-br from-blue-900/40 to-gray-800/80 border border-blue-700/50 hover:border-blue-600' 
                : 'bg-gradient-to-br from-blue-50 to-white border border-blue-200 hover:border-blue-400'
            }`}
          >
            <div className="flex flex-col items-center text-center">
              <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-6 transition-transform group-hover:rotate-12 ${
                theme === 'dark' ? 'bg-blue-900/60' : 'bg-blue-100'
              }`}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h2 className={`text-2xl font-bold ${textColor} mb-3`}>I'm a Customer</h2>
              <p className={`text-base ${secondaryTextColor} mb-6 leading-relaxed`}>
                View your invoices, make secure payments, and upload documents for review.
              </p>
              <div className={`w-full space-y-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                <div className="flex items-center gap-2 text-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  View invoices instantly
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  M-Pesa & card payments
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Upload payment proofs
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Track payment history
                </div>
              </div>
              <div className="mt-6 flex items-center gap-2 text-blue-600 dark:text-blue-400 font-semibold">
                Get Started
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transition-transform group-hover:translate-x-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          </button>
        </div>

        {/* Loading State */}
        {loading && (
          <div className={`mt-6 p-4 rounded-xl text-center ${theme === 'dark' ? 'bg-gray-800/80' : 'bg-gray-100'}`}>
            <div className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5 text-red-600 dark:text-red-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className={`font-medium ${textColor}`}>Setting up your account...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RoleSelectionPage;