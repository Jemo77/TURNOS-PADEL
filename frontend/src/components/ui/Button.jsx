import { Link } from 'react-router-dom';

// Botón base del proyecto. Reemplaza al className="bg-slate-900 text-white px-4 py-3
// rounded-lg" que estaba pegado a mano en cada pantalla. La idea es que cambiar el
// estilo global sea editar este archivo y nada más.
const base =
  'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 ' +
  'disabled:cursor-not-allowed disabled:opacity-60';

const variants = {
  // Acción principal del sitio público.
  primary: 'bg-brand-500 text-white hover:bg-brand-600 active:bg-brand-700 shadow-sm',
  // Acción principal del panel admin (superficie oscura).
  dark: 'bg-admin-900 text-white hover:bg-admin-800 active:bg-admin-950 shadow-sm',
  danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 shadow-sm',
  warning: 'bg-amber-500 text-admin-900 hover:bg-amber-600 active:bg-amber-700 shadow-sm',
  // Botón secundario: contornos, no peso visual.
  outline: 'border border-admin-300 bg-white text-admin-700 hover:bg-admin-50',
  subtle: 'bg-admin-100 text-admin-700 hover:bg-admin-200',
  ghost: 'text-admin-600 hover:bg-admin-100 hover:text-admin-900',
  // Sobre fondos oscuros (sidebar del panel).
  ghostDark: 'text-admin-300 hover:bg-admin-800 hover:text-white'
};

const sizes = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-5 py-3 text-sm'
};

export default function Button({
  variant = 'primary',
  size = 'md',
  as,
  to,
  href,
  className = '',
  children,
  ...props
}) {
  const classes = `${base} ${variants[variant] || variants.primary} ${sizes[size] || sizes.md} ${className}`;

  if (to) return <Link to={to} className={classes} {...props}>{children}</Link>;
  if (href) return <a href={href} className={classes} {...props}>{children}</a>;

  const Component = as || 'button';
  return (
    <Component type={Component === 'button' ? 'button' : undefined} className={classes} {...props}>
      {children}
    </Component>
  );
}
