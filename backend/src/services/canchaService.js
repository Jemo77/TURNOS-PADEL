const prisma = require('../config/prisma');
const { parseFechaISO } = require('../utils/fecha');
const { AppError } = require('../utils/errors');
const { toTimeSlots, timeToMinutes, minutesToTime, existeSolapamiento } = require('../utils/horarios');

function getDateKeyLocal(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function esSlotPasado(fechaISO, horaFin) {
  const fechaStr = String(fechaISO || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaStr)) return true;

  const [year, month, day] = fechaStr.split('-').map(Number);
  const selectedDate = new Date(year, month - 1, day);
  const hoy = new Date();
  const selectedKey = getDateKeyLocal(selectedDate);
  const hoyKey = getDateKeyLocal(hoy);

  if (selectedKey < hoyKey) return true;
  if (selectedKey > hoyKey) return false;

  return timeToMinutes(horaFin) <= (hoy.getHours() * 60 + hoy.getMinutes());
}

async function getTurnosDelDia(canchaId, fecha) {
  const cancha = await prisma.cancha.findUnique({ where: { id: canchaId } });
  if (!cancha) throw new AppError('Cancha no encontrada', 404);

  const slots = toTimeSlots(cancha.horaApertura, cancha.horaCierre, cancha.duracionTurnoMin);
  const fechaDate = parseFechaISO(fecha);

  const reservas = await prisma.reserva.findMany({
    where: {
      canchaId,
      fecha: fechaDate,
      estado: { in: [1, 2] }
    },
    select: {
      horaInicio: true,
      horaFin: true,
      estado: true
    }
  });

  return slots.map((slot) => {
    const slotPasado = esSlotPasado(fecha, slot.horaFin) || esSlotPasado(fecha, slot.horaInicio);
    const match = reservas.find((r) =>
      existeSolapamiento(slot.horaInicio, slot.horaFin, r.horaInicio, r.horaFin)
    );

    if (slotPasado) {
      return { ...slot, estado: 'pasado' };
    }

    if (match) {
      return {
        ...slot,
        estado: match.estado === 1 ? 'en_proceso' : 'reservado'
      };
    }

    return { ...slot, estado: 'disponible' };
  });
}

module.exports = { getTurnosDelDia, toTimeSlots, timeToMinutes, minutesToTime };
