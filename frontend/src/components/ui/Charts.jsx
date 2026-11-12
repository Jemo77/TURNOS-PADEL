// Gráficos del panel de Finanzas.
//
// Son SVG/CSS a propósito, sin librerías de charts: son cuatro gráficos fijos, y meter
// recharts/chart.js sólo para eso agrega ~100 kB al bundle del admin y una dependencia
// más que mantener. Si alguna vez hacen falta gráficos configurables, ahí sí conviene
// evaluarla.
import { formatMoney } from '../../utils/format';

const TONO = {
  brand: 'bg-brand-500',
  brandSuave: 'bg-brand-300',
  amber: 'bg-amber-400',
  admin: 'bg-admin-400',
  red: 'bg-red-400',
  sky: 'bg-sky-400'
};

// Barras verticales. `data` = [{ etiqueta, valor, valor2? }]
export function BarChart({
  data,
  alto = 160,
  formato = (v) => String(v),
  tono = 'brand'
}) {
  if (!data.length) return <Vacio alto={alto} />;

  const max = Math.max(1, ...data.map((d) => Math.max(Number(d.valor) || 0, Number(d.valor2) || 0)));

  return (
    <div className="flex items-stretch gap-1" style={{ minHeight: alto }}>
      {data.map((d) => {
        const altura = Math.max(3, ((Number(d.valor) || 0) / max) * 100);
        return (
          <div key={d.etiqueta} className="group flex min-w-0 flex-1 flex-col items-center gap-1.5">
            <div className="relative flex w-full flex-1 items-end">
              <div
                className={`w-full rounded-t-md ${TONO[tono] || TONO.brand} opacity-85 transition group-hover:opacity-100`}
                style={{ height: `${altura}%` }}
                title={`${d.etiqueta}: ${formato(d.valor)}`}
              />
              <span className="pointer-events-none absolute -top-6 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-admin-900 px-2 py-1 text-[10px] font-semibold text-white shadow-lg group-hover:block">
                {formato(d.valor)}
              </span>
            </div>
            <span className="w-full truncate text-center text-[10px] text-admin-400">{d.etiqueta}</span>
          </div>
        );
      })}
    </div>
  );
}

// Barras apiladas: cobrado (oscuro) + pendiente (ámbar). Para plata.
export function StackedBarChart({ data, alto = 160 }) {
  if (!data.length) return <Vacio alto={alto} />;

  const max = Math.max(1, ...data.map((d) => (Number(d.cobrado) || 0) + (Number(d.pendiente) || 0)));

  return (
    <div className="flex items-stretch gap-1" style={{ minHeight: alto }}>
      {data.map((d) => {
        const cobrado = Number(d.cobrado) || 0;
        const pendiente = Number(d.pendiente) || 0;
        const total = cobrado + pendiente;
        const hCobrado = (cobrado / max) * 100;
        const hPendiente = (pendiente / max) * 100;
        return (
          <div key={d.fecha} className="group flex min-w-0 flex-1 flex-col items-center gap-1.5">
            <div className="relative flex w-full flex-1 flex-col justify-end">
              {pendiente > 0 && (
                <div
                  className="w-full rounded-t-md bg-amber-400 opacity-90 transition group-hover:opacity-100"
                  style={{ height: `${hPendiente}%` }}
                />
              )}
              {cobrado > 0 && (
                <div
                  className={`w-full ${pendiente > 0 ? '' : 'rounded-t-md'} bg-brand-600 transition group-hover:bg-brand-500`}
                  style={{ height: `${hCobrado}%` }}
                />
              )}
              {total === 0 && <div className="h-[3px] w-full rounded-t-md bg-admin-200" />}
              <span className="pointer-events-none absolute -top-6 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-admin-900 px-2 py-1 text-[10px] font-semibold text-white shadow-lg group-hover:block">
                {formatMoney(total)}
              </span>
            </div>
            <span className="w-full truncate text-center text-[10px] text-admin-400">{d.etiqueta}</span>
          </div>
        );
      })}
    </div>
  );
}

// Barras horizontales con porcentaje: mix de métodos de pago, ingresos por cancha.
export function ProgressList({ data, formato = (v) => String(v), tono = 'brand' }) {
  if (!data.length) return <p className="py-6 text-center text-sm text-admin-500">Sin datos en el período.</p>;

  return (
    <ul className="space-y-3">
      {data.map((item) => (
        <li key={item.clave ?? item.etiqueta}>
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <span className="truncate text-sm font-medium text-admin-700">{item.etiqueta}</span>
            <span className="shrink-0 text-sm tabular-nums text-admin-500">
              {formato(item.valor)}
              {typeof item.porcentaje === 'number' && (
                <span className="ml-1.5 text-xs text-admin-400">{item.porcentaje}%</span>
              )}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-admin-100">
            <div
              className={`h-full rounded-full ${TONO[item.tono || tono] || TONO.brand} transition-[width] duration-500`}
              style={{ width: `${Math.max(2, Math.min(100, item.porcentaje || 0))}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

// Anillo de ocupación de hoy. Un número grande se lee más rápido que una barra.
export function RingProgress({ porcentaje, etiqueta, subetiqueta, tamano = 132 }) {
  const radio = 52;
  const circunferencia = 2 * Math.PI * radio;
  const avance = circunferencia * (Math.max(0, Math.min(100, porcentaje)) / 100);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: tamano, height: tamano }}>
        <svg viewBox="0 0 120 120" className="-rotate-90">
          <circle cx="60" cy="60" r={radio} fill="none" stroke="currentColor" strokeWidth="11" className="text-admin-100" />
          <circle
            cx="60"
            cy="60"
            r={radio}
            fill="none"
            strokeWidth="11"
            strokeLinecap="round"
            strokeDasharray={`${avance} ${circunferencia - avance}`}
            className={porcentaje >= 80 ? 'text-brand-500' : porcentaje >= 40 ? 'text-amber-400' : 'text-sky-400'}
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <div className="text-center">
            <p className="text-3xl font-bold tabular-nums text-admin-900">{porcentaje}%</p>
          </div>
        </div>
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-admin-800">{etiqueta}</p>
        {subetiqueta && <p className="mt-0.5 text-xs text-admin-500">{subetiqueta}</p>}
      </div>
    </div>
  );
}

function Vacio({ alto = 160 }) {
  return (
    <div className="grid place-items-center rounded-xl border border-dashed border-admin-200 text-sm text-admin-400" style={{ minHeight: alto }}>
      Sin datos en el período
    </div>
  );
}

export function Leyenda({ items }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
      {items.map((item) => (
        <li key={item.etiqueta} className="flex items-center gap-1.5 text-xs text-admin-500">
          <span className={`h-2.5 w-2.5 rounded ${TONO[item.tono] || TONO.brand}`} />
          {item.etiqueta}
        </li>
      ))}
    </ul>
  );
}
