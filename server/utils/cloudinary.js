const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

if (!process.env.CLOUDINARY_CLOUD_NAME) {
  console.error("[Cloudinary] CRITICAL: CLOUDINARY_CLOUD_NAME is missing!");
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const avatarStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'zenchat_avatars',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 500, height: 500, crop: 'limit' }]
  }
});

const mediaStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "zenchat_media",
    resource_type: "auto",
  }
});

const upload = multer({ storage: avatarStorage });
const uploadMedia = multer({
  storage: mediaStorage,
  limits: {
    fileSize: 7 * 1024 * 1024
  }
});

module.exports = { cloudinary, upload, uploadMedia };
