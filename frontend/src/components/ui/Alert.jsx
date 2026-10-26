import { Info, AlertTriangle, XCircle, CheckCircle2, FlaskConical } from 'lucide-react';

const ICONS = { info: Info, warning: AlertTriangle, error: XCircle, success: CheckCircle2, demo: FlaskConical };

export function Alert({ tone = 'info', title, children, actions, className = '' }) {
  const Icon = ICONS[tone] || Info;
  return (
    <div className={`alert alert--${tone} ${className}`} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon size={17} aria-hidden="true" />
      <div className="alert__body">
        {title && <p className="alert__title">{title}</p>}
        {children && <div>{children}</div>}
        {actions && <div className="alert__actions">{actions}</div>}
      </div>
    </div>
  );
}
