const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';

const requiredKeys = ['DATABASE_URL', 'JWT_SECRET', 'CRON_SECRET', 'MP_TOKEN_ENCRYPTION_KEY'];
for (const key of requiredKeys) {
  if (!process.env[key] || !String(process.env[key]).trim()) {
    throw new Error(`Falta la variable de entorno requerida: ${key}`);
  }
}

const port = process.env.PORT || 4000;

module.exports = {
  port,
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: '8h',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  // Política de cobros: TODOS los cobros pasan SIEMPRE por la cuenta de Mercado
  // Pago del club conectada vía OAuth, nunca por una cuenta o token de la
  // plataforma. MP_CLIENT_ID / MP_CLIENT_SECRET se usan ÚNICAMENTE para el paso
  // de OAuth (pantalla "Conectar con Mercado Pago" y refresco del token del club).
  // Nunca para crear o consultar pagos, y nunca con marketplace_fee / application_fee.
  mpClientId: process.env.MP_CLIENT_ID || '',
  mpClientSecret: process.env.MP_CLIENT_SECRET || '',
  mpOauthRedirectUri: process.env.MP_OAUTH_REDIRECT_URI || 'http://localhost:4000/api/admin/mp/oauth/callback',
  // URL pública del backend, para armar la notification_url del webhook de Mercado Pago.
  // En producción debe ser un dominio público al que MP pueda pegarle.
  backendUrl: process.env.BACKEND_URL || `http://localhost:${port}`,
  mpTokenEncryptionKey: process.env.MP_TOKEN_ENCRYPTION_KEY,
  holdMinutosCheckout: Number(process.env.HOLD_MINUTOS_CHECKOUT || 10),
  holdMinutosComprobante: Number(process.env.HOLD_MINUTOS_COMPROBANTE || 30),
  cronSecret: process.env.CRON_SECRET,
  // Cron interno: expira holds y concilia MP dentro del propio proceso. Es la red de
  // seguridad para que los holds nunca queden bloqueados si no hay cron externo
  // configurado. En despliegues con cron externo, dejarlo en false.
  cronInterno: process.env.CRON_INTERNO === 'true',
  cancelacionHorasMin: Number(process.env.CANCELACION_HORAS_MIN || 24),
  // Carpeta donde se guardan las imágenes de las canchas (nombre de la cancha + .webp).
  // Por defecto apunta a frontend/src/imagenes; se puede sobreescribir con IMAGENES_DIR.
  frontendImagenesDir: process.env.IMAGENES_DIR || path.resolve(__dirname, '../../../frontend/src/imagenes'),
  frontendComprobantesDir: process.env.COMPROBANTES_DIR || path.resolve(__dirname, '../../../frontend/src/imagenes/comprobantes')
};
