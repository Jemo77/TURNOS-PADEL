import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { CheckIcon, WarningIcon, CloseIcon } from '../icons';

// Toasts en vez del banner de texto fijo arriba del dashboard. El aviso aparece abajo
// a la derecha (lejos de donde se está mirando), se auto-oculta a los 3s y no empuja
// el contenido, así la acción "Cancha eliminada" no interrumpe el trabajo.
const DURACION_MS = 3000;

const estilos = {
  success: { contenedor: 'border-brand-200 bg-white', icono: 'text-brand-600', CircleIcon: CheckIcon },
  error: { contenedor: 'border-red-200 bg-white', icono: 'text-red-600', CircleIcon: CloseIcon },
  warning: { contenedor: 'border-amber-200 bg-white', icono: 'text-amber-600', CircleIcon: WarningIcon },
  info: { contenedor: 'border-admin-200 bg-white', icono: 'text-admin-500', CircleIcon: null }
};

const ToastContext = createContext(null);

let contador = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());

  const cerrar = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const mostrar = useCallback((mensaje, tipo = 'success') => {
    if (!mensaje) return;
    contador += 1;
    const id = contador;
    setToasts((prev) => [...prev, { id, mensaje, tipo }]);
    timersRef.current.set(id, setTimeout(() => cerrar(id), DURACION_MS));
  }, [cerrar]);

  // Si el componente se desmonta (logout, navegación) no quedan timers huérfanos.
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach(clearTimeout);
      timers.clear();
    };
  }, []);

  const value = useMemo(() => ({ mostrar, cerrar }), [mostrar, cerrar]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-0 sm:items-end"
        role="status"
        aria-live="polite"
      >
        {toasts.map((toast) => {
          const estilo = estilos[toast.tipo] || estilos.info;
          const CircleIcon = estilo.CircleIcon;
          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex w-full max-w-sm animate-toast-in items-start gap-3 rounded-xl border px-4 py-3 shadow-lift ${estilo.contenedor}`}
            >
              {CircleIcon && (
                <span className="mt-0.5 shrink-0">
                  <CircleIcon className={`h-5 w-5 ${estilo.icono}`} />
                </span>
              )}
              <p className="min-w-0 flex-1 text-sm font-medium text-admin-800">{toast.mensaje}</p>
              <button
                type="button"
                onClick={() => cerrar(toast.id)}
                className="shrink-0 rounded-md p-1 text-admin-400 transition hover:bg-admin-100 hover:text-admin-700"
                aria-label="Cerrar aviso"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast debe usarse dentro de <ToastProvider>');
  return context;
}
