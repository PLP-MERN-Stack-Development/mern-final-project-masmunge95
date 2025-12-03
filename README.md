# RecordIQ - AI-Powered Business Management Platform

> **⚠️ DISCLAIMER**: This is a copy of the original project for assignment purposes. GitHub Actions workflows and CI/CD pipelines have been removed from this version to prevent deployment conflicts. The original project with full CI/CD implementation can be found at: [https://github.com/masmunge95/Recordiq.git](https://github.com/masmunge95/Recordiq.git)

A comprehensive, offline-first business management platform with AI-powered OCR, multi-tier subscriptions, and integrated payments. Built for service providers, utility companies, and small businesses to manage invoices, customers, records, and payments seamlessly across web and mobile.

🌐 **Live Demo:** [https://recordiq.vercel.app](https://recordiq.vercel.app)  
📱 **Platform:** Web + Android Mobile App  
💳 **Payments:** M-Pesa + Card (via IntaSend)  
🤖 **AI:** Azure Computer Vision + Document Intelligence

## 🌍 UN Sustainable Development Goals

RecordIQ contributes to the following UN SDGs:

- **SDG 8 - Decent Work & Economic Growth**: Empowering small businesses, utility providers, and service entrepreneurs with professional tools for financial management, helping formalize operations and scale efficiently
- **SDG 9 - Industry, Innovation & Infrastructure**: Democratizing access to business infrastructure through technology, making professional invoicing, billing, and payment tools accessible to all
- **SDG 10 - Reduced Inequalities**: Leveling the playing field for micro-entrepreneurs and utility service providers by providing enterprise-grade tools previously only available to large corporations
- **SDG 11 - Sustainable Cities & Communities**: Facilitating efficient utility service management and billing, supporting sustainable infrastructure development in communities

## 🚀 Features

### 💼 Business Management Core
- **Invoice Management** - Create, send, track invoices with automated numbering and status workflows
- **Customer Portal** - Secure portal for customers to view invoices and make payments
- **Payment Processing** - Integrated M-Pesa + Card payments via IntaSend (USD pricing, KES processing)
- **Customer Management** - Comprehensive CRM with contact info, payment history, and consumption tracking
- **Multi-Currency Support** - USD pricing with automatic KES conversion (1 USD = 130 KES)

### 🤖 AI-Powered OCR & Document Processing
- **Azure Computer Vision** - Extract text from handwritten meters, receipts, and documents
- **Azure Document Intelligence** - Advanced structured data extraction from invoices and bills
- **Tier-Based AI Routing** - Enterprise tier gets premium prebuilt-invoice model for superior accuracy
- **Auto-Population** - Extracted data automatically fills forms (invoices, records, meter readings)
- **Document Types Supported** - Receipts, invoices, utility bills, meter readings, inventory, customer records

### 💎 Subscription & Monetization
- **4-Tier System** - Trial (14 days) → Basic → Pro → Enterprise
- **Trial Extension** - One-time 14-day extension for trial users
- **Usage Tracking** - Real-time monitoring of invoices, customers, OCR scans, and records
- **Tiered Limits** - Scalable limits from 10 invoices (trial) to 10,000 (enterprise)
- **Automated Billing** - Recurring monthly/annual subscriptions with IntaSend webhooks
- **Seller Wallet System** - Track earnings, pending balances, and withdrawal requests

### 🏢 Utility Services & Meter Reading
- **Service Templates** - Configure water, electricity, gas services with fees and calculation rules
- **Meter Reading OCR** - Upload meter photos and extract readings via AI
- **Consumption Tracking** - Automatic calculation based on previous/current readings
- **Service Fee Calculation** - Tiered pricing with base fees and additional charges

### 📱 Advanced Capabilities
- **Offline-First Architecture** - Full CRUD operations work offline with background sync (Dexie IndexedDB)
- **Progressive Web App** - Installable web app with service worker caching
- **Native Android App** - Built with Capacitor for native mobile experience
- **Dark/Light Theme** - User preference persistence with smooth theme transitions
- **Toast Notification System** - Modern, non-intrusive feedback (success, error, warning, info)
- **Role-Based Access** - Separate seller, customer, and admin dashboards
- **Real-Time Sync** - 5-second background sync interval with conflict resolution
- **Export & Print** - PDF generation, CSV export, and print-friendly invoice layouts

## 📸 Screenshots

### Application Interface

<div align="center">

#### Dashboard & Invoice Management
![Seller Dashboard](screenshots/seller-dashboard.png)
*Seller dashboard with real-time analytics, recent invoices, and top customers*

![Invoice Management](screenshots/invoice-list.png)
*Invoice list view with status tracking, filtering, and export options*

![Invoice Detail](screenshots/invoice-detail.png)
*Detailed invoice view with print, PDF export, and payment options*

#### Customer Portal & Payments
![Customer Dashboard](screenshots/customer-dashboard.png)
*Customer portal showing pending invoices and payment history*

![Payment Gateway](screenshots/payment-form.png)
*Integrated IntaSend payment gateway for M-Pesa and card payments*

#### Utility Services & OCR
![Meter Reading](screenshots/meter-reading.png)
*Meter reading records with OCR extraction and consumption tracking*

![OCR Upload](screenshots/ocr-upload.png)
*Azure AI-powered OCR for automatic data extraction from documents*

![Customer Management](screenshots/customer-list.png)
*Customer management with contact information and export capabilities*

</div>

### CI/CD Pipeline

<div align="center">

#### GitHub Actions Workflow
![CI/CD Workflow Overview](screenshots/cicd-workflow-overview.png)
*Automated deployment pipeline with build, test, and deploy stages*

![CI/CD Job Details](screenshots/cicd-job-details.png)
*Detailed job execution logs showing build steps and deployment status*

</div>

## 🏗️ Architecture

### Frontend Stack
- **React 19** - UI component framework with concurrent features
- **React Router 7** - Client-side routing with data loaders
- **Tailwind CSS 4** - Utility-first styling with JIT compilation
- **Dexie 4** - IndexedDB wrapper for offline-first data storage
- **Clerk** - Authentication & user management with webhooks
- **Vite 6** - Fast build tool and dev server with HMR
- **Capacitor 7** - Native mobile app wrapper (Android SDK 35)
- **Axios** - HTTP client for API calls with interceptors

### Backend Stack
- **Node.js 18+** - LTS runtime environment
- **Express** - REST API server with middleware
- **MongoDB Atlas** - Cloud document database with sharding
- **Mongoose 8** - Schema validation & ORM with virtuals
- **Multer** - File upload handling with storage config
- **Azure Computer Vision** - OCR Read API for text extraction
- **Azure Document Intelligence** - Layout + Prebuilt Invoice models
- **IntaSend** - Payment gateway (M-Pesa, Cards, USD/KES)
- **Clerk** - Authentication webhook integration for user sync
- **Node-Cron** - Subscription renewal scheduler
- **Nodemailer** - Transactional email notifications

### Testing Stack
- **Vitest 4** - Unit testing with 100% pass rate (156/157 tests)
- **Cypress 15** - E2E testing with 67% pass rate (6/9 tests)
- **Jest 30** - Backend unit testing for controllers and services
- **Testing Library** - React component testing utilities

### Mobile Platform
- **Capacitor 7** - Cross-platform native runtime
- **Android SDK 35** - Target Android 15 (API Level 35)
- **Gradle 8.13** - Android build system with Kotlin DSL
- **ProGuard/R8** - Code optimization, obfuscation, and shrinking

### Key Architecture Patterns
- **Offline-First**: Local-first with background sync to server
- **Optimistic Updates**: UI updates before server confirmation
- **Idempotent Operations**: Safe retry logic for failed syncs
- **Role-Based Access Control**: Seller vs customer permission layers
- **String-based IDs**: UUID strings instead of MongoDB ObjectIds for client-server compatibility
- **Environment-Based Configuration**: Development, staging, and production URL management

## 📋 Project Structure

```
RecordIQ/
├── client/                          # React frontend (Vite + Capacitor)
│   ├── android/                     # Native Android project (Capacitor)
│   │   ├── app/
│   │   │   ├── src/main/
│   │   │   │   ├── AndroidManifest.xml
│   │   │   │   ├── res/             # Android resources (icons, strings, colors)
│   │   │   │   └── assets/          # Web assets (copied from build)
│   │   │   ├── build.gradle         # App-level Gradle config
│   │   │   └── proguard-rules.pro   # Code shrinking/obfuscation rules
│   │   ├── build.gradle             # Project-level Gradle config
│   │   ├── variables.gradle         # Capacitor variables (SDK versions)
│   │   └── keystore.properties.example  # Signing config template
│   │
│   ├── cypress/                     # E2E testing (Cypress)
│   │   ├── e2e/                     # Test specs (invoices, services, records)
│   │   ├── fixtures/                # Test data fixtures
│   │   └── support/                 # Test helpers and commands
│   │
│   ├── src/
│   │   ├── components/              # Reusable React components
│   │   │   ├── Header.jsx           # App header with nav and theme toggle
│   │   │   ├── Footer.jsx           # App footer with links
│   │   │   ├── Layout.jsx           # Page layout wrapper
│   │   │   ├── Button.jsx           # Styled button component
│   │   │   ├── Modal.jsx            # Modal dialog wrapper
│   │   │   ├── Toast.jsx            # Toast notification component
│   │   │   ├── ConfirmModal.jsx     # Confirmation dialog
│   │   │   ├── CenteredLoader.jsx   # Loading spinner
│   │   │   ├── ErrorBoundary.jsx    # Error boundary for React errors
│   │   │   ├── SubscriptionBanner.jsx  # Usage limits banner
│   │   │   ├── OfflineDisclaimer.jsx   # Offline mode indicator
│   │   │   ├── QueueStatus.jsx      # Sync queue status display
│   │   │   ├── AddInvoiceForm.jsx   # Invoice creation/edit form
│   │   │   ├── AddRecordForm/       # Record creation forms (subfolder)
│   │   │   ├── CustomerOcrRecordForm.jsx  # Customer-side record upload
│   │   │   ├── RecordViewer.jsx     # Record detail viewer with tabs
│   │   │   ├── RecordVerificationForm.jsx # Record verification UI
│   │   │   ├── InvoiceView.jsx      # Invoice detail display
│   │   │   ├── ReceiptView.jsx      # Receipt display component
│   │   │   ├── InventoryView.jsx    # Inventory display component
│   │   │   ├── UtilityReadingView.jsx  # Utility reading display
│   │   │   ├── CustomerRecordView.jsx  # Customer record display
│   │   │   ├── InvoiceDisputeForm.jsx  # Dispute submission form
│   │   │   ├── DisputeReviewDashboard.jsx  # Admin dispute review
│   │   │   ├── OcrUploader.jsx      # OCR file upload component
│   │   │   ├── PaymentForm.jsx      # IntaSend payment form
│   │   │   ├── ServiceForm.jsx      # Utility service config form
│   │   │   ├── AdminRoute.jsx       # Admin route guard
│   │   │   └── ClearLocalDataModal.jsx  # Local data cleanup modal
│   │   │
│   │   ├── pages/                   # Page components (routes)
│   │   │   ├── DashboardPage.jsx    # Role router (seller/customer redirect)
│   │   │   ├── SellerDashboardPage.jsx  # Seller analytics dashboard
│   │   │   ├── CustomerDashboardPage.jsx  # Customer portal dashboard
│   │   │   ├── RoleSelectionPage.jsx    # Role selection for new users
│   │   │   ├── InvoicesPage/        # Invoice list (subfolder with hooks)
│   │   │   ├── InvoiceDetailPage.jsx    # Invoice detail view
│   │   │   ├── CustomersPage.jsx    # Customer management list
│   │   │   ├── CustomerDetailPage.jsx   # Customer detail view
│   │   │   ├── RecordsPage/         # Records list (subfolder with hooks)
│   │   │   ├── RecordDetailPage/    # Record detail (subfolder)
│   │   │   ├── CustomerRecordsPage.jsx  # Customer-facing records view
│   │   │   ├── SharedRecordsPage.jsx    # Shared records viewer
│   │   │   ├── UtilityServicesPage.jsx  # Utility service templates
│   │   │   ├── WalletPage.jsx       # Seller wallet & withdrawals
│   │   │   ├── SubscriptionPage.jsx # Subscription tiers & trial extension
│   │   │   ├── AboutPage.jsx        # Platform info & tech stack
│   │   │   ├── ContactPage.jsx      # Contact form + FAQ (6 categories)
│   │   │   ├── PrivacyPolicyPage.jsx    # Privacy policy & disclosures
│   │   │   ├── AdminDashboardPage.jsx   # Admin overview dashboard
│   │   │   ├── AdminWalletsPage.jsx     # Admin wallet management
│   │   │   ├── AdminWithdrawalsPage.jsx # Admin withdrawal approvals
│   │   │   ├── AdminBillingPage.jsx     # Admin billing reconciliation
│   │   │   ├── AdminLedgerPage.jsx      # Admin payment ledger
│   │   │   ├── DisputeReviewPage.jsx    # Admin dispute management
│   │   │   ├── DebugInvoicesPage.jsx    # Development: Invoice debug
│   │   │   └── ToastDemoPage.jsx        # Development: Toast testing
│   │   │
│   │   ├── services/                # API & business logic layer
│   │   │   ├── api.js               # Axios instance with auth & env URLs
│   │   │   ├── syncService.js       # Core offline sync orchestrator
│   │   │   ├── syncQueue.js         # Sync queue management (Dexie)
│   │   │   ├── fullSync.js          # Full sync operations
│   │   │   ├── dataSyncService.js   # Data synchronization helpers
│   │   │   ├── queueService.js      # Queue processing logic
│   │   │   ├── dbUtils.js           # Database utility functions
│   │   │   ├── invoiceService.js    # Invoice CRUD API calls
│   │   │   ├── customerService.js   # Customer CRUD API calls
│   │   │   ├── recordService.js     # Record CRUD API calls
│   │   │   ├── utilityService.js    # Utility service API calls
│   │   │   ├── paymentService.js    # Payment processing API calls
│   │   │   ├── portalService.js     # Customer portal API calls
│   │   │   ├── ocrService.js        # OCR upload & processing API
│   │   │   ├── subscriptionService.js  # Subscription + trial extension
│   │   │   ├── walletService.js     # Wallet & withdrawal API calls
│   │   │   └── adminService.js      # Admin management API calls
│   │   │
│   │   ├── context/                 # React Context providers
│   │   │   ├── ThemeContext.jsx     # Dark/light theme state
│   │   │   └── ToastContext.jsx     # Toast notification state
│   │   │
│   │   ├── hooks/                   # Custom React hooks (co-located)
│   │   │   ├── AddRecordForm/       # Record form hooks
│   │   │   ├── InvoicesPage/        # Invoice page hooks
│   │   │   ├── RecordsPage/         # Records page hooks
│   │   │   └── RecordDetailPage/    # Record detail hooks
│   │   │
│   │   ├── utils/                   # Helper utilities
│   │   │   ├── dbDiag.js            # DB diagnostics (console-only)
│   │   │   └── producerDiag.js      # Production-guarded diagnostics
│   │   │
│   │   ├── tests/                   # Vitest unit tests
│   │   │   ├── unit/                # Component & service tests
│   │   │   └── setup.js             # Test environment setup
│   │   │
│   │   ├── db.js                    # Dexie IndexedDB schema (v5)
│   │   ├── db_clean.js              # Dev: DB cleanup utility
│   │   ├── App.jsx                  # Root component with routing
│   │   ├── main.jsx                 # React app entry point
│   │   └── index.css                # Global Tailwind styles
│   │
│   ├── public/
│   │   └── service-worker.js        # Service worker for offline mode
│   │
│   ├── .env                         # Environment variables (gitignored)
│   ├── .env.example                 # Environment template
│   ├── package.json                 # Dependencies & scripts
│   ├── vite.config.js               # Vite build & dev server config
│   ├── vitest.config.js             # Vitest unit test config
│   ├── cypress.config.js            # Cypress E2E test config
│   ├── capacitor.config.json        # Capacitor mobile config
│   ├── tailwind.config.js           # Tailwind CSS configuration
│   ├── jsconfig.json                # JavaScript path aliases
│   └── index.html                   # HTML entry point
│
├── server/                          # Node.js backend (Express)
│   ├── src/
│   │   ├── server.js                # Express app entry & routes
│   │   │
│   │   ├── config/
│   │   │   └── db.js                # MongoDB Atlas connection
│   │   │
│   │   ├── controllers/             # Request handlers (business logic)
│   │   │   ├── invoiceController.js # Invoice CRUD operations
│   │   │   ├── customerController.js    # Customer management
│   │   │   ├── recordController.js  # Record processing & verification
│   │   │   ├── paymentController.js # Payment processing (IntaSend)
│   │   │   ├── ocrController.js     # OCR processing (Azure AI)
│   │   │   ├── portalController.js  # Customer portal operations
│   │   │   ├── utilityServiceController.js  # Utility service templates
│   │   │   ├── withdrawalController.js  # Withdrawal management
│   │   │   ├── adminController.js   # Admin operations
│   │   │   └── authController.js    # Clerk webhook handling
│   │   │
│   │   ├── models/                  # MongoDB Mongoose schemas
│   │   │   ├── Invoice.js           # Invoice schema with line items
│   │   │   ├── Customer.js          # Customer schema with validation
│   │   │   ├── Record.js            # Generic record schema (OCR data)
│   │   │   ├── Payment.js           # Payment transaction schema
│   │   │   ├── Subscription.js      # Subscription with trialExtended flag
│   │   │   ├── SellerWallet.js      # Seller wallet balances
│   │   │   ├── WithdrawalRequest.js # Withdrawal request tracking
│   │   │   ├── PaymentLedger.js     # Payment reconciliation ledger
│   │   │   ├── UtilityService.js    # Utility service templates
│   │   │   ├── AnalysisEvent.js     # OCR analysis event logging
│   │   │   └── Counter.js           # Auto-increment counter
│   │   │
│   │   ├── routes/                  # API route definitions
│   │   │   ├── invoiceRoutes.js     # /api/invoices
│   │   │   ├── customerRoutes.js    # /api/customers
│   │   │   ├── recordRoutes.js      # /api/records
│   │   │   ├── paymentRoutes.js     # /api/payments
│   │   │   ├── ocrRoutes.js         # /api/ocr
│   │   │   ├── portalRoutes.js      # /api/portal
│   │   │   ├── utilityServiceRoutes.js  # /api/utility-services
│   │   │   ├── subscriptionRoutes.js    # /api/subscriptions (/extend-trial)
│   │   │   ├── subscriptionWebhookRoutes.js  # /api/subscription-webhooks
│   │   │   ├── withdrawal.js        # /api/withdrawals
│   │   │   ├── feeRoutes.js         # /api/fees
│   │   │   ├── adminRoutes.js       # /api/admin
│   │   │   ├── authRoutes.js        # /api/auth
│   │   │   └── webhookRoutes.js     # /api/webhooks (Clerk)
│   │   │
│   │   ├── middleware/              # Express middleware
│   │   │   ├── authMiddleware.js    # Clerk JWT verification
│   │   │   ├── ownershipMiddleware.js   # Resource ownership checks
│   │   │   ├── subscriptionMiddleware.js # Usage limit enforcement
│   │   │   ├── uploadMiddleware.js  # Multer file upload config
│   │   │   ├── errorHandler.js      # Global error handler
│   │   │   ├── logger.js            # Request logging
│   │   │   └── performanceMonitor.js    # Performance tracking
│   │   │
│   │   ├── services/                # Business logic services
│   │   │   ├── ocrService.js        # Azure OCR orchestration
│   │   │   ├── ocrParsers.js        # OCR text parsing utilities
│   │   │   ├── ocr/                 # OCR processing modules
│   │   │   │   ├── ocrGenericParser.js  # Generic text extraction
│   │   │   │   ├── ocrReceiptParser.js  # Receipt parsing
│   │   │   │   ├── ocrUtilityParser.js  # Utility bill parsing
│   │   │   │   ├── ocrHelpers.js    # OCR helper functions
│   │   │   │   ├── ocrOrchestration.js  # Tier-based routing logic
│   │   │   │   └── ocrValidation.js # OCR result validation
│   │   │   ├── payment/             # Payment processing modules
│   │   │   │   ├── paymentProvider.js       # IntaSend integration
│   │   │   │   └── paymentTransactionService.js  # Transaction handling
│   │   │   ├── invoice/             # Invoice processing modules
│   │   │   ├── record/              # Record processing modules
│   │   │   │   ├── recordConversionService.js   # Record type conversion
│   │   │   │   ├── recordCrudService.js     # Record CRUD operations
│   │   │   │   └── recordVerificationService.js # Record verification
│   │   │   ├── emailService.js      # Nodemailer email service
│   │   │   ├── feeService.js        # Fee calculation service
│   │   │   ├── subscriptionScheduler.js # Subscription renewal cron
│   │   │   ├── walletScheduler.js   # Wallet balance reconciliation
│   │   │   └── autoWithdrawalService.js # Auto withdrawal processing
│   │   │
│   │   ├── jobs/                    # Scheduled jobs (node-cron)
│   │   │   └── subscriptionRenewal.js   # Subscription renewal job
│   │   │
│   │   ├── utils/                   # Utility functions
│   │   │   └── asyncHandler.js      # Async error wrapper
│   │   │
│   │   └── backups/                 # Database backup scripts
│   │
│   ├── tests/                       # Jest unit & integration tests
│   │   ├── unit/                    # Unit tests (19k+ lines)
│   │   │   ├── ocrController.test.js
│   │   │   ├── ocrGenericParser.test.js
│   │   │   ├── ocrHelpers.test.js
│   │   │   ├── ocrOrchestration.test.js
│   │   │   ├── ocrParsers.test.js
│   │   │   ├── ocrReceiptParser.test.js
│   │   │   ├── ocrUtilityParser.test.js
│   │   │   ├── ocrValidation.test.js
│   │   │   ├── paymentProvider.test.js
│   │   │   ├── paymentTransactionService.test.js
│   │   │   ├── ownershipMiddleware.test.js
│   │   │   ├── recordConversionService.test.js
│   │   │   ├── recordCrudService.test.js
│   │   │   ├── recordVerificationService.test.js
│   │   │   └── uploadMiddleware.test.js
│   │   ├── integration/             # Integration tests
│   │   └── setup.js                 # Test environment setup
│   │
│   ├── uploads/                     # User-uploaded files (gitignored)
│   │   ├── invoices/
│   │   └── records/
│   │
│   ├── coverage/                    # Test coverage reports (gitignored)
│   │   ├── lcov.info
│   │   └── lcov-report/index.html
│   │
│   ├── .env                         # Environment variables (gitignored)
│   ├── .env.example                 # Environment template
│   ├── package.json                 # Dependencies & scripts
│   ├── jest.config.js               # Jest test configuration
│   └── server.js                    # Server entry point (alias to src/server.js)
│
├── screenshots/                     # App screenshots for README
│   ├── seller-dashboard.png
│   ├── invoice-list.png
│   └── ...
│
├── backups/                         # Database backups (gitignored)
│
├── .gitignore                       # Git ignore rules
├── package.json                     # Monorepo root scripts
├── README.md                        # Project documentation (this file)
└── RESUME.md                        # Developer resume/portfolio
```
│   └── ANDROID_PACKAGING.md         # Comprehensive Android build guide
│
└── README.md (this file)
```

## 🔄 Data Flow & Sync Architecture

### Offline-First Sync Flow
```
User Action (Create Invoice)
    ↓
[1] Optimistically update local Dexie DB
[2] Add job to syncQueue table
[3] UI updates immediately
    ↓
Background Sync (every 5 seconds in App.jsx)
    ↓
[4] Process syncQueue items via syncService.js
[5] Call appropriate API endpoint (POST/PUT/DELETE)
[6] On success: Write server response back to Dexie
[7] Remove item from syncQueue
[8] If offline: Queue persists, retries when online
```

### Data Types & String IDs
- **Invoice**: `_id` (string UUID), `customer` (string ref to Customer._id)
- **Customer**: `_id` (string UUID), unique `email` and `phone`
- **Record**: `_id` (string UUID), `invoice` (string ref)
- **Payment**: `_id` (string UUID), `invoice` (string ref)
- **UtilityService**: `_id` (string UUID), `fees` (array of objects)

All IDs are **strings** (not MongoDB ObjectIds) to ensure client-server compatibility and enable client-side UUID generation.

## 🎯 Role-Based Features

### Seller Dashboard
```
📊 Seller Dashboard
├─ Statistics Cards (Total, Sent, Paid, Revenue)
├─ Recent Invoices (Last 5 with status badges)
├─ Top Customers (By revenue)
└─ Quick Actions (Create Invoice, Manage Customers, View Records)
```

### Customer Portal
```
📋 Customer Dashboard
├─ My Invoices (Filtered by email, status: sent/paid/overdue)
├─ Invoice Details (View full invoice, payment options)
└─ Payment Gateway (Pay via card/online)
```

### Admin Dashboard
```
🔧 Admin Dashboard (Role: admin)
├─ Withdrawal Management
│  ├─ View pending/approved/rejected requests
│  ├─ Approve/reject with notes
│  ├─ View security issues from auto-approval system
│  └─ Manual payout processing
├─ Wallet Management
│  ├─ Search seller wallets by ID
│  ├─ View balance breakdown (available/pending/held)
│  ├─ Clear pending balances manually
│  └─ Check withdrawal details
├─ Billing & Reconciliation
│  ├─ View all OCR analysis events
│  ├─ Reconcile subscription usage
│  ├─ Track billing attribution
│  └─ Sync usage counters
└─ Payment Ledger
   ├─ View all platform transactions
   ├─ Filter by type/status/seller/date
   ├─ Fee breakdown (platform + processing)
   └─ Audit trail for compliance

See ADMIN_IMPLEMENTATION.md for complete documentation
```

## 🛠️ Tech Stack Details

### Frontend Technologies

| Technology | Purpose | Version |
|-----------|---------|---------|
| React | UI framework | 19.2.0 |
| Vite | Build tool | 6.x |
| React Router | Client routing | 7.9.6 |
| Tailwind CSS | Styling | 4.1.17 |
| Dexie | IndexedDB layer | 4.2.1 |
| Clerk | Auth & user mgmt | 5.55.0 |
| Axios | HTTP client | 1.13.2 |
| Capacitor | Mobile runtime | 7.4.4 |
| Capacitor Android | Android platform | 7.4.4 |

### Backend Technologies

| Technology | Purpose | Version |
|-----------|---------|---------|
| Node.js | Runtime | 18+ |
| Express | Web framework | 4.18.2 |
| MongoDB | Database | 5.0+ (Atlas) |
| Mongoose | ODM | 8.19.4 |
| Multer | File uploads | 1.4.5-lts.1 |
| Azure Computer Vision | OCR text extraction | Latest |
| Azure Document Intelligence | Document processing | Latest |
| IntaSend | Payment gateway | 1.1.2 |
| Clerk SDK Node | Backend auth | 4.13.23 |
| Node-Cron | Task scheduler | 3.0.3 |
| Nodemailer | Email service | 6.10.1 |
| Jest | Testing | 30.2.0 |

### Mobile & Build Technologies

| Technology | Purpose | Version |
|-----------|---------|---------|
| Gradle | Android build | 8.13.1 |
| Android SDK | Target platform | API 35 |
| Min SDK | Minimum support | API 23 |
| ProGuard/R8 | Code optimization | Built-in |
| Java | Android compatibility | 17 |

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- MongoDB 5.0+ Atlas (cloud database)
- Clerk account for authentication
- Azure account for Computer Vision & Document Intelligence
- IntaSend account for payment processing
- Modern browser with IndexedDB support
- (Optional) Android Studio for mobile app development

### Frontend Setup

```bash
cd client
npm install

# Configure environment variables
# Edit .env with your API keys and URLs

# Development URLs (for ngrok testing)
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
VITE_API_BASE_URL_DEV=https://your-ngrok-url.ngrok-free.dev/api
VITE_API_BASE_URL_PROD=https://your-production-backend.onrender.com/api
VITE_API_BASE_URL=https://your-ngrok-url.ngrok-free.dev/api

# Start development server
npm run dev
# Frontend runs on http://localhost:5173
```

### Backend Setup

```bash
cd server
npm install

# Configure environment variables in .env
NODE_ENV=development
PORT=5000
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/recordiq
CLERK_SECRET_KEY=sk_test_your_secret_key
CLERK_WEBHOOK_SECRET_LOCAL=whsec_your_webhook_secret

# IntaSend Payment Configuration
INTASEND_PUBLISHABLE_KEY=ISPubKey_test_your_key
INTASEND_SECRET_KEY=ISSecretKey_test_your_key

# Azure OCR Configuration
AZURE_COMPUTER_VISION_KEY=your_azure_key
AZURE_COMPUTER_VISION_ENDPOINT=https://your-service.cognitiveservices.azure.com/
AZURE_DOCUMENT_INTELLIGENCE_KEY=your_azure_key
AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT=https://your-service.cognitiveservices.azure.com/

# Frontend URLs for CORS
FRONTEND_URL_DEV=http://localhost:5173
FRONTEND_URL_NGROK=https://your-ngrok-url.ngrok-free.dev
FRONTEND_URL_PROD=https://your-frontend.vercel.app
FRONTEND_URL=http://localhost:5173

CORS_ALLOWED_ORIGINS=http://localhost:5173,https://your-ngrok-url.ngrok-free.dev,capacitor://localhost,http://localhost

# Start development server
npm run dev
# Backend runs on http://localhost:5000
```

### Android App Setup

```bash
cd client

# Build web assets
npm run build

# Initialize Capacitor (first time only)
npm run cap:init

# Add Android platform (first time only)
npm run cap:add:android

# Sync web assets to Android
npm run cap:sync

# Open in Android Studio
npm run cap:open:android

# Build debug APK
npm run build:android:debug

# Build release APK (requires keystore)
npm run build:android:release
```

See `guides/ANDROID_PACKAGING.md` for comprehensive Android build instructions.

### Initial Configuration

1. **Clerk Setup**
   - Create application in Clerk dashboard
   - Get publishable key for frontend
   - Get secret key for backend
   - Configure webhooks for user management
   - Add custom metadata fields: `role` (seller/customer)

2. **MongoDB Atlas Setup**
   - Create free cluster on MongoDB Atlas
   - Whitelist your IP address
   - Create database user with read/write permissions
   - Get connection string
   - Collections auto-created on first write

3. **Azure Setup**
   - Create Computer Vision resource
   - Create Document Intelligence resource
   - Get API keys and endpoints for both services
   - Configure for OCR text extraction

4. **IntaSend Setup**
   - Create account on IntaSend
   - Get test API keys for development
   - Get production API keys for live payments
   - Configure webhooks for payment notifications
   - Note: Pricing in USD, processing in KES

5. **Environment Variables Summary**
   - **Frontend**: `VITE_CLERK_PUBLISHABLE_KEY`, `VITE_API_BASE_URL_DEV`, `VITE_API_BASE_URL_PROD`
   - **Backend**: All keys listed in `.env` template above

## 📱 Key Features Walkthrough

### Creating a Utility Service Invoice

```jsx
// User flow
1. Navigate to /invoices
2. Click "Add Invoice"
3. Select customer from dropdown
4. Add utility service (water/electricity/gas)
5. Enter meter reading (previous/current)
6. Additional line items if needed
7. System calculates consumption and fees automatically
8. Set due date
9. Click "Save Invoice"

// Behind the scenes
→ Locally stored in Dexie as draft
→ Added to syncQueue
→ Background sync sends to server (5-second interval)
→ Server generates invoiceNumber (auto-increment)
→ Response synced back to local DB
→ UI updates with server-generated data
```

### OCR Meter Reading

```jsx
// User flow
1. Navigate to /records
2. Click "Add Record with OCR"
3. Upload meter photo
4. Azure Computer Vision extracts text
5. System identifies meter reading numbers
6. Auto-populates current reading
7. Select service and customer
8. Previous reading fetched automatically
9. Consumption calculated
10. Save record

// Behind the scenes
→ Image uploaded to server via multer
→ Azure Computer Vision API called
→ OCR text extracted and parsed
→ Meter reading identified via pattern matching
→ Record saved with OCR metadata
→ Synced to local Dexie DB
```

### Sending Invoice & Payment

```jsx
// User flow
1. Open invoice detail (/invoices/{id})
2. Click "Send Invoice"
3. Status changes to "sent"
4. Customer receives email notification
5. Customer views invoice in portal
6. Customer clicks "Pay Now"
7. Redirected to IntaSend payment page
8. Completes M-Pesa or card payment
9. Webhook updates invoice status to "paid"

// Behind the scenes
→ Local status updated to "sent"
→ syncQueue item added with action="update"
→ Server updates invoice status
→ Email service sends notification to customer
→ Customer accesses /customer-dashboard
→ Payment initiated via IntaSend API
→ Webhook receives payment confirmation
→ Invoice status updated to "paid"
→ Background sync updates local DB
```

### Offline Functionality

```
When offline:
✓ All data operations (CRUD) work normally
✓ Changes stored locally in Dexie
✓ syncQueue accumulates pending actions
✓ Service Worker caches API responses

When coming back online:
✓ Background sync automatically triggers
✓ syncQueue processes all pending items
✓ Server confirms or rejects changes
✓ Conflicts resolved via server-of-truth pattern
✓ UI automatically refreshes
```

## 🔐 Security & Authentication

- **Clerk Integration**: All requests validated via Clerk JWT tokens
- **Role-Based Access**: Middleware checks `publicMetadata.role` (seller/customer)
- **Data Isolation**: Users can only access their own data
- **String IDs**: UUIDs generated client-side, harder to enumerate
- **Customer Portal**: Invoices filtered by email + status constraints

## 📊 API Endpoints

### Invoices
```
GET    /api/invoices?sync=true        # Get all invoices (for sync)
GET    /api/invoices/{id}             # Get single invoice
POST   /api/invoices                  # Create invoice
PUT    /api/invoices/{id}             # Update invoice
DELETE /api/invoices/{id}             # Delete invoice
```

### Customers
```
GET    /api/customers                 # Get all customers
POST   /api/customers                 # Create customer
PUT    /api/customers/{id}            # Update customer
DELETE /api/customers/{id}            # Delete customer
```

### Customer Portal
```
GET    /api/portal/invoices           # Get customer's invoices (filtered by email)
GET    /api/portal/invoices/{id}      # Get single invoice (with access check)
```

### Records (OCR)
```
GET    /api/records                   # Get all records
POST   /api/records                   # Create record
PUT    /api/records/{id}              # Update record
DELETE /api/records/{id}              # Delete record
GET    /api/ocr/extract               # Extract text from image
```

## 🎨 UI/UX Highlights

### Responsive Design
- Mobile-first approach with Tailwind breakpoints
- Optimized form layouts for small screens
- Touch-friendly button sizing (min 44px)
- Collapsible navigation on mobile

### Accessibility
- Semantic HTML structure
- ARIA labels where needed
- Keyboard navigation support
- High contrast dark/light modes
- Form validation with clear error messages

### Performance
- Code splitting via React Router
- Lazy loading of pages
- Service Worker caching
- Dexie for instant data access
- Optimistic UI updates

## 📸 Screenshots (Placeholder)

<div style="text-align: center; padding: 20px;">

### Dashboard Overview
```
[Screenshot: Seller Dashboard with stats cards]
📊 Statistics overview with key metrics
- Total Invoices card
- Sent Invoices card
- Paid Invoices card
- Total Revenue card (green)
```

### Invoice Management
```
[Screenshot: Invoice creation form]
📝 Dynamic invoice form with:
- Customer selector dropdown
- Line item grid (description, qty, price)
- Quick add from service templates
- Total calculation
```

### Mobile Experience
```
[Screenshot: Mobile navigation menu]
📱 Responsive mobile menu with:
- Hamburger navigation
- Sign-in buttons for guests
- Dark/light theme toggle
- Navigation links
```

### Customer Portal
```
[Screenshot: Customer invoice view]
🔒 Customer-facing invoice portal with:
- Invoice details
- Payment options
- Status display
- Download/print options
```

</div>

## 🌐 Deployment

### Frontend Deployment

**Vercel (Recommended)**
```bash
# 1. Push code to GitHub
# 2. Connect repo to Vercel
# 3. Add environment variables:
#    - VITE_CLERK_PUBLISHABLE_KEY
#    - VITE_API_URL (backend URL)
# 4. Deploy automatically on push

# Live URL: [Add your Vercel deployment link here]
```

**Alternative: Netlify**
```bash
npm run build
netlify deploy --prod --dir=dist

# Live URL: [Add your Netlify deployment link here]
```

**Alternative: Self-hosted (Docker)**
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY client/ .
RUN npm install && npm run build
EXPOSE 3000
CMD ["npm", "run", "preview"]
```

### Backend Deployment

**Render (Recommended)**
```bash
# 1. Connect GitHub repo
# 2. Add environment variables:
#    - MONGODB_URI
#    - CLERK_SECRET_KEY
#    - NODE_ENV=production
# 3. Deploy automatically on push

# Live URL: [Add your Render deployment link here]
```

**Alternative: Railway**
```bash
railway login
railway link
railway up

# Live URL: [Add your Railway deployment link here]
```

**Alternative: Self-hosted (Docker)**
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY server/ .
RUN npm install
EXPOSE 5000
CMD ["npm", "start"]
```

**Alternative: Heroku**
```bash
heroku login
heroku create recordiq-api
git push heroku main

# Live URL: [Add your Heroku deployment link here]
```

## 🔗 Deployment Links

| Component | Provider | Status | Link |
|-----------|----------|--------|------|
| Frontend | Vercel | 🚀 Live | [Add frontend URL] |
| Backend | Render | 🚀 Live | [Add backend URL] |
| Database | MongoDB Atlas | 🚀 Live | [Private] |
| Auth | Clerk | ✅ Configured | [Configured] |

## 📈 Monitoring & Logging

### Frontend Monitoring
- Browser console logs for development
- Error boundaries for crash handling
- Performance metrics via Web Vitals
- Offline status detection

### Backend Monitoring
- Express request logging (morgan)
- Error stack traces
- Database query logging
- Performance monitoring middleware

## 🧪 Testing

### Test Coverage Summary
- **Vitest (Frontend Unit Tests)**: 100% pass rate - 156/157 tests passing, 1 skipped
- **Cypress (Frontend E2E Tests)**: 67% pass rate - 6/9 tests passing
- **Jest (Backend Unit Tests)**: Comprehensive coverage for controllers, services, and middleware

### Frontend Testing
```bash
cd client

# Unit Tests (Vitest)
npm run test              # Run all unit tests
npm run test:watch        # Watch mode for development
npm run test:coverage     # Generate coverage report

# E2E Tests (Cypress)
npm run test:e2e          # Run E2E tests headless
npm run test:e2e:open     # Open Cypress GUI
```

**Test Files (19,000+ lines of comprehensive tests)**:
- `tests/unit/` - React component tests
- `cypress/e2e/` - End-to-end user flow tests

### Backend Testing
```bash
cd server

# Unit Tests (Jest)
npm run test              # Run all tests
npm run test:watch        # Watch mode
npm run test:coverage     # Coverage report with lcov

# Test Coverage Areas
# ✅ OCR Controller (ocrController.test.js)
# ✅ OCR Generic Parser (ocrGenericParser.test.js)
# ✅ OCR Helpers (ocrHelpers.test.js)
# ✅ OCR Orchestration (ocrOrchestration.test.js)
# ✅ OCR Parsers (ocrParsers.test.js)
# ✅ OCR Receipt Parser (ocrReceiptParser.test.js)
# ✅ OCR Utility Parser (ocrUtilityParser.test.js)
# ✅ OCR Validation (ocrValidation.test.js)
# ✅ Payment Provider (paymentProvider.test.js)
# ✅ Payment Transaction Service (paymentTransactionService.test.js)
# ✅ Ownership Middleware (ownershipMiddleware.test.js)
# ✅ Record Conversion Service (recordConversionService.test.js)
# ✅ Record CRUD Service (recordCrudService.test.js)
# ✅ Record Verification Service (recordVerificationService.test.js)
# ✅ Upload Middleware (uploadMiddleware.test.js)
```

**Coverage Reports**: Available in `server/coverage/lcov-report/index.html`

### Test File Highlights
```javascript
// Example: Comprehensive OCR validation testing
describe('OCR Validation Service', () => {
  test('validates receipt extraction results', async () => {
    const result = await validateReceiptData(mockOcrResponse);
    expect(result.isValid).toBe(true);
    expect(result.confidence).toBeGreaterThan(0.8);
  });
  
  test('handles malformed OCR responses gracefully', async () => {
    const result = await validateReceiptData(null);
    expect(result.isValid).toBe(false);
    expect(result.errors).toBeDefined();
  });
});
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 Git Workflow

```bash
# Clone
git clone https://github.com/masmunge95/Recordiq.git
cd Recordiq

# Setup
cd client && npm install && cd ..
cd server && npm install && cd ..

# Development
# Terminal 1: Frontend
cd client && npm run dev

# Terminal 2: Backend
cd server && npm run dev

# Commit
git add .
git commit -m "feat: description"
git push origin main
```

## 🐛 Troubleshooting

### Sync Issues
**Problem**: Changes not syncing to server
- Check browser console for errors
- Verify network connectivity
- Check server logs for API errors
- Inspect syncQueue in Dexie DevTools

**Solution**:
```javascript
// In browser console
await db.syncQueue.toArray()  // See pending items
await db.open()               // Reconnect to DB
```

### Offline Issues
**Problem**: No offline functionality
- Ensure service worker is registered
- Check IndexedDB quota
- Clear browser cache and retry

### Authentication Issues
**Problem**: Clerk login not working
- Verify Clerk publishable key
- Check Clerk dashboard configuration
- Clear browser cookies

## 📚 Additional Resources

- [React Documentation](https://react.dev)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [Dexie.js Guide](https://dexie.org)
- [MongoDB Manual](https://docs.mongodb.com)
- [Express.js Guide](https://expressjs.com)
- [Clerk Documentation](https://clerk.com/docs)

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 👥 Team

- **Developer**: Samuel Munge Waema
- **Project**: Recordiq - Invoice Management & OCR Platform
- **Started**: 2025

## 📞 Support

- Email: waemasamuel95@gmail.com

---

**Last Updated**: December 2, 2025  
**Status**: Active Development  
**Version**: 1.2.0
