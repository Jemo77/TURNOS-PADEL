import { useEffect, useState } from 'react';
import ConfirmDialog from './ConfirmDialog';
import { Input, Select, Checkbox, Field } from './ui';
import api from '../services/api';
import { formatMoney } from '../utils/format';
import { getHoyISO, esFechaHoraPasada } from '../utils/fecha';

// Alta manual de un turno desde el dashboard. Reusa el patrón de ConfirmDialog (mismo
// overlay, mismo foco en cancelar, mismo Escape) y la misma lógica de grilla de
// CanchaDetalle: al elegir cancha + fecha pide GET /canchas/:id/turnos y muestra
// únicamente los horarios libres.
const formInicial = {
  canchaId: '',
  fecha: getHoyISO(),
  horaInicio: '',
  horaFin: '',
  montoTotal: '',
  clienteNombre: '',
  clienteTelefono: '',
  clienteEmail: '',
  metodoPago: 'EFECTIVO_PRESENCIAL',
  marcarPagada: true
};

const slotKey = (slot) => `${slot.horaInicio}-${slot.horaFin}`;

export default function NuevoTurnoManualDialog({ open, canchas, onClose, onCreated }) {
  const [form, setForm] = useState(formInicial);
  const [turnos, setTurnos] = useState([]);
  const [seleccionados, setSeleccionados] = useState([]);
  const [cargandoTurnos, setCargandoTurnos] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  const cancha = canchas.find((item) => item.id === form.canchaId) || null;

  const reiniciar = () => {
    setForm(formInicial);
    setTurnos([]);
    setSeleccionados([]);
    setCargandoTurnos(false);
    setEnviando(false);
    setError('');
  };

  const cerrar = () => {
    reiniciar();
    onClose();
  };

  // Cada vez que cambian cancha o fecha se recarga la disponibilidad libre.
  useEffect(() => {
    if (!open || !form.canchaId || !form.fecha) {
      setTurnos([]);
      return undefined;
    }

    let vigente = true;
    setCargandoTurnos(true);
    setSeleccionados([]);

    api.get(`/canchas/${form.canchaId}/turnos?fecha=${form.fecha}`)
      .then(({ data }) => {
        if (vigente) setTurnos(data.turnos || []);
      })
      .catch(() => {
        if (vigente) setTurnos([]);
      })
      .finally(() => {
        if (vigente) setCargandoTurnos(false);
      });

    return () => {
      vigente = false;
    };
  }, [open, form.canchaId, form.fecha]);

  // El monto se precarga con el precio de la cancha por la cantidad de horas elegidas,
  // pero el admin puede corregirlo (descuentos, cortesías, precios especiales).
  useEffect(() => {
    if (!cancha || seleccionados.length === 0) return;
    const horas = seleccionados.length * (Number(cancha.duracionTurnoMin) / 60);
    setForm((prev) => ({ ...prev, montoTotal: String(Math.round(Number(cancha.precioHora) * horas)) }));
  }, [seleccionados, cancha]);

  const slotsLibres = turnos.filter(
    (turno) =>
      turno.estado === 'disponible' &&
      !esFechaHoraPasada(form.fecha, turno.horaInicio) &&
      !esFechaHoraPasada(form.fecha, turno.horaFin)
  );

  const alternarSlot = (turno) => {
    setSeleccionados((prev) => {
      const existe = prev.some((slot) => slotKey(slot) === slotKey(turno));

      // Misma regla que en CanchaDetalle: la reserva es un único intervalo, así que los
      // horarios tienen que ser contiguos (si no, se bloquearían horas que nadie compró).
      if (!existe && prev.length > 0) {
        const ordenados = [...prev].sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
        const primero = ordenados[0];
        const ultimo = ordenados[ordenados.length - 1];
        const contiguo = turno.horaFin === primero.horaInicio || turno.horaInicio === ultimo.horaFin;
        if (!contiguo) return prev;
      }

      return existe ? prev.filter((slot) => slotKey(slot) !== slotKey(turno)) : [...prev, turno];
    });
  };

  const slotsOrdenados = [...seleccionados].sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
  const horaInicio = slotsOrdenados[0]?.horaInicio || '';
  const horaFin = slotsOrdenados[slotsOrdenados.length - 1]?.horaFin || '';

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async () => {
    setError('');

    if (!form.canchaId) return setError('Elegí la cancha.');
    if (!form.fecha) return setError('Elegí la fecha.');
    if (seleccionados.length === 0) return setError('Elegí al menos un horario libre.');
    if (!form.clienteNombre.trim()) return setError('Ingresá el nombre del cliente.');
    if (!form.clienteTelefono.trim()) return setError('Ingresá el teléfono del cliente.');
    if (form.clienteEmail && !/^\S+@\S+\.\S+$/.test(form.clienteEmail)) return setError('El email no es válido.');

    const monto = Number(form.montoTotal);
    if (Number.isNaN(monto) || monto < 0) return setError('Ingresá un monto válido.');

    try {
      setEnviando(true);
      const { data } = await api.post('/admin/reservas', {
        canchaId: form.canchaId,
        fecha: form.fecha,
        horaInicio,
        horaFin,
        montoTotal: monto,
        clienteNombre: form.clienteNombre.trim(),
        clienteTelefono: form.clienteTelefono.trim(),
        clienteEmail: form.clienteEmail.trim(),
        metodoPago: form.metodoPago,
        marcarPagada: form.marcarPagada
      });

      onCreated?.(data);
      cerrar();
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo crear el turno.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <ConfirmDialog
      open={open}
      title="Nuevo turno manual"
      size="lg"
      message="Cargá un turno tomado por teléfono o presencialmente. Nace confirmado y queda auditado con tu usuario."
      confirmLabel={enviando ? 'Guardando...' : 'Crear turno'}
      cancelLabel="Cancelar"
      variant="success"
      loading={enviando}
      onConfirm={handleSubmit}
      onCancel={cerrar}
    >
      <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Cancha" name="canchaId" value={form.canchaId} onChange={handleChange}>
            <option value="">Elegí una cancha</option>
            {canchas.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nombre} · {formatMoney(item.precioHora)}/h
              </option>
            ))}
          </Select>

          <Field label="Fecha" htmlFor="turno-manual-fecha">
            <input
              id="turno-manual-fecha"
              type="date"
              name="fecha"
              min={getHoyISO()}
              value={form.fecha}
              onChange={handleChange}
              className="w-full rounded-xl border border-admin-300 bg-white px-3.5 py-2.5 text-sm text-admin-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </Field>
        </div>

        <Field
          label="Horarios libres"
          hint={
            !form.canchaId
              ? 'Elegí una cancha para ver la disponibilidad.'
              : cargandoTurnos
                ? 'Cargando disponibilidad...'
                : slotsLibres.length === 0
                  ? 'No hay horarios libres para esa fecha.'
                  : `${seleccionados.length} seleccionados · ${horaInicio} a ${horaFin}`
          }
        >
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {slotsLibres.map((turno) => {
              const activo = seleccionados.some((slot) => slotKey(slot) === slotKey(turno));
              return (
                <button
                  key={slotKey(turno)}
                  type="button"
                  onClick={() => alternarSlot(turno)}
                  aria-pressed={activo}
                  className={`rounded-lg border px-2 py-2 text-xs font-semibold transition ${
                    activo
                      ? 'border-admin-900 bg-admin-900 text-white'
                      : 'border-admin-200 bg-white text-admin-700 hover:border-brand-400 hover:text-brand-700'
                  }`}
                >
                  {turno.horaInicio}
                </button>
              );
            })}
            {!cargandoTurnos && form.canchaId && slotsLibres.length === 0 && (
              <p className="col-span-full py-2 text-sm text-admin-500">
                No queda ningún horario libre. Probá con otro día.
              </p>
            )}
          </div>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Nombre" name="clienteNombre" value={form.clienteNombre} onChange={handleChange} placeholder="Juan Pérez" />
          <Input label="Teléfono" name="clienteTelefono" value={form.clienteTelefono} onChange={handleChange} placeholder="11 2345 6789" inputMode="tel" />
        </div>

        <Input
          label="Email (opcional)"
          name="clienteEmail"
          type="email"
          value={form.clienteEmail}
          onChange={handleChange}
          placeholder="Para walk-ins se puede dejar vacío"
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Método de pago" name="metodoPago" value={form.metodoPago} onChange={handleChange}>
            <option value="EFECTIVO_PRESENCIAL">Efectivo presencial</option>
            <option value="TRANSFERENCIA">Transferencia</option>
            <option value="TARJETA_VIRTUAL">Tarjeta virtual</option>
          </Select>

          <Input
            label="Monto total"
            name="montoTotal"
            type="number"
            min="0"
            step="0.01"
            value={form.montoTotal}
            onChange={handleChange}
            placeholder={seleccionados.length ? '0' : 'Elegí un horario'}
            hint={cancha && seleccionados.length ? `Precio de lista: ${formatMoney(cancha.precioHora)} por hora` : undefined}
          />
        </div>

        <Checkbox
          label="Marcar como pagado ahora"
          hint="Deja la reserva en estado PAGADO y registra tu usuario como responsable."
          name="marcarPagada"
          checked={form.marcarPagada}
          onChange={handleChange}
        />

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        {seleccionados.length > 0 && (
          <div className="rounded-xl bg-admin-50 px-3 py-2 text-xs text-admin-600">
            Se creará la reserva <strong>{horaInicio} - {horaFin}</strong> en estado{' '}
            <strong>{form.marcarPagada ? 'confirmada y pagada' : 'confirmada, pendiente de pago'}</strong>.
          </div>
        )}
      </div>
    </ConfirmDialog>
  );
}
