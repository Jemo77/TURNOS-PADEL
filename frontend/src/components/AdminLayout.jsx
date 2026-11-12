// Layout del panel de administración.
//
// A diferencia del sitio público (fondo claro, header con el nombre del club), el
// panel arranca en fondo oscuro y se identifica como "Panel Turnos Padel". El
// objetivo es que abrir /admin se sienta como entrar a otra aplicación, no como
// una página más del sitio.
export default function AdminLayout({ children, centered = false }) {
  return (
    <div className="min-h-screen bg-admin-900 text-admin-100">
      {centered ? (
        <div className="flex min-h-screen flex-col items-center justify-center px-5 py-12">
          {children}
        </div>
      ) : (
        children
      )}
    </div>
  );
}

// Marca del panel: se usa en el login y en el sidebar del dashboard.
export function AdminBrand({ subtitle = 'Panel de administración', compact = false }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-500 font-black text-admin-950">
        TP
      </span>
      {!compact && (
        <div className="min-w-0">
          <p className="truncate text-base font-bold leading-tight text-white">Panel Turnos Padel</p>
          <p className="truncate text-xs text-admin-400">{subtitle}</p>
        </div>
      )}
    </div>
  );
}
