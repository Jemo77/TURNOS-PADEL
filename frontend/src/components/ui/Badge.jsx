import { CheckIcon, WarningIcon, CloseIcon } from '../icons';

// Badge de estado. Reemplaza los "text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700"
// sueltos, y suma el icono para que el estado se lea de un vistazo.
const tones = {
  neutral: 'bg-admin-100 text-admin-700',
  brand: 'bg-brand-100 text-brand-700',
  success: 'bg-brand-100 text-brand-700',
  warning: 'bg-amber-100 text-amber-700',
  danger: 'bg-red-100 text-red-700',
  info: 'bg-sky-100 text-sky-700',
  // Para usar sobre el sidebar oscuro del panel.
  dark: 'bg-admin-800 text-admin-200'
};

// Qué tonos llevan icono y cuáles no: "PAGADO" con tick verde, "PENDIENTE" con
// exclamación, y los neutros sin nada para no ensuciar.
const toneIcons = {
  brand: CheckIcon,
  success: CheckIcon,
  warning: WarningIcon,
  danger: CloseIcon
};

export default function Badge({ tone = 'neutral', icon = false, className = '', children }) {
  const Icon = icon === true ? toneIcons[tone] : null;

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${tones[tone] || tones.neutral} ${className}`}>
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {children}
    </span>
  );
}
