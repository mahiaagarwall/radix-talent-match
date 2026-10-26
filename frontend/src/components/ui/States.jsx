import { Loader2, Inbox, RefreshCw } from 'lucide-react';
import { Alert } from './Alert';
import { Button } from './Button';
import { toUserMessage } from '../../services/apiClient';

export function EmptyState({ icon: Icon = Inbox, title, description, actions, compact = false }) {
  return (
    <div className={`empty${compact ? ' empty--compact' : ''}`}>
      <div className="empty__icon" aria-hidden="true">
        <Icon size={22} />
      </div>
      <p className="empty__title">{title}</p>
      {description && <p className="empty__desc">{description}</p>}
      {actions && <div className="empty__actions">{actions}</div>}
    </div>
  );
}

export function LoadingState({ label = 'Loading…' }) {
  return (
    <div className="loading" role="status" aria-live="polite">
      <Loader2 size={18} className="spin" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function ErrorState({ error, title = 'Something went wrong', onRetry }) {
  return (
    <Alert
      tone="error"
      title={title}
      actions={
        onRetry && (
          <Button size="sm" icon={RefreshCw} onClick={onRetry}>
            Try again
          </Button>
        )
      }
    >
      {toUserMessage(error)}
    </Alert>
  );
}
