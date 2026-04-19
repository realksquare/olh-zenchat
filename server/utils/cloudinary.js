const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Storage for avatar images only (profile pictures)
const avatarStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'zenchat_avatars',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 500, height: 500, crop: 'limit' }]
  }
});

// Storage for chat media (images + videos)
const mediaStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    const isVideo = file.mimetype.startsWith('video/');
    return {
      folder: 'zenchat_media',
      resource_type: isVideo ? 'video' : 'image',
      allowed_formats: isVideo
        ? ['mp4', 'mov', 'webm', 'mkv']
        : ['jpg', 'jpeg', 'png', 'webp', 'gif'],
      transformation: isVideo
        ? [{ quality: 'auto' }]
        : [{ width: 1200, crop: 'limit', quality: 'auto', fetch_format: 'auto' }]
    };
  }
});

const upload = multer({ storage: avatarStorage });
const uploadMedia = multer({
  storage: mediaStorage,
  limits: {
    fileSize: 7 * 1024 * 1024 // 7 MB max
  }
});

module.exports = { cloudinary, upload, uploadMedia };
