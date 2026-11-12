/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * SERVICIO DE MERCADO PAGO — TODO EL COBRO PASA SIEMPRE POR LA CUENTA DEL CLUB
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Reglas innegociables para cualquier código que toque Mercado Pago (no
 * modificarlas ni "mejorarlas" sin leer esto primero):
 *
 * 1. mpClientId / mpClientSecret (backend/src/config/env.js) se usan ÚNICAMENTE
 *    para el paso de OAuth (pantalla "Conectar con Mercado Pago") y el refresco
 *    del token del club, que es parte del ciclo de vida del OAuth. NUNCA para
 *    crear o consultar pagos.
 *
 * 2. Cualquier llamado a la API de Mercado Pago para cobrar o consultar un pago
 *    debe autenticarse con el access_token de la fila más reciente de
 *    CuentaMercadoPago (la cuenta del club), nunca con otro token. Eso se logra
 *    a través de obtenerAccessTokenValido().
 *
 * 3. NUNCA agregar marketplace_fee, application_fee ni ningún parámetro de split
 *    o comisión hacia otra cuenta en las llamadas a Mercado Pago.
 *
 * 4. accessToken y refreshToken de CuentaMercadoPago se guardan SIEMPRE
 *    cifrados en la base de datos (nunca texto plano), usando
 *    backend/src/utils/crypto.js (AES-256-GCM, clave derivada de
 *    MP_TOKEN_ENCRYPTION_KEY con scrypt).
 *
 * 5. El access_token de Mercado Pago vence en horas: obtenerAccessTokenValido()
 *    refresca automáticamente con el refresh_token
 *    (grant_type=refresh_token contra /oauth/token) antes de usarlo, sin
 *    intervención manual.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const prisma = require('../config/prisma');
const { AppError, ConflictError } = require('../utils/errors');
const { encriptar, desencriptar } = require('../utils/crypto');
const { mpClientId, mpClientSecret, frontendUrl, backendUrl } = require('../config/env');

const MP_API = 'https://api.mercadopago.com';
const ANTICIPACION_REFRESH_MS = 5 * 60 * 1000; // refrescar si faltan menos de 5 minutos para vencer

// Última fila de CuentaMercadoPago = la cuenta del club conectada vía OAuth.
async function obtenerCuentaConectada() {
  return prisma.cuentaMercadoPago.findFirst({ orderBy: { conectadaEn: 'desc' } });
}

// Refresca el token con el refresh_token del club y guarda los nuevos tokens
// SIEMPRE cifrados. Devuelve el access_token vigente (desencriptado).
async function refrescarYGuardarToken(cuenta) {
  const refreshToken = desencriptar(cuenta.refreshToken);

  const response = await fetch(`${MP_API}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: mpClientId,
      client_secret: mpClientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    throw new AppError(
      `No se pudo refrescar el token de Mercado Pago: ${data.error_description || data.message || response.status}`,
      500
    );
  }

  await prisma.cuentaMercadoPago.update({
    where: { id: cuenta.id },
    data: {
      accessToken: encriptar(data.access_token),
      refreshToken: data.refresh_token ? encriptar(data.refresh_token) : cuenta.refreshToken,
      publicKey: data.public_key || cuenta.publicKey,
      scope: data.scope || cuenta.scope,
      expiraToken: new Date(Date.now() + Number(data.expires_in || 3600) * 1000)
    }
  });

  return data.access_token;
}

// Devuelve el access_token vigente de la cuenta del club (desencriptado),
// refrescándolo automáticamente si está por vencer o ya venció.
async function obtenerAccessTokenValido() {
  const cuenta = await obtenerCuentaConectada();
  if (!cuenta) {
    throw new ConflictError('El club todavía no conectó su cuenta de Mercado Pago');
  }

  if (cuenta.expiraToken.getTime() - Date.now() < ANTICIPACION_REFRESH_MS) {
    return refrescarYGuardarToken(cuenta);
  }

  return desencriptar(cuenta.accessToken);
}

// Crea una preferencia de Checkout Pro autenticada con el token del club.
// NO incluye marketplace_fee ni application_fee (regla 3).
async function crearPreferenciaPago(reserva) {
  const accessToken = await obtenerAccessTokenValido();

  const fechaISO = reserva.fecha instanceof Date
    ? reserva.fecha.toISOString().slice(0, 10)
    : String(reserva.fecha).slice(0, 10);
  const titulo = `Turno de pádel — ${reserva.cancha?.nombre || ''} ${fechaISO} ${reserva.horaInicio}`.trim();

  const response = await fetch(`${MP_API}/checkout/preferences`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      items: [
        {
          title: titulo,
          quantity: 1,
          unit_price: Number(reserva.montoTotal),
          currency_id: 'ARS'
        }
      ],
      external_reference: reserva.id,
      back_urls: {
        success: `${frontendUrl}/reservar/${reserva.id}`,
        failure: `${frontendUrl}/reservar/${reserva.id}`,
        pending: `${frontendUrl}/reservar/${reserva.id}`
      },
      auto_return: 'approved',
      notification_url: `${backendUrl}/api/mp/webhook`
      // IMPORTANTE: NO agregar marketplace_fee, application_fee ni ningún split.
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.init_point || !data.id) {
    throw new AppError(`Mercado Pago no pudo crear la preferencia: ${data.message || response.status}`, 500);
  }

  return { initPoint: data.init_point, preferenceId: data.id };
}

// Consulta un pago autenticado con el token del club. Devuelve null si la
// respuesta no es ok (o si no hay cuenta conectada).
async function consultarPago(paymentId) {
  try {
    const accessToken = await obtenerAccessTokenValido();
    const response = await fetch(`${MP_API}/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    return null;
  }
}

module.exports = {
  obtenerCuentaConectada,
  obtenerAccessTokenValido,
  crearPreferenciaPago,
  consultarPago
};