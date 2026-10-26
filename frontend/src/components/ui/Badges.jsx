import { CheckCircle2, CircleDashed, XCircle, HelpCircle, MinusCircle } from 'lucide-react';
import { categoryName } from '../../data/categories';

export function Badge({ tone = 'neutral', icon: Icon, children, title }) {
  return (
    <span className={`badge badge--${tone}`} title={title}>
      {Icon && <Icon size={12} aria-hidden="true" />}
      {children}
    </span>
  );
}

export function CategoryBadge({ code, showName = false }) {
  return (
    <span className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
      <span className={`cat-code${code === 'OTHER' ? ' cat-code--other' : ''}`} title={categoryName(code)}>
        {code}
        <span className="sr-only"> — {categoryName(code)}</span>
      </span>
      {showName && <span className="small muted">{categoryName(code)}</span>}
    </span>
  );
}

// Extraction confidence: bars + text so it never relies on colour alone.
export function ConfidenceBadge({ value }) {
  if (!value) return <span className="conf">—</span>;
  return (
    <span className={`conf conf--${value}`} title={`Extraction confidence: ${value}`}>
      <span className="conf__bars" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span>
        <span className="sr-only">Extraction confidence: </span>
        {value}
      </span>
    </span>
  );
}

const STATUS_META = {
  matched: { label: 'Matched', icon: CheckCircle2 },
  partial: { label: 'Partial', icon: CircleDashed },
  missing: { label: 'Missing', icon: XCircle },
  meets: { label: 'Meets', icon: CheckCircle2 },
  close: { label: 'Close', icon: CircleDashed },
  gap: { label: 'Gap', icon: XCircle },
  'no-evidence': { label: 'No evidence', icon: XCircle },
  'not-assessed': { label: 'Not in file', icon: HelpCircle },
  'not-required': { label: 'Not required', icon: MinusCircle },
  unknown: { label: 'Unknown', icon: HelpCircle },
};

export function StatusPill({ status }) {
  const meta = STATUS_META[status] || STATUS_META.unknown;
  const Icon = meta.icon;
  return (
    <span className={`status status--${STATUS_META[status] ? status : 'unknown'}`}>
      <Icon size={13} aria-hidden="true" />
      {meta.label}
    </span>
  );
}

export function DemoBadge({ children = 'Demo' }) {
  return <span className="badge badge--demo">{children}</span>;
}
