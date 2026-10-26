import { Link } from 'react-router-dom';
import { UserRound, BriefcaseBusiness, Gauge, GitCompareArrows } from 'lucide-react';
import { formatRelative } from '../../utils/format';

// Activity is derived from record timestamps in the current data store.
export function buildActivity({ profiles, jds, results }) {
  const events = [
    ...profiles.map((p) => ({
      key: `p-${p.profile_id}`,
      at: p.updated_at || p.created_at,
      icon: UserRound,
      text: `${p.created_at === p.updated_at ? 'Profile created' : 'Profile updated'}: ${p.name}`,
      to: `/profile-builder/${p.profile_id}`,
    })),
    ...jds.map((j) => ({
      key: `j-${j.jd_id}`,
      at: j.updated_at || j.created_at,
      icon: BriefcaseBusiness,
      text: `Job description saved: ${j.role}, ${j.company}`,
      to: `/jd-analytics/${j.jd_id}`,
    })),
    ...results.map((r) => ({
      key: `r-${r.result_id}`,
      at: r.created_at,
      icon: r.type === 'talent_check' ? Gauge : GitCompareArrows,
      text:
        r.type === 'talent_check'
          ? `Talent Check: ${r.candidate_name} vs ${r.company} — ${r.readiness_score}/100`
          : `Skill Match: ${r.candidate_name} vs ${r.role} — ${r.match_score}/100`,
      to: `/results/${r.result_id}`,
    })),
  ];
  return events.filter((e) => e.at).sort((a, b) => String(b.at).localeCompare(String(a.at)));
}

export function ActivityFeed({ events, limit = 8 }) {
  if (!events.length) return <p className="small muted" style={{ padding: 20 }}>No activity yet.</p>;
  return (
    <ul className="activity">
      {events.slice(0, limit).map((e) => {
        const Icon = e.icon;
        return (
          <li key={e.key}>
            <Link to={e.to} className="activity__item">
              <span className="activity__icon" aria-hidden="true">
                <Icon size={14} />
              </span>
              <span className="activity__text small">{e.text}</span>
              <time className="xsmall muted" dateTime={e.at}>
                {formatRelative(e.at)}
              </time>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
