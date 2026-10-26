import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, Plus } from 'lucide-react';
import { Card, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { SearchInput } from '../ui/Fields';
import { LoadingState, ErrorState, EmptyState } from '../ui/States';
import { initials, formatRelative, pluralize } from '../../utils/format';

export function ProfileSelector({ profiles, activeId, onNew, onRetry }) {
  const [q, setQ] = useState('');
  const items = profiles.items.filter((p) => !q || `${p.name} ${p.email}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <Card>
      <CardHeader
        icon={Users}
        title="Candidate profiles"
        subtitle={profiles.loading ? undefined : pluralize(profiles.items.length, 'saved profile')}
        actions={
          <Button size="sm" icon={Plus} onClick={onNew}>
            New
          </Button>
        }
      />
      {profiles.items.length > 4 && (
        <div style={{ padding: '12px 20px 0' }}>
          <SearchInput label="Filter profiles" value={q} onChange={setQ} placeholder="Filter by name or email" />
        </div>
      )}
      <div className="profile-list">
        {profiles.loading ? (
          <LoadingState label="Loading profiles…" />
        ) : profiles.error ? (
          <div style={{ padding: 16 }}>
            <ErrorState error={profiles.error} title="Could not load profiles" onRetry={onRetry} />
          </div>
        ) : items.length === 0 ? (
          <EmptyState compact icon={Users} title={q ? 'No matching profiles' : 'No saved profiles'} description={q ? undefined : 'Save a profile to make it available to Talent Check and Skill Matching.'} />
        ) : (
          <ul>
            {items.map((p) => (
              <li key={p.profile_id}>
                <Link
                  to={`/profile-builder/${p.profile_id}`}
                  className={`list-item${p.profile_id === activeId ? ' list-item--active' : ''}`}
                  aria-current={p.profile_id === activeId ? 'true' : undefined}
                >
                  <span className="avatar" aria-hidden="true">
                    {initials(p.name)}
                  </span>
                  <div className="list-item__main">
                    <p className="list-item__title">{p.name}</p>
                    <p className="list-item__meta">
                      {pluralize((p.skills || []).length, 'skill')} · updated {formatRelative(p.updated_at)}
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
