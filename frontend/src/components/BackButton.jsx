import { Link } from 'react-router-dom';
import { ArrowLeftIcon } from './icons';

export default function BackButton({ to = '/', label = 'Volver', className = '' }) {
  return (
    <Link
      to={to}
      className={`inline-flex items-center gap-2 rounded-xl border border-admin-300 bg-white px-3 py-2 text-sm font-medium text-admin-700 transition hover:bg-admin-50 ${className}`}
    >
      <ArrowLeftIcon className="h-4 w-4" />
      <span>{label}</span>
    </Link>
  );
}
