import { useId } from 'react';

// Controles de formulario. Todo con la misma caja (borde, radio, focus) para que un
// cambio de estilo global se vea igual en el login, el checkout y el panel admin.
//
// Cada control genera su propio id si no se le pasa uno, para que el <label> quede
// siempre asociado al input (accesibilidad, click en el label, autofill del navegador
// y selectores de test consistentes).
const control =
  'w-full rounded-xl border border-admin-300 bg-white px-3.5 py-2.5 text-sm text-admin-900 ' +
  'placeholder:text-admin-400 outline-none transition ' +
  'focus:border-brand-500 focus:ring-2 focus:ring-brand-100 ' +
  'disabled:bg-admin-50 disabled:text-admin-400';

export function Input({ label, hint, error, className = '', id, ...props }) {
  const autoId = useId();
  const inputId = id || autoId;
  return (
    <Field label={label} hint={hint} error={error} htmlFor={inputId} className={className}>
      <input id={inputId} className={control} {...props} />
    </Field>
  );
}

export function Textarea({ label, hint, error, className = '', id, ...props }) {
  const autoId = useId();
  const inputId = id || autoId;
  return (
    <Field label={label} hint={hint} error={error} htmlFor={inputId} className={className}>
      <textarea id={inputId} className={`${control} resize-y`} {...props} />
    </Field>
  );
}

export function Select({ label, hint, error, className = '', id, children, ...props }) {
  const autoId = useId();
  const inputId = id || autoId;
  return (
    <Field label={label} hint={hint} error={error} htmlFor={inputId} className={className}>
      <select id={inputId} className={`${control} pr-9`} {...props}>
        {children}
      </select>
    </Field>
  );
}

export function Checkbox({ label, hint, className = '', id, ...props }) {
  const autoId = useId();
  const inputId = id || autoId;
  return (
    <label htmlFor={inputId} className={`flex cursor-pointer items-start gap-2.5 text-sm text-admin-700 ${className}`}>
      <input
        id={inputId}
        type="checkbox"
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-admin-300 text-brand-500 focus:ring-brand-400"
        {...props}
      />
      <span>
        <span className="font-medium">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-admin-500">{hint}</span>}
      </span>
    </label>
  );
}

export function Field({ label, hint, error, htmlFor, className = '', children }) {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-admin-700">
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p className="mt-1.5 text-xs font-medium text-red-600">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-admin-500">{hint}</p>
      ) : null}
    </div>
  );
}

// Input de archivo con el botón oscuro, igual en todas las pantallas.
export function FileInput({ label, hint, accept, onChange, id }) {
  const autoId = useId();
  const inputId = id || autoId;
  return (
    <Field label={label} hint={hint} htmlFor={inputId}>
      <input
        id={inputId}
        type="file"
        accept={accept}
        onChange={onChange}
        className="block w-full text-sm text-admin-600 file:mr-4 file:cursor-pointer file:rounded-lg file:border-0 file:bg-admin-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-admin-800"
      />
    </Field>
  );
}
