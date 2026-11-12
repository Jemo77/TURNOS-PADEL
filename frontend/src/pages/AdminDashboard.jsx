import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout, { AdminBrand } from '../components/AdminLayout';
import ConfirmDialog from '../components/ConfirmDialog';
import TurnoAdminCard from '../components/TurnoAdminCard';
import NuevoTurnoManualDialog from '../components/NuevoTurnoManualDialog';
import { Button, Card, CardHeader, StatCard, Input, Select, Textarea, FileInput, Checkbox, SkeletonRow, useToast } from '../components/ui';
import { BarChart, StackedBarChart, ProgressList, RingProgress, Leyenda } from '../components/ui/Charts';
import { MenuIcon, GlobeIcon, LogoutIcon } from '../components/icons';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { formatMoney } from '../utils/format';
import { imagenDeCancha, slugifyNombre } from '../utils/canchaImagen';
import { toDateKey, parseFechaCalendario, formatFechaLocal } from '../utils/fecha';
import { reservaVigente } from '../utils/reservas';
import {
  resumen as resumenFinanzas,
  ocupacionPorDia,
  ingresosPorDia,
  ingresosPorCancha,
  distribucionMetodosPago,
  demandaPorFranja,
  ultimosDias,
  proximosDias
} from '../utils/metricas';
import useDocumentTitle from '../hooks/useDocumentTitle';

const emptyCanchaForm = {
  nombre: '',
  descripcion: '',
  imagenUrl: '',
  deporte: 'Padel',
  precioHora: 15000,
  moneda: 'ARS',
  horaApertura: '08:00',
  horaCierre: '23:00',
  duracionTurnoMin: 60,
  activa: true
};

const SECCIONES = [
  { id: 'turnos', label: 'Turnos' },
  { id: 'finanzas', label: 'Finanzas' },
  { id: 'canchas', label: 'Canchas' },
  { id: 'mp', label: 'Config. Mercado Pago' }
];

function TurnosSection({
  canchas,
  reservas,
  loadingData,
  filtroFecha,
  filtroCancha,
  ordenReservas,
  soloPorConfirmar,
  onFiltroChange,
  onAbrirManual,
  onRefresh,
  onToast
}) {
  const hayFiltros = filtroFecha || filtroCancha || soloPorConfirmar || ordenReservas !== 'fechaAsc';

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <StatCard label="Reservas hoy" value={reservas.hoy} />
        <StatCard label="Pendientes de cobro" value={reservas.pendientes} tone="warning" />
      </div>

      <Card className="p-6">
        <CardHeader
          title="Turnos"
          subtitle={hayFiltros ? 'Filtrando la lista' : 'Todas las reservas del club'}
          action={
            <Button onClick={onAbrirManual} size="sm">
              <span className="text-base leading-none">+</span> Nuevo turno manual
            </Button>
          }
          className="mb-5"
        />

        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <Input
            type="date"
            aria-label="Filtrar por fecha"
            className="sm:w-44"
            value={filtroFecha}
            onChange={(e) => onFiltroChange({ filtroFecha: e.target.value })}
          />
          <Select
            aria-label="Filtrar por cancha"
            className="sm:w-48"
            value={filtroCancha}
            onChange={(e) => onFiltroChange({ filtroCancha: e.target.value })}
          >
            <option value="">Todas las canchas</option>
            {canchas.map((cancha) => (
              <option key={cancha.id} value={cancha.id}>{cancha.nombre}</option>
            ))}
          </Select>
          <Select
            aria-label="Ordenar"
            className="sm:w-48"
            value={ordenReservas}
            onChange={(e) => onFiltroChange({ ordenReservas: e.target.value })}
          >
            <option value="fechaAsc">Más próximo</option>
            <option value="fechaDesc">Más reciente</option>
            <option value="montoAsc">Monto menor</option>
            <option value="montoDesc">Monto mayor</option>
          </Select>
          <Checkbox
            label="Solo por confirmar"
            className="self-end rounded-lg border border-admin-200 px-3 py-2"
            checked={soloPorConfirmar}
            onChange={(e) => onFiltroChange({ soloPorConfirmar: e.target.checked })}
          />
          {hayFiltros && (
            <Button
              variant="subtle"
              className="self-end"
              onClick={() => onFiltroChange({ filtroFecha: '', filtroCancha: '', soloPorConfirmar: false, ordenReservas: 'fechaAsc' })}
            >
              Limpiar
            </Button>
          )}
        </div>

        {loadingData ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)}
          </div>
        ) : reservas.lista.length === 0 ? (
          <p className="py-8 text-center text-sm text-admin-500">No hay turnos para los filtros seleccionados.</p>
        ) : (
          <div className="space-y-3">
            {reservas.lista.map((reserva) => (
              <TurnoAdminCard
                key={reserva.id}
                reserva={reserva}
                onRefresh={onRefresh}
                onStatus={onToast}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function FinanzasSection({ reservasTodas, canchas, pendientes }) {
  const dias = useMemo(() => ultimosDias(14), []);
  const adelante = useMemo(() => proximosDias(14), []);

  const resumen = useMemo(() => resumenFinanzas(reservasTodas, canchas), [reservasTodas, canchas]);
  const ocupacion = useMemo(() => ocupacionPorDia(reservasTodas, canchas, adelante), [reservasTodas, canchas, adelante]);
  const ingresos = useMemo(() => ingresosPorDia(reservasTodas, dias), [reservasTodas, dias]);
  const porCancha = useMemo(() => ingresosPorCancha(reservasTodas, canchas, dias), [reservasTodas, canchas, dias]);
  const metodos = useMemo(() => distribucionMetodosPago(reservasTodas, dias), [reservasTodas, dias]);
  const franja = useMemo(() => demandaPorFranja(reservasTodas, dias), [reservasTodas, dias]);

  const comprobantesPendientes = pendientes.filter((item) => item.estado === 'PENDIENTE').length;
  const dia = (fecha) => formatFechaLocal(fecha, { day: '2-digit', month: '2-digit' });

  return (
    <div className="space-y-6">
      {/* Los cuatro números con los que se arranca el día. */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Cobrado"
          value={formatMoney(resumen.cobrado)}
          hint={`${resumen.reservasVigentes} turnos vigentes`}
          tone="brand"
        />
        <StatCard
          label="Por cobrar"
          value={formatMoney(resumen.pendiente)}
          hint={resumen.pendiente > 0 ? 'Reservas confirmadas sin acreditar' : 'Todo al día'}
          tone="warning"
        />
        <StatCard
          label="Ticket promedio"
          value={formatMoney(resumen.ticketPromedio)}
          hint="Por reserva vigente"
        />
        <StatCard
          label="Turnos de hoy"
          value={resumen.turnosHoy}
          hint={`${resumen.horasHoy} h reservadas`}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
        {/* Qué tan lleno está el club: la métrica que define si el negocio rinde. */}
        <Card className="p-6">
          <CardHeader
            title="Ocupación de los próximos 14 días"
            subtitle="Porcentaje de horas disponibles ya vendidas. Hoy al 80% o más, el club está al límite."
            className="mb-6"
          />
          <BarChart
            data={ocupacion.map((d) => ({ etiqueta: dia(d.fecha), valor: d.porcentaje }))}
            formato={(v) => `${v}%`}
            alto={180}
          />
          <p className="mt-4 text-xs text-admin-500">
            La ocupación se mide sobre las horas realmente reservadas (una reserva de 3 h cuenta
            3 h), no sobre la cantidad de reservas.
          </p>
        </Card>

        <Card className="flex flex-col items-center justify-center p-6">
          <RingProgress
            porcentaje={resumen.ocupacionHoy}
            etiqueta="Ocupación de hoy"
            subetiqueta={`${resumen.horasHoy} h vendidas de las disponibles`}
          />
        </Card>
      </div>

      <Card className="p-6">
        <CardHeader
          title="Ingresos de los últimos 14 días"
          subtitle="Lo que ya entró vs. lo que falta acreditar."
          className="mb-6"
          action={
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-700">
                Cobrado {formatMoney(ingresos.reduce((s, d) => s + d.cobrado, 0))}
              </span>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                Pendiente {formatMoney(ingresos.reduce((s, d) => s + d.pendiente, 0))}
              </span>
            </div>
          }
        />
        <StackedBarChart data={ingresos.map((d) => ({ ...d, etiqueta: dia(d.fecha) }))} alto={180} />
        <div className="mt-4">
          <Leyenda
            items={[
              { etiqueta: 'Cobrado', tono: 'brand' },
              { etiqueta: 'Pendiente de acreditar', tono: 'amber' }
            ]}
          />
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <CardHeader title="Ingresos por cancha" subtitle="Últimos 14 días. Para saber dónde ajustar precio." className="mb-5" />
          <ProgressList
            data={porCancha.map((c) => ({
              clave: c.id,
              etiqueta: c.nombre,
              valor: c.monto,
              porcentaje: c.porcentaje
            }))}
            formato={(v) => formatMoney(v)}
          />
        </Card>

        <Card className="p-6">
          <CardHeader title="Cómo pagan" subtitle="Mix de métodos de pago en reservas vigentes." className="mb-5" />
          <ProgressList
            data={metodos.map((m) => ({
              clave: m.metodo,
              etiqueta: m.etiqueta,
              valor: m.cantidad,
              porcentaje: m.porcentaje
            }))}
            formato={(v) => `${v} ${v === 1 ? 'turno' : 'turnos'}`}
            tono="admin"
          />
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Card className="p-6">
          <CardHeader
            title="Demanda por franja horaria"
            subtitle="Dónde se concentra la reserva. Útil para subir la hora pico o bajar la de la valle."
            className="mb-6"
          />
          <BarChart
            data={franja.map((f) => ({ etiqueta: f.etiqueta, valor: f.cantidad }))}
            formato={(v) => `${v} reservas`}
            tono="admin"
            alto={160}
          />
        </Card>

        <Card className="p-6">
          <CardHeader title="Salud de las reservas" className="mb-5" />
          <div className="space-y-3">
            <Fila
              etiqueta="Tasa de turnos perdidos o cancelados"
              valor={`${resumen.tasaPerdida}%`}
              detalle={`${resumen.cantidadPerdidas} de ${resumen.cantidadPerdidas + resumen.reservasVigentes} reservas`}
              tono={resumen.tasaPerdida > 20 ? 'red' : 'brand'}
            />
            <Fila
              etiqueta="Comprobantes esperando revisión"
              valor={comprobantesPendientes}
              detalle="se aprueban desde la sección Turnos"
              tono={comprobantesPendientes > 0 ? 'amber' : 'brand'}
            />
            <Fila
              etiqueta="Reservas sin acreditar"
              valor={resumen.pendiente > 0 ? formatMoney(resumen.pendiente) : '—'}
              detalle={resumen.pendiente > 0 ? 'cobro que todavía no entró' : 'todo cobrado'}
              tono={resumen.pendiente > 0 ? 'amber' : 'brand'}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}

function Fila({ etiqueta, valor, detalle, tono = 'brand' }) {
  const colores = {
    brand: 'text-admin-900',
    amber: 'text-amber-600',
    red: 'text-red-600'
  };
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-admin-200 bg-admin-50 px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-admin-800">{etiqueta}</p>
        <p className="truncate text-xs text-admin-500">{detalle}</p>
      </div>
      <p className={`shrink-0 text-lg font-bold tabular-nums ${colores[tono]}`}>{valor}</p>
    </div>
  );
}

function CanchasSection({ canchas, loadingData, form, editingId, imagenPreviewUrl, onFormChange, onImagenChange, onSubmit, onEdit, onReset, onDelete }) {
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card className="p-6">
        <CardHeader
          title={editingId ? 'Editar cancha' : 'Nueva cancha'}
          subtitle="Las canchas activas son las que se ven en el sitio público."
          action={editingId ? <Button variant="ghost" size="sm" onClick={onReset}>Cancelar</Button> : null}
          className="mb-5"
        />

        <form onSubmit={onSubmit} className="space-y-4">
          <Input label="Nombre" name="nombre" value={form.nombre} onChange={onFormChange} placeholder="Cancha 1" required />
          <Input label="Deporte" name="deporte" value={form.deporte} onChange={onFormChange} placeholder="Padel" />
          <Textarea label="Descripción" name="descripcion" value={form.descripcion || ''} onChange={onFormChange} placeholder="Cancha techada, piso de grip…" rows={3} />
          <Input label="URL de imagen (opcional)" name="imagenUrl" value={form.imagenUrl || ''} onChange={onFormChange} placeholder="https://…" />

          <FileInput
            label="Imagen de la cancha"
            hint={`Se guarda convertida a webp como ${slugifyNombre(form.nombre) || 'cancha'}.webp en src/imagenes (no se guarda nada en la base de datos).`}
            accept="image/*"
            onChange={onImagenChange}
          />
          {(imagenPreviewUrl || (editingId && imagenDeCancha(form.nombre))) && (
            <img
              src={imagenPreviewUrl || imagenDeCancha(form.nombre)}
              alt="Vista previa"
              className="h-28 w-40 rounded-lg border border-admin-200 object-cover"
            />
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <Input label="Precio por hora" name="precioHora" type="number" min="0" value={form.precioHora} onChange={onFormChange} required />
            <Input label="Moneda" name="moneda" value={form.moneda} onChange={onFormChange} />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Input label="Apertura" name="horaApertura" type="time" value={form.horaApertura} onChange={onFormChange} required />
            <Input label="Cierre" name="horaCierre" type="time" value={form.horaCierre} onChange={onFormChange} required />
            <Input label="Duración (min)" name="duracionTurnoMin" type="number" min="15" step="15" value={form.duracionTurnoMin} onChange={onFormChange} required />
          </div>

          <Checkbox label="Cancha activa" name="activa" checked={form.activa} onChange={onFormChange} />

          <Button type="submit" variant="dark" className="w-full">
            {editingId ? 'Guardar cambios' : 'Crear cancha'}
          </Button>
        </form>
      </Card>

      <Card className="p-6">
        <CardHeader title="Canchas cargadas" className="mb-4" />

        {loadingData ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => <SkeletonRow key={i} />)}
          </div>
        ) : canchas.length === 0 ? (
          <p className="py-8 text-center text-sm text-admin-500">No hay canchas.</p>
        ) : (
          <div className="space-y-3">
            {canchas.map((cancha) => (
              <div key={cancha.id} className="flex flex-col gap-3 rounded-xl border border-admin-200 p-3 md:flex-row md:items-center md:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  {imagenDeCancha(cancha.nombre) ? (
                    <img src={imagenDeCancha(cancha.nombre)} alt={cancha.nombre} className="h-16 w-24 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <div className="grid h-16 w-24 shrink-0 place-items-center rounded-lg bg-admin-100 text-xs font-semibold text-admin-400">
                      Sin foto
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-admin-900">{cancha.nombre}</p>
                    <p className="truncate text-sm text-admin-500">
                      {cancha.deporte} · {formatMoney(cancha.precioHora)}/hora · {cancha.activa ? 'Activa' : 'Inactiva'}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="warning" size="sm" onClick={() => onEdit(cancha)}>Editar</Button>
                  <Button variant="danger" size="sm" onClick={() => onDelete(cancha.id)}>Eliminar</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function MpSection({ mpConnect, onConectar, transferAccount, onTransferChange, onTransferSave }) {
  return (
    <div className="max-w-2xl space-y-6">
      <Card className="p-6">
        <CardHeader title="Mercado Pago" subtitle="Se conecta la cuenta del club vía OAuth para conciliar los cobros." className="mb-4" />

        <Button variant="primary" className="w-full" onClick={onConectar} disabled={mpConnect.connected}>
          {mpConnect.connected ? 'Mercado Pago conectado' : 'Conectar Mercado Pago'}
        </Button>

        {!mpConnect.connected && (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            Si no aparece la autorización, faltan MP_CLIENT_ID, MP_CLIENT_SECRET y MP_OAUTH_REDIRECT_URI en el .env
            del backend.
          </p>
        )}

        {mpConnect.qrDataUrl && !mpConnect.connected && (
          <div className="mt-4 text-center">
            <img src={mpConnect.qrDataUrl} alt="QR de conexión Mercado Pago" className="mx-auto rounded-lg border border-admin-200 bg-white p-2" />
            <a href={mpConnect.url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm text-sky-700 underline">
              Abrir autorización de Mercado Pago
            </a>
          </div>
        )}

        {mpConnect.connected && (
          <p className="mt-3 rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm text-brand-800">
            La cuenta de Mercado Pago quedó conectada y lista para conciliación.
          </p>
        )}
      </Card>

      <Card className="p-6">
        <CardHeader
          title="Cuenta para transferencias"
          subtitle="Estos datos son los que ve el comprador en el checkout."
          className="mb-4"
        />
        <form onSubmit={onTransferSave} className="space-y-3">
          <Input label="Nombre de la cuenta" value={transferAccount.nombre || ''} onChange={(e) => onTransferChange('nombre', e.target.value)} placeholder="Turnos Padel SRL" />
          <Input label="CBU" value={transferAccount.cbu || ''} onChange={(e) => onTransferChange('cbu', e.target.value)} placeholder="0000000000000000000000" />
          <Input label="Alias" value={transferAccount.alias || ''} onChange={(e) => onTransferChange('alias', e.target.value)} placeholder="turnos.padel" />
          <Input label="Banco" value={transferAccount.banco || ''} onChange={(e) => onTransferChange('banco', e.target.value)} placeholder="Banco del club" />
          <Button type="submit" className="w-full">Guardar datos de transferencia</Button>
        </form>
      </Card>
    </div>
  );
}

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const { mostrar } = useToast();
  const navigate = useNavigate();

  const [seccion, setSeccion] = useState('turnos');
  const [reservasTodas, setReservasTodas] = useState([]);
  const [canchas, setCanchas] = useState([]);
  const [pendientes, setPendientes] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyCanchaForm);
  const [imagenFile, setImagenFile] = useState(null);
  const [imagenPreviewUrl, setImagenPreviewUrl] = useState('');
  const [transferAccount, setTransferAccount] = useState({ nombre: '', cbu: '', alias: '', banco: '' });
  const [mpConnect, setMpConnect] = useState({ url: '', qrDataUrl: '', connected: false });
  const [filtroFecha, setFiltroFecha] = useState('');
  const [filtroCancha, setFiltroCancha] = useState('');
  const [soloPorConfirmar, setSoloPorConfirmar] = useState(false);
  const [ordenReservas, setOrdenReservas] = useState('fechaAsc');
  const [colapsado, setColapsado] = useState(false);
  const [canchaIdAEliminar, setCanchaIdAEliminar] = useState(null);
  const [eliminando, setEliminando] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);

  useDocumentTitle('Panel Turnos Padel', { sufijo: null });

  const toast = (mensaje, tipo = 'success') => mostrar(mensaje, tipo);

  const fetchReservas = async () => {
    try {
      const { data } = await api.get('/admin/reservas');
      setReservasTodas(data || []);
    } catch (error) {
      setReservasTodas([]);
    }
  };

  const fetchDatos = async () => {
    try {
      const [canchasRes, pagosRes, cuentaRes, mpEstadoRes] = await Promise.all([
        api.get('/admin/canchas'),
        api.get('/admin/pagos/pendientes'),
        api.get('/admin/config/transferencia'),
        api.get('/admin/mp/estado').catch(() => ({ data: { conectado: false, cuenta: null } }))
      ]);

      setCanchas(canchasRes.data || []);
      setPendientes(pagosRes.data || []);
      setTransferAccount(cuentaRes.data || { nombre: '', cbu: '', alias: '', banco: '' });
      setMpConnect((prev) => ({ ...prev, connected: !!mpEstadoRes.data?.conectado }));
    } catch (error) {
      setCanchas([]);
      setPendientes([]);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    fetchReservas();
    fetchDatos();
  }, []);

  // Los KPIs de la cabecera del sidebar y las métricas se calculan acá una sola vez.
  const hoyISO = toDateKey(new Date());
  const totalFinanzas = reservasTodas.reduce((sum, reserva) => (
    reservaVigente(reserva) ? sum + Number(reserva.montoTotal || 0) : sum
  ), 0);
  const pendientesPago = reservasTodas.filter((reserva) => (
    reservaVigente(reserva) && reserva.estadoPago === 'PENDIENTE'
  )).length;
  const comprobantesPendientes = pendientes.filter((item) => item.estado === 'PENDIENTE').length;

  // Filtros + orden de la sección Turnos.
  const reservasFiltradas = reservasTodas
    .filter((reserva) => {
      if (filtroFecha && toDateKey(reserva.fecha) !== filtroFecha) return false;
      if (filtroCancha && reserva.canchaId !== filtroCancha) return false;
      if (soloPorConfirmar && !(reserva.estadoPago === 'PENDIENTE' && ['TRANSFERENCIA', 'EFECTIVO_PRESENCIAL'].includes(reserva.metodoPago))) return false;
      return true;
    })
    .sort((a, b) => {
      const fechaA = parseFechaCalendario(a.fecha)?.getTime?.() ?? 0;
      const fechaB = parseFechaCalendario(b.fecha)?.getTime?.() ?? 0;

      switch (ordenReservas) {
        case 'fechaDesc':
          return fechaB - fechaA || String(b.horaInicio || '').localeCompare(String(a.horaInicio || ''));
        case 'montoDesc':
          return Number(b.montoTotal || 0) - Number(a.montoTotal || 0);
        case 'montoAsc':
          return Number(a.montoTotal || 0) - Number(b.montoTotal || 0);
        case 'fechaAsc':
        default:
          return fechaA - fechaB || String(a.horaInicio || '').localeCompare(String(b.horaInicio || ''));
      }
    });

  const metricasTurnos = {
    lista: reservasFiltradas,
    hoy: reservasFiltradas.filter((reserva) => toDateKey(reserva.fecha) === hoyISO).length,
    pendientes: reservasFiltradas.filter((reserva) => reservaVigente(reserva) && reserva.estadoPago === 'PENDIENTE').length
  };

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleImagenChange = (e) => {
    const file = e.target.files?.[0] || null;
    if (imagenPreviewUrl) URL.revokeObjectURL(imagenPreviewUrl);
    setImagenFile(file);
    setImagenPreviewUrl(file ? URL.createObjectURL(file) : '');
  };

  const resetForm = () => {
    setForm(emptyCanchaForm);
    setEditingId(null);
    setImagenFile(null);
    if (imagenPreviewUrl) URL.revokeObjectURL(imagenPreviewUrl);
    setImagenPreviewUrl('');
  };

  const handleCanchaSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      precioHora: Number(form.precioHora),
      duracionTurnoMin: Number(form.duracionTurnoMin),
      activa: Boolean(form.activa)
    };

    try {
      const { data: canchaGuardada } = editingId
        ? await api.put(`/admin/canchas/${editingId}`, payload)
        : await api.post('/admin/canchas', payload);

      // La imagen se sube aparte: se guarda como {nombre-cancha}.webp en src/imagenes.
      if (imagenFile) {
        const formData = new FormData();
        formData.append('imagen', imagenFile);
        await api.post(`/admin/canchas/${canchaGuardada.id}/imagen`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }

      toast(editingId ? 'Cancha actualizada' : 'Cancha creada');
      resetForm();
      fetchDatos();
    } catch (error) {
      toast(error.response?.data?.message || 'No se pudo guardar la cancha', 'error');
    }
  };

  const handleEdit = (cancha) => {
    setEditingId(cancha.id);
    setImagenFile(null);
    if (imagenPreviewUrl) URL.revokeObjectURL(imagenPreviewUrl);
    setImagenPreviewUrl('');
    setForm({
      nombre: cancha.nombre || '',
      descripcion: cancha.descripcion || '',
      imagenUrl: cancha.imagenUrl || '',
      deporte: cancha.deporte || 'Padel',
      precioHora: Number(cancha.precioHora || 0),
      moneda: cancha.moneda || 'ARS',
      horaApertura: cancha.horaApertura || '08:00',
      horaCierre: cancha.horaCierre || '23:00',
      duracionTurnoMin: Number(cancha.duracionTurnoMin || 60),
      activa: Boolean(cancha.activa)
    });
  };

  const handleDelete = async () => {
    if (!canchaIdAEliminar) return;
    try {
      setEliminando(true);
      await api.delete(`/admin/canchas/${canchaIdAEliminar}`);
      toast('Cancha eliminada');
      setCanchaIdAEliminar(null);
      fetchDatos();
    } catch (error) {
      toast(error.response?.data?.message || 'No se pudo eliminar la cancha', 'error');
    } finally {
      setEliminando(false);
    }
  };

  const refreshTurnos = async () => {
    await Promise.all([fetchReservas(), fetchDatos()]);
  };

  const handleMpConectar = async () => {
    try {
      const { data } = await api.post('/admin/mp/conectar');
      setMpConnect({ url: data.url, qrDataUrl: data.qrDataUrl, connected: false });
      toast('Conexión de Mercado Pago iniciada');

      const interval = setInterval(async () => {
        try {
          const { data: statusData } = await api.get('/admin/mp/estado');
          if (statusData?.conectado) {
            clearInterval(interval);
            setMpConnect((prev) => ({ ...prev, connected: true }));
            toast('Mercado Pago conectado correctamente');
          }
        } catch (error) {
          // seguir esperando la autorización
        }
      }, 3000);
    } catch (error) {
      toast(error.response?.data?.message || 'No se pudo iniciar la conexión con Mercado Pago', 'error');
      setMpConnect((prev) => ({ ...prev, connected: false }));
    }
  };

  const handleTransferChange = (campo, valor) => {
    setTransferAccount((prev) => ({ ...prev, [campo]: valor }));
  };

  const handleTransferSave = async (e) => {
    e.preventDefault();
    try {
      await api.put('/admin/config/transferencia', transferAccount);
      toast('Cuenta de transferencia actualizada');
      fetchDatos();
    } catch (error) {
      toast(error.response?.data?.message || 'No se pudo guardar la cuenta de transferencia', 'error');
    }
  };

  const onFiltroChange = (patch) => {
    if ('filtroFecha' in patch) setFiltroFecha(patch.filtroFecha);
    if ('filtroCancha' in patch) setFiltroCancha(patch.filtroCancha);
    if ('ordenReservas' in patch) setOrdenReservas(patch.ordenReservas);
    if ('soloPorConfirmar' in patch) setSoloPorConfirmar(patch.soloPorConfirmar);
  };

  const seccionActual = SECCIONES.find((s) => s.id === seccion) || SECCIONES[0];

  return (
    <AdminLayout>
      <div className="flex h-screen flex-col overflow-hidden md:flex-row">
        {/*
          Sidebar. En desktop es un riel fijo: expandido 16rem, retraído 4rem con sólo
          los puntos. En mobile NO puede ocupar toda la pantalla (tapaba el contenido), así
          que se comporta como una barra superior: la navegación va en fila con scroll
          horizontal y, retraída, se reduce a la marca + el botón del menú.
        */}
        <aside
          className={`z-20 flex shrink-0 flex-col bg-admin-950 text-white md:h-full md:min-h-0 ${
            colapsado ? 'md:w-16' : 'md:w-64'
          }`}
        >
          <div
            className={`flex items-center justify-between gap-2 border-b border-admin-800 px-4 py-3 md:py-4 ${
              colapsado ? 'md:justify-center md:px-0' : ''
            }`}
          >
            <AdminBrand compact={colapsado} />
            <button
              type="button"
              onClick={() => setColapsado((v) => !v)}
              title={colapsado ? 'Expandir menú' : 'Retraer menú'}
              aria-label={colapsado ? 'Expandir menú' : 'Retraer menú'}
              aria-expanded={!colapsado}
              className="shrink-0 rounded-lg p-2 text-admin-300 transition hover:bg-admin-800 hover:text-white"
            >
              <MenuIcon className="h-5 w-5" />
            </button>
          </div>

          <nav
            className={`min-h-0 flex-1 flex-row overflow-x-auto md:flex-col md:overflow-y-auto md:overflow-x-hidden ${
              colapsado ? 'hidden md:flex' : 'flex'
            }`}
          >
            {SECCIONES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSeccion(s.id)}
                title={colapsado ? s.label : undefined}
                className={`flex items-center gap-2 whitespace-nowrap px-4 py-3 text-sm font-medium transition md:gap-3 md:border-b md:border-b-0 md:border-l-4 md:px-5 md:py-3.5 ${
                  seccion === s.id
                    ? 'bg-admin-800 text-white md:border-l-brand-400'
                    : 'text-admin-300 hover:bg-admin-900 md:border-l-transparent'
                } ${colapsado ? 'md:justify-center md:px-0' : ''}`}
              >
                <span className={`h-2 w-2 shrink-0 rounded-full ${seccion === s.id ? 'bg-brand-400' : 'bg-admin-700'}`} />
                {!colapsado && <span>{s.label}</span>}
              </button>
            ))}
          </nav>

          <div
            className={`flex-row gap-1 border-t border-admin-800 px-2 py-2 md:mt-auto md:flex-col md:gap-1 md:p-4 ${
              colapsado ? 'hidden md:flex md:px-2' : 'flex'
            }`}
          >
            <a
              href="/"
              target="_blank"
              rel="noreferrer"
              title="Ver el sitio público"
              className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-2 py-2 text-sm text-admin-300 transition hover:bg-admin-800 hover:text-white md:gap-3 ${colapsado ? 'md:justify-center' : ''}`}
            >
              <GlobeIcon className="h-4 w-4 shrink-0" />
              {!colapsado && <span>Ver sitio</span>}
            </a>
            <button
              type="button"
              onClick={async () => {
                await logout();
                navigate('/', { replace: true });
              }}
              title="Cerrar sesión"
              className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-2 py-2 text-sm text-red-300 transition hover:bg-admin-800 hover:text-red-200 md:gap-3 ${colapsado ? 'md:justify-center' : ''}`}
            >
              <LogoutIcon className="h-4 w-4 shrink-0" />
              {!colapsado && <span>Salir</span>}
            </button>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto bg-admin-50 p-5 md:p-8">
          <ConfirmDialog
            open={Boolean(canchaIdAEliminar)}
            title="Eliminar cancha"
            message="¿Seguro que querés eliminar esta cancha? Esta acción no se puede deshacer."
            confirmLabel="Sí, eliminar"
            cancelLabel="Volver"
            variant="danger"
            loading={eliminando}
            onConfirm={handleDelete}
            onCancel={() => setCanchaIdAEliminar(null)}
          />

          <NuevoTurnoManualDialog
            open={manualOpen}
            canchas={canchas}
            onClose={() => setManualOpen(false)}
            onCreated={(reserva) => {
              toast(`Turno de ${reserva.horaInicio} a ${reserva.horaFin} cargado para ${reserva.clienteNombre}`);
              refreshTurnos();
            }}
          />

          <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-admin-900">{seccionActual.label}</h2>
              <p className="mt-0.5 text-sm text-admin-500">
                Sesión de {user?.nombre || user?.email} · {pendientesPago} cobros pendientes
              </p>
            </div>
            {loadingData && <span className="text-xs text-admin-400">Actualizando datos...</span>}
          </header>

          {seccion === 'turnos' && (
            <TurnosSection
              canchas={canchas}
              reservas={metricasTurnos}
              loadingData={loadingData}
              filtroFecha={filtroFecha}
              filtroCancha={filtroCancha}
              ordenReservas={ordenReservas}
              soloPorConfirmar={soloPorConfirmar}
              onFiltroChange={onFiltroChange}
              onAbrirManual={() => setManualOpen(true)}
              onRefresh={refreshTurnos}
              onToast={toast}
            />
          )}

          {seccion === 'finanzas' && (
            <FinanzasSection reservasTodas={reservasTodas} canchas={canchas} pendientes={pendientes} />
          )}

          {seccion === 'canchas' && (
            <CanchasSection
              canchas={canchas}
              loadingData={loadingData}
              form={form}
              editingId={editingId}
              imagenPreviewUrl={imagenPreviewUrl}
              onFormChange={handleFormChange}
              onImagenChange={handleImagenChange}
              onSubmit={handleCanchaSubmit}
              onEdit={handleEdit}
              onReset={resetForm}
              onDelete={setCanchaIdAEliminar}
            />
          )}

          {seccion === 'mp' && (
            <MpSection
              mpConnect={mpConnect}
              onConectar={handleMpConectar}
              transferAccount={transferAccount}
              onTransferChange={handleTransferChange}
              onTransferSave={handleTransferSave}
            />
          )}
        </main>
      </div>
    </AdminLayout>
  );
}
