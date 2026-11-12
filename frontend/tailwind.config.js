/**
 * Tokens de diseño.
 *
 * Antes cada pantalla repetía `bg-emerald-500` / `bg-slate-900` sueltas, así que un
 * cambio de color de marca obligaba a tocar todas las pantallas. Acá se fija:
 *   - brand: verde principal, para todo lo que es acción positiva del sitio público
 *     (reservar, confirmar, precio).
 *   - admin: escala oscura, para el chrome del panel (sidebar, títulos, botones
 *     oscuros). Es lo que hace que el dashboard se vea como otra superficie.
 *
 * Las escalas son las de Tailwind (emerald / slate) nombradas por su rol.
 *
 * @type {import('tailwindcss').Config}
 */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b'
        },
        admin: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif']
      },
      boxShadow: {
        card: '0 1px 2px rgba(15, 23, 42, 0.04), 0 8px 24px -12px rgba(15, 23, 42, 0.18)',
        lift: '0 12px 32px -12px rgba(15, 23, 42, 0.28)'
      },
      keyframes: {
        'toast-in': {
          '0%': { opacity: '0', transform: 'translateY(12px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' }
        }
      },
      animation: {
        'toast-in': 'toast-in 180ms ease-out'
      }
    }
  },
  plugins: []
};
