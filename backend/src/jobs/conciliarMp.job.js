const prisma = require('../config/prisma');

async function conciliarConMp() {
  const pendientes = await prisma.comprobante.findMany({
    where: { estado: 'PENDIENTE', matchMp: false }
  });

  return {
    pendientes: pendientes.length,
    ok: true
  };
}

module.exports = { conciliarConMp };
