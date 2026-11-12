const { z } = require('zod');
const prisma = require('../config/prisma');
const { crearHold, confirmarReserva } = require('../services/reservaService');
const { extraerDatos, parsearFechaHora } = require('../parsers/comprobantePdf.parser');
const { PDFParse } = require('pdf-parse');
const { AppError, ConflictError } = require('../utils/errors');
const { guardarImagen } = require('../services/comprobanteImagenService');
const { analizarComprobante } = require('../services/comprobanteAnalisisService');
const { cancelacionHorasMin } = require('../config/env');

const holdSchema = z.object({
  canchaId: z.string().trim().min(1),
  fecha: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida'),
  horaInicio: z.string().trim().regex(/^([01]?\d|2[0-3]):([0-5]\d)$/, 'Hora de inicio inválida'),
  horaFin: z.string().trim().regex(/^([01]?\d|2[0-3]):([0-5]\d)$/, 'Hora de fin inválida'),
  montoTotal: z.coerce.number().positive('El monto debe ser mayor a cero')
});

const confirmarSchema = z.object({
  clienteNombre: z.string().trim().min(1, 'Ingresá el nombre del cliente'),
  clienteTelefono: z.string().trim().min(1, 'Ingresá el teléfono del cliente'),
  clienteEmail: z.string().trim().email('Email inválido'),
  metodoPago: z.enum(['EFECTIVO_PRESENCIAL', 'TARJETA_VIRTUAL', 'TRANSFERENCIA'])
});

const cancelarSchema = z.object({
  telefono: z.string().trim().min(1, 'Ingresá el teléfono asociado a la reserva')
});

async function crearHoldReserva(req, res, next) {
  try {
    const parsed = holdSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0]?.message || 'Datos de la reserva inválidos' });
    }

    const { canchaId, fecha, horaInicio, horaFin, montoTotal } = parsed.data;

    const nueva = await crearHold(canchaId, fecha, horaInicio, horaFin, montoTotal);
    res.status(201).json(nueva);
  } catch (error) {
    next(error);
  }
}

async function confirmarReservaById(req, res, next) {
  try {
    const parsed = confirmarSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0]?.message || 'Datos de confirmación inválidos' });
    }

    const reserva = await confirmarReserva(req.params.id, parsed.data);
    res.json(reserva);
  } catch (error) {
    next(error);
  }
}

async function consultarReserva(req, res, next) {
  try {
    const reserva = await prisma.reserva.findUnique({
      where: { id: req.params.id },
      include: { cancha: true, comprobante: true }
    });

    if (!reserva) return res.status(404).json({ message: 'Reserva no encontrada' });
    res.json(reserva);
  } catch (error) {
    next(error);
  }
}

// La fecha de la reserva es un día calendario (guardada en UTC a las 00:00) y la
// hora es un "HH:MM" suelto. Para decidir "¿falta más de N horas?" hay que pegarlos
// en la zona horaria del servidor, que es la del club.
function inicioDeReservaEnZonaLocal(fecha, hora) {
  const [h, m] = String(hora || '00:00').split(':').map(Number);
  return new Date(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate(), h || 0, m || 0, 0, 0);
}

function horasHastaInicio(fecha, hora) {
  return (inicioDeReservaEnZonaLocal(fecha, hora).getTime() - Date.now()) / 3_600_000;
}

async function cancelarReserva(req, res, next) {
  try {
    const parsed = cancelarSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0]?.message || 'Datos de cancelación inválidos' });
    }

    const telefonoNormalizado = parsed.data.telefono;

    const reserva = await prisma.reserva.findUnique({
      where: { id: req.params.id },
      include: { cancha: true }
    });

    if (!reserva) {
      return res.status(404).json({ message: 'Reserva no encontrada' });
    }

    if (reserva.clienteTelefono && reserva.clienteTelefono.replace(/\D/g, '') !== telefonoNormalizado.replace(/\D/g, '')) {
      return res.status(403).json({ message: 'El teléfono no coincide con la reserva' });
    }

    if (![1, 2].includes(reserva.estado)) {
      return res.status(409).json({ message: 'La reserva ya no se puede cancelar' });
    }

    // Política de cancelación anticipada: si el turno empieza dentro de la ventana
    // mínima (CANCELACION_HORAS_MIN) el club ya no puede poner a alguien en esa
    // cancha, así que se rechaza y hay que hablar directamente con el admin.
    if (cancelacionHorasMin > 0) {
      const horasRestantes = horasHastaInicio(reserva.fecha, reserva.horaInicio);
      if (horasRestantes < cancelacionHorasMin) {
        const motivo = horasRestantes <= 0
          ? 'El turno ya empezó. Para cambios, contactate con el club.'
          : `Este turno está a menos de ${cancelacionHorasMin} horas. Para cancelarlo, contactate con el club.`;
        return res.status(409).json({ message: motivo });
      }
    }

    const reservaActualizada = await prisma.reserva.update({
      where: { id: req.params.id },
      data: {
        estado: 4,
        estadoPago: reserva.estadoPago === 'PAGADO' ? 'PAGADO' : 'RECHAZADO',
        expiraEn: null
      }
    });

    res.json(reservaActualizada);
  } catch (error) {
    next(error);
  }
}

async function subirComprobante(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ message: 'No se recibió ningún PDF' });

    const reserva = await prisma.reserva.findUnique({ where: { id: req.params.id } });
    if (!reserva) throw new AppError('Reserva no encontrada', 404);
    if (reserva.estado === 3 || reserva.estado === 4 || reserva.estadoPago === 'PAGADO') {
      throw new ConflictError('La reserva ya no puede recibir un comprobante');
    }

    const parser = new PDFParse({ data: req.file.buffer });
    const { text } = await parser.getText();
    const datos = extraerDatos(text);
    const cuenta = await prisma.cuentaTransferencia.findFirst({
      where: { activo: true },
      orderBy: { createdAt: 'desc' }
    });

    const tieneOrigen = datos.origen && (datos.origen.nombre || datos.origen.banco_o_billetera || datos.origen.cuit_cuil || datos.origen.cvu);
    const tieneDestino = datos.destino && (datos.destino.nombre || datos.destino.banco_o_billetera || datos.destino.cuit_cuil || datos.destino.cvu);

    const origen = tieneOrigen
      ? datos.origen
      : {
          nombre: reserva?.clienteNombre || null,
          banco_o_billetera: null,
          cuit_cuil: null,
          cvu: null
        };

    const destino = tieneDestino
      ? datos.destino
      : {
          nombre: cuenta?.nombre || 'Cuenta del club',
          banco_o_billetera: cuenta?.banco || null,
          cuit_cuil: null,
          cvu: cuenta?.cbu || null
        };

    const fechaDetectada = parsearFechaHora(datos.fecha, datos.hora);
    const analisis = analizarComprobante({ datos: { ...datos, fechaDetectada, destino }, reserva, cuentaActiva: cuenta });

    const comprobante = await prisma.comprobante.upsert({
      where: { reservaId: req.params.id },
      create: {
        reservaId: req.params.id,
        fechaHoraTexto: `${datos.fecha || ''} ${datos.hora || ''}`.trim(),
        fechaDetectada,
        importe: datos.importe != null ? Number(Number(datos.importe).toFixed(2)) : null,
        moneda: datos.moneda,
        motivo: datos.motivo,
        numeroOperacion: datos.numero_operacion,
        esMercadoPago: analisis.esMercadoPago,
        validaciones: analisis.validaciones,
        origen,
        destino,
        textoExtraido: text,
        estado: 'PENDIENTE'
      },
      update: {
        fechaHoraTexto: `${datos.fecha || ''} ${datos.hora || ''}`.trim(),
        fechaDetectada,
        importe: datos.importe != null ? Number(Number(datos.importe).toFixed(2)) : null,
        moneda: datos.moneda,
        motivo: datos.motivo,
        numeroOperacion: datos.numero_operacion,
        esMercadoPago: analisis.esMercadoPago,
        validaciones: analisis.validaciones,
        origen,
        destino,
        textoExtraido: text,
        estado: 'PENDIENTE'
      }
    });

    await prisma.reserva.update({
      where: { id: req.params.id },
      data: { expiraEn: null }
    });

    res.json({ success: true, comprobante });
  } catch (error) {
    next(error);
  }
}

async function subirComprobanteImagen(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ message: 'No se recibió ninguna imagen' });

    const reserva = await prisma.reserva.findUnique({ where: { id: req.params.id } });
    if (!reserva) throw new AppError('Reserva no encontrada', 404);
    if (reserva.estado === 3 || reserva.estado === 4 || reserva.estadoPago === 'PAGADO') {
      throw new ConflictError('La reserva ya no puede recibir un comprobante');
    }

    const nombre = await guardarImagen(req.params.id, req.file.buffer);
    const comprobanteExistente = await prisma.comprobante.findUnique({ where: { reservaId: req.params.id } });

    const comprobante = await prisma.comprobante.upsert({
      where: { reservaId: req.params.id },
      create: {
        reservaId: req.params.id,
        estado: 'PENDIENTE',
        esMercadoPago: false,
        validaciones: [],
        importe: null,
        fechaHoraTexto: null,
        numeroOperacion: null,
        motivo: null,
        textoExtraido: null,
        origen: null,
        destino: null,
        fechaDetectada: null
      },
      update: {
        validaciones: comprobanteExistente?.validaciones ?? [],
        esMercadoPago: comprobanteExistente?.esMercadoPago ?? false,
        importe: comprobanteExistente?.importe ?? null,
        fechaHoraTexto: comprobanteExistente?.fechaHoraTexto ?? null,
        numeroOperacion: comprobanteExistente?.numeroOperacion ?? null,
        motivo: comprobanteExistente?.motivo ?? null,
        textoExtraido: comprobanteExistente?.textoExtraido ?? null,
        origen: comprobanteExistente?.origen ?? null,
        destino: comprobanteExistente?.destino ?? null,
        fechaDetectada: comprobanteExistente?.fechaDetectada ?? null
      }
    });

    await prisma.reserva.update({
      where: { id: req.params.id },
      data: { expiraEn: null }
    });

    res.json({ success: true, nombre, comprobante });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  crearHoldReserva,
  confirmarReservaById,
  consultarReserva,
  cancelarReserva,
  subirComprobante,
  subirComprobanteImagen
};
