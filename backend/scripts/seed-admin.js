const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

async function main() {
  const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !/^[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}$/.test(email)) {
    throw new Error('ADMIN_EMAIL no tiene un formato válido. Debe configurarse explícitamente en el entorno.');
  }

  if (!password || password.length < 12) {
    throw new Error('ADMIN_PASSWORD debe existir y tener al menos 12 caracteres. Debe configurarse explícitamente en el entorno.');
  }

  const existing = await prisma.usuario.findUnique({ where: { email } });

  if (existing) {
    const hashed = await bcrypt.hash(password, 12);
    await prisma.usuario.update({
      where: { email },
      data: { password: hashed, nombre: existing.nombre || 'Admin Turnos Padel', rol: existing.rol || 'ADMIN' }
    });
    console.log(`Admin actualizado: ${email}`);
    return;
  }

  const hashed = await bcrypt.hash(password, 12);

  const user = await prisma.usuario.create({
    data: {
      email,
      password: hashed,
      nombre: 'Admin Turnos Padel',
      rol: 'ADMIN'
    }
  });

  console.log(`Admin creado: ${email} (id: ${user.id})`);
}

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
