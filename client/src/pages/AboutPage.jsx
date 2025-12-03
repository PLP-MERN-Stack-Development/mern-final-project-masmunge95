import React from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';

const AboutPage = () => {
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
        <h1 className={`text-4xl font-bold mb-6 ${textColor}`}>About RecordIQ</h1>
        <p className={`mt-4 text-lg ${secondaryTextColor}`}>
          RecordIQ is a comprehensive business management platform designed to empower small businesses, utility service providers, and entrepreneurs. We combine cutting-edge AI technology with intuitive design to help you digitize records, manage invoices, and accept payments—all in one place.
        </p>
        <p className={`mt-4 ${secondaryTextColor}`}>
          Whether you're a utility seller tracking customer consumption records, a freelancer managing client invoices, or a shop owner digitizing handwritten inventory lists, RecordIQ provides enterprise-grade tools previously accessible only to large corporations.
        </p>
        
        <h2 className={`text-2xl font-semibold mt-8 mb-4 ${textColor}`}>What Makes Us Different</h2>
        <div className={`mt-4 space-y-6 ${secondaryTextColor}`}>
          <div className={`p-6 rounded-xl ${theme === 'dark' ? 'bg-gray-700/50 border border-gray-600/50' : 'bg-gray-50/80 border border-gray-200/50'}`}>
            <h3 className={`text-xl font-semibold ${textColor}`}>🤖 Intelligent Document Processing</h3>
            <p className="mt-2">
              Powered by <strong>Microsoft Azure Computer Vision and Document Intelligence</strong>, our OCR technology automatically reads and extracts data from:
            </p>
            <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
              <li><strong>Receipts & Invoices</strong> - Automatic extraction of vendors, totals, dates, and line items</li>
              <li><strong>Utility Meter Readings</strong> - Extract serial numbers, consumption data, and technical specifications</li>
              <li><strong>Customer Consumption Records</strong> - Process Excel sheets or handwritten tables with customer names and monthly usage</li>
              <li><strong>Inventory Lists</strong> - Digitize stock records from Word documents, spreadsheets, or photos</li>
              <li><strong>Handwritten Notes</strong> - Advanced OCR that understands handwriting and reconstructs table structures</li>
            </ul>
            <p className="mt-2 text-sm italic">
              Supported formats: JPG, PNG, PDF, Word (.docx), Excel (.xlsx), PowerPoint (.pptx)
            </p>
          </div>
          
          <div className={`p-6 rounded-xl ${theme === 'dark' ? 'bg-gray-700/50 border border-gray-600/50' : 'bg-gray-50/80 border border-gray-200/50'}`}>
            <h3 className={`text-xl font-semibold ${textColor}`}>💳 Flexible Payment Solutions</h3>
            <p className="mt-2">
              Integrated with <strong>IntaSend</strong> to offer multiple payment options:
            </p>
            <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
              <li><strong>M-Pesa STK Push</strong> - Instant mobile money payments with real-time confirmation</li>
              <li><strong>Card Payments</strong> - Secure Visa/Mastercard processing via IntaSend's checkout</li>
              <li><strong>Automatic Invoice Updates</strong> - Payment webhooks automatically mark invoices as paid</li>
              <li><strong>Customer Portal</strong> - Clients can view and pay invoices without creating an account</li>
            </ul>
          </div>
          
          <div className={`p-6 rounded-xl ${theme === 'dark' ? 'bg-gray-700/50 border border-gray-600/50' : 'bg-gray-50/80 border border-gray-200/50'}`}>
            <h3 className={`text-xl font-semibold ${textColor}`}>📱 Multi-Platform Access</h3>
            <p className="mt-2">
              Access RecordIQ anywhere, on any device:
            </p>
            <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
              <li><strong>Web Application</strong> - Full-featured dashboard accessible from any browser</li>
              <li><strong>Android Mobile App</strong> - Built with Capacitor for native mobile experience</li>
              <li><strong>Offline Support</strong> - IndexedDB storage keeps your data accessible even without internet</li>
              <li><strong>Cloud Sync</strong> - Seamless synchronization across all your devices</li>
            </ul>
          </div>
          
          <div className={`p-6 rounded-xl ${theme === 'dark' ? 'bg-gray-700/50 border border-gray-600/50' : 'bg-gray-50/80 border border-gray-200/50'}`}>
            <h3 className={`text-xl font-semibold ${textColor}`}>🔒 Enterprise-Grade Security</h3>
            <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
              <li><strong>Clerk Authentication</strong> - Industry-standard user management and access control</li>
              <li><strong>Encrypted Data Transmission</strong> - All API calls use HTTPS/TLS encryption</li>
              <li><strong>Secure Document Processing</strong> - Files are processed in-memory and not permanently stored on our servers</li>
              <li><strong>PCI-Compliant Payments</strong> - Card data never touches our servers (handled by IntaSend)</li>
            </ul>
          </div>
        </div>
        <h2 className={`text-2xl font-semibold mt-6 ${textColor}`}>Our Mission</h2>
        <p className={`mt-2 ${secondaryTextColor}`}>
          Our mission is to empower individuals and businesses to take control of their finances through intuitive and powerful tools. We believe that financial management should be simple, accessible, and stress-free.
        </p>
        <h2 className={`text-2xl font-semibold mt-6 ${textColor}`}>Our Vision</h2>
        <p className={`mt-2 ${secondaryTextColor}`}>
          We envision a world where everyone has the financial literacy and tools to achieve their goals. We are committed to building a platform that not only manages records but also provides insights to help you make smarter financial decisions.
        </p>
        <h2 className={`text-2xl font-semibold mt-6 ${textColor}`}>Our Values</h2>
        <ul className={`mt-2 ${secondaryTextColor} list-disc list-inside`}>
          <li><strong>Customer-Centric:</strong> We put our users at the heart of everything we do.</li>
          <li><strong>Innovation:</strong> We constantly strive to improve and innovate our products.</li>
          <li><strong>Integrity:</strong> We are committed to the highest standards of privacy and security.</li>
          <li><strong>Simplicity:</strong> We believe in making complex tasks simple and intuitive.</li>
        </ul>
        <h2 className={`text-2xl font-semibold mt-6 ${textColor}`}>Technology Stack</h2>
        <p className={`mt-2 ${secondaryTextColor}`}>
          We leverage best-in-class technologies to deliver a reliable, scalable platform:
        </p>
        <div className={`mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 ${secondaryTextColor}`}>
          <div>
            <h4 className="font-semibold">Frontend</h4>
            <ul className="text-sm ml-4 mt-1 space-y-1">
              <li>• React 18 + Vite (fast, modern UI)</li>
              <li>• Tailwind CSS (responsive design)</li>
              <li>• Dexie.js (offline-first storage)</li>
              <li>• Capacitor (native mobile apps)</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold">Backend</h4>
            <ul className="text-sm ml-4 mt-1 space-y-1">
              <li>• Node.js + Express (scalable API)</li>
              <li>• MongoDB (flexible data storage)</li>
              <li>• Azure AI Services (OCR processing)</li>
              <li>• IntaSend API (payment processing)</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold">Infrastructure</h4>
            <ul className="text-sm ml-4 mt-1 space-y-1">
              <li>• Vercel (frontend hosting)</li>
              <li>• Render (backend hosting)</li>
              <li>• GitHub Actions (CI/CD)</li>
              <li>• Clerk (authentication)</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold">AI & Intelligence</h4>
            <ul className="text-sm ml-4 mt-1 space-y-1">
              <li>• Azure Computer Vision (images)</li>
              <li>• Azure Document Intelligence (docs)</li>
              <li>• Intelligent model selection</li>
              <li>• Automatic table extraction</li>
            </ul>
          </div>
        </div>
        
        <h2 className={`text-2xl font-semibold mt-6 ${textColor}`}>Our Impact</h2>
        <p className={`mt-2 ${secondaryTextColor}`}>
          RecordIQ is committed to contributing to the United Nations Sustainable Development Goals (SDGs):
        </p>
        <ul className={`mt-2 ${secondaryTextColor} list-disc list-inside space-y-2`}>
          <li>
            <strong>SDG 8 - Decent Work & Economic Growth:</strong> We empower small businesses and entrepreneurs with professional financial management tools, helping them formalize operations, reduce administrative burden, and scale efficiently.
          </li>
          <li>
            <strong>SDG 9 - Industry, Innovation & Infrastructure:</strong> We democratize access to business infrastructure through technology, making professional invoicing, OCR document processing, and payment tools accessible to everyone—not just large corporations.
          </li>
          <li>
            <strong>SDG 10 - Reduced Inequalities:</strong> We level the playing field for micro-entrepreneurs, freelancers, and service providers by providing enterprise-grade tools at accessible prices, removing economic barriers to professional business management.
          </li>
        </ul>
        <p className={`mt-4 ${secondaryTextColor}`}>
          By making business tools accessible and affordable, we help create economic opportunities and promote inclusive growth for all.
        </p>
      </div>
    </div>
  );
};

export default AboutPage;