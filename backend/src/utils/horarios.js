// Utilidades de horario ("HH:MM") compartidas entre reservaService y canchaService.
// Antes estas funciones vivían duplicadas en los dos servicios; centralizarlas acá
// garantiza que la validación de solapamiento usada al crear un turno sea EXACTAMENTE
// la misma que la usada para marcar un slot como ocupado en la grilla del día.

function timeToMinutes(hora) {
  const [h, m] = String(hora || '00:00').split(':').map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

function minutesToTime(minutos) {
  const hs = Math.floor(minutos / 60);
  const ms = minutos % 60;
  return `${String(hs).padStart(2, '0')}:${String(ms).padStart(2, '0')}`;
}

// Dos intervalos [inicio, fin) se solapan si el primero arranca antes de que termine
// el segundo y viceversa. Turnos contiguos (18:00-19:00 y 19:00-20:00) NO se solapan.
function existeSolapamiento(inicioA, finA, inicioB, finB) {
  return timeToMinutes(inicioA) < timeToMinutes(finB) && timeToMinutes(inicioB) < timeToMinutes(finA);
}

// Genera la grilla de slots de una cancha dividiendo [horaApertura, horaCierre)
// en bloques de duracionTurnoMin. Un turno que no entra completo no se genera.
function toTimeSlots(horaInicio, horaFin, duracionMin) {
  const slots = [];
  const duracion = Number(duracionMin) > 0 ? Number(duracionMin) : 60;
  const inicio = timeToMinutes(horaInicio);
  const fin = timeToMinutes(horaFin);
  let actual = inicio;

  while (actual + duracion <= fin) {
    slots.push({ horaInicio: minutesToTime(actual), horaFin: minutesToTime(actual + duracion) });
    actual += duracion;
  }

  return slots;
}

const REGEX_HORA = /^([01]?\d|2[0-3]):([0-5]\d)$/;

function esHoraValida(hora) {
  return REGEX_HORA.test(String(hora || ''));
}

module.exports = { timeToMinutes, minutesToTime, existeSolapamiento, toTimeSlots, esHoraValida };
