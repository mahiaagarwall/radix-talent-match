import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

export function Button({
  variant = 'secondary',
  size,
  to,
  icon: Icon,
  iconRight: IconRight,
  loading = false,
  block = false,
  className = '',
  children,
  type = 'button',
  disabled,
  ...rest
}) {
  const cls = ['btn', `btn--${variant}`, size === 'sm' && 'btn--sm', block && 'btn--block', className]
    .filter(Boolean)
    .join(' ');
  const iconSize = size === 'sm' ? 15 : 16;
  const content = (
    <>
      {loading ? <Loader2 size={iconSize} className="spin" aria-hidden="true" /> : Icon && <Icon size={iconSize} aria-hidden="true" />}
      {children}
      {IconRight && <IconRight size={iconSize} aria-hidden="true" />}
    </>
  );
  if (to && !disabled) {
    return (
      <Link to={to} className={cls} {...rest}>
        {content}
      </Link>
    );
  }
  return (
    <button type={type} className={cls} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {content}
    </button>
  );
}

export function IconButton({ label, icon: Icon, size = 'md', danger = false, className = '', ...rest }) {
  return (
    <button
      type="button"
      className={['icon-btn', size === 'sm' && 'icon-btn--sm', danger && 'icon-btn--danger', className].filter(Boolean).join(' ')}
      aria-label={label}
      title={label}
      {...rest}
    >
      <Icon size={size === 'sm' ? 15 : 18} aria-hidden="true" />
    </button>
  );
}
