import { Card } from './Card';

export function StatCard({ icon: Icon, label, value, meta, tone = 'indigo' }) {
  return (
    <Card as="div" className="stat">
      <div className={`stat__icon${tone === 'teal' ? ' stat__icon--teal' : ''}`} aria-hidden="true">
        <Icon size={20} />
      </div>
      <div style={{ minWidth: 0 }}>
        <p className="stat__label">{label}</p>
        <p className="stat__value">{value}</p>
        {meta && <p className="stat__meta">{meta}</p>}
      </div>
    </Card>
  );
}
