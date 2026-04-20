const cloudinary = require('cloudinary').v2;
const multer = require('multer');

cloudinary.config({
  cloud_name: (process.env.CLOUDINARY_CLOUD_NAME || "").trim(),
  api_key: (process.env.CLOUDINARY_API_KEY || "").trim(),
  api_secret: (process.env.CLOUDINARY_API_SECRET || "").trim()
});

// Use memory storage to avoid middleware crashes
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Higher limit for media
const uploadMedia = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

module.exports = { cloudinary, upload, uploadMedia };
