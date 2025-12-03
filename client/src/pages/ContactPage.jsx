import React from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';

const ContactPage = () => {
  const { theme } = useTheme();
  const textColor = theme === 'dark' ? 'text-white' : 'text-gray-900';
  const secondaryTextColor = theme === 'dark' ? 'text-gray-300' : 'text-gray-600';

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="mb-2">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:underline dark:text-blue-400">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" /></svg>
          Back to Dashboard
        </Link>
      </div>
      <div className={`mb-8 p-8 rounded-2xl shadow-xl backdrop-blur-sm ${theme === 'dark' ? 'bg-gray-800/90 border border-gray-700/50' : 'bg-white/90 border border-gray-200/50'}`}>
        <h1 className={`text-4xl font-bold mb-6 ${textColor}`}>Contact Us</h1>
        <p className={`mt-4 text-lg ${secondaryTextColor}`}>
          Have questions or feedback? We'd love to hear from you.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
          <div>
            <h2 className={`text-2xl font-semibold mb-4 ${textColor}`}>Get in Touch</h2>
            <div className={`mt-4 ${secondaryTextColor}`}>
              <p><strong>Email:</strong> <a href="mailto:support@recordiq.com" className="text-red-500 hover:underline">support@recordiq.com</a></p>
              <p className="mt-2"><strong>Phone:</strong> +1 (800) 555-1234</p>
              <p className="mt-2"><strong>Address:</strong> 123 Innovation Drive, Tech City, 12345</p>
            </div>
            <div className="mt-6">
              <h3 className={`text-xl font-semibold ${textColor}`}>Follow Us</h3>
              <div className="flex space-x-4 mt-2">
                <a href="#" className="text-red-500 hover:underline">Facebook</a>
                <a href="#" className="text-red-500 hover:underline">Twitter</a>
                <a href="#" className="text-red-500 hover:underline">LinkedIn</a>
              </div>
            </div>
          </div>
          <div>
            <h2 className={`text-2xl font-semibold ${textColor}`}>Send us a Message</h2>
            <form className="mt-4 space-y-4">
              <div>
                <label htmlFor="name" className={`block text-sm font-medium ${secondaryTextColor}`}>Name</label>
                <input type="text" id="name" name="name" className={`mt-1 block w-full px-4 py-2 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'}`} />
              </div>
              <div>
                <label htmlFor="email" className={`block text-sm font-medium ${secondaryTextColor}`}>Email</label>
                <input type="email" id="email" name="email" className={`mt-1 block w-full px-4 py-2 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'}`} />
              </div>
              <div>
                <label htmlFor="message" className={`block text-sm font-medium ${secondaryTextColor}`}>Message</label>
                <textarea id="message" name="message" rows="4" className={`mt-1 block w-full px-4 py-2 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'}`}></textarea>
              </div>
              <div>
                <button type="submit" className="w-full bg-red-600 text-white py-3 px-6 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all shadow-md hover:shadow-lg font-semibold">
                  Send Message
                </button>
              </div>
            </form>
          </div>
        </div>
        <div className="mt-8">
          <h2 className={`text-2xl font-semibold ${textColor}`}>Our Location</h2>
          <div className={`mt-4 h-64 rounded-xl overflow-hidden ${theme === 'dark' ? 'bg-gray-700/50 border border-gray-600' : 'bg-gray-100 border border-gray-300'}`}>
            {/* Placeholder for a map */}
            <p className={`text-center pt-24 ${secondaryTextColor} text-lg`}>Map placeholder</p>
          </div>
        </div>
        
        {/* FAQ Section */}
        <div className="mt-12">
          <h2 className={`text-3xl font-bold mb-6 ${textColor}`}>Frequently Asked Questions</h2>
          <div className="space-y-4">
            
            {/* General */}
            <div className={`p-6 rounded-xl ${theme === 'dark' ? 'bg-gray-700/50 border border-gray-600' : 'bg-gray-50 border border-gray-200'}`}>
              <h3 className={`text-xl font-semibold ${textColor} mb-4`}>General Questions</h3>
              
              <div className="space-y-3">
                <div>
                  <p className={`font-semibold ${textColor}`}>What is RecordIQ?</p>
                  <p className={`text-sm ${secondaryTextColor} mt-1`}>
                    RecordIQ is a comprehensive business management platform that helps you digitize records, manage invoices, accept payments, and track utility services. We combine AI-powered OCR technology with intuitive tools to streamline your business operations.
                  </p>
                </div>
                
                <div>
                  <p className={`font-semibold ${textColor}`}>Who is RecordIQ for?</p>
                  <p className={`text-sm ${secondaryTextColor} mt-1`}>
                    RecordIQ is designed for small businesses, utility service providers, freelancers, and entrepreneurs who need to manage invoices, digitize documents, track customer records, and accept payments. Whether you're a water meter reader, shop owner, or service provider, RecordIQ has tools for you.
                  </p>
                </div>
                
                <div>
                  <p className={`font-semibold ${textColor}`}>Is RecordIQ free?</p>
                  <p className={`text-sm ${secondaryTextColor} mt-1`}>
                    RecordIQ offers both free and premium plans. Basic features are available at no cost, while advanced features like OCR document processing and premium payment options require a subscription. Check our pricing page for details.
                  </p>
                </div>
              </div>
            </div>
            
            {/* OCR & Document Processing */}
            <div className={`p-6 rounded-xl ${theme === 'dark' ? 'bg-gray-700/50 border border-gray-600' : 'bg-gray-50 border border-gray-200'}`}>
              <h3 className={`text-xl font-semibold ${textColor} mb-4`}>OCR & Document Processing</h3>
              
              <div className="space-y-3">
                <div>
                  <p className={`font-semibold ${textColor}`}>What types of documents can I upload for OCR processing?</p>
                  <p className={`text-sm ${secondaryTextColor} mt-1`}>
                    You can upload images (JPG, PNG), PDFs, Microsoft Word (.docx), Excel (.xlsx), and PowerPoint (.pptx) files. Our AI can extract data from receipts, invoices, utility meter readings, handwritten notes, and even tables in spreadsheets or photos.
                  </p>
                </div>
                
                <div>
                  <p className={`font-semibold ${textColor}`}>How accurate is the OCR technology?</p>
                  <p className={`text-sm ${secondaryTextColor} mt-1`}>
                    We use Microsoft Azure AI Services, which provide industry-leading OCR accuracy. However, accuracy depends on document quality, handwriting clarity, and image resolution. Always review extracted data before saving. We're not liable for OCR errors—please verify all critical information.
                  </p>
                </div>
                
                <div>
                  <p className={`font-semibold ${textColor}`}>Do you store my uploaded documents?</p>
                  <p className={`text-sm ${secondaryTextColor} mt-1`}>
                    No. Uploaded files are processed in-memory and immediately discarded after OCR analysis. We only store the extracted text and structured data—not the original files. This ensures your document privacy and reduces storage costs.
                  </p>
                </div>
                
                <div>
                  <p className={`font-semibold ${textColor}`}>Can OCR work offline?</p>
                  <p className={`text-sm ${secondaryTextColor} mt-1`}>
                    No. OCR requires an internet connection because documents are processed on Microsoft Azure's cloud servers. However, once data is extracted, it's stored locally in your device's IndexedDB and accessible offline.
                  </p>
                </div>
              </div>
            </div>
            
            {/* Invoicing & Payments */}
            <div className={`p-6 rounded-xl ${theme === 'dark' ? 'bg-gray-700/50 border border-gray-600' : 'bg-gray-50 border border-gray-200'}`}>
              <h3 className={`text-xl font-semibold ${textColor} mb-4`}>Invoicing & Payments</h3>
              
              <div className="space-y-3">
                <div>
                  <p className={`font-semibold ${textColor}`}>How do I accept payments from customers?</p>
                  <p className={`text-sm ${secondaryTextColor} mt-1`}>
                    Create an invoice, share the payment link with your customer, and they can pay via M-Pesa STK Push or card (Visa/Mastercard). Payments are processed securely by IntaSend, and invoices are automatically marked as paid when payment is confirmed.
                  </p>
                </div>
                
                <div>
                  <p className={`font-semibold ${textColor}`}>Do customers need a RecordIQ account to pay invoices?</p>
                  <p className={`text-sm ${secondaryTextColor} mt-1`}>
                    No. Customers can view and pay invoices using a public link—no account required. They simply enter their payment details and complete the transaction through IntaSend's secure checkout.
                  </p>
                </div>
                
                <div>
                  <p className={`font-semibold ${textColor}`}>What payment methods are supported?</p>
                  <p className={`text-sm ${secondaryTextColor} mt-1`}>
                    We support M-Pesa STK Push (instant mobile money) and card payments (Visa/Mastercard) through our integration with IntaSend. All transactions are secure and PCI-DSS compliant.
                  </p>
                </div>
                
                <div>
                  <p className={`font-semibold ${textColor}`}>How do I withdraw my earnings?</p>
                  <p className={`text-sm ${secondaryTextColor} mt-1`}>
                    Go to the Wallet page, set up your withdrawal method (M-Pesa or bank account), and request a withdrawal. Withdrawals are processed within 1-3 business days depending on the method.
                  </p>
                </div>
              </div>
            </div>
            
            {/* Mobile & Offline */}
            <div className={`p-6 rounded-xl ${theme === 'dark' ? 'bg-gray-700/50 border border-gray-600' : 'bg-gray-50 border border-gray-200'}`}>
              <h3 className={`text-xl font-semibold ${textColor} mb-4`}>Mobile App & Offline Mode</h3>
              
              <div className="space-y-3">
                <div>
                  <p className={`font-semibold ${textColor}`}>Is there a mobile app?</p>
                  <p className={`text-sm ${secondaryTextColor} mt-1`}>
                    Yes! RecordIQ has an Android mobile app built with Capacitor. You can download it from the Google Play Store (coming soon) or use our web app on any mobile browser.
                  </p>
                </div>
                
                <div>
                  <p className={`font-semibold ${textColor}`}>Can I use RecordIQ offline?</p>
                  <p className={`text-sm ${secondaryTextColor} mt-1`}>
                    Yes. RecordIQ uses IndexedDB for offline-first storage. You can view invoices, customers, and records without internet. Changes are saved locally and synced to the cloud when you reconnect. However, OCR processing and payments require an internet connection.
                  </p>
                </div>
                
                <div>
                  <p className={`font-semibold ${textColor}`}>How does data sync work across devices?</p>
                  <p className={`text-sm ${secondaryTextColor} mt-1`}>
                    When you log in on multiple devices, your data automatically syncs through our cloud backend. Changes made on one device (e.g., creating an invoice) will appear on your other devices after they sync. Sync happens automatically when online.
                  </p>
                </div>
              </div>
            </div>
            
            {/* Security & Privacy */}
            <div className={`p-6 rounded-xl ${theme === 'dark' ? 'bg-gray-700/50 border border-gray-600' : 'bg-gray-50 border border-gray-200'}`}>
              <h3 className={`text-xl font-semibold ${textColor} mb-4`}>Security & Privacy</h3>
              
              <div className="space-y-3">
                <div>
                  <p className={`font-semibold ${textColor}`}>Is my data secure?</p>
                  <p className={`text-sm ${secondaryTextColor} mt-1`}>
                    Yes. We use HTTPS/TLS encryption for all data transmission, encrypted database connections, Clerk for authentication, and PCI-DSS compliant payment processing. Your data is protected with industry-standard security measures.
                  </p>
                </div>
                
                <div>
                  <p className={`font-semibold ${textColor}`}>Do you sell my data to third parties?</p>
                  <p className={`text-sm ${secondaryTextColor} mt-1`}>
                    Absolutely not. We will never sell your data to third parties, use your documents for AI training without consent, or share your business information with competitors. Your privacy is sacred.
                  </p>
                </div>
                
                <div>
                  <p className={`font-semibold ${textColor}`}>Can I delete my account and data?</p>
                  <p className={`text-sm ${secondaryTextColor} mt-1`}>
                    Yes. You can delete individual records, customers, or invoices anytime. To permanently delete your entire account and all associated data, contact us at privacy@recordiq.com and we'll process your request within 30 days.
                  </p>
                </div>
                
                <div>
                  <p className={`font-semibold ${textColor}`}>Where is my data stored?</p>
                  <p className={`text-sm ${secondaryTextColor} mt-1`}>
                    Your data is stored in MongoDB Atlas (encrypted cloud database), locally in IndexedDB on your devices, and temporarily processed on Microsoft Azure for OCR. All storage providers use encryption and follow strict security protocols.
                  </p>
                </div>
              </div>
            </div>
            
            {/* Technical Support */}
            <div className={`p-6 rounded-xl ${theme === 'dark' ? 'bg-gray-700/50 border border-gray-600' : 'bg-gray-50 border border-gray-200'}`}>
              <h3 className={`text-xl font-semibold ${textColor} mb-4`}>Technical Support</h3>
              
              <div className="space-y-3">
                <div>
                  <p className={`font-semibold ${textColor}`}>What browsers are supported?</p>
                  <p className={`text-sm ${secondaryTextColor} mt-1`}>
                    RecordIQ works best on modern browsers: Chrome, Firefox, Safari, and Edge (latest versions). Internet Explorer is not supported.
                  </p>
                </div>
                
                <div>
                  <p className={`font-semibold ${textColor}`}>I'm experiencing sync issues. What should I do?</p>
                  <p className={`text-sm ${secondaryTextColor} mt-1`}>
                    Check your internet connection, refresh the page, and try logging out and back in. If the issue persists, contact support at support@recordiq.com with details about the problem.
                  </p>
                </div>
                
                <div>
                  <p className={`font-semibold ${textColor}`}>How do I report a bug or request a feature?</p>
                  <p className={`text-sm ${secondaryTextColor} mt-1`}>
                    Email us at support@recordiq.com with "Bug Report" or "Feature Request" in the subject line. Include screenshots and detailed steps to reproduce the issue. We review all feedback and prioritize improvements based on user needs.
                  </p>
                </div>
              </div>
            </div>
            
          </div>
          
          <div className={`mt-8 p-6 rounded-xl ${theme === 'dark' ? 'bg-red-900/20 border border-red-700/50' : 'bg-red-50 border border-red-200'}`}>
            <p className={`${secondaryTextColor} text-center`}>
              <strong>Still have questions?</strong> Contact us at{' '}
              <a href="mailto:support@recordiq.com" className="text-red-500 hover:underline font-semibold">
                support@recordiq.com
              </a>
              {' '}or use the contact form above. We typically respond within 24 hours.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactPage;