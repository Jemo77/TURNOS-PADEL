// Contenedor de superficie. Reemplaza al "bg-white rounded-2xl shadow p-6" repetido.
export default function Card({ as: Component = 'div', className = '', children, ...props }) {
  return (
    <Component className={`rounded-2xl border border-admin-100 bg-white shadow-card ${className}`} {...props}>
      {children}
    </Component>
  );
}

export function CardHeader({ title, subtitle, action, className = '' }) {
  return (
    <div className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${className}`}>
      <div className="min-w-0">
        <h2 className="text-xl font-bold text-admin-900">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-admin-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function CardBody({ className = '', children }) {
  return <div className={className}>{children}</div>;
}

// Métrica del dashboard (reservas hoy, pendientes, monto total...).
export function StatCard({ label, value, hint, tone = 'default', icon: Icon }) {
  const tones = {
    default: 'text-admin-900',
    brand: 'text-brand-600',
    warning: 'text-amber-600'
  };

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-admin-500">{label}</p>
        {Icon && <Icon className="h-5 w-5 shrink-0 text-admin-300" />}
      </div>
      <p className={`mt-2 text-3xl font-bold tabular-nums ${tones[tone] || tones.default}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-admin-400">{hint}</p>}
    </Card>
  );
}
