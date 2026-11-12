/**
 * Genera ilustraciones provisionales de las canchas como .webp.
 *
 * Son provisionales: el flujo real es que el admin suba la foto desde el panel
 * (Canchas -> Nueva cancha -> Imagen), que la guarda en frontend/src/imagenes/{slug}.webp.
 * Sirven para que la demo no muestre placeholders grises, pero hay que reemplazarlas por
 * fotos reales del club antes de mostrar el producto.
 *
 * Uso: node scripts/generar-imagenes-canchas.js
 */
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const DESTINO = path.resolve(__dirname, '../../frontend/src/imagenes');

// Cada cancha con su paleta: pasto, franja de juego y vidrio.
const VARIANTES = [
  { archivo: 'cancha-1.webp', pasto: '#2f855a', pastoOscuro: '#276749', juego: '#1a5490', vidrio: '#bee3f8', marco: '#2c5282' },
  { archivo: 'cancha-2.webp', pasto: '#2b6cb0', pastoOscuro: '#2a4365', juego: '#0f2942', vidrio: '#c6f6d5', marco: '#285e61' },
  { archivo: 'cancha-3.webp', pasto: '#9c6644', pastoOscuro: '#7b4f34', juego: '#1a4731', vidrio: '#feebc8', marco: '#7f5539' }
];

const W = 1200;
const H = 800;

// Cancha de padel vista desde arriba, en proporcion, con la pista de juego y el glass.
function svg({ pasto, pastoOscuro, juego, vidrio, marco }) {
  const m = 70;               // margen exterior
  const pistaX = m;
  const pistaY = m;
  const pistaW = W - m * 2;
  const pistaH = H - m * 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="pasto" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${pasto}"/>
      <stop offset="100%" stop-color="${pastoOscuro}"/>
    </linearGradient>
    <linearGradient id="cielo" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0b1f3a"/>
      <stop offset="100%" stop-color="#16283f"/>
    </linearGradient>
  </defs>

  <!-- fondo -->
  <rect width="${W}" height="${H}" fill="url(#cielo)"/>

  <!-- recorta a la pista, con esquinas redondeadas -->
  <g>
    <clipPath id="pistaClip">
      <rect x="${pistaX}" y="${pistaY}" width="${pistaW}" height="${pistaH}" rx="18"/>
    </clipPath>

    <g clip-path="url(#pistaClip)">
      <rect x="${pistaX}" y="${pistaY}" width="${pistaW}" height="${pistaH}" fill="url(#pasto)"/>

      <!-- cesped en franjas -->
      <g opacity="0.07">
        ${Array.from({ length: 12 }).map((_, i) =>
          `<rect x="${pistaX + i * (pistaW / 12)}" y="${pistaY}" width="${pistaW / 24}" height="${pistaH}"/>`
        ).join('\n        ')}
      </g>

      <!-- zona de servicio, en el color de la pista de juego -->
      <rect x="${pistaX + pistaW * 0.22}" y="${pistaY}" width="${pistaW * 0.56}" height="${pistaH}" fill="${juego}" opacity="0.92"/>

      <!-- líneas de la pista -->
      <g stroke="#ffffff" stroke-width="4" fill="none" opacity="0.92">
        <!-- perimeter -->
        <rect x="${pistaX + pistaW * 0.22}" y="${pistaY}" width="${pistaW * 0.56}" height="${pistaH}"/>
        <!-- linea de saque -->
        <line x1="${pistaX}" y1="${pistaY + pistaH / 2}" x2="${pistaX + pistaW * 0.22}" y2="${pistaY + pistaH / 2}"/>
        <line x1="${pistaX + pistaW * 0.78}" y1="${pistaY + pistaH / 2}" x2="${pistaX + pistaW}" y2="${pistaY + pistaH / 2}"/>
        <!-- lineas de las cajas de saqueo -->
        <line x1="${pistaX + pistaW * 0.22}" y1="${pistaY + pistaH * 0.14}" x2="${pistaX + pistaW * 0.78}" y2="${pistaY + pistaH * 0.14}"/>
        <line x1="${pistaX + pistaW * 0.22}" y1="${pistaY + pistaH * 0.86}" x2="${pistaX + pistaW * 0.78}" y2="${pistaY + pistaH * 0.86}"/>
        <!-- linea de saque central -->
        <line x1="${pistaX + pistaW * 0.5}" y1="${pistaY}" x2="${pistaX + pistaW * 0.5}" y2="${pistaY + pistaH * 0.14}"/>
        <line x1="${pistaX + pistaW * 0.5}" y1="${pistaY + pistaH * 0.86}" x2="${pistaX + pistaW * 0.5}" y2="${pistaY + pistaH}"/>
      </g>

      <!-- vidrio perimetral (mesh) -->
      <g>
        <rect x="${pistaX}" y="${pistaY}" width="${pistaW}" height="${pistaH}" fill="none" stroke="${marco}" stroke-width="14" opacity="0.5"/>
        <rect x="${pistaX}" y="${pistaY}" width="${pistaW}" height="${pistaH}" fill="none" stroke="${vidrio}" stroke-width="3" opacity="0.75"/>
        <g stroke="${vidrio}" stroke-width="2" opacity="0.35">
          ${Array.from({ length: 26 }).map((_, i) =>
            `<line x1="${pistaX + (i + 0.5) * (pistaW / 26)}" y1="${pistaY}" x2="${pistaX + (i + 0.5) * (pistaW / 26)}" y2="${pistaY + pistaH}"/>`
          ).join('\n          ')}
        </g>
      </g>

      <!-- sombra suave para que no se vea plano -->
      <rect x="${pistaX}" y="${pistaY}" width="${pistaW}" height="${pistaH}" fill="url(#sombra)" opacity="0.18"/>
      <radialGradient id="sombra" cx="0.5" cy="0.35" r="0.8">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0.45"/>
      </radialGradient>
    </g>
  </g>
</svg>`;
}

(async () => {
  fs.mkdirSync(DESTINO, { recursive: true });

  for (const variante of VARIANTES) {
    const salida = path.join(DESTINO, variante.archivo);
    await sharp(Buffer.from(svg(variante)))
      .webp({ quality: 82 })
      .toFile(salida);
    console.log('generada', path.relative(process.cwd(), salida));
  }
})();
