import { useEffect, useRef, useState } from 'react';
import api from '../services/api';
import { formatMoney } from '../utils/format';
import { imagenDeComprobante } from '../utils/comprobanteImagen';
import { formatFechaLocal } from '../utils/fecha';
import ConfirmDialog from './ConfirmDialog';
import { Badge, Button } from './ui';
import { CheckIcon, WarningIcon, CloseIcon } from './icons';

// Tonos del Badge compartido (components/ui/Badge.jsx). El estado del pago y el de
// la reserva se distinguen de un vistazo, con ícono incluido.
const toneEstadoPago = {
  PENDIENTE: 'warning',
  PAGADO: 'success',
  RECHAZADO: 'danger'
};

const toneEstadoReserva = {
  1: 'neutral',
  2: 'success',
  3: 'danger',
  4: 'neutral'
};

const labelsEstado = {
  1: 'En proceso',
  2: 'Confirmada',
  3: 'Expirada',
  4: 'Cancelada'
};

const labelsMetodoPago = {
  EFECTIVO_PRESENCIAL: 'Efectivo',
  TRANSFERENCIA: 'Transferencia',
  TARJETA_VIRTUAL: 'Tarjeta virtual'
};

function formatComprobanteField(value) {
  if (!value) return 'Sin dato';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    const texto = Object.values(value).filter(Boolean).join(' · ');
    return texto || 'Sin dato';
  }
  return String(value);
}

function formatExtractedText(value) {
  if (!value) return 'Sin texto extraído.';
  return String(value).trim() || 'Sin texto extraído.';
}

export default function TurnoAdminCard({ reserva, onRefresh, onStatus }) {
  const [rechazoMotivo, setRechazoMotivo] = useState('Rechazado por administración');
  const [subiendoImagen, setSubiendoImagen] = useState(false);
  const [imagenLocal, setImagenLocal] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [dialog, setDialog] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [dialogError, setDialogError] = useState('');
  const textareaRef = useRef(null);

  useEffect(() => {
    if (dialog === 'rechazar' && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [dialog]);

  const esPendiente = reserva.estadoPago === 'PENDIENTE';
  const esTransferencia = reserva.metodoPago === 'TRANSFERENCIA';
  const tieneComprobante = !!reserva.comprobante;
  const esMercadoPago = !!reserva.comprobante?.esMercadoPago;
  const validaciones = Array.isArray(reserva.comprobante?.validaciones) ? reserva.comprobante.validaciones : [];

  const marcarPagado = async () => {
    try {
      await api.put(`/admin/reservas/${reserva.id}/marcar-pagado`);
      onStatus('Reserva marcada como pagada');
      onRefresh();
    } catch (error) {
      onStatus(error.response?.data?.message || 'No se pudo marcar la reserva', 'error');
    }
  };

  const cancelarReserva = async () => {
    try {
      setProcesando(true);
      setDialogError('');
      await api.put(`/admin/reservas/${reserva.id}/cancelar`);
      onStatus('Reserva cancelada');
      setDialog(null);
      onRefresh();
    } catch (error) {
      setDialogError(error.response?.data?.message || 'No se pudo cancelar la reserva');
    } finally {
      setProcesando(false);
    }
  };

  const aprobarComprobante = async () => {
    try {
      setProcesando(true);
      setDialogError('');
      await api.put(`/admin/pagos/${reserva.comprobante.id}/aprobar`);
      onStatus('Comprobante aprobado');
      setDialog(null);
      onRefresh();
    } catch (error) {
      setDialogError(error.response?.data?.message || 'No se pudo aprobar el comprobante');
    } finally {
      setProcesando(false);
    }
  };

  const rechazarComprobante = async () => {
    try {
      setProcesando(true);
      setDialogError('');
      const motivo = (rechazoMotivo || '').trim() || 'Rechazado por administración';
      await api.put(`/admin/pagos/${reserva.comprobante.id}/rechazar`, { motivo });
      onStatus('Comprobante rechazado');
      setRechazoMotivo('Rechazado por administración');
      setDialog(null);
      onRefresh();
    } catch (error) {
      setDialogError(error.response?.data?.message || 'No se pudo rechazar el comprobante');
    } finally {
      setProcesando(false);
    }
  };

  const subirImagen = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    setImagenLocal(previewUrl);
    const formData = new FormData();
    formData.append('imagen', file);
    try {
      setSubiendoImagen(true);
      await api.post(`/reservas/${reserva.id}/comprobante-imagen`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      onStatus('Imagen del comprobante cargada');
      onRefresh();
    } catch (error) {
      onStatus(error.response?.data?.message || 'No se pudo subir la imagen', 'error');
    } finally {
      setSubiendoImagen(false);
      if (previewUrl) {
        setTimeout(() => URL.revokeObjectURL(previewUrl), 2000);
      }
    }
  };

  const comprobanteImagen = imagenLocal || imagenDeComprobante(reserva.id);
  const erroresValidacion = validaciones.filter((v) => v.nivel === 'error');

  return (
    <div className="rounded-2xl border border-admin-100 bg-white p-4 shadow-card">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-lg font-bold text-admin-900">{reserva.cancha?.nombre || 'Cancha'}</p>
            <Badge tone={toneEstadoReserva[reserva.estado] || 'neutral'}>
              {labelsEstado[reserva.estado] || 'Estado'}
            </Badge>
            <Badge tone={toneEstadoPago[reserva.estadoPago] || 'neutral'} icon>
              {reserva.estadoPago || 'PENDIENTE'}
            </Badge>
            {reserva.metodoPago && (
              <Badge tone="neutral">{labelsMetodoPago[reserva.metodoPago] || reserva.metodoPago}</Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-admin-500">
            {formatFechaLocal(reserva.fecha)} · {reserva.horaInicio} - {reserva.horaFin}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold text-admin-900">{formatMoney(reserva.montoTotal)}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_1.1fr]">
        <div className="space-y-3">
          <div>
            <p className="mb-1 text-xs uppercase tracking-[0.2em] text-admin-500">Cliente</p>
            <p className="font-semibold text-admin-900">{reserva.clienteNombre || 'Sin nombre'}</p>
            <p className="text-sm text-admin-600">{reserva.clienteTelefono || 'Sin teléfono'} · {reserva.clienteEmail || 'Sin email'}</p>
          </div>

          {esTransferencia && (
            <div className="rounded-xl border border-admin-200 bg-admin-50 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="font-semibold text-admin-800">Comprobante</p>
                {!tieneComprobante && <Badge tone="neutral">Sin comprobante</Badge>}
                {tieneComprobante && !reserva.comprobante?.esMercadoPago && !reserva.comprobante?.numeroOperacion && <Badge tone="neutral">Solo imagen</Badge>}
                {tieneComprobante && esMercadoPago && <Badge tone="success" icon>Mercado Pago detectado</Badge>}
                {tieneComprobante && !esMercadoPago && <Badge tone="warning">No reconocido como Mercado Pago</Badge>}
              </div>

              {tieneComprobante && (
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2 text-sm text-admin-700">
                    <p><span className="font-semibold">Importe:</span> {reserva.comprobante.importe ? formatMoney(reserva.comprobante.importe) : 'Sin datos'}</p>
                    <p><span className="font-semibold">Fecha:</span> {reserva.comprobante.fechaHoraTexto || 'Sin fecha'}</p>
                    <p><span className="font-semibold">Operación:</span> {reserva.comprobante.numeroOperacion || 'Sin número'}</p>
                    <p><span className="font-semibold">Motivo:</span> {reserva.comprobante.motivo || 'Sin motivo'}</p>
                  </div>
                  <div className="space-y-2 text-sm text-admin-700">
                    <p><span className="font-semibold">Origen:</span> {formatComprobanteField(reserva.comprobante.origen)}</p>
                    <p><span className="font-semibold">Destino:</span> {formatComprobanteField(reserva.comprobante.destino)}</p>
                  </div>
                </div>
              )}

              {validaciones.length > 0 && (
                <div className="mt-3 space-y-2">
                  {validaciones.map((v) => (
                    <div key={`${v.codigo}-${v.mensaje}`} className="flex items-start gap-2 rounded-lg border border-admin-200 bg-white px-2 py-1.5 text-xs">
                      {v.nivel === 'ok' ? (
                        <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                      ) : v.nivel === 'warn' ? (
                        <WarningIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                      ) : (
                        <CloseIcon className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                      )}
                      <span className="text-admin-700">{v.mensaje}</span>
                    </div>
                  ))}
                </div>
              )}

              {comprobanteImagen && (
                <div className="mt-3">
                  <img
                    src={comprobanteImagen}
                    alt="Comprobante"
                    className="h-24 w-28 cursor-pointer rounded-lg border border-admin-200 object-cover"
                    onClick={() => setModalOpen(true)}
                  />
                  {modalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setModalOpen(false)}>
                      <img src={comprobanteImagen} alt="Comprobante ampliado" className="max-h-[85vh] max-w-[90vw] rounded-xl shadow-2xl" onClick={(e) => e.stopPropagation()} />
                    </div>
                  )}
                </div>
              )}

              <div className="mt-3 flex flex-col gap-2">
                <label className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-admin-300 bg-white px-3 py-2 text-sm font-medium text-admin-700 transition hover:bg-admin-50">
                  {tieneComprobante ? 'Reemplazar imagen' : 'Adjuntar imagen'}
                  <input type="file" accept="image/*" className="hidden" onChange={subirImagen} />
                </label>
                {subiendoImagen && <span className="text-xs text-admin-500">Subiendo imagen...</span>}
              </div>

              <details className="mt-3 text-sm text-admin-700">
                <summary className="cursor-pointer font-medium">Ver texto extraído</summary>
                <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-admin-100 p-2 text-xs leading-relaxed">{formatExtractedText(reserva.comprobante?.textoExtraido)}</pre>
              </details>
            </div>
          )}

          {reserva.metodoPago === 'EFECTIVO_PRESENCIAL' && (
            <div className="rounded-xl border border-admin-200 bg-admin-50 p-3 text-sm text-admin-700">
              <span className="font-semibold">Pago presencial:</span> cobrar {formatMoney(reserva.montoTotal)} en el club.
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          {reserva.estado === 1 || reserva.estado === 2 ? (
            esPendiente ? (
              esTransferencia ? (
                tieneComprobante ? (
                  <>
                    <Button
                      onClick={() => {
                        if (erroresValidacion.length > 0) {
                          setDialog('aprobar');
                          return;
                        }
                        aprobarComprobante();
                      }}
                    >
                      Aprobar
                    </Button>
                    <Button variant="danger" onClick={() => setDialog('rechazar')}>Rechazar</Button>
                  </>
                ) : (
                  <>
                    <Button onClick={marcarPagado}>Marcar pagado</Button>
                    <Button variant="danger" onClick={() => setDialog('cancelar')}>Cancelar</Button>
                  </>
                )
              ) : (
                <>
                  <Button onClick={marcarPagado}>Confirmar cobro en efectivo</Button>
                  <Button variant="danger" onClick={() => setDialog('cancelar')}>Cancelar</Button>
                </>
              )
            ) : (
              <div className="rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-800">
                {reserva.estadoPago === 'PAGADO' ? 'Pagado' : 'Sin acciones pendientes'}
              </div>
            )
          ) : (
            <div className="rounded-xl border border-admin-200 bg-admin-50 px-3 py-2 text-sm text-admin-700">
              {reserva.estadoPago === 'PAGADO' ? 'Pago confirmado' : reserva.estado === 3 ? 'Expirada' : 'Cancelada'}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={dialog === 'cancelar'}
        title="Cancelar reserva"
        message={`¿Seguro que querés cancelar la reserva de ${reserva.cancha?.nombre || 'la cancha'} para ${formatFechaLocal(reserva.fecha)} de ${reserva.horaInicio} a ${reserva.horaFin}?`}
        confirmLabel="Sí, cancelar"
        cancelLabel="Volver"
        variant="danger"
        loading={procesando && dialog === 'cancelar'}
        onConfirm={cancelarReserva}
        onCancel={() => {
          setDialog(null);
          setDialogError('');
        }}
      >
        {dialogError && <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{dialogError}</p>}
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog === 'rechazar'}
        title="Rechazar comprobante"
        message="Escribí el motivo del rechazo. Si lo dejas vacío, se usará el texto por defecto."
        confirmLabel="Rechazar"
        cancelLabel="Volver"
        variant="danger"
        loading={procesando && dialog === 'rechazar'}
        onConfirm={rechazarComprobante}
        onCancel={() => {
          setDialog(null);
          setDialogError('');
          setRechazoMotivo('Rechazado por administración');
        }}
      >
        <div className="space-y-3">
          <textarea
            ref={textareaRef}
            value={rechazoMotivo}
            onChange={(event) => setRechazoMotivo(event.target.value)}
            rows={4}
            className="w-full rounded-lg border border-slate-300 p-3 text-sm text-slate-700 outline-none focus:border-slate-500"
            placeholder="Motivo del rechazo"
          />
          {dialogError && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{dialogError}</p>}
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog === 'aprobar'}
        title="Aprobar comprobante"
        message="Hay validaciones con error. ¿Deseás aprobar igual esta comprobación?"
        confirmLabel="Aprobar igual"
        cancelLabel="Volver"
        variant="warning"
        loading={procesando && dialog === 'aprobar'}
        onConfirm={aprobarComprobante}
        onCancel={() => {
          setDialog(null);
          setDialogError('');
        }}
      >
        {erroresValidacion.length > 0 && (
          <div className="mt-3 space-y-2">
            {erroresValidacion.map((validacion) => (
              <div key={`${validacion.codigo}-${validacion.mensaje}`} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {validacion.mensaje}
              </div>
            ))}
          </div>
        )}
        {dialogError && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{dialogError}</p>}
      </ConfirmDialog>
    </div>
  );
}
