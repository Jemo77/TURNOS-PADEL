const crypto = require('crypto');
const { z } = require('zod');
const prisma = require('../config/prisma');
const { parseFechaISO } = require('../utils/fecha');
const { listarPendientes, aprobarComprobante, rechazarComprobante } = require('../services/pagoService');
const { crearReservaManual } = require('../services/reservaService');
const QRCode = require('qrcode');
const { mpClientId, mpClientSecret, mpOauthRedirectUri } = require('../config/env');
const { encriptar } = require('../utils/crypto');
const { AppError, ConflictError } = require('../utils/errors');

const METODOS_PAGO = ['EFECTIVO_PRESENCIAL', 'TARJETA_VIRTUAL', 'TRANSFERENCIA'];

const reservaManualSchema = z.object({
  canchaId: z.string().trim().min(1, 'Elegí una cancha'),
  fecha: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida'),
  horaInicio: z.string().trim().regex(/^([01]?\d|2[0-3]):([0-5]\d)$/, 'Hora de inicio inválida'),
  horaFin: z.string().trim().regex(/^([01]?\d|2[0-3]):([0-5]\d)$/, 'Hora de fin inválida'),
  montoTotal: z.coerce.number().nonnegative('El monto no puede ser negativo'),
  clienteNombre: z.string().trim().max(120).optional().or(z.literal('')),
  clienteTelefono: z.string().trim().max(40).optional().or(z.literal('')),
  // El email es opcional: plenty de turnos se toman por teléfono en el club.
  clienteEmail: z.string().trim().email('Email inválido').optional().or(z.literal('')),
  metodoPago: z.enum(METODOS_PAGO).default('EFECTIVO_PRESENCIAL'),
  marcarPagada: z.coerce.boolean().default(false)
});

const cuentaTransferenciaSchema = z.object({
  nombre: z.string().trim().max(120).optional().or(z.literal('')),
  cbu: z.string().trim().max(34).optional().or(z.literal('')),
  alias: z.string().trim().max(120).optional().or(z.literal('')),
  banco: z.string().trim().max(120).optional().or(z.literal(''))
});

function primerError(error) {
  return error?.issues?.[0]?.message || 'Datos inválidos';
}

async function listarReservasAdmin(req, res, next) {
  try {
    const { fecha, canchaId } = req.query;

    const where = {};
    if (fecha) {
      where.fecha = parseFechaISO(fecha);
    }
    if (canchaId) where.canchaId = canchaId;

    const reservas = await prisma.reserva.findMany({
      where,
      include: { cancha: true, comprobante: true },
      orderBy: { fecha: 'asc' }
    });

    res.json(reservas);
  } catch (error) {
    next(error);
  }
}

async function marcarPagada(req, res, next) {
  try {
    const reserva = await prisma.reserva.findUnique({ where: { id: req.params.id } });
    if (!reserva) throw new AppError('Reserva no encontrada', 404);
    if (reserva.estado === 3 || reserva.estado === 4) throw new ConflictError('La reserva ya no puede pagarse');
    if (reserva.estadoPago === 'PAGADO') throw new ConflictError('La reserva ya está marcada como pagada');

    const result = await prisma.reserva.update({
      where: { id: req.params.id },
      data: {
        estadoPago: 'PAGADO',
        estado: 2,
        confirmadaEn: new Date(),
        expiraEn: null,
        confirmadaPorId: req.admin.id
      }
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function pendientesPagos(req, res, next) {
  try {
    const pagos = await listarPendientes();
    res.json(pagos);
  } catch (error) {
    next(error);
  }
}

async function aprobarPago(req, res, next) {
  try {
    const result = await aprobarComprobante(req.params.comprobanteId, req.admin.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function cancelarReservaAdmin(req, res, next) {
  try {
    const reserva = await prisma.reserva.findUnique({ where: { id: req.params.id } });
    if (!reserva) throw new AppError('Reserva no encontrada', 404);
    const result = await prisma.reserva.update({
      where: { id: req.params.id },
      data: { estado: 4, estadoPago: reserva.estadoPago === 'PAGADO' ? 'PAGADO' : 'RECHAZADO', expiraEn: null }
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function rechazarPago(req, res, next) {
  try {
    const result = await rechazarComprobante(req.params.comprobanteId, req.admin.id, req.body.motivo || 'Sin motivo');
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function getCuentaTransferencia(req, res, next) {
  try {
    const cuenta = await prisma.cuentaTransferencia.findFirst({
      where: { activo: true },
      orderBy: { createdAt: 'desc' }
    });

    res.json(cuenta || { nombre: 'Cuenta del club', cbu: '', alias: '', banco: '', activo: true });
  } catch (error) {
    next(error);
  }
}

async function getCuentaTransferenciaPublic(req, res, next) {
  try {
    const cuenta = await prisma.cuentaTransferencia.findFirst({
      where: { activo: true },
      orderBy: { createdAt: 'desc' }
    });

    res.json(cuenta || { nombre: 'Cuenta del club', cbu: '', alias: '', banco: '', activo: true });
  } catch (error) {
    next(error);
  }
}

// Alta manual de un turno desde el panel: lo usa el admin cuando alguien reserva
// por teléfono o en el club y hay que cargarlo a mano. Nace confirmado y, si el
// admin tildó "marcar como pagado", queda acreditado con su usuario registrado.
async function crearReservaManualAdmin(req, res, next) {
  try {
    const parsed = reservaManualSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ message: primerError(parsed.error) });
    }

    const cancha = await prisma.cancha.findUnique({ where: { id: parsed.data.canchaId } });
    if (!cancha) return res.status(404).json({ message: 'Cancha no encontrada' });

    const reserva = await crearReservaManual({
      ...parsed.data,
      adminId: req.admin.id
    });

    res.status(201).json(reserva);
  } catch (error) {
    next(error);
  }
}

async function saveCuentaTransferencia(req, res, next) {
  try {
    const parsed = cuentaTransferenciaSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ message: primerError(parsed.error) });
    }

    const { nombre, cbu, alias, banco } = parsed.data;
    const actual = await prisma.cuentaTransferencia.findFirst({ orderBy: { createdAt: 'desc' } });

    const cuenta = actual
      ? await prisma.cuentaTransferencia.update({
          where: { id: actual.id },
          data: {
            nombre: nombre || actual.nombre,
            cbu: cbu ?? actual.cbu,
            alias: alias ?? actual.alias,
            banco: banco ?? actual.banco,
            activo: true
          }
        })
      : await prisma.cuentaTransferencia.create({
          data: {
            nombre: nombre || 'Cuenta del club',
            cbu: cbu || '',
            alias: alias || '',
            banco: banco || '',
            activo: true
          }
        });

    res.json(cuenta);
  } catch (error) {
    next(error);
  }
}

async function conectarMercadoPago(req, res, next) {
  try {
    const missing = [];
    if (!mpClientId) missing.push('MP_CLIENT_ID');
    if (!mpClientSecret) missing.push('MP_CLIENT_SECRET');
    if (!mpOauthRedirectUri) missing.push('MP_OAUTH_REDIRECT_URI');

    if (missing.length) {
      return res.status(400).json({
        message: `Falta configurar Mercado Pago: ${missing.join(', ')}. Agregalos en el .env del backend.`
      });
    }

    const state = crypto.randomUUID();
    await prisma.oAuthEstadoPendiente.create({
      data: {
        state,
        expiraEn: new Date(Date.now() + 10 * 60 * 1000)
      }
    });

    const url = `https://auth.mercadopago.com/authorization` +
      `?client_id=${encodeURIComponent(mpClientId)}` +
      `&response_type=code&platform_id=mp` +
      `&state=${encodeURIComponent(state)}` +
      `&redirect_uri=${encodeURIComponent(mpOauthRedirectUri)}`;

    const qrDataUrl = await QRCode.toDataURL(url);
    res.json({ url, qrDataUrl, state, configurado: true });
  } catch (error) {
    next(error);
  }
}

async function estadoMercadoPago(req, res, next) {
  try {
    const cuenta = await prisma.cuentaMercadoPago.findFirst({ orderBy: { conectadaEn: 'desc' } });
    res.json({
      conectado: !!cuenta,
      configurado: !!(mpClientId && mpClientSecret && mpOauthRedirectUri),
      cuenta: cuenta ? { mpUserId: cuenta.mpUserId, expiraToken: cuenta.expiraToken } : null
    });
  } catch (error) {
    next(error);
  }
}

async function callbackMercadoPago(req, res, next) {
  try {
    const { code, state } = req.query;
    if (!code || !state) return res.status(400).send('Faltan parámetros de OAuth');

    const pendiente = await prisma.oAuthEstadoPendiente.findUnique({ where: { state: String(state) } });
    if (!pendiente || pendiente.usado || pendiente.expiraEn < new Date()) {
      return res.status(400).send('Conexión inválida o vencida');
    }

    const response = await fetch('https://api.mercadopago.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: mpClientId,
        client_secret: mpClientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: mpOauthRedirectUri
      })
    });

    const data = await response.json();
    if (!data.access_token || !data.user_id) {
      return res.status(400).send('No se pudo completar la conexión con Mercado Pago');
    }

    // Los tokens se guardan SIEMPRE cifrados (nunca texto plano).
    // Ver backend/src/utils/crypto.js y los comentarios del modelo CuentaMercadoPago.
    const accessTokenCifrado = encriptar(data.access_token);
    const refreshTokenCifrado = data.refresh_token ? encriptar(data.refresh_token) : '';

    await prisma.cuentaMercadoPago.upsert({
      where: { mpUserId: String(data.user_id) },
      update: {
        accessToken: accessTokenCifrado,
        refreshToken: refreshTokenCifrado,
        publicKey: data.public_key || null,
        scope: data.scope || null,
        expiraToken: new Date(Date.now() + Number(data.expires_in || 3600) * 1000)
      },
      create: {
        mpUserId: String(data.user_id),
        accessToken: accessTokenCifrado,
        refreshToken: refreshTokenCifrado,
        publicKey: data.public_key || null,
        scope: data.scope || null,
        expiraToken: new Date(Date.now() + Number(data.expires_in || 3600) * 1000)
      }
    });

    await prisma.oAuthEstadoPendiente.update({
      where: { state: String(state) },
      data: { usado: true }
    });

    res.send('<h1>Cuenta conectada</h1><p>Ya podés cerrar esta ventana.</p>');
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listarReservasAdmin,
  crearReservaManualAdmin,
  marcarPagada,
  cancelarReservaAdmin,
  pendientesPagos,
  aprobarPago,
  rechazarPago,
  getCuentaTransferencia,
  getCuentaTransferenciaPublic,
  saveCuentaTransferencia,
  conectarMercadoPago,
  estadoMercadoPago,
  callbackMercadoPago
};
