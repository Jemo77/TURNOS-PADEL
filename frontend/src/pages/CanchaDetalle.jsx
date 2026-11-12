import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import BackButton from '../components/BackButton';
import { Button, Card, Input, Select, Field, Skeleton } from '../components/ui';
import api from '../services/api';
import { formatMoney } from '../utils/format';
import { formatFechaLocal, getHoyISO, esFechaHoraPasada } from '../utils/fecha';
import useDocumentTitle from '../hooks/useDocumentTitle';

const METODOS_PAGO = [
  { value: 'TRANSFERENCIA', label: 'Transferencia bancaria' },
  { value: 'EFECTIVO_PRESENCIAL', label: 'Efectivo en el club' },
  { value: 'TARJETA_VIRTUAL', label: 'Tarjeta virtual' }
];

const estiloSlot = {
  disponible: 'bg-brand-500 text-white hover:bg-brand-600',
  en_proceso: 'bg-amber-400 text-admin-900 cursor-not-allowed',
  reservado: 'bg-admin-300 text-admin-600 cursor-not-allowed',
  pasado: 'bg-admin-200 text-admin-400 cursor-not-allowed'
};

export default function CanchaDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [cancha, setCancha] = useState(null);
  const [turnos, setTurnos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cargandoTurnos, setCargandoTurnos] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => getHoyISO());
  const [selectedSlots, setSelectedSlots] = useState([]);
  const [form, setForm] = useState({
    clienteNombre: '',
    clienteTelefono: '',
    clienteEmail: '',
    metodoPago: 'TRANSFERENCIA'
  });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState('success');

  useDocumentTitle(cancha ? `${cancha.nombre} · Disponibilidad` : 'Disponibilidad');

  const fetchCanchaAndTurnos = async (fecha) => {
    setCargandoTurnos(true);
    try {
      const [canchaRes, turnosRes] = await Promise.all([
        api.get(`/canchas/${id}`),
        api.get(`/canchas/${id}/turnos?fecha=${fecha}`)
      ]);

      setCancha(canchaRes.data);
      setTurnos(turnosRes.data.turnos || []);
    } catch (error) {
      setCancha(null);
      setTurnos([]);
    } finally {
      setLoading(false);
      setCargandoTurnos(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    setSelectedSlots([]);
    fetchCanchaAndTurnos(selectedDate);
  }, [id, selectedDate]);

  const slotKey = (slot) => `${slot.horaInicio}-${slot.horaFin}`;

  const estaSeleccionado = (turno) => selectedSlots.some((slot) => slotKey(slot) === slotKey(turno));

  // La reserva se guarda como un único intervalo (horaInicio..horaFin), así que los slots
  // elegidos tienen que ser SIEMPRE contiguos. Antes se podían elegir 08:00 y 10:00 y eso
  // creaba un bloque de 08:00 a 11:00: se cobraban 2 horas pero quedaban 3 bloqueadas para
  // todos los demás. Sólo se puede hacer clic sobre el bloque (para limpiar) o pegado a uno
  // de sus extremos (para extender); un hueco intermedio no es seleccionable.
  const esContiguoCon = (turno, seleccion) => {
    if (seleccion.length === 0) return true;
    const ordenados = [...seleccion].sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
    const primero = ordenados[0];
    const ultimo = ordenados[ordenados.length - 1];

    const pegaIzquierda = turno.horaFin === primero.horaInicio;
    const pegaDerecha = turno.horaInicio === ultimo.horaFin;
    return pegaIzquierda || pegaDerecha;
  };

  const toggleSlot = (turno) => {
    if (turno.estado !== 'disponible') return;
    if (esFechaHoraPasada(selectedDate, turno.horaInicio) || esFechaHoraPasada(selectedDate, turno.horaFin)) return;
    if (!estaSeleccionado(turno) && !esContiguoCon(turno, selectedSlots)) return;

    setSelectedSlots((prev) => {
      const exists = prev.some((slot) => slotKey(slot) === slotKey(turno));
      return exists ? prev.filter((slot) => slotKey(slot) !== slotKey(turno)) : [...prev, turno];
    });
  };

  const total = Number(cancha?.precioHora || 0) * selectedSlots.length;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const avisar = (texto, tone = 'success') => {
    setMessage(texto);
    setMessageTone(tone);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!cancha || selectedSlots.length === 0) {
      return avisar('Seleccioná al menos un horario para continuar.', 'error');
    }
    if (!form.clienteNombre || !form.clienteTelefono || !form.clienteEmail) {
      return avisar('Completá nombre, teléfono y email para confirmar la reserva.', 'error');
    }

    try {
      setSubmitting(true);
      setMessage('');

      const slotsOrdenados = [...selectedSlots].sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
      const horaInicio = slotsOrdenados[0].horaInicio;
      const horaFin = slotsOrdenados[slotsOrdenados.length - 1].horaFin;
      const montoTotal = Number(cancha.precioHora) * selectedSlots.length;

      const { data: reserva } = await api.post('/reservas/hold', {
        canchaId: id,
        fecha: selectedDate,
        horaInicio,
        horaFin,
        montoTotal
      });

      const { data: reservaConfirmada } = await api.put(`/reservas/${reserva.id}/confirmar`, {
        clienteNombre: form.clienteNombre,
        clienteTelefono: form.clienteTelefono,
        clienteEmail: form.clienteEmail,
        metodoPago: form.metodoPago
      });

      localStorage.setItem('reservaActual', JSON.stringify({
        id: reservaConfirmada.id,
        expiraEn: reservaConfirmada.expiraEn
      }));

      setSelectedSlots([]);

      if (form.metodoPago === 'TARJETA_VIRTUAL') {
        avisar('Pago acreditado. Tu reserva quedó confirmada.');
      } else if (form.metodoPago === 'TRANSFERENCIA') {
        avisar('Reserva registrada. Subí el comprobante para completarla.');
        navigate(`/reservar/${reservaConfirmada.id}`);
      } else {
        avisar('Reserva registrada. Queda pendiente de confirmación del club.');
      }

      await fetchCanchaAndTurnos(selectedDate);
    } catch (error) {
      avisar(error.response?.data?.message || 'No se pudo confirmar la reserva.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout width="xl">
      {loading ? (
        <div className="space-y-6">
          <Skeleton className="h-6 w-32" />
          <div className="grid gap-8 xl:grid-cols-[1.5fr_0.8fr]">
            <Skeleton className="h-[32rem] w-full rounded-2xl" />
            <Skeleton className="h-[32rem] w-full rounded-2xl" />
          </div>
        </div>
      ) : !cancha ? (
        <Card className="p-8 text-center text-admin-500">La cancha no existe.</Card>
      ) : (
        <div className="grid gap-8 xl:grid-cols-[1.5fr_0.8fr]">
          <Card className="p-6">
            <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <BackButton to="/" label="Volver" className="mb-3" />
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">
                  {cancha.deporte || 'Padel'}
                </p>
                <h1 className="mt-1 text-3xl font-bold tracking-tight text-admin-900">{cancha.nombre}</h1>
              </div>
              <div className="rounded-xl bg-brand-50 px-4 py-2 font-semibold text-brand-700">
                {formatMoney(cancha.precioHora)} por hora
              </div>
            </div>

            <Field label="Día de la reserva" htmlFor="fecha" className="mb-6 max-w-xs">
              <input
                id="fecha"
                type="date"
                min={getHoyISO()}
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full rounded-xl border border-admin-300 bg-white px-3.5 py-2.5 text-sm text-admin-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </Field>

            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-admin-600">
                Elegí uno o varios horarios para{' '}
                <span className="font-semibold text-admin-900">
                  {formatFechaLocal(selectedDate, { day: '2-digit', month: 'long', year: 'numeric' })}
                </span>
                .
              </p>
              <div className="flex items-center gap-2">
                {selectedSlots.length > 0 && (
                  <>
                    <span className="rounded-full bg-admin-900 px-3 py-1 text-xs font-semibold text-white">
                      {selectedSlots.length} seleccionados
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedSlots([])}
                      className="text-xs font-medium text-admin-500 underline hover:text-admin-800"
                    >
                      Limpiar
                    </button>
                  </>
                )}
              </div>
            </div>

            {cargandoTurnos && turnos.length === 0 ? (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                {Array.from({ length: 9 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                {turnos.map((turno) => {
                  const bloqueado =
                    turno.estado !== 'disponible' ||
                    esFechaHoraPasada(selectedDate, turno.horaInicio) ||
                    esFechaHoraPasada(selectedDate, turno.horaFin);

                  // Libre pero no pegado a lo ya elegido: se ve pero no se puede tomar,
                  // para que quede claro que el bloque tiene que ser seguido.
                  const noContiguo =
                    !bloqueado && !estaSeleccionado(turno) && !esContiguoCon(turno, selectedSlots);

                  return (
                    <button
                      key={slotKey(turno)}
                      type="button"
                      onClick={() => toggleSlot(turno)}
                      disabled={bloqueado}
                      aria-pressed={estaSeleccionado(turno)}
                      title={noContiguo ? 'Elegí un horario pegado a los que ya seleccionaste' : undefined}
                      className={`rounded-xl px-3 py-3 text-sm font-semibold transition ${
                        noContiguo ? 'cursor-not-allowed opacity-40 ' : ''}${
                        estaSeleccionado(turno) ? 'bg-admin-900 text-white' : estiloSlot[turno.estado] || estiloSlot.pasado
                      }`}
                    >
                      {turno.horaInicio} - {turno.horaFin}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 border-t border-admin-100 pt-4 text-xs text-admin-500">
              <span className="flex items-center gap-2"><span className="h-3 w-3 rounded bg-brand-500" /> Libre</span>
              <span className="flex items-center gap-2"><span className="h-3 w-3 rounded bg-admin-900" /> Seleccionado</span>
              <span className="flex items-center gap-2"><span className="h-3 w-3 rounded bg-amber-400" /> Alguien está reservando</span>
              <span className="flex items-center gap-2"><span className="h-3 w-3 rounded bg-admin-300" /> Reservado</span>
            </div>
          </Card>

          <Card as="aside" className="p-6 xl:sticky xl:top-8">
            <h2 className="mb-4 text-xl font-bold text-admin-900">Pago y reserva</h2>

            <div className="mb-5 rounded-xl bg-admin-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-admin-500">Turnos elegidos</p>
              {selectedSlots.length === 0 ? (
                <p className="mt-2 text-sm text-admin-500">Todavía no elegiste horarios.</p>
              ) : (
                <ul className="mt-2 space-y-2 text-sm text-admin-700">
                  {[...selectedSlots]
                    .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio))
                    .map((slot) => (
                      <li
                        key={slotKey(slot)}
                        className="flex justify-between gap-3 border-b border-admin-200 pb-2 last:border-0 last:pb-0"
                      >
                        <span>{slot.horaInicio} - {slot.horaFin}</span>
                        <span className="font-medium">{formatMoney(cancha.precioHora)}</span>
                      </li>
                    ))}
                </ul>
              )}

              <div className="mt-4 flex items-center justify-between border-t border-admin-200 pt-3 font-semibold text-admin-900">
                <span>Total</span>
                <span>{formatMoney(total)}</span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Nombre"
                name="clienteNombre"
                value={form.clienteNombre}
                onChange={handleChange}
                placeholder="Juan Pérez"
                autoComplete="name"
                required
              />
              <Input
                label="Teléfono"
                name="clienteTelefono"
                value={form.clienteTelefono}
                onChange={handleChange}
                placeholder="11 2345 6789"
                inputMode="tel"
                autoComplete="tel"
                required
              />
              <Input
                label="Email"
                name="clienteEmail"
                type="email"
                value={form.clienteEmail}
                onChange={handleChange}
                placeholder="usuario@mail.com"
                autoComplete="email"
                required
              />
              <Select label="Método de pago" name="metodoPago" value={form.metodoPago} onChange={handleChange}>
                {METODOS_PAGO.map((opcion) => (
                  <option key={opcion.value} value={opcion.value}>{opcion.label}</option>
                ))}
              </Select>

              {form.metodoPago === 'TRANSFERENCIA' && (
                <div className="rounded-xl border border-dashed border-admin-300 bg-admin-50 p-3 text-xs text-admin-600">
                  Te vamos a mostrar los datos de la cuenta del club en el siguiente paso para que subas el
                  comprobante.
                </div>
              )}

              {form.metodoPago === 'TARJETA_VIRTUAL' && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                  <strong className="font-semibold">Demo, sin cobro real.</strong> Por ahora la tarjeta virtual
                  confirma la reserva al instante sin pasar por una pasarela de pago. Para la versión productive se
                  conecta Mercado Pago.
                </div>
              )}

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

              <Button type="submit" variant="dark" className="w-full py-3" disabled={submitting || selectedSlots.length === 0}>
                {submitting ? 'Confirmando...' : 'Confirmar reserva'}
              </Button>
            </form>
          </Card>
        </div>
      )}
    </Layout>
  );
}
