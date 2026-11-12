import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import AdminLayout, { AdminBrand } from '../components/AdminLayout';
import { Button } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import useDocumentTitle from '../hooks/useDocumentTitle';

// Login del panel: usa AdminLayout (fondo oscuro, marca "Panel Turnos Padel") y NO el
// layout público, para que entrar a /admin se sienta como entrar a otra aplicación.
export default function AdminLogin() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [errorLogin, setErrorLogin] = useState('');
  const [enviando, setEnviando] = useState(false);

  useDocumentTitle('Panel Turnos Padel · Acceso', { sufijo: null });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  // Distinguir "credenciales malas" de "el servidor no respondió". Antes cualquier fallo
  // (backend caído, sin internet, CORS) terminaba mostrando "Credenciales inválidas", que
  // mandaba a revisar una contraseña que en realidad estaba bien.
  const mensajeDeError = (error) => {
    if (error.response) {
      return error.response.data?.message || `No se pudo iniciar sesión (error ${error.response.status})`;
    }
    if (error.request) {
      return 'No se pudo contactar al servidor. Revisá que el backend esté levantado.';
    }
    return 'Ocurrió un error inesperado. Probá de nuevo.';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorLogin('');
    setEnviando(true);

    try {
      await login(form.email, form.password);
      navigate('/admin/dashboard', { replace: true });
    } catch (error) {
      setErrorLogin(mensajeDeError(error));
    } finally {
      setEnviando(false);
    }
  };

  if (user) return <Navigate to="/admin/dashboard" replace />;

  return (
    <AdminLayout centered>
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <AdminBrand subtitle="Acceso restringido al club" />
        </div>

        <div className="rounded-2xl border border-admin-800 bg-admin-950 p-8 shadow-2xl">
          <h1 className="text-xl font-bold text-white">Iniciar sesión</h1>
          <p className="mt-1 text-sm text-admin-400">Ingresá con las credenciales del administrador del club.</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {errorLogin && (
              <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {errorLogin}
              </div>
            )}

            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-admin-300">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                value={form.email}
                onChange={handleChange}
                placeholder="admin@turnospadel.com"
                className="w-full rounded-xl border border-admin-700 bg-admin-900 px-3.5 py-2.5 text-sm text-white placeholder:text-admin-500 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-admin-300">Contraseña</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={form.password}
                onChange={handleChange}
                placeholder="••••••••"
                className="w-full rounded-xl border border-admin-700 bg-admin-900 px-3.5 py-2.5 text-sm text-white placeholder:text-admin-500 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                required
              />
            </div>

            <Button type="submit" variant="primary" className="w-full py-3" disabled={enviando}>
              {enviando ? 'Ingresando...' : 'Ingresar al panel'}
            </Button>
          </form>
        </div>

        <div className="mt-6 text-center text-sm">
          <a href="/" className="text-admin-400 underline-offset-4 transition hover:text-white hover:underline">
            Volver al sitio público
          </a>
        </div>
      </div>
    </AdminLayout>
  );
}
