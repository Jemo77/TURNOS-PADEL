const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { frontendComprobantesDir } = require('../config/env');

function directorioComprobantes() {
  fs.mkdirSync(frontendComprobantesDir, { recursive: true });
  return frontendComprobantesDir;
}

function rutaImagen(reservaId) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(reservaId || ''))) {
    throw new Error('ID de reserva inválido');
  }

  const dir = directorioComprobantes();
  const nombreArchivo = `${reservaId}.webp`;
  const ruta = path.resolve(dir, nombreArchivo);

  if (path.basename(ruta) !== nombreArchivo || path.relative(dir, ruta).startsWith('..')) {
    throw new Error('Ruta de comprobante inválida');
  }

  return ruta;
}

async function guardarImagen(reservaId, buffer) {
  const ruta = rutaImagen(reservaId);
  await sharp(buffer)
    .rotate()
    .resize({ width: 2000, withoutEnlargement: true })
    .webp({ quality: 85 })
    .toFile(ruta);

  return path.basename(ruta);
}

async function eliminarImagen(reservaId) {
  try {
    await fs.promises.unlink(rutaImagen(reservaId));
  } catch (error) {
    // Si no existe, ignorarlo.
  }
}

module.exports = { guardarImagen, eliminarImagen, rutaImagen };
