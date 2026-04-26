const cloudinary = require('cloudinary').v2;
const multer = require('multer');

console.log("[Cloudinary] Configuring with Cloud Name:", (process.env.CLOUDINARY_CLOUD_NAME || "").trim());
console.log("[Cloudinary] API Key Present:", !!process.env.CLOUDINARY_API_KEY);
console.log("[Cloudinary] API Secret Present:", !!process.env.CLOUDINARY_API_SECRET);

cloudinary.config({
  cloud_name: (process.env.CLOUDINARY_CLOUD_NAME || "").trim(),
  api_key: (process.env.CLOUDINARY_API_KEY || "").trim(),
  api_secret: (process.env.CLOUDINARY_API_SECRET || "").trim()
});

const storage = multer.diskStorage({});
const upload = multer({ storage });

const uploadMedia = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }
});

module.exports = { cloudinary, upload, uploadMedia };
