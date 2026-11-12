// Layout del sitio público: fondo claro y contenido centrado con el padding del sitio.
// El panel admin NO usa este layout: vive en AdminLayout, para que a simple vista se
// note que el login y el dashboard son otra superficie.
const anchos = {
  sm: 'max-w-2xl',
  md: 'max-w-4xl',
  lg: 'max-w-5xl',
  xl: 'max-w-6xl'
};

export default function Layout({ children, width = 'lg', className = '' }) {
  return (
    <div className={`min-h-screen bg-gradient-to-b from-admin-50 to-admin-200 ${className}`}>
      <div className={`mx-auto w-full px-5 py-8 sm:px-8 ${anchos[width] || anchos.lg}`}>{children}</div>
    </div>
  );
}

export function PublicHeader({ title = 'Turnos Padel', subtitle, action }) {
  return (
    <header className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-admin-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-admin-500">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}
