const imgs = import.meta.glob('/src/imagenes/comprobantes/*.webp', { eager: true, import: 'default' });

export const imagenDeComprobante = (reservaId) => imgs[`/src/imagenes/comprobantes/${reservaId}.webp`] || null;
