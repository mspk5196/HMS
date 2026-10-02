/**
 * upload.js
 * Multer middleware for employee document uploads (Aadhar, PAN).
 * Files are stored in the `uploads/` directory at the Backend root.
 */
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.resolve(__dirname, '../../uploads');

// Ensure the upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const ts = Date.now();
    const safe = file.fieldname.replace(/[^a-z0-9_]/gi, '_');
    cb(null, `${safe}_${ts}${ext}`);
  },
});

const fileFilter = (_req, file, cb) => {
  const allowed = ['.jpg', '.jpeg', '.png', '.pdf'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file type "${ext}". Allowed: jpg, jpeg, png, pdf`));
  }
};

/** Accepts up to 2 files: aadhar_doc and pan_doc */
const employeeDocUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB per file
}).fields([
  { name: 'aadhar_doc', maxCount: 1 },
  { name: 'pan_doc', maxCount: 1 },
]);

const logoFilter = (_req, file, cb) => {
  const allowed = ['.jpg', '.jpeg', '.png', '.svg', '.webp'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext) || file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported image type "${ext}". Allowed: jpg, jpeg, png, svg, webp`));
  }
};

const logoUpload = multer({
  storage,
  fileFilter: logoFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
}).single('logo');

module.exports = { employeeDocUpload, logoUpload };
