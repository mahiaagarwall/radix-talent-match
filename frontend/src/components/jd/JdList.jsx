import { Link } from 'react-router-dom';
import { BriefcaseBusiness } from 'lucide-react';
import { Card, CardHeader } from '../ui/Card';
import { LoadingState, ErrorState, EmptyState } from '../ui/States';
import { pluralize, formatRelative } from '../../utils/format';

export function JdList({ jds, activeId, onRetry }) {
  return (
    <Card>
      <CardHeader icon={BriefcaseBusiness} title="Saved job descriptions" subtitle={jds.loading ? undefined : pluralize(jds.items.length, 'record')} />
      <div className="profile-list">
        {jds.loading ? (
          <LoadingState label="Loading job descriptions…" />
        ) : jds.error ? (
          <div style={{ padding: 16 }}>
            <ErrorState error={jds.error} title="Could not load job descriptions" onRetry={onRetry} />
          </div>
        ) : jds.items.length === 0 ? (
          <EmptyState compact icon={BriefcaseBusiness} title="No saved JDs" description="Analyze and save a job description to use it in Skill Matching." />
        ) : (
          <ul>
            {jds.items.map((j) => (
              <li key={j.jd_id}>
                <Link
                  to={`/jd-analytics/${j.jd_id}`}
                  className={`list-item${j.jd_id === activeId ? ' list-item--active' : ''}`}
                  aria-current={j.jd_id === activeId ? 'true' : undefined}
                >
                  <div className="list-item__main">
                    <p className="list-item__title">{j.role}</p>
                    <p className="list-item__meta">
                      {j.company} · {pluralize((j.skills || []).length, 'skill')} · {formatRelative(j.updated_at)}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
