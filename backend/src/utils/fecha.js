// Las fechas de reserva se manejan como calendario, no como instantes con zona horaria.
// Para que un día quede consistente en cualquier servidor, se guardan y comparan en UTC por fecha.
function parseFechaISO(value) {
  if (!value && value !== 0) return null;

  if (value instanceof Date) {
    const time = value.getTime();
    if (Number.isNaN(time)) return null;
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }

  const texto = String(value).trim();
  if (!texto) return null;

  const match = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (!year || !month || !day) return null;
  return new Date(Date.UTC(year, month - 1, day));
}

module.exports = { parseFechaISO };
