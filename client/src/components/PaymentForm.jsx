import React, { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import Button from './Button';

const PaymentForm = ({ invoice, onPayment, onCancel, loading }) => {
  const { theme } = useTheme();
  const [name, setName] = useState(invoice.customerName || '');
  const [email, setEmail] = useState(invoice.customer?.email || '');
  const [phone, setPhone] = useState(invoice.customer?.phone || '');
  const [paymentMethod, setPaymentMethod] = useState('mpesa'); // 'mpesa' or 'card'

  const handleSubmit = (e) => {
    e.preventDefault();
    onPayment({ name, email, phone, paymentMethod });
  };

  // Calculate processing fees (estimates based on IntaSend + M-Pesa/Card fees)
  const invoiceAmount = Number(invoice.total) || 0;
  const calculateFees = () => {
    if (paymentMethod === 'mpesa') {
      // IntaSend: 3.5% + KES 10, M-Pesa: varies by amount (simplified estimate)
      const intasendFee = (invoiceAmount * 0.035) + 10;
      const mpesaFee = invoiceAmount <= 1000 ? 10 : invoiceAmount <= 5000 ? 30 : invoiceAmount <= 20000 ? 50 : 70;
      return Math.ceil(intasendFee + mpesaFee);
    } else {
      // Card: IntaSend 4% + KES 15
      return Math.ceil((invoiceAmount * 0.04) + 15);
    }
  };
  
  const processingFee = calculateFees();
  const totalAmount = invoiceAmount + processingFee;

  const textColor = theme === 'dark' ? 'text-white' : 'text-gray-900';
  const inputBg = theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100';
  const inputBorder = theme === 'dark' ? 'border-gray-600' : 'border-gray-300';

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onCancel}
    >
      <div 
        className={`p-6 sm:p-8 rounded-xl shadow-2xl w-full max-w-md my-8 max-h-[90vh] overflow-y-auto ${theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className={`text-xl sm:text-2xl font-bold mb-6 ${textColor}`}>Enter Payment Details</h2>
        <form onSubmit={handleSubmit}>
          {/* Payment Method Selection */}
          <div className="mb-6">
            <label className={`block mb-3 font-medium ${textColor}`}>Payment Method</label>
            <div className="flex gap-4">
              <label className={`flex items-center cursor-pointer px-4 py-3 rounded-lg border-2 transition-all ${
                paymentMethod === 'mpesa' 
                  ? theme === 'dark' ? 'border-red-500 bg-red-900/20' : 'border-red-500 bg-red-50'
                  : theme === 'dark' ? 'border-gray-600 bg-gray-700/50' : 'border-gray-300 bg-gray-50'
              } ${textColor}`}>
                <input
                  type="radio"
                  name="paymentMethod"
                  value="mpesa"
                  checked={paymentMethod === 'mpesa'}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="mr-2 accent-red-600"
                />
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
                </svg>
                M-Pesa
              </label>
              <label className={`flex items-center cursor-pointer px-4 py-3 rounded-lg border-2 transition-all ${
                paymentMethod === 'card' 
                  ? theme === 'dark' ? 'border-red-500 bg-red-900/20' : 'border-red-500 bg-red-50'
                  : theme === 'dark' ? 'border-gray-600 bg-gray-700/50' : 'border-gray-300 bg-gray-50'
              } ${textColor}`}>
                <input
                  type="radio"
                  name="paymentMethod"
                  value="card"
                  checked={paymentMethod === 'card'}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="mr-2 accent-red-600"
                />
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                Card
              </label>
            </div>
          </div>

          <div className="mb-4">
            <label htmlFor="name" className={`block mb-2 font-medium ${textColor}`}>Name</label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`w-full p-3 rounded-lg border ${inputBg} ${inputBorder} ${textColor} focus:ring-2 focus:ring-red-500 focus:border-transparent`}
              required
            />
          </div>
          <div className="mb-4">
            <label htmlFor="email" className={`block mb-2 font-medium ${textColor}`}>Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`w-full p-3 rounded-lg border ${inputBg} ${inputBorder} ${textColor} focus:ring-2 focus:ring-red-500 focus:border-transparent`}
              required
            />
          </div>
          {paymentMethod === 'mpesa' && (
            <div className="mb-4">
              <label htmlFor="phone" className={`block mb-2 font-medium ${textColor}`}>Phone Number (M-Pesa)</label>
              <input
                type="text"
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={`w-full p-3 rounded-lg border ${inputBg} ${inputBorder} ${textColor} focus:ring-2 focus:ring-red-500 focus:border-transparent`}
                placeholder="e.g., 254712345678"
                required
              />
              <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                Format: 254XXXXXXXXX
              </p>
            </div>
          )}
          {paymentMethod === 'card' && (
            <div className={`mb-4 p-4 rounded-lg border ${theme === 'dark' ? 'bg-blue-900/20 border-blue-700' : 'bg-blue-50 border-blue-200'}`}>
              <p className={`text-sm flex items-center gap-2 ${theme === 'dark' ? 'text-blue-300' : 'text-blue-700'}`}>
                <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                You'll be redirected to a secure payment page to enter your card details.
              </p>
            </div>
          )}

          {/* Fee Breakdown */}
          <div className={`mb-6 p-4 rounded-lg border-2 ${theme === 'dark' ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
            <h3 className={`text-sm font-semibold mb-3 ${textColor}`}>Payment Summary</h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>Invoice Amount:</span>
                <span className={`text-sm font-medium ${textColor}`}>KES {invoiceAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>Processing Fees:</span>
                <span className={`text-sm font-medium ${textColor}`}>KES {processingFee.toFixed(2)}</span>
              </div>
              <div className={`pt-2 mt-2 border-t ${theme === 'dark' ? 'border-gray-600' : 'border-gray-300'}`}>
                <div className="flex justify-between items-center">
                  <span className={`text-base font-bold ${textColor}`}>Total to Pay:</span>
                  <span className={`text-lg font-bold ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`}>KES {totalAmount.toFixed(2)}</span>
                </div>
              </div>
            </div>
            <div className={`mt-3 pt-3 border-t ${theme === 'dark' ? 'border-gray-600' : 'border-gray-300'}`}>
              <p className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                <span className="font-semibold">Note:</span> Processing fees cover payment gateway and transaction costs. The seller receives 100% of the invoice amount (KES {invoiceAmount.toFixed(2)}).
              </p>
            </div>
          </div>

          {/* IntaSend Trust Badge */}
          <div className="mb-6 text-center">
            <a 
              href="https://intasend.com/security" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-block transition-opacity hover:opacity-80"
            >
              <img 
                src={theme === 'dark' 
                  ? "https://intasend-prod-static.s3.amazonaws.com/img/trust-badges/intasend-trust-badge-with-mpesa-hr-dark.png"
                  : "https://intasend-prod-static.s3.amazonaws.com/img/trust-badges/intasend-trust-badge-with-mpesa-hr-light.png"
                }
                alt="IntaSend Secure Payments (PCI-DSS Compliant)"
                className="w-full max-w-[280px] h-auto mx-auto"
              />
            </a>
            <a 
              href="https://intasend.com/security" 
              target="_blank" 
              rel="noopener noreferrer"
              className={`block text-xs mt-2 no-underline hover:underline ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
            >
              Secured by IntaSend Payments
            </a>
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 mt-6">
            <Button type="button" onClick={onCancel} variant="secondary" className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button type="submit" disabled={loading} variant="primary" className="w-full sm:w-auto">
              {loading ? 'Processing...' : `Pay KES ${totalAmount.toFixed(2)}`}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PaymentForm;