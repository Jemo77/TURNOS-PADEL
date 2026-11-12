import { parseFechaCalendario, toDateKey } from './fecha';
import { reservaVigente } from './reservas';

// Métricas del panel de Finanzas. Todo se calcula en el front a partir de la misma lista
// de reservas que ya descarga /admin/reservas, así que no hacen falta endpoints nuevos.

export function horaAMinutos(hora) {
  const [h, m] = String(hora || '00:00').split(':').map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

export function duracionEnHoras(horaInicio, horaFin) {
  return Math.max(0, (horaAMinutos(horaFin) - horaAMinutos(horaInicio)) / 60);
}

// Cuántos turnos entran en una cancha por día según su apertura, cierre y duración.
export function capacidadDiaria(cancha) {
  const duracion = Number(cancha.duracionTurnoMin) || 60;
  const minutos = horaAMinutos(cancha.horaCierre) - horaAMinutos(cancha.horaApertura);
  return Math.max(0, Math.floor(minutos / duracion));
}

export function capacidadTotal(canchas) {
  return canchas
    .filter((cancha) => cancha.activa !== false)
    .reduce((sum, cancha) => sum + capacidadDiaria(cancha) * (Number(cancha.duracionTurnoMin) || 60) / 60, 0);
}

function sumarHoras(reservas) {
  return reservas.reduce((sum, reserva) => sum + duracionEnHoras(reserva.horaInicio, reserva.horaFin), 0);
}

// Los últimos N días hacia atrás, en orden cronológico, incluyendo hoy.
export function ultimosDias(cantidad = 14) {
  const dias = [];
  const hoy = new Date();
  for (let i = cantidad - 1; i >= 0; i -= 1) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - i);
    dias.push(toDateKey(d));
  }
  return dias;
}

// A partir de hoy, hacia adelante.
export function proximosDias(cantidad = 14) {
  const dias = [];
  const hoy = new Date();
  for (let i = 0; i < cantidad; i += 1) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + i);
    dias.push(toDateKey(d));
  }
  return dias;
}

function agruparPorFecha(reservas, fechas) {
  const mapa = new Map(fechas.map((f) => [f, []]));
  for (const reserva of reservas) {
    const key = toDateKey(reserva.fecha);
    if (mapa.has(key)) mapa.get(key).push(reserva);
  }
  return mapa;
}

// % de horas vendidas por día. Es el número que de verdad le importa al dueño: si
// llenó o no la cancha. Mide sobre las horas realmente reservadas (no la cantidad de
// reservas), porque alguien puede comprar 3 horas en un solo turno.
export function ocupacionPorDia(reservas, canchas, dias) {
  const capacidad = capacidadTotal(canchas);
  if (!capacidad) return [];

  const porFecha = agruparPorFecha(reservas, dias);

  return dias.map((fecha) => {
    const delDia = (porFecha.get(fecha) || []).filter((r) => r.estado === 1 || r.estado === 2);
    const horas = sumarHoras(delDia);
    return {
      fecha,
      horas,
      porcentaje: Math.min(100, Math.round((horas / capacidad) * 100)),
      reservas: delDia.length
    };
  });
}

// Dinero cobrado (PAGADO) vs. todavía pendiente, por día.
export function ingresosPorDia(reservas, dias) {
  const porFecha = agruparPorFecha(reservas, dias);

  return dias.map((fecha) => {
    const delDia = (porFecha.get(fecha) || []).filter(reservaVigente);
    const cobrado = delDia
      .filter((r) => r.estadoPago === 'PAGADO')
      .reduce((sum, r) => sum + Number(r.montoTotal || 0), 0);
    const pendiente = delDia
      .filter((r) => r.estadoPago === 'PENDIENTE')
      .reduce((sum, r) => sum + Number(r.montoTotal || 0), 0);
    return { fecha, cobrado, pendiente, total: cobrado + pendiente };
  });
}

// Qué cancha deja más plata. Sirve para decidir dónde ajustar precios.
export function ingresosPorCancha(reservas, canchas, dias) {
  const desde = new Set(dias);
  const porCancha = new Map(canchas.map((c) => [c.id, 0]));
  let total = 0;

  for (const reserva of reservas) {
    if (!desde.has(toDateKey(reserva.fecha))) continue;
    if (!reservaVigente(reserva)) continue;
    const monto = Number(reserva.montoTotal || 0);
    porCancha.set(reserva.canchaId, (porCancha.get(reserva.canchaId) || 0) + monto);
    total += monto;
  }

  return canchas
    .map((cancha) => ({
      id: cancha.id,
      nombre: cancha.nombre,
      monto: porCancha.get(cancha.id) || 0,
      porcentaje: total ? Math.round(((porCancha.get(cancha.id) || 0) / total) * 100) : 0
    }))
    .sort((a, b) => b.monto - a.monto);
}

// Mix de métodos de pago: sirve para ver cuánto de la plata entra por transferencia
// (y por lo tanto cuánto depende de que|club esté al día con la conciliación).
export function distribucionMetodosPago(reservas, dias) {
  const desde = new Set(dias);
  const etiquetas = {
    EFECTIVO_PRESENCIAL: 'Efectivo',
    TRANSFERENCIA: 'Transferencia',
    TARJETA_VIRTUAL: 'Tarjeta virtual'
  };
  const conteo = new Map();
  let total = 0;

  for (const reserva of reservas) {
    if (!desde.has(toDateKey(reserva.fecha))) continue;
    if (!reservaVigente(reserva)) continue;
    const metodo = reserva.metodoPago || 'SIN_METODO';
    conteo.set(metodo, (conteo.get(metodo) || 0) + 1);
    total += 1;
  }

  return [...conteo.entries()]
    .map(([metodo, cantidad]) => ({
      metodo,
      etiqueta: etiquetas[metodo] || 'Sin método',
      cantidad,
      porcentaje: total ? Math.round((cantidad / total) * 100) : 0
    }))
    .sort((a, b) => b.cantidad - a.cantidad);
}

// En qué franjas horarias se concentration la demanda. Sirve para decidir si conviene
// subir el precio de la hora pico o bajar el de la valle.
export function demandaPorFranja(reservas, dias) {
  const desde = new Set(dias);
  const franjas = new Map();

  for (const reserva of reservas) {
    if (!desde.has(toDateKey(reserva.fecha))) continue;
    if (reserva.estado === 3 || reserva.estado === 4) continue;
    const hora = Number(String(reserva.horaInicio || '00:00').slice(0, 2));
    if (Number.isNaN(hora)) continue;
    franjas.set(hora, (franjas.get(hora) || 0) + 1);
  }

  const horas = [...franjas.keys()].sort((a, b) => a - b);
  if (!horas.length) return [];

  const total = [...franjas.values()].reduce((a, b) => a + b, 0);
  return horas.map((hora) => ({
    hora,
    etiqueta: `${String(hora).padStart(2, '0')}h`,
    cantidad: franjas.get(hora),
    porcentaje: Math.round((franjas.get(hora) / total) * 100)
  }));
}

// Pancitos de arriba: cobros, deuda, ticket promedio, ocupación de hoy, how many turnos
// y cuánta gente se cae (expiradas + canceladas) sobre el total.
export function resumen(reservas, canchas) {
  const hoyISO = toDateKey(new Date());
  const vigentes = reservas.filter(reservaVigente);

  const cobrado = vigentes
    .filter((r) => r.estadoPago === 'PAGADO')
    .reduce((sum, r) => sum + Number(r.montoTotal || 0), 0);
  const pendiente = vigentes
    .filter((r) => r.estadoPago === 'PENDIENTE')
    .reduce((sum, r) => sum + Number(r.montoTotal || 0), 0);

  const capacidad = capacidadTotal(canchas);
  const horasHoy = sumarHoras(
    reservas.filter((r) => toDateKey(r.fecha) === hoyISO && (r.estado === 1 || r.estado === 2))
  );
  const turnosHoy = reservas.filter((r) => toDateKey(r.fecha) === hoyISO && (r.estado === 1 || r.estado === 2)).length;

  const perdidas = reservas.filter((r) => r.estado === 3 || r.estado === 4).length;
  const reservadas = reservas.filter((r) => r.estado === 1 || r.estado === 2).length;

  return {
    cobrado,
    pendiente,
    total: cobrado + pendiente,
    ticketPromedio: vigentes.length ? (cobrado + pendiente) / vigentes.length : 0,
    ocupacionHoy: capacidad ? Math.min(100, Math.round((horasHoy / capacidad) * 100)) : 0,
    horasHoy,
    turnosHoy,
    cantidadPerdidas: perdidas,
    tasaPerdida: reservadas + perdidas ? Math.round((perdidas / (reservadas + perdidas)) * 100) : 0,
    reservasVigentes: vigentes.length
  };
}
