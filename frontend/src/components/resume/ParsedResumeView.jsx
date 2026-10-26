import { GraduationCap, FolderGit2, Briefcase, Trophy, BadgeCheck, Star, Target } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../ui/Card';
import { CategoryBadge, ConfidenceBadge } from '../ui/Badges';
import { initials } from '../../utils/format';

function Section({ icon, title, items, render, empty = 'Not found in this document.' }) {
  return (
    <Card>
      <CardHeader icon={icon} title={title} subtitle={items.length ? `${items.length} found` : undefined} />
      <CardBody>
        {items.length ? <ul className="stack stack--sm">{items.map(render)}</ul> : <p className="small muted">{empty}</p>}
      </CardBody>
    </Card>
  );
}

export function SkillEvidenceTable({ skills, caption = 'Extracted skills with evidence and confidence' }) {
  if (!skills.length) return <p className="small muted" style={{ padding: 20 }}>No skills were extracted.</p>;
  return (
    <div className="table-wrap">
      <table className="table table--min-720">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Skill</th>
            <th scope="col">Category</th>
            <th scope="col">Evidence</th>
            <th scope="col">Extraction confidence</th>
          </tr>
        </thead>
        <tbody>
          {skills.map((s, i) => (
            <tr key={`${s.skill_name}-${i}`}>
              <td className="strong">{s.skill_name}</td>
              <td>
                <CategoryBadge code={s.category_code} />
              </td>
              <td className="muted" style={{ maxWidth: 460 }}>
                {s.evidence || '—'}
              </td>
              <td>
                <ConfidenceBadge value={s.confidence} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ParsedResumeView({ parsed }) {
  return (
    <div className="stack">
      <Card>
        <CardBody>
          <div className="row" style={{ gap: 16, flexWrap: 'nowrap', alignItems: 'flex-start' }}>
            <span className="avatar avatar--lg" aria-hidden="true">
              {initials(parsed.name)}
            </span>
            <div style={{ minWidth: 0 }}>
              <h2 style={{ fontSize: 'var(--fs-lg)' }}>{parsed.name || 'Name not found'}</h2>
              <p className="small muted">{parsed.email || 'No email address found in this resume'}</p>
              {parsed.headline && <p className="small" style={{ marginTop: 6 }}>{parsed.headline}</p>}
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          icon={Star}
          title="Skills"
          subtitle="Confidence describes how strongly the resume evidences each skill — it is not a proficiency rating."
        />
        <CardBody flush>
          <SkillEvidenceTable skills={parsed.skills} />
        </CardBody>
      </Card>

      <div className="grid grid--2">
        <Section
          icon={GraduationCap}
          title="Education"
          items={parsed.education}
          render={(e, i) => (
            <li key={i}>
              <p className="strong small">
                {[e.degree, e.field].filter(Boolean).join(', ')}
                {e.graduation_year ? ` · Class of ${e.graduation_year}` : ''}
              </p>
              <p className="xsmall muted">{[e.institution, e.grade].filter(Boolean).join(' · ') || 'Institution not stated'}</p>
            </li>
          )}
        />
        <Section
          icon={Target}
          title="Preferred roles"
          items={parsed.preferred_roles}
          render={(r) => (
            <li key={r} className="small">
              {r}
            </li>
          )}
        />
        <Section
          icon={FolderGit2}
          title="Projects"
          items={parsed.projects}
          render={(p, i) => (
            <li key={i}>
              <p className="strong small">{p.title}</p>
              <p className="xsmall muted">{p.description}</p>
            </li>
          )}
        />
        <Section
          icon={Briefcase}
          title="Internships & experience"
          items={parsed.internships}
          render={(x, i) => (
            <li key={i}>
              <p className="strong small">
                {x.role}
                {x.organization ? ` · ${x.organization}` : ''}
              </p>
              <p className="xsmall muted">{x.description}</p>
            </li>
          )}
        />
        <Section
          icon={Trophy}
          title="Hackathons"
          items={parsed.hackathons}
          render={(h, i) => (
            <li key={i}>
              <p className="strong small">
                {h.name}
                {h.result ? ` — ${h.result}` : ''}
              </p>
              {h.description && <p className="xsmall muted">{h.description}</p>}
            </li>
          )}
        />
        <Section
          icon={BadgeCheck}
          title="Certifications"
          items={parsed.certifications}
          empty="None listed in this document."
          render={(c, i) => (
            <li key={i} className="small">
              {c.name}
              {c.issuer ? <span className="muted"> · {c.issuer}</span> : null}
            </li>
          )}
        />
      </div>
      {parsed.achievements?.length > 0 && (
        <Section
          icon={Trophy}
          title="Achievements"
          items={parsed.achievements}
          render={(a, i) => (
            <li key={i} className="small">
              {a}
            </li>
          )}
        />
      )}
    </div>
  );
}
