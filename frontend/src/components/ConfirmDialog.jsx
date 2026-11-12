import { useEffect, useRef } from 'react';

// Diálogo modal base del panel. Lo usan: cancelar reserva, aprobar/rechazar
// comprobante, eliminar cancha y el alta manual de turnos (pasando el form como
// children). Mantiene el mismo comportamiento en todos: Escape para cerrar, foco en
// cancelar, click fuera para cerrar y bloqueo mientras procesa.
const anchos = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl'
};

const colorByVariant = {
  danger: 'bg-red-600 hover:bg-red-700 text-white',
  warning: 'bg-amber-500 hover:bg-amber-600 text-admin-900',
  success: 'bg-brand-500 hover:bg-brand-600 text-white',
  dark: 'bg-admin-900 hover:bg-admin-800 text-white'
};

export default function ConfirmDialog({
  open,
  title,
  message,
  children,
  size = 'md',
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'danger',
  loading = false,
  onConfirm,
  onCancel
}) {
  const cancelButtonRef = useRef(null);

  useEffect(() => {
    if (!open || loading) return;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onCancel?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, loading, onCancel]);

  useEffect(() => {
    if (open && !loading) {
      cancelButtonRef.current?.focus();
    }
  }, [open, loading]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:items-center"
      onClick={() => {
        if (!loading) onCancel?.();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className={`my-auto w-full ${anchos[size] || anchos.md} rounded-2xl bg-white p-6 shadow-xl`}
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id="confirm-dialog-title" className="text-xl font-bold text-admin-900">{title}</h3>

        {message && <p className="mt-2 text-sm text-admin-600">{message}</p>}

        {children && <div className="mt-4">{children}</div>}

        <div className="mt-6 flex justify-end gap-3">
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-xl border border-admin-300 bg-white px-4 py-2 text-sm font-medium text-admin-700 transition hover:bg-admin-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-70 ${colorByVariant[variant] || colorByVariant.danger}`}
          >
            {loading ? 'Procesando...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
