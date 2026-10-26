import { useState } from 'react';
import { ListChecks } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../ui/Card';
import { Badge, CategoryBadge, ConfidenceBadge } from '../ui/Badges';
import { Segmented } from '../ui/Segmented';
import { SearchInput } from '../ui/Fields';
import { EmptyState } from '../ui/States';

export function JdRequirementsView({ jd }) {
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const skills = jd.skills || [];
  const required = skills.filter((s) => s.requirement !== 'preferred');
  const preferred = skills.filter((s) => s.requirement === 'preferred');
  const shown = skills
    .filter((s) => filter === 'all' || (filter === 'preferred' ? s.requirement === 'preferred' : s.requirement !== 'preferred'))
    .filter((s) => !q || `${s.skill_name} ${s.category_code} ${s.evidence}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <Card>
      <CardHeader
        icon={ListChecks}
        title="Structured requirements"
        subtitle={`${required.length} required · ${preferred.length} preferred · ${new Set(skills.map((s) => s.category_code)).size} categories`}
        actions={
          <>
            <Segmented
              label="Filter by requirement type"
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: 'All', count: skills.length },
                { value: 'required', label: 'Required', count: required.length },
                { value: 'preferred', label: 'Preferred', count: preferred.length },
              ]}
            />
            <SearchInput label="Search requirements" value={q} onChange={setQ} placeholder="Search skills" />
          </>
        }
      />
      <CardBody flush>
        {shown.length === 0 ? (
          <EmptyState compact title="No requirements match the current filter" />
        ) : (
          <div className="table-wrap">
            <table className="table table--min-720">
              <caption className="sr-only">Skills required by {jd.role}</caption>
              <thead>
                <tr>
                  <th scope="col">Skill</th>
                  <th scope="col">Category</th>
                  <th scope="col">Type</th>
                  <th scope="col">Evidence from the JD</th>
                  <th scope="col">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((s, i) => (
                  <tr key={`${s.skill_name}-${i}`}>
                    <td className="strong">{s.skill_name}</td>
                    <td>
                      <CategoryBadge code={s.category_code} />
                    </td>
                    <td>{s.requirement === 'preferred' ? <Badge tone="outline">Preferred</Badge> : <Badge tone="indigo">Required</Badge>}</td>
                    <td className="muted" style={{ maxWidth: 480 }}>
                      “{s.evidence}”
                    </td>
                    <td>
                      <ConfidenceBadge value={s.confidence} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
