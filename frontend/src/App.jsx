import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './components/ui';
import RequireAdmin from './components/RequireAdmin';

// Code-splitting real: el visitante público nunca descarga el JS del panel admin.
// AdminLogin y AdminDashboard (y sus dependencias: TurnoAdminCard, ConfirmDialog,
// los formularios del panel) viven en chunks aparte que sólo se piden al entrar a /admin.
const PublicHome = lazy(() => import('./pages/PublicHome'));
const CanchaDetalle = lazy(() => import('./pages/CanchaDetalle'));
const ReservaCheckoutPage = lazy(() => import('./pages/ReservaCheckoutPage'));
const AdminLogin = lazy(() => import('./pages/AdminLogin'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));

function Cargando() {
  return (
    <div className="grid min-h-screen place-items-center">
      <div className="flex flex-col items-center gap-3">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-admin-200 border-t-brand-500" />
        <p className="text-sm text-admin-500">Cargando...</p>
      </div>
    </div>
  );
}

function AppContent() {
  return (
    <Suspense fallback={<Cargando />}>
      <Routes>
        <Route path="/" element={<PublicHome />} />
        <Route path="/cancha/:id" element={<CanchaDetalle />} />
        <Route path="/reservar/:reservaId" element={<ReservaCheckoutPage />} />

        {/* El panel va envuelto en AdminLayout y protegido por RequireAdmin: si no hay
            sesión se redirige a /admin/login sin llegar a renderizar el dashboard. */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route
          path="/admin/dashboard"
          element={
            <RequireAdmin>
              <AdminDashboard />
            </RequireAdmin>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </AuthProvider>
  );
}
