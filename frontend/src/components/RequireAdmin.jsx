import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Guarda única del acceso al panel. Antes esta lógica (if (loading) ... if (!user)
// return <Navigate to="/admin/login" />) estaba copiada en AdminLogin y
// AdminDashboard, y era fácil que una se desincronizara de la otra.
export default function RequireAdmin({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-admin-900">
        <div className="flex flex-col items-center gap-3">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-admin-700 border-t-brand-400" />
          <p className="text-sm text-admin-400">Verificando sesión...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/admin/login" replace />;

  return children;
}
