const prisma = require('../config/prisma');

async function expirarReservasVencidas() {
  return prisma.reserva.updateMany({
    where: {
      estado: 1,
      expiraEn: { lt: new Date() }
    },
    data: { estado: 3 }
  });
}

module.exports = { expirarReservasVencidas };
