// Skeletons de carga. Reemplazan al "<p>Cargando...</p>" para que la pantalla no
// salte de tamaño cuando llegan los datos.
export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-lg bg-admin-200/70 ${className}`} />;
}

export function SkeletonText({ lines = 3, className = '' }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={`h-3 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`} />
      ))}
    </div>
  );
}

export function SkeletonCard({ className = '' }) {
  return (
    <div className={`rounded-2xl border border-admin-100 bg-white p-6 shadow-card ${className}`}>
      <Skeleton className="h-36 w-full rounded-xl" />
      <Skeleton className="mt-4 h-5 w-2/3" />
      <Skeleton className="mt-2 h-3 w-1/3" />
      <Skeleton className="mt-4 h-4 w-1/2" />
    </div>
  );
}

export function SkeletonStat() {
  return (
    <div className="rounded-2xl border border-admin-100 bg-white p-5 shadow-card">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-8 w-16" />
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="rounded-2xl border border-admin-100 bg-white p-4 shadow-card">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-56" />
        </div>
        <Skeleton className="h-6 w-20" />
      </div>
      <Skeleton className="mt-4 h-3 w-full" />
    </div>
  );
}
