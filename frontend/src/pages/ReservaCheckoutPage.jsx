import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import ConfirmDialog from '../components/ConfirmDialog';
import { Button, Card, Badge, Input, FileInput, Skeleton } from '../components/ui';
import api from '../services/api';
import { formatMoney } from '../utils/format';
import { imagenDeComprobante } from '../utils/comprobanteImagen';
import { formatFechaLocal } from '../utils/fecha';
import useDocumentTitle from '../hooks/useDocumentTitle';

const etiquetasPago = {
  EFECTIVO_PRESENCIAL: 'Efectivo en el club',
  TARJETA_VIRTUAL: 'Tarjeta virtual',
  TRANSFERENCIA: 'Transferencia bancaria'
};

const toneEstadoPago = {
  PAGADO: 'success',
  PENDIENTE: 'warning',
  RECHAZADO: 'danger'
};

export default function ReservaCheckoutPage() {
  const { reservaId } = useParams();
  const [reserva, setReserva] = useState(null);
  const [transferAccount, setTransferAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState(null);
  const [subiendo, setSubiendo] = useState(false);
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState('success');
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelTelefono, setCancelTelefono] = useState('');
  const [cancelando, setCancelando] = useState(false);
  const [cancelError, setCancelError] = useState('');

  useDocumentTitle(reserva?.cancha?.nombre ? `Turno en ${reserva.cancha.nombre}` : 'Tu reserva');

  const avisar = (texto, tone = 'success') => {
    setMessage(texto);
    setMessageTone(tone);
  };

  const fetchReserva = async () => {
    try {
      const { data } = await api.get(`/reservas/${reservaId}`);
      setReserva(data);
      localStorage.setItem('reservaActual', JSON.stringify({ id: data.id, expiraEn: data.expiraEn }));

      if (data?.metodoPago === 'TRANSFERENCIA') {
        const { data: cuenta } = await api.get('/transferencia');
        setTransferAccount(cuenta || null);
      } else {
        setTransferAccount(null);
      }
    } catch (error) {
      setReserva(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReserva();
  }, [reservaId]);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return avisar('Elegí el comprobante antes de continuar.', 'error');

    const formData = new FormData();
    const esPdf = file.type === 'application/pdf';
    formData.append(esPdf ? 'pdf' : 'imagen', file);

    try {
      setSubiendo(true);
      setMessage('');
      const endpoint = esPdf ? `/reservas/${reservaId}/comprobante` : `/reservas/${reservaId}/comprobante-imagen`;
      await api.post(endpoint, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setFile(null);
      avisar('Comprobante enviado. El club lo revisa y te confirma por este medio.');
      await fetchReserva();
    } catch (error) {
      avisar(error.response?.data?.message || 'No se pudo subir el comprobante.', 'error');
    } finally {
      setSubiendo(false);
    }
  };

  const cerrarDialogoCancelar = () => {
    setCancelDialogOpen(false);
    setCancelTelefono('');
    setCancelError('');
  };

  const cancelarReservaPublica = async () => {
    if (!cancelTelefono.trim()) {
      // El error va DENTRO del diálogo: si se mostrara en la página quedaría tapado por
      // el overlay y el usuario vería que no pasa nada al confirmar.
      return setCancelError('Ingresá tu teléfono para confirmar la cancelación.');
    }

    setCancelando(true);
    setCancelError('');
    try {
      await api.put(`/reservas/${reservaId}/cancelar`, { telefono: cancelTelefono });
      avisar('Reserva cancelada.');
      setReserva(null);
      cerrarDialogoCancelar();
      localStorage.removeItem('reservaActual');
    } catch (error) {
      setCancelError(error.response?.data?.message || 'No se pudo cancelar la reserva.');
    } finally {
      setCancelando(false);
    }
  };

  if (loading) {
    return (
      <Layout width="md">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-6 h-72 w-full rounded-2xl" />
      </Layout>
    );
  }

  if (!reserva) {
    return (
      <Layout width="md">
        <Card className="p-8 text-center text-admin-500">No se encontró la reserva.</Card>
      </Layout>
    );
  }

  const requiereComprobante = ['TRANSFERENCIA', 'EFECTIVO_PRESENCIAL'].includes(reserva.metodoPago);
  const imagenComprobante = imagenDeComprobante(reserva.id);

  return (
    <Layout width="md">
      <ConfirmDialog
        open={cancelDialogOpen}
        title="Cancelar reserva"
        message="¿Seguro que querés cancelar esta reserva? Esta acción no se puede deshacer."
        confirmLabel="Sí, cancelar"
        cancelLabel="Volver"
        variant="danger"
        loading={cancelando}
        onConfirm={cancelarReservaPublica}
        onCancel={cerrarDialogoCancelar}
      >
        <Input
          label="Confirmá tu teléfono para cancelar"
          type="tel"
          value={cancelTelefono}
          onChange={(e) => setCancelTelefono(e.target.value)}
          placeholder="11 2345 6789"
        />
        {cancelError && (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {cancelError}
          </p>
        )}
      </ConfirmDialog>

      <Card className="p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-admin-400">Reserva</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-admin-900">
              {reserva.cancha?.nombre || 'Cancha'}
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="dark">{etiquetasPago[reserva.metodoPago] || 'Sin método'}</Badge>
            <Badge tone={toneEstadoPago[reserva.estadoPago] || 'neutral'} icon>
              {reserva.estadoPago || 'PENDIENTE'}
            </Badge>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl bg-admin-50 p-4 text-sm text-admin-700">
            <p className="font-semibold text-admin-900">Datos de la reserva</p>
            <dl className="mt-2 space-y-1">
              <div className="flex justify-between gap-3"><dt>Fecha</dt><dd className="font-medium">{formatFechaLocal(reserva.fecha)}</dd></div>
              <div className="flex justify-between gap-3"><dt>Horario</dt><dd className="font-medium">{reserva.horaInicio} - {reserva.horaFin}</dd></div>
              <div className="flex justify-between gap-3"><dt>Total</dt><dd className="font-medium">{formatMoney(reserva.montoTotal)}</dd></div>
            </dl>
          </div>

          <div className="rounded-xl bg-admin-50 p-4 text-sm text-admin-700">
            <p className="font-semibold text-admin-900">Cliente</p>
            <p className="mt-2">{reserva.clienteNombre || 'Sin nombre'}</p>
            <p>{reserva.clienteTelefono || 'Sin teléfono'}</p>
            <p className="truncate">{reserva.clienteEmail || 'Sin email'}</p>
          </div>
        </div>

        {reserva.estado === 1 || reserva.estado === 2 ? (
          <div className="mt-4 rounded-xl border border-admin-200 bg-white p-4">
            <p className="text-sm text-admin-600">
              ¿Necesitás liberar el horario? La cancelación Online se permite hasta 24 h antes del turno; después de
              eso, contactate directamente con el club.
            </p>
            <Button variant="danger" size="sm" className="mt-3" onClick={() => setCancelDialogOpen(true)}>
              Cancelar reserva
            </Button>
          </div>
        ) : null}

        {requiereComprobante && (
          <div className="mt-8 border-t border-admin-100 pt-6">
            <h2 className="text-xl font-bold text-admin-900">Datos para transferir</h2>

            {transferAccount ? (
              <div className="mt-3 space-y-1 rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900">
                <p><span className="font-semibold">Titular:</span> {transferAccount.nombre || 'Cuenta del club'}</p>
                <p><span className="font-semibold">CBU:</span> {transferAccount.cbu || 'Sin CBU'}</p>
                <p><span className="font-semibold">Alias:</span> {transferAccount.alias || 'Sin alias'}</p>
                <p><span className="font-semibold">Banco:</span> {transferAccount.banco || 'Sin banco'}</p>
              </div>
            ) : (
              <p className="mt-3 text-sm text-amber-700">
                El club todavía no cargó los datos de la cuenta. Contactalos para recibir los datos de pago.
              </p>
            )}

            <form onSubmit={handleUpload} className="mt-6 space-y-4">
              <FileInput
                label="Subí tu comprobante"
                hint="PDF o imagen (JPG/PNG). Se revisa automáticamente y, si hace falta, el club lo confirma a mano."
                accept="application/pdf,image/*"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />

              {message && (
                <div
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    messageTone === 'error'
                      ? 'border-red-200 bg-red-50 text-red-700'
                      : 'border-brand-200 bg-brand-50 text-brand-800'
                  }`}
                >
                  {message}
                </div>
              )}

              <Button type="submit" variant="dark" disabled={subiendo}>
                {subiendo ? 'Enviando...' : 'Enviar comprobante'}
              </Button>
            </form>
          </div>
        )}

        {reserva.comprobante && (
          <div className="mt-8 border-t border-admin-100 pt-6">
            <h2 className="text-xl font-bold text-admin-900">Datos del comprobante</h2>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <div className="rounded-xl bg-admin-50 p-4 text-sm text-admin-700">
                <p><span className="font-semibold">Importe:</span> {reserva.comprobante.importe ? formatMoney(reserva.comprobante.importe) : 'Sin importe'}</p>
                <p><span className="font-semibold">Moneda:</span> {reserva.comprobante.moneda || 'ARS'}</p>
                <p><span className="font-semibold">Número:</span> {reserva.comprobante.numeroOperacion || 'Sin número'}</p>
              </div>
              <div className="rounded-xl bg-admin-50 p-4 text-sm text-admin-700">
                <p><span className="font-semibold">Motivo:</span> {reserva.comprobante.motivo || 'Sin motivo'}</p>
                <p><span className="font-semibold">Estado:</span> {reserva.comprobante.estado}</p>
              </div>
            </div>
            {imagenComprobante && (
              <img
                src={imagenComprobante}
                alt="Comprobante cargado"
                className="mt-4 h-36 w-48 rounded-lg border border-admin-200 object-cover"
              />
            )}
          </div>
        )}
      </Card>
    </Layout>
  );
}
