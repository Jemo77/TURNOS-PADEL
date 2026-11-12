const express = require('express');
const prisma = require('../config/prisma');
const { publicRateLimit } = require('../middlewares/rateLimiter');
const { requireAuth, requireAdmin } = require('../middlewares/auth');
const upload = require('../middlewares/upload');
const { login, logout, me } = require('../controllers/auth.controller');
const { listarCanchas, detalleCancha, turnosCancha, crearCancha, actualizarCancha, eliminarCancha, subirImagenCancha } = require('../controllers/cancha.controller');
const { crearHoldReserva, confirmarReservaById, consultarReserva, cancelarReserva, subirComprobante, subirComprobanteImagen } = require('../controllers/reserva.controller');
const { listarReservasAdmin, crearReservaManualAdmin, marcarPagada, cancelarReservaAdmin, pendientesPagos, aprobarPago, rechazarPago, getCuentaTransferencia, getCuentaTransferenciaPublic, saveCuentaTransferencia, conectarMercadoPago, estadoMercadoPago, callbackMercadoPago } = require('../controllers/admin.controller');
const { generarPreferencia, webhook } = require('../controllers/mercadopago.controller');
const { expirarReservasVencidas } = require('../jobs/expirarReservas.job');
const { conciliarConMp } = require('../jobs/conciliarMp.job');
const { cronSecret } = require('../config/env');

const router = express.Router();

router.get('/health', (req, res) => res.json({ ok: true }));

router.post('/auth/login', publicRateLimit, login);
router.post('/auth/logout', publicRateLimit, logout);
router.get('/auth/me', requireAuth, requireAdmin, me);

router.get('/canchas', listarCanchas);
router.get('/canchas/:id', detalleCancha);
router.get('/canchas/:id/turnos', turnosCancha);

router.post('/reservas/hold', publicRateLimit, crearHoldReserva);
router.put('/reservas/:id/confirmar', publicRateLimit, confirmarReservaById);
router.post('/reservas/:id/comprobante', publicRateLimit, upload.single('pdf'), subirComprobante);
router.post('/reservas/:id/comprobante-imagen', publicRateLimit, upload.uploadImagen.single('imagen'), subirComprobanteImagen);
router.get('/reservas/buscar', publicRateLimit, async (req, res, next) => {
  try {
    const telefono = String(req.query.telefono || '').trim();
    if (!telefono) return res.json([]);

    const reservas = await prisma.reserva.findMany({
      where: {
        clienteTelefono: telefono,
        estado: { in: [1, 2] }
      },
      include: { cancha: true, comprobante: true },
      orderBy: { createdAt: 'desc' }
    });

    res.json(reservas);
  } catch (error) {
    next(error);
  }
});
router.get('/reservas/:id', consultarReserva);
router.post('/reservas/:id/mp/preferencia', publicRateLimit, generarPreferencia);
router.put('/reservas/:id/cancelar', publicRateLimit, cancelarReserva);
router.get('/transferencia', getCuentaTransferenciaPublic);

// Webhook de Mercado Pago (sin rate limit: siempre responde 200)
router.post('/mp/webhook', webhook);
router.get('/mp/webhook', webhook);

router.get('/admin/reservas', requireAuth, requireAdmin, listarReservasAdmin);
router.post('/admin/reservas', requireAuth, requireAdmin, crearReservaManualAdmin);
router.put('/admin/reservas/:id/marcar-pagado', requireAuth, requireAdmin, marcarPagada);
router.put('/admin/reservas/:id/cancelar', requireAuth, requireAdmin, cancelarReservaAdmin);
router.get('/admin/canchas', requireAuth, requireAdmin, listarCanchas);
router.post('/admin/canchas', requireAuth, requireAdmin, crearCancha);
router.put('/admin/canchas/:id', requireAuth, requireAdmin, actualizarCancha);
router.post('/admin/canchas/:id/imagen', requireAuth, requireAdmin, upload.uploadImagen.single('imagen'), subirImagenCancha);
router.delete('/admin/canchas/:id', requireAuth, requireAdmin, eliminarCancha);
router.get('/admin/pagos/pendientes', requireAuth, requireAdmin, pendientesPagos);
router.put('/admin/pagos/:comprobanteId/aprobar', requireAuth, requireAdmin, aprobarPago);
router.put('/admin/pagos/:comprobanteId/rechazar', requireAuth, requireAdmin, rechazarPago);
router.get('/admin/config/transferencia', requireAuth, requireAdmin, getCuentaTransferencia);
router.put('/admin/config/transferencia', requireAuth, requireAdmin, saveCuentaTransferencia);
router.post('/admin/mp/conectar', requireAuth, requireAdmin, conectarMercadoPago);
router.get('/admin/mp/estado', requireAuth, requireAdmin, estadoMercadoPago);
router.get('/admin/mp/oauth/callback', callbackMercadoPago);

// Endpoints para un cron externo (Railway/Render/GitHub Actions). Se pegan con
// el header x-cron-secret. El mismo trabajo corre también dentro del proceso si
// CRON_INTERNO=true, así los holds nunca quedan bloqueados si nadie los dispara.
function endpointCron(ejecutar) {
  return async (req, res, next) => {
    const secret = req.headers['x-cron-secret'];
    if (secret !== cronSecret) return res.status(401).json({ message: 'No autorizado' });

    try {
      const result = await ejecutar();
      res.json({ success: true, result });
    } catch (error) {
      next(error);
    }
  };
}

router.post('/cron/expirar-reservas', endpointCron(expirarReservasVencidas));
router.post('/cron/conciliar-mp', endpointCron(conciliarConMp));

module.exports = router;
