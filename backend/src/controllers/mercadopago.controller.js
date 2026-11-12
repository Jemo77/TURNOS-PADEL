const prisma = require('../config/prisma');
const { AppError } = require('../utils/errors');
const { crearPreferenciaPago, consultarPago } = require('../services/mercadoPagoService');

// Genera una preferencia de Checkout Pro para una reserva, siempre con la cuenta
// de Mercado Pago del club (ver backend/src/services/mercadoPagoService.js).
async function generarPreferencia(req, res, next) {
  try {
    const reserva = await prisma.reserva.findUnique({
      where: { id: req.params.id },
      include: { cancha: true }
    });

    if (!reserva) throw new AppError('Reserva no encontrada', 404);
    if (reserva.estado !== 1 && reserva.estado !== 2) {
      throw new AppError('La reserva ya no puede pagarse', 409);
    }
    if (reserva.estadoPago === 'PAGADO') {
      throw new AppError('La reserva ya está pagada', 409);
    }

    const { initPoint, preferenceId } = await crearPreferenciaPago(reserva);
    res.json({ initPoint, preferenceId });
  } catch (error) {
    next(error);
  }
}

// Webhook de Mercado Pago. SIEMPRE responde 200 (aunque no encuentre la reserva
// o falle algo), para que MP no reintente indefinidamente.
async function webhook(req, res) {
  try {
    const paymentId = req.query['data.id'] || req.query.id || req.body?.data?.id;
    const topic = req.query.type || req.query.topic || req.body?.type;

    if (topic !== 'payment' || !paymentId) {
      return res.status(200).json({ received: true });
    }

    const pago = await consultarPago(paymentId);
    if (!pago || !pago.external_reference) {
      return res.status(200).json({ received: true });
    }

    const reserva = await prisma.reserva.findUnique({ where: { id: String(pago.external_reference) } });
    if (reserva) {
      if (pago.status === 'approved') {
        await prisma.reserva.update({
          where: { id: reserva.id },
          data: {
            estado: 2,
            estadoPago: 'PAGADO',
            confirmadaEn: new Date(),
            expiraEn: null,
            metodoPago: 'TARJETA_VIRTUAL'
          }
        });
      } else if (pago.status === 'rejected' || pago.status === 'cancelled') {
        await prisma.reserva.update({
          where: { id: reserva.id },
          data: { estadoPago: 'RECHAZADO' }
        });
      }
    }

    res.status(200).json({ received: true });
  } catch (error) {
    res.status(200).json({ received: true });
  }
}

module.exports = { generarPreferencia, webhook };