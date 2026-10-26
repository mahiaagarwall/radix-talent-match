import { useId } from 'react';
import { Search } from 'lucide-react';

function FieldShell({ id, label, required, hint, error, children, className = '' }) {
  return (
    <div className={`field ${className}`}>
      {label && (
        <label className="field__label" htmlFor={id}>
          {label}
          {required && (
            <span className="req" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      {children}
      {error ? (
        <span className="field__error" id={`${id}-error`}>
          {error}
        </span>
      ) : (
        hint && (
          <span className="field__hint" id={`${id}-hint`}>
            {hint}
          </span>
        )
      )}
    </div>
  );
}

function describedBy(id, error, hint) {
  if (error) return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
}

export function TextField({ label, required, hint, error, className, size, id: idProp, ...rest }) {
  const auto = useId();
  const id = idProp || auto;
  return (
    <FieldShell id={id} label={label} required={required} hint={hint} error={error} className={className}>
      <input
        id={id}
        className={`input${size === 'sm' ? ' input--sm' : ''}`}
        aria-invalid={error ? 'true' : undefined}
        aria-required={required || undefined}
        aria-describedby={describedBy(id, error, hint)}
        {...rest}
      />
    </FieldShell>
  );
}

export function TextAreaField({ label, required, hint, error, className, id: idProp, ...rest }) {
  const auto = useId();
  const id = idProp || auto;
  return (
    <FieldShell id={id} label={label} required={required} hint={hint} error={error} className={className}>
      <textarea
        id={id}
        className="textarea"
        aria-invalid={error ? 'true' : undefined}
        aria-required={required || undefined}
        aria-describedby={describedBy(id, error, hint)}
        {...rest}
      />
    </FieldShell>
  );
}

export function SelectField({ label, required, hint, error, className, options, placeholder, size, id: idProp, ...rest }) {
  const auto = useId();
  const id = idProp || auto;
  return (
    <FieldShell id={id} label={label} required={required} hint={hint} error={error} className={className}>
      <select
        id={id}
        className={`select${size === 'sm' ? ' select--sm' : ''}`}
        aria-invalid={error ? 'true' : undefined}
        aria-required={required || undefined}
        aria-describedby={describedBy(id, error, hint)}
        {...rest}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

export function SearchInput({ label = 'Search', value, onChange, placeholder = 'Search…', className = '' }) {
  const id = useId();
  return (
    <div className={`search-input ${className}`}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Search size={15} aria-hidden="true" />
      <input id={id} type="search" className="input input--sm" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
