import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout, { PublicHeader } from '../components/Layout';
import { Button, Card, Input, SkeletonCard } from '../components/ui';
import api from '../services/api';
import { formatMoney } from '../utils/format';
import { imagenDeCancha } from '../utils/canchaImagen';
import { formatFechaLocal } from '../utils/fecha';
import useDocumentTitle from '../hooks/useDocumentTitle';

export default function PublicHome() {
  useDocumentTitle(null);

  const [canchas, setCanchas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reservaActual, setReservaActual] = useState(null);
  const [telefonoBusqueda, setTelefonoBusqueda] = useState('');
  const [reservasBuscadas, setReservasBuscadas] = useState([]);
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    api.get('/canchas')
      .then((res) => setCanchas(res.data))
      .catch(() => setCanchas([]))
      .finally(() => setLoading(false));

    const raw = localStorage.getItem('reservaActual');
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw);
      if (parsed?.id && (!parsed.expiraEn || new Date(parsed.expiraEn).getTime() > Date.now())) {
        setReservaActual(parsed);
      }
    } catch (error) {
      localStorage.removeItem('reservaActual');
    }
  }, []);

  const buscarReserva = async (event) => {
    event.preventDefault();
    if (!telefonoBusqueda.trim()) return;

    setBuscando(true);
    try {
      const { data } = await api.get('/reservas/buscar', {
        params: { telefono: telefonoBusqueda.trim() }
      });
      setReservasBuscadas(data || []);
    } catch (error) {
      setReservasBuscadas([]);
    } finally {
      setBuscando(false);
    }
  };

  return (
    <Layout width="lg">
      <PublicHeader title="Turnos Padel" subtitle="Elegí tu cancha y reservá tu horario en minutos." />

      {reservaActual && (
        <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium">Tenés una reserva en proceso. Podés continuarla desde acá.</p>
          <Button as={Link} to={`/reservar/${reservaActual.id}`} variant="warning" size="sm">
            Continuar reserva
          </Button>
        </div>
      )}

      <Card className="mb-8 p-5">
        <h2 className="text-lg font-bold text-admin-900">Retomar reserva</h2>
        <p className="mb-3 text-sm text-admin-500">
          ¿Ya reservaste y querés ver el comprobante o cancelar? Buscá con el teléfono que usaste.
        </p>
        <form onSubmit={buscarReserva} className="flex flex-col gap-3 sm:flex-row">
          <Input
            value={telefonoBusqueda}
            onChange={(e) => setTelefonoBusqueda(e.target.value)}
            placeholder="Ingresá tu teléfono"
            inputMode="tel"
            aria-label="Teléfono"
            className="flex-1"
          />
          <Button type="submit" variant="dark" disabled={buscando || !telefonoBusqueda.trim()}>
            {buscando ? 'Buscando...' : 'Buscar'}
          </Button>
        </form>

        {reservasBuscadas.length > 0 && (
          <div className="mt-4 space-y-2">
            {reservasBuscadas.map((reserva) => (
              <div
                key={reserva.id}
                className="flex flex-col gap-3 rounded-xl border border-admin-200 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-semibold text-admin-900">{reserva.cancha?.nombre || 'Reserva'}</p>
                  <p className="text-sm text-admin-500">
                    {formatFechaLocal(reserva.fecha)} · {reserva.horaInicio} - {reserva.horaFin}
                  </p>
                </div>
                <Button as={Link} to={`/reservar/${reserva.id}`} size="sm">
                  Continuar
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {loading ? (
        <div className="grid gap-6 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : canchas.length === 0 ? (
        <Card className="p-8 text-center text-admin-500">No hay canchas cargadas todavía.</Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-3">
          {canchas.map((cancha) => {
            const imgCancha = imagenDeCancha(cancha.nombre);
            return (
              <Card key={cancha.id} className="flex flex-col overflow-hidden">
                {imgCancha ? (
                  <img src={imgCancha} alt={cancha.nombre} className="h-36 w-full object-cover" />
                ) : (
                  <div className="grid h-36 place-items-center bg-admin-100 text-sm font-semibold text-admin-400">
                    {cancha.nombre}
                  </div>
                )}
                <div className="flex flex-1 flex-col p-5">
                  <h2 className="text-xl font-semibold text-admin-900">{cancha.nombre}</h2>
                  <p className="mt-1 text-sm text-admin-500">{cancha.deporte || 'Padel'}</p>
                  <p className="text-sm text-admin-400">
                    {cancha.horaApertura} a {cancha.horaCierre}
                  </p>
                  <p className="mt-4 font-semibold text-brand-600">{formatMoney(cancha.precioHora)} / hora</p>
                  <Button as={Link} to={`/cancha/${cancha.id}`} className="mt-5 w-full">
                    Ver disponibilidad
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
