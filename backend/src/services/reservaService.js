const prisma = require('../config/prisma');
const { ConflictError, AppError } = require('../utils/errors');
const { parseFechaISO } = require('../utils/fecha');
const { existeSolapamiento, timeToMinutes, esHoraValida } = require('../utils/horarios');
const { holdMinutosCheckout, holdMinutosComprobante } = require('../config/env');

function validarRango(horaInicio, horaFin) {
  if (!esHoraValida(horaInicio) || !esHoraValida(horaFin)) {
    throw new AppError('Los horarios deben tener el formato HH:MM', 400);
  }
  if (timeToMinutes(horaInicio) >= timeToMinutes(horaFin)) {
    throw new AppError('La hora de fin debe ser posterior a la de inicio', 400);
  }
}

// Busca reservas vivas (hold o confirmadas) de esa cancha en esa fecha y corta
// con un 409 si el rango pedido pisa alguna. Se usa tanto para los holds públicos
// como para el alta manual del admin, así las dos entradas compiten por el mismo
// horario con la misma regla.
async function assertSinSolapamiento(tx, { canchaId, fechaDate, horaInicio, horaFin }) {
  const reservasMismoDia = await tx.reserva.findMany({
    where: { canchaId, fecha: fechaDate, estado: { in: [1, 2] } },
    select: { horaInicio: true, horaFin: true }
  });

  const haySolapamiento = reservasMismoDia.some((reserva) =>
    existeSolapamiento(horaInicio, horaFin, reserva.horaInicio, reserva.horaFin)
  );

  if (haySolapamiento) {
    throw new ConflictError('Ese horario ya está reservado');
  }
}

async function crearHold(canchaId, fecha, horaInicio, horaFin, montoTotal) {
  validarRango(horaInicio, horaFin);

  const fechaDate = parseFechaISO(fecha);
  if (!fechaDate) throw new AppError('Fecha inválida', 400);

  return prisma.$transaction(async (tx) => {
    await assertSinSolapamiento(tx, { canchaId, fechaDate, horaInicio, horaFin });

    const expiraEn = new Date(Date.now() + holdMinutosCheckout * 60 * 1000);

    return tx.reserva.create({
      data: {
        canchaId,
        fecha: fechaDate,
        horaInicio,
        horaFin,
        estado: 1,
        estadoPago: 'PENDIENTE',
        montoTotal,
        expiraEn
      }
    });
  });
}

async function confirmarReserva(id, payload) {
  const { clienteNombre, clienteTelefono, clienteEmail, metodoPago } = payload;

  const reserva = await prisma.reserva.findUnique({ where: { id } });
  if (!reserva) throw new AppError('Reserva no encontrada', 404);
  if (reserva.estado !== 1) throw new ConflictError('La reserva ya no puede modificarse');

  const esVirtual = metodoPago === 'TARJETA_VIRTUAL';
  const esManual = metodoPago === 'TRANSFERENCIA' || metodoPago === 'EFECTIVO_PRESENCIAL';

  const result = await prisma.reserva.update({
    where: { id },
    data: {
      clienteNombre,
      clienteTelefono,
      clienteEmail,
      metodoPago,
      estadoPago: esVirtual ? 'PAGADO' : 'PENDIENTE',
      estado: esVirtual ? 2 : 1,
      // El hold de los pagos manuales selava el tiempo para subir el comprobante;
      // sin holdMinutosComprobante el plazo quedaba fijo en 30 minutos.
      expiraEn: esManual ? new Date(Date.now() + holdMinutosComprobante * 60 * 1000) : null,
      confirmadaEn: esVirtual ? new Date() : null
    }
  });

  return result;
}

// Alta manual desde el panel admin (turno tomado por teléfono, en el club, etc.).
// A diferencia de crearHold, la reserva nace CONFIRMADA (estado 2) y sin expiraEn:
// no hay hold que pueda expirar porque nadie la está "comprando" en línea.
// Si marcarPagada viene true se acredita en el acto y queda auditada con el admin
// que la cargó (confirmadaPorId / confirmadaEn).
async function crearReservaManual({
  canchaId,
  fecha,
  horaInicio,
  horaFin,
  montoTotal,
  clienteNombre,
  clienteTelefono,
  clienteEmail,
  metodoPago = 'EFECTIVO_PRESENCIAL',
  marcarPagada = false,
  adminId = null
}) {
  validarRango(horaInicio, horaFin);

  const fechaDate = parseFechaISO(fecha);
  if (!fechaDate) throw new AppError('Fecha inválida', 400);

  return prisma.$transaction(async (tx) => {
    await assertSinSolapamiento(tx, { canchaId, fechaDate, horaInicio, horaFin });

    return tx.reserva.create({
      data: {
        canchaId,
        fecha: fechaDate,
        horaInicio,
        horaFin,
        estado: 2,
        estadoPago: marcarPagada ? 'PAGADO' : 'PENDIENTE',
        montoTotal,
        clienteNombre: clienteNombre || null,
        clienteTelefono: clienteTelefono || null,
        clienteEmail: clienteEmail || null,
        metodoPago,
        expiraEn: null,
        confirmadaEn: marcarPagada ? new Date() : null,
        confirmadaPorId: marcarPagada ? adminId : null
      },
      include: { cancha: true, comprobante: true }
    });
  });
}

module.exports = { crearHold, confirmarReserva, crearReservaManual };
