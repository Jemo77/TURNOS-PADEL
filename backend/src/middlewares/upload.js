const multer = require('multer');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') return cb(null, true);
    cb(new Error('El archivo debe ser un PDF'));
  }
});

// Subida de imágenes para las canchas (se convierten a webp al guardarse).
upload.uploadImagen = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith('image/')) return cb(null, true);
    cb(new Error('El archivo debe ser una imagen (JPG, PNG, WEBP, etc.)'));
  }
});

module.exports = upload;