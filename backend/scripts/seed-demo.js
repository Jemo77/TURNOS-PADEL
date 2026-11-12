/**
 * Datos de demo: limpia la base y deja canchas, cuenta bancaria y un par de reservas
 * repartidas en el tiempo para que el panel muestre contenido realista.
 *
 *   node scripts/seed-demo.js           -> upsert de canchas y cuenta (NO borra reservas)
 *   node scripts/seed-demo.js --reset   -> borra reservas/comprobantes/cobros y recarga todo
 *
 * Las fechas se calculan siempre relativas a HOY, así la demo muestra la semana que viene
 * con actividad aunque se corra dentro de un mes.
 */
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const prisma = new PrismaClient();

const args = process.argv.slice(2);
const RESET = args.includes('--reset');
const CON_RESET = args.includes('--confirm-reset');

// ---------------------------------------------------------------- utilidades

const HOY = new Date();

function diaRelativo(offset) {
  const d = new Date(HOY.getFullYear(), HOY.getMonth(), HOY.getDate() + offset);
  return d;
}

// Las fechas de reserva son días calendario guardados en UTC (ver backend/src/utils/fecha.js).
function fechaISO(date) {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

function sumarHoras(horaInicio, horas) {
  const [h, m] = horaInicio.split(':').map(Number);
  const total = h * 60 + m + horas * 60;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

// ---------------------------------------------------------------- canchas

const CANCHAS = [
  {
    nombre: 'Cancha 1',
    descripcion: 'Cancha techada con piso de césped sintético y vista de vidrio. Ideal para grupos.',
    deporte: 'Padel',
    precioHora: 15000,
    horaApertura: '08:00',
    horaCierre: '23:00',
    duracionTurnoMin: 60
  },
  {
    nombre: 'Cancha 2',
    descripcion: 'Cancha techada al fondo, con tribuna para ver el partido.',
    deporte: 'Padel',
    precioHora: 15000,
    horaApertura: '08:00',
    horaCierre: '23:00',
    duracionTurnoMin: 60
  },
  {
    nombre: 'Cancha 3',
    descripcion: 'La PREMIUM: césped de primera, iluminación LED y duchas.',
    deporte: 'Padel',
    precioHora: 22000,
    horaApertura: '09:00',
    horaCierre: '23:00',
    duracionTurnoMin: 90
  }
];

const CUENTA = {
  nombre: 'Turnos Padel SRL',
  banco: 'Galicia',
  cbu: '2850590940090418135201',
  alias: 'turnospadel.uba'
};

// ---------------------------------------------------------------- reservas de ejemplo

// Cada entrada: [offsetDias, cancha, hora, horas, cliente, metodo, estadoPago, estado]
const RESERVAS = [
  // --- Pasado: para que "Ingresos de los últimos 14 días" tenga historia ---
  [-9, 'Cancha 1', '19:00', 2, 'Sofía Ramírez', 'TRANSFERENCIA', 'PAGADO', 2],
  [-9, 'Cancha 2', '21:00', 1, 'Diego Torres', 'EFECTIVO_PRESENCIAL', 'PAGADO', 2],
  [-7, 'Cancha 3', '10:00', 2, 'Laura Fernández', 'TRANSFERENCIA', 'PAGADO', 2],
  [-6, 'Cancha 1', '09:00', 1, 'Martín Gómez', 'EFECTIVO_PRESENCIAL', 'PAGADO', 2],
  [-5, 'Cancha 2', '18:00', 2, 'Carla Ruiz', 'TRANSFERENCIA', 'PAGADO', 2],
  [-4, 'Cancha 1', '20:00', 1, 'Nicolás Herrera', 'EFECTIVO_PRESENCIAL', 'PAGADO', 2],
  [-4, 'Cancha 3', '12:00', 1, 'Sofía Ramírez', 'TRANSFERENCIA', 'PAGADO', 2],
  // Un par de turnos que se perdieron, para que la tasa de perdidas no dé 0
  [-3, 'Cancha 2', '16:00', 1, 'Ana López', 'TRANSFERENCIA', 'RECHAZADO', 4],
  [-2, 'Cancha 1', '11:00', 1, 'Bruno Díaz', 'TRANSFERENCIA', 'RECHAZADO', 3],

  // --- Hoy: la pantalla que se abre al hacer la demo ---
  [0, 'Cancha 1', '18:00', 2, 'Carla Ruiz', 'EFECTIVO_PRESENCIAL', 'PAGADO', 2],
  [0, 'Cancha 2', '09:00', 1, 'Diego Torres', 'TRANSFERENCIA', 'PAGADO', 2],
  [0, 'Cancha 3', '11:00', 1, 'Laura Fernández', 'EFECTIVO_PRESENCIAL', 'PAGADO', 2],
  // Esta queda con comprobante para revisar: es la que abre el flujo de aprobación en la demo
  [0, 'Cancha 1', '20:00', 1, 'Martín Gómez', 'TRANSFERENCIA', 'PENDIENTE', 2],
  [0, 'Cancha 2', '21:00', 1, 'Nicolás Herrera', 'TRANSFERENCIA', 'PENDIENTE', 2],
  [0, 'Cancha 2', '14:00', 1, 'Ana López', 'EFECTIVO_PRESENCIAL', 'PENDIENTE', 2],

  // --- Próximos días: para que la ocupación futura no salga en cero ---
  [1, 'Cancha 1', '19:00', 1, 'Carla Ruiz', 'EFECTIVO_PRESENCIAL', 'PENDIENTE', 2],
  [1, 'Cancha 3', '10:00', 1, 'Bruno Díaz', 'TRANSFERENCIA', 'PENDIENTE', 2],
  [2, 'Cancha 2', '18:00', 2, 'Diego Torres', 'EFECTIVO_PRESENCIAL', 'PENDIENTE', 2],
  [2, 'Cancha 1', '09:00', 1, 'Laura Fernández', 'TRANSFERENCIA', 'PENDIENTE', 2],
  [3, 'Cancha 3', '17:00', 1, 'Sofía Ramírez', 'EFECTIVO_PRESENCIAL', 'PENDIENTE', 2],
  [4, 'Cancha 1', '20:00', 2, 'Martín Gómez', 'TRANSFERENCIA', 'PENDIENTE', 2],
  [5, 'Cancha 2', '10:00', 1, 'Nicolás Herrera', 'EFECTIVO_PRESENCIAL', 'PENDIENTE', 2],
  [6, 'Cancha 3', '19:00', 1, 'Carla Ruiz', 'TRANSFERENCIA', 'PENDIENTE', 2],
  [8, 'Cancha 1', '11:00', 1, 'Ana López', 'EFECTIVO_PRESENCIAL', 'PENDIENTE', 2],
  [10, 'Cancha 2', '16:00', 1, 'Bruno Díaz', 'EFECTIVO_PRESENCIAL', 'PENDIENTE', 2]
];

// Dos comprobantes de ejemplo. Uno entra limpio y el otro con un error de importe, para
// ver en la demo los dos caminos: aprobar directo vs. "aprobar igual" con advertencias.
const COMPROBANTES = [
  {
    // Cliente Martín Gómez, hoy 20:00, transferencia
    cliente: 'Martín Gómez',
    importe: 15000,
    fechaHoraTexto: '26/septiembre/2026 18:41',
    numeroOperacion: 'MP-8842190377',
    esMercadoPago: true,
    validaciones: [
      { codigo: 'importe', nivel: 'ok', mensaje: 'El importe coincide con el monto de la reserva ($15.000)' },
      { codigo: 'destino', nivel: 'ok', mensaje: 'La cuenta de destino coincide con la del club' },
      { codigo: 'origen', nivel: 'ok', mensaje: 'Se identificó el comprobante como una transferencia de Mercado Pago' }
    ]
  },
  {
    // Cliente Nicolás Herrera, hoy 21:00, transferencia con importe que no cierra
    cliente: 'Nicolás Herrera',
    importe: 30000,
    fechaHoraTexto: '26/septiembre/2026 19:02',
    numeroOperacion: 'MP-7712004419',
    esMercadoPago: true,
    validaciones: [
      { codigo: 'importe', nivel: 'error', mensaje: 'El comprobante dice $30.000 pero la reserva es de $15.000' },
      { codigo: 'destino', nivel: 'ok', mensaje: 'La cuenta de destino coincide con la del club' },
      { codigo: 'fecha', nivel: 'warn', mensaje: 'No se pudo verificar que la fecha del pago sea la de la reserva' }
    ]
  }
];

// ---------------------------------------------------------------- ejecución

async function limpiar() {
  // El orden importa: hay relaciones sin onDelete: Cascade.
  const comprobantes = await prisma.comprobante.deleteMany({});
  const reservas = await prisma.reserva.deleteMany({});
  const mp = await prisma.cuentaMercadoPago.deleteMany({});
  const oauth = await prisma.oAuthEstadoPendiente.deleteMany({});
  const reportes = await prisma.reporteMpProcesado.deleteMany({});

  console.log(`  borrados: ${comprobantes.count} comprobantes, ${reservas.count} reservas, `
    + `${mp.count} cuentas MP, ${oauth.count} estados OAuth, ${reportes.count} reportes`);
}

async function cargarCanchas() {
  const porNombre = new Map();

  for (const datos of CANCHAS) {
    const existente = await prisma.cancha.findFirst({ where: { nombre: datos.nombre } });
    const canchas = existente
      ? await prisma.cancha.update({ where: { id: existente.id }, data: { ...datos, activa: true } })
      : await prisma.cancha.create({ data: { ...datos, activa: true, moneda: 'ARS' } });
    porNombre.set(datos.nombre, canchas);
  }

  // Canchas que quedaron de una corrida previa con nombres viejos.
  const sobrantes = await prisma.cancha.findMany({
    where: { nombre: { notIn: CANCHAS.map((c) => c.nombre) } },
    select: { id: true, nombre: true }
  });
  for (const sobrante of sobrantes) {
    const conReservas = await prisma.reserva.count({ where: { canchaId: sobrante.id } });
    if (conReservas === 0) {
      await prisma.cancha.delete({ where: { id: sobrante.id } });
      console.log(`  eliminada cancha obsoleta "${sobrante.nombre}"`);
    }
  }

  console.log(`  canchas: ${porNombre.size}`);
  return porNombre;
}

async function cargarCuenta() {
  const existente = await prisma.cuentaTransferencia.findFirst();
  const cuenta = existente
    ? await prisma.cuentaTransferencia.update({ where: { id: existente.id }, data: { ...CUENTA, activo: true } })
    : await prisma.cuentaTransferencia.create({ data: { ...CUENTA, activo: true } });
  console.log(`  cuenta de transferencia: ${cuenta.alias} (${cuenta.banco})`);
  return cuenta;
}

async function cargarReservas(canchasPorNombre) {
  const creadas = [];

  for (const [offset, nombreCancha, hora, horas, cliente, metodo, estadoPago, estado] of RESERVAS) {
    const cancha = canchasPorNombre.get(nombreCancha);
    if (!cancha) continue;

    const horaInicio = hora;
    const horaFin = sumarHoras(hora, horas);
    const monto = Number(cancha.precioHora) * horas;
    const fecha = fechaISO(diaRelativo(offset));

    // El índice único turno_activo_unico bloquea (cancha, fecha, horaInicio) si la reserva
    // queda activa. Si esa combinación ya está usada se saltea en vez de romper el seed.
    const choque = await prisma.reserva.findFirst({
      where: { canchaId: cancha.id, fecha, horaInicio, estado: { in: [1, 2] } },
      select: { id: true }
    });
    if (choque) {
      console.log(`  (omitida: ${nombreCancha} ${offset >= 0 ? `+${offset}` : offset}d ${horaInicio} ya está ocupado)`);
      continue;
    }

    creadas.push({
      canchaId: cancha.id,
      fecha,
      horaInicio,
      horaFin,
      estado,
      metodoPago: metodo,
      estadoPago,
      montoTotal: monto,
      clienteNombre: cliente,
      clienteTelefono: telefonoDe(cliente),
      clienteEmail: `${cliente.split(' ')[0].toLowerCase()}@ejemplo.com`,
      // Las de efectivo se cobran en el momento; el resto queda con el admin como responsable.
      confirmadaEn: estado === 2 ? new Date() : null,
      confirmadaPorId: null
    });
  }

  const result = await prisma.reserva.createMany({ data: creadas });
  console.log(`  reservas: ${result.count}`);
  return creadas.length;
}

async function cargarComprobantes() {
  let cargados = 0;

  for (const comp of COMPROBANTES) {
    const reserva = await prisma.reserva.findFirst({
      where: { clienteNombre: comp.cliente, metodoPago: 'TRANSFERENCIA' },
      orderBy: { createdAt: 'desc' }
    });
    if (!reserva) continue;

    await prisma.comprobante.upsert({
      where: { reservaId: reserva.id },
      create: {
        reservaId: reserva.id,
        fechaHoraTexto: comp.fechaHoraTexto,
        importe: comp.importe,
        moneda: 'ARS',
        numeroOperacion: comp.numeroOperacion,
        esMercadoPago: comp.esMercadoPago,
        validaciones: comp.validaciones,
        origen: { nombre: comp.cliente, banco_o_billetera: 'Mercado Pago', cuit_cuil: null, cvu: null },
        destino: { nombre: CUENTA.nombre, banco_o_billetera: CUENTA.banco, cuit_cuil: null, cvu: CUENTA.cbu },
        textoExtraido: `Transferencia\n${comp.fechaHoraTexto}\nOrigen: ${comp.cliente}\nDestino: ${CUENTA.nombre}\nCBU: ${CUENTA.cbu}\nAlias: ${CUENTA.alias}\n$ ${comp.importe.toLocaleString('es-AR')}`,
        estado: 'PENDIENTE'
      },
      update: { estado: 'PENDIENTE' }
    });
    cargados += 1;
  }

  console.log(`  comprobantes para revisar: ${cargados}`);
}

// Teléfono de ejemplo derivado del nombre, estable entre corridas.
function telefonoDe(cliente) {
  let hash = 0;
  for (const letra of cliente) hash = (hash * 31 + letra.charCodeAt(0)) % 100000000;
  return `11 ${String(60000000 + hash).slice(0, 8)}`;
}

async function main() {
  console.log(RESET ? '== LIMPIANDO Y CARGANDO DATOS DE DEMO ==' : '== ACTUALIZANDO CONFIGURACIÓN DE DEMO (no borra reservas) ==');

  if (RESET) {
    if (!CON_RESET) {
      console.error('\n  Esto BORRA reservas, comprobantes y cobros de la base.');
      console.error('  Si es lo que querés, corré:  node scripts/seed-demo.js --reset --confirm-reset\n');
      process.exit(1);
    }
    await limpiar();
  }

  const canchas = await cargarCanchas();
  await cargarCuenta();
  if (RESET) {
    await cargarReservas(canchas);
    await cargarComprobantes();
  }

  console.log('\nListo.');
}

main()
  .catch((error) => {
    console.error('Error en el seed:', error.message || error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
