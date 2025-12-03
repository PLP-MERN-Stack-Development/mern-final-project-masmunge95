import React from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';

const PrivacyPolicyPage = () => {
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
        <h1 className={`text-4xl font-bold mb-6 ${textColor}`}>Privacy Policy</h1>
        <p className={`mt-4 text-lg ${secondaryTextColor}`}>
          Your privacy is important to us. It is RecordIQ's policy to respect your privacy regarding any information we may collect from you across our website.
        </p>
        <div className={`mt-6 p-6 rounded-xl backdrop-blur-sm ${theme === 'dark' ? 'bg-red-900/20 border border-red-700/30' : 'bg-red-50/80 border border-red-200/50'}`}>
          <p className={`${secondaryTextColor}`}>
            <strong>Our Commitment:</strong> As part of our mission to contribute to UN Sustainable Development Goals (SDG 8, 9, and 10), we believe in ethical data practices that empower users while protecting their privacy. We collect only what's necessary to provide you with excellent service, and we handle your data with the utmost care and transparency.
          </p>
        </div>
        <h2 className={`text-2xl font-semibold mt-8 mb-4 ${textColor}`}>1. Information We Collect</h2>
        <p className={`mt-2 ${secondaryTextColor}`}>
          We only collect information necessary to provide our services. All data collection is done transparently, with your knowledge and consent.
        </p>
        <div className={`mt-4 ${secondaryTextColor}`}>
          <h3 className={`text-lg font-semibold mt-4 ${textColor}`}>Account Information</h3>
          <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
            <li><strong>Authentication Data:</strong> Managed by Clerk (email, name, authentication tokens)</li>
            <li><strong>Profile Information:</strong> Business name, contact details you choose to provide</li>
            <li><strong>Usage Data:</strong> Login times, feature usage, device information</li>
          </ul>
          
          <h3 className={`text-lg font-semibold ${textColor} mt-4`}>Business Data</h3>
          <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
            <li><strong>Customer Information:</strong> Names, contact details, addresses you enter for invoicing</li>
            <li><strong>Invoice Data:</strong> Invoice details, line items, amounts, due dates</li>
            <li><strong>Payment Records:</strong> Transaction IDs, payment status (card details are NOT stored - handled by IntaSend)</li>
            <li><strong>Utility Service Data:</strong> Service types, meter readings, consumption records you create</li>
          </ul>
          
          <h3 className={`text-lg font-semibold ${textColor} mt-4`}>Uploaded Documents</h3>
          <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
            <li><strong>OCR Processing:</strong> Images, PDFs, Word/Excel documents you upload for text extraction</li>
            <li><strong>Temporary Storage:</strong> Files are processed in-memory and immediately discarded after OCR analysis</li>
            <li><strong>Extracted Data:</strong> Text, numbers, and structured data extracted from your documents</li>
            <li><strong>Note:</strong> Original uploaded files are NOT permanently stored on our servers</li>
          </ul>
        </div>
        <h2 className={`text-2xl font-semibold mt-6 ${textColor}`}>2. How We Use Your Information</h2>
        <p className={`mt-2 ${secondaryTextColor}`}>
          We use your information solely to provide and improve our services:
        </p>
        <ul className={`mt-2 ${secondaryTextColor} list-disc list-inside ml-4 space-y-2`}>
          <li><strong>Service Delivery:</strong> Process OCR requests, generate invoices, facilitate payments</li>
          <li><strong>AI Processing:</strong> Send uploaded documents to Microsoft Azure for OCR analysis (Azure's data processing complies with their privacy policy)</li>
          <li><strong>Payment Processing:</strong> Share necessary transaction details with IntaSend to process M-Pesa and card payments</li>
          <li><strong>Customer Communication:</strong> Send invoice notifications and payment confirmations to your customers</li>
          <li><strong>Data Synchronization:</strong> Sync your data across devices (web and mobile app)</li>
          <li><strong>Platform Improvement:</strong> Analyze usage patterns to improve features (anonymized data only)</li>
          <li><strong>Security:</strong> Detect and prevent fraud, unauthorized access, and abuse</li>
        </ul>
        <p className={`mt-4 ${secondaryTextColor}`}>
          <strong>We will NEVER:</strong> Sell your data to third parties, use your documents for AI training without consent, or share your business information with competitors.
        </p>
        <h2 className={`text-2xl font-semibold mt-6 ${textColor}`}>3. Data Security</h2>
        <p className={`mt-2 ${secondaryTextColor}`}>
          We implement industry-standard security measures to protect your data:
        </p>
        <ul className={`mt-2 ${secondaryTextColor} list-disc list-inside ml-4 space-y-2`}>
          <li><strong>Encryption in Transit:</strong> All data transmission uses HTTPS/TLS 1.3 encryption</li>
          <li><strong>Encryption at Rest:</strong> Database connections are encrypted; sensitive data is hashed</li>
          <li><strong>Authentication:</strong> Clerk handles secure login with multi-factor authentication support</li>
          <li><strong>API Security:</strong> CORS policies, rate limiting, and request validation prevent unauthorized access</li>
          <li><strong>Payment Security:</strong> PCI-DSS compliant payment processing (card data handled entirely by IntaSend)</li>
          <li><strong>Document Processing:</strong> Uploaded files are processed in-memory and immediately discarded—not stored on disk</li>
          <li><strong>Access Control:</strong> Role-based permissions ensure users can only access their own data</li>
          <li><strong>Infrastructure:</strong> Hosted on secure cloud platforms (Vercel, Render) with DDoS protection</li>
        </ul>
        <p className={`mt-4 ${secondaryTextColor}`}>
          While we implement robust security measures, no system is 100% secure. We encourage you to use strong passwords and enable two-factor authentication.
        </p>
        <h2 className={`text-2xl font-semibold mt-6 ${textColor}`}>4. Cookies and Tracking Technologies</h2>
        <p className={`mt-2 ${secondaryTextColor}`}>
          We use cookies and similar tracking technologies to track the activity on our service and hold certain information. You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent.
        </p>
        <h2 className={`text-2xl font-semibold mt-8 mb-4 ${textColor}`}>Third-Party Services</h2>
        <p className={`mt-2 ${secondaryTextColor}`}>
          RecordIQ integrates with trusted third-party services to deliver core functionality. Each service has its own privacy policy:
        </p>
        <div className={`mt-4 ${secondaryTextColor} space-y-4`}>
          <div>
            <h3 className="font-semibold">Clerk (Authentication)</h3>
            <p className="ml-4 text-sm mt-1">
              Handles user authentication and account management. Your email and authentication data are stored and managed by Clerk.
              <br/>
              <a href="https://clerk.com/privacy" target="_blank" rel="noopener noreferrer" className="text-red-500 hover:underline">View Clerk Privacy Policy →</a>
            </p>
          </div>
          
          <div>
            <h3 className="font-semibold">Microsoft Azure AI Services (OCR Processing)</h3>
            <p className="ml-4 text-sm mt-1">
              Processes uploaded documents using Computer Vision and Document Intelligence APIs. Documents are analyzed in Azure's secure cloud and not retained.
              <br/>
              <a href="https://privacy.microsoft.com/en-us/privacystatement" target="_blank" rel="noopener noreferrer" className="text-red-500 hover:underline">View Microsoft Privacy Statement →</a>
            </p>
            <div className={`mt-3 ml-4 p-3 rounded-lg ${theme === 'dark' ? 'bg-yellow-900/20 border border-yellow-700/50' : 'bg-yellow-50 border border-yellow-200'}`}>
              <p className={`text-sm ${theme === 'dark' ? 'text-yellow-300' : 'text-yellow-800'}`}>
                <strong>⚠️ OCR Data Accuracy Disclaimer:</strong>
              </p>
              <ul className={`text-xs mt-2 space-y-1 ${theme === 'dark' ? 'text-yellow-300/90' : 'text-yellow-700'}`}>
                <li>• Internet connection is required for document analysis</li>
                <li>• Extracted data may not be 100% accurate due to document quality, handwriting, or OCR limitations</li>
                <li>• Users are responsible for reviewing and verifying all extracted information before saving or using it</li>
                <li>• RecordIQ is not liable for errors in OCR-extracted data or decisions made based on that data</li>
                <li>• Always cross-check critical information (amounts, dates, names) against original documents</li>
              </ul>
            </div>
          </div>
          
          <div>
            <h3 className="font-semibold">IntaSend (Payment Processing)</h3>
            <p className="ml-4 text-sm mt-1">
              Processes M-Pesa and card payments. Payment details are sent directly to IntaSend—we never store card information.
              <br/>
              <a href="https://intasend.com/privacy" target="_blank" rel="noopener noreferrer" className="text-red-500 hover:underline">View IntaSend Privacy Policy →</a>
            </p>
          </div>
          
          <div>
            <h3 className="font-semibold">MongoDB Atlas (Database Hosting)</h3>
            <p className="ml-4 text-sm mt-1">
              Stores your business data in encrypted MongoDB clusters with automatic backups.
              <br/>
              <a href="https://www.mongodb.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-red-500 hover:underline">View MongoDB Privacy Policy →</a>
            </p>
          </div>
        </div>
        <h2 className={`text-2xl font-semibold mt-6 ${textColor}`}>6. Your Data Protection Rights</h2>
        <p className={`mt-2 ${secondaryTextColor}`}>
          You have full control over your data. We provide the following rights:
        </p>
        <ul className={`mt-2 ${secondaryTextColor} list-disc list-inside ml-4 space-y-2`}>
          <li><strong>Access:</strong> View all data associated with your account through the dashboard</li>
          <li><strong>Correction:</strong> Edit customer records, invoices, and profile information at any time</li>
          <li><strong>Deletion:</strong> Delete individual records, customers, or your entire account (contact support for full account deletion)</li>
          <li><strong>Export:</strong> Download your data in JSON format for backup or migration purposes</li>
          <li><strong>Portability:</strong> Transfer your data to another service provider</li>
          <li><strong>Objection:</strong> Opt out of analytics or marketing communications</li>
          <li><strong>Restriction:</strong> Request temporary suspension of data processing</li>
        </ul>
        <p className={`mt-4 ${secondaryTextColor}`}>
          To exercise any of these rights, contact us at <a href="mailto:privacy@recordiq.com" className="text-red-500 hover:underline">privacy@recordiq.com</a>. We will respond within 30 days.
        </p>
        <h2 className={`text-2xl font-semibold mt-6 ${textColor}`}>7. Changes to This Policy</h2>
        <p className={`mt-2 ${secondaryTextColor}`}>
          We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page.
        </p>
        <h2 className={`text-2xl font-semibold mt-6 ${textColor}`}>8. Contact Us</h2>
        <p className={`mt-2 ${secondaryTextColor}`}>
          If you have any questions about this Privacy Policy, please contact us at <a href="mailto:privacy@recordiq.com" className="text-red-500 hover:underline">privacy@recordiq.com</a>.
        </p>
      </div>
    </div>
  );
};

export default PrivacyPolicyPage;