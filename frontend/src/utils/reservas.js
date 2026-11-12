// Una reserva cuenta para las métricas si sigue vigente.
export const reservaVigente = (reserva) =>
  reserva.estado !== 3 && reserva.estado !== 4 && reserva.estadoPago !== 'RECHAZADO';
