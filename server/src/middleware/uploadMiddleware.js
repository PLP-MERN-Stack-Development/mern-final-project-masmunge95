const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Create the base uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Create subdirectories for different upload types
const createSubDirectories = () => {
  const subDirs = [
    path.join(uploadDir, 'records'),
    path.join(uploadDir, 'invoices'),
    path.join(uploadDir, 'ocr'),
  ];
  
  subDirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
};

createSubDirectories();

// Helper function to create user-specific OCR folders organized by document type
const ensureOcrUserFolder = (userId, documentType) => {
  const userOcrDir = path.join(uploadDir, 'ocr', userId);
  const typeDir = path.join(userOcrDir, documentType || 'general');
  
  if (!fs.existsSync(userOcrDir)) {
    fs.mkdirSync(userOcrDir, { recursive: true });
  }
  
  if (!fs.existsSync(typeDir)) {
    fs.mkdirSync(typeDir, { recursive: true });
  }
  
  return typeDir;
};

// Map document types to folder names for better organization
const getDocumentTypeFolder = (documentType) => {
  const typeMap = {
    'receipt': 'receipts',
    'invoice': 'invoices', 
    'utility': 'utilities',
    'inventory': 'inventory',
    'customer': 'customers',
    'customer-consumption': 'consumption',
    'business-record': 'business-records'
  };
  return typeMap[documentType] || 'general';
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let dest;
    if (req.baseUrl.includes('/records')) {
      dest = path.join(uploadDir, 'records');
    } else if (req.baseUrl.includes('/invoices')) {
      dest = path.join(uploadDir, 'invoices');
    } else {
      dest = uploadDir;
    }
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ storage });

module.exports = {
  upload,
  ensureOcrUserFolder,
  getDocumentTypeFolder,
  uploadDir,
};
