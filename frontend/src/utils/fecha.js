// Las fechas de reserva se guardan como día calendario y no como instante con zona horaria.
// Por eso ignoramos la parte horaria/UTC y construimos la fecha con año, mes y día locales.
export function parseFechaCalendario(value) {
  if (!value && value !== 0) return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const year = value.getUTCFullYear();
    const month = value.getUTCMonth();
    const day = value.getUTCDate();
    return new Date(year, month, day);
  }

  if (typeof value === 'string') {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);

    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day);
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function toDateKey(value) {
  const date = parseFechaCalendario(value);
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatFechaLocal(value, options = { day: '2-digit', month: '2-digit', year: 'numeric' }) {
  const date = parseFechaCalendario(value);
  if (!date) return 'Sin fecha';
  return date.toLocaleDateString('es-AR', options);
}

export function getHoyISO() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function esFechaHoraPasada(fecha, hora) {
  const date = parseFechaCalendario(fecha);
  if (!date) return true;

  const [horaNumerica, minutoNumerico = 0] = String(hora || '00:00').split(':').map(Number);
  const fechaHora = new Date(date.getFullYear(), date.getMonth(), date.getDate(), horaNumerica, minutoNumerico, 0);

  return fechaHora.getTime() <= Date.now();
}
