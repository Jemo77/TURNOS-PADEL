const { z } = require('zod');
const prisma = require('../config/prisma');
const { getTurnosDelDia } = require('../services/canchaService');
const { guardarImagen, eliminarImagen, renombrarImagen } = require('../services/canchaImagenService');
const { AppError } = require('../utils/errors');

// Los controllers de canchas NO pasan req.body crudo a Prisma: este schema define
// exactamente qué campos se aceptan, así un body con campos inesperados (por ejemplo
// "id" o "reservas") no puede terminar en la base de datos.
const HORA = /^([01]?\d|2[0-3]):([0-5]\d)$/;

const canchaSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio').max(80),
  descripcion: z.string().trim().max(500).nullish(),
  imagenUrl: z.string().trim().max(500).nullish(),
  deporte: z.string().trim().max(60).nullish(),
  precioHora: z.coerce.number().nonnegative('El precio no puede ser negativo'),
  moneda: z.string().trim().max(8).default('ARS'),
  activa: z.coerce.boolean().default(true),
  horaApertura: z.string().trim().regex(HORA, 'Hora de apertura inválida'),
  horaCierre: z.string().trim().regex(HORA, 'Hora de cierre inválida'),
  duracionTurnoMin: z.coerce.number().int().min(15, 'La duración mínima es 15 minutos').max(480),
  diasDisponibles: z.array(z.coerce.number().int().min(0).max(6)).optional()
}).refine((data) => data.horaApertura < data.horaCierre, {
  message: 'La hora de cierre debe ser posterior a la de apertura',
  path: ['horaCierre']
});

function normalizarCancha(data) {
  return {
    ...data,
    descripcion: data.descripcion || null,
    imagenUrl: data.imagenUrl || null,
    deporte: data.deporte || null
  };
}

async function listarCanchas(req, res, next) {
  try {
    const canchas = await prisma.cancha.findMany({
      where: { activa: true },
      orderBy: { nombre: 'asc' }
    });

    res.json(canchas);
  } catch (error) {
    next(error);
  }
}

async function detalleCancha(req, res, next) {
  try {
    const cancha = await prisma.cancha.findUnique({ where: { id: req.params.id } });
    if (!cancha) return res.status(404).json({ message: 'Cancha no encontrada' });
    res.json(cancha);
  } catch (error) {
    next(error);
  }
}

async function turnosCancha(req, res, next) {
  try {
    const fecha = String(req.query.fecha || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return res.status(400).json({ message: 'Fecha inválida, se espera YYYY-MM-DD' });
    }

    const datos = await getTurnosDelDia(req.params.id, fecha);
    res.json({ cancha: { id: req.params.id }, fecha, turnos: datos });
  } catch (error) {
    next(error);
  }
}

async function crearCancha(req, res, next) {
  try {
    const parsed = canchaSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0]?.message || 'Datos de la cancha inválidos' });
    }

    const cancha = await prisma.cancha.create({ data: normalizarCancha(parsed.data) });
    res.status(201).json(cancha);
  } catch (error) {
    next(error);
  }
}

async function actualizarCancha(req, res, next) {
  try {
    const parsed = canchaSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0]?.message || 'Datos de la cancha inválidos' });
    }

    const anterior = await prisma.cancha.findUnique({ where: { id: req.params.id } });
    if (!anterior) throw new AppError('Cancha no encontrada', 404);

    const cancha = await prisma.cancha.update({
      where: { id: req.params.id },
      data: normalizarCancha(parsed.data)
    });

    // Si cambió el nombre, la imagen vieja (guardada con ese nombre) queda obsoleta.
    if (anterior.nombre !== cancha.nombre) {
      await renombrarImagen(anterior.nombre, cancha.nombre);
    }

    res.json(cancha);
  } catch (error) {
    next(error);
  }
}

async function eliminarCancha(req, res, next) {
  try {
    const cancha = await prisma.cancha.findUnique({ where: { id: req.params.id } });
    if (!cancha) throw new AppError('Cancha no encontrada', 404);

    await prisma.cancha.delete({ where: { id: req.params.id } });

    // Se borra también la imagen {nombre}.webp asociada a la cancha.
    if (cancha.nombre) {
      await eliminarImagen(cancha.nombre);
    }

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
}

// Recibe la imagen (multipart, campo "imagen"), la convierte a webp y la guarda
// en frontend/src/imagenes/{nombreCancha}.webp. No se guarda nada en la base de datos:
// el frontend carga la imagen por el nombre de la cancha.
async function subirImagenCancha(req, res, next) {
  try {
    const cancha = await prisma.cancha.findUnique({ where: { id: req.params.id } });
    if (!cancha) return res.status(404).json({ message: 'Cancha no encontrada' });
    if (!req.file) return res.status(400).json({ message: 'No se recibió ninguna imagen' });

    const nombreArchivo = await guardarImagen(cancha.nombre, req.file.buffer);
    res.json({ success: true, nombre: nombreArchivo });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listarCanchas,
  detalleCancha,
  turnosCancha,
  crearCancha,
  actualizarCancha,
  eliminarCancha,
  subirImagenCancha
};