const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { frontendImagenesDir } = require('../config/env');

// Convierte el nombre de una cancha a un nombre de archivo seguro.
// Debe mantenerse idéntica a la versión del frontend (frontend/src/App.jsx).
function slugifyNombre(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'cancha';
}

function directorioImagenes() {
  fs.mkdirSync(frontendImagenesDir, { recursive: true });
  return frontendImagenesDir;
}

function rutaImagen(nombre) {
  return path.join(directorioImagenes(), `${slugifyNombre(nombre)}.webp`);
}

// Guarda (o reemplaza) la imagen de una cancha como {nombre}.webp en frontend/src/imagenes.
async function guardarImagen(nombre, buffer) {
  const ruta = rutaImagen(nombre);
  await sharp(buffer)
    .rotate() // respeta la orientación EXIF
    .resize({ width: 1600, withoutEnlargement: true })
    .webp({ quality: 85 })
    .toFile(ruta);
  return path.basename(ruta);
}

async function eliminarImagen(nombre) {
  try {
    await fs.promises.unlink(rutaImagen(nombre));
  } catch (error) {
    // Si no existe el archivo, no hay nada que borrar.
  }
}

// Elimina la imagen anterior cuando la cancha cambió de nombre.
async function renombrarImagen(nombreAnterior, nombreNuevo) {
  if (!nombreAnterior || !nombreNuevo) return;
  if (slugifyNombre(nombreAnterior) !== slugifyNombre(nombreNuevo)) {
    await eliminarImagen(nombreAnterior);
  }
}

module.exports = { slugifyNombre, guardarImagen, eliminarImagen, renombrarImagen };