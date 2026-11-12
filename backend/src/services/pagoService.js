const prisma = require('../config/prisma');
const { AppError, ConflictError } = require('../utils/errors');

async function listarPendientes() {
  return prisma.comprobante.findMany({
    where: { estado: 'PENDIENTE' },
    include: { reserva: { include: { cancha: true } } }
  });
}

async function aprobarComprobante(comprobanteId, usuarioId) {
  const comprobante = await prisma.comprobante.findUnique({
    where: { id: comprobanteId },
    include: { reserva: true }
  });

  if (!comprobante) throw new AppError('Comprobante no encontrado', 404);
  if (comprobante.reserva.estado === 3 || comprobante.reserva.estado === 4) {
    throw new ConflictError('La reserva ya no puede aprobarse');
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.comprobante.update({
        where: { id: comprobanteId },
        data: {
          estado: 'APROBADO',
          revisadoEn: new Date(),
          revisadoPorId: usuarioId,
          matchMp: true
        }
      });

      await tx.reserva.update({
        where: { id: comprobante.reservaId },
        data: {
          estado: 2,
          estadoPago: 'PAGADO',
          confirmadaEn: new Date(),
          expiraEn: null,
          confirmadaPorId: usuarioId
        }
      });
    });
  } catch (error) {
    if (error.code === 'P2002') {
      throw new ConflictError('El turno ya fue tomado por otra reserva');
    }
    throw error;
  }

  return { success: true };
}

async function rechazarComprobante(comprobanteId, usuarioId, motivo) {
  const comprobante = await prisma.comprobante.findUnique({
    where: { id: comprobanteId },
    include: { reserva: true }
  });

  if (!comprobante) throw new AppError('Comprobante no encontrado', 404);

  await prisma.$transaction(async (tx) => {
    await tx.comprobante.update({
      where: { id: comprobanteId },
      data: {
        estado: 'RECHAZADO',
        motivoRechazo: motivo,
        revisadoEn: new Date(),
        revisadoPorId: usuarioId
      }
    });

    await tx.reserva.update({
      where: { id: comprobante.reservaId },
      data: {
        estado: 4,
        estadoPago: 'RECHAZADO',
        expiraEn: null
      }
    });
  });

  return { success: true };
}

module.exports = { listarPendientes, aprobarComprobante, rechazarComprobante };
