// Imágenes de canchas subidas por el admin: frontend/src/imagenes/{nombre-cancha}.webp.
// El glob mapea la ruta del archivo a la URL servida por Vite sin guardar nada en la
// base de datos.
const imagenesCanchas = import.meta.glob('/src/imagenes/*.webp', { eager: true, import: 'default' });

// Debe coincidir con slugifyNombre del backend (backend/src/services/canchaImagenService.js).
export function slugifyNombre(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'cancha';
}

export function imagenDeCancha(nombre) {
  return imagenesCanchas[`/src/imagenes/${slugifyNombre(nombre)}.webp`] || null;
}
