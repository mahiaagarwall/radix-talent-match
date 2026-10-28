import { useMemo, useState } from 'react';
import { Table2 } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../ui/Card';
import { Badge, CategoryBadge, StatusPill, ConfidenceBadge } from '../ui/Badges';
import { Segmented } from '../ui/Segmented';
import { SearchInput } from '../ui/Fields';
import { EmptyState } from '../ui/States';
import { ALL_CATEGORIES } from '../../data/categories';

const fmt = (n) => (n === null || n === undefined ? '—' : Number.isInteger(n) ? String(n) : Number(n).toFixed(2));

export function MatchTable({ skillResults }) {
  const [status, setStatus] = useState('all');
  const [category, setCategory] = useState('');
  const [q, setQ] = useState('');

  const counts = useMemo(
    () => ({
      all: skillResults.length,
      matched: skillResults.filter((r) => r.status === 'matched').length,
      partial: skillResults.filter((r) => r.status === 'partial').length,
      missing: skillResults.filter((r) => r.status === 'missing').length,
    }),
    [skillResults],
  );

  const presentCategories = ALL_CATEGORIES.filter((c) => skillResults.some((r) => r.category_code === c.code));

  const rows = skillResults.filter((r) => {
    if (status !== 'all' && r.status !== status) return false;
    if (category && r.category_code !== category) return false;
    if (q) {
      const hay = `${r.skill_name} ${r.reason} ${r.jd_evidence} ${r.candidate_evidence.map((e) => `${e.skill_name} ${e.evidence}`).join(' ')}`.toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  });

  return (
    <Card>
      <CardHeader icon={Table2} title="Detailed match table" subtitle="Every JD requirement, how it was classified, and why." />
      <div className="table-toolbar">
        <Segmented
          label="Filter by classification"
          value={status}
          onChange={setStatus}
          options={[
            { value: 'all', label: 'All', count: counts.all },
            { value: 'matched', label: 'Matched', count: counts.matched },
            { value: 'partial', label: 'Partial', count: counts.partial },
            { value: 'missing', label: 'Missing', count: counts.missing },
          ]}
        />
        <div className="row">
          <label className="sr-only" htmlFor="match-cat-filter">
            Filter by category
          </label>
          <select id="match-cat-filter" className="select select--sm" style={{ width: 170 }} value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All categories</option>
            {presentCategories.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} — {c.name}
              </option>
            ))}
          </select>
          <SearchInput label="Search skills and evidence" value={q} onChange={setQ} placeholder="Search skills, evidence" />
        </div>
      </div>
      <CardBody flush>
        {rows.length === 0 ? (
          <EmptyState compact title="No requirements match these filters" />
        ) : (
          <div className="table-wrap">
            <table className="table table--min-900">
              <caption className="sr-only">Skill match classification for each job requirement</caption>
              <thead>
                <tr>
                  <th scope="col">JD requirement</th>
                  <th scope="col">Category</th>
                  <th scope="col">Status</th>
                  <th scope="col">Candidate evidence</th>
                  <th scope="col">JD evidence</th>
                  <th scope="col">Explanation</th>
                  <th scope="col" className="num">
                    Weight × value
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={`${r.skill_name}-${i}`}>
                    <td>
                      <p className="strong">{r.skill_name}</p>
                      <div style={{ marginTop: 4 }}>
                        {r.requirement === 'preferred' ? <Badge tone="outline">Preferred</Badge> : <Badge tone="indigo">Required</Badge>}
                      </div>
                    </td>
                    <td>
                      <CategoryBadge code={r.category_code} />
                    </td>
                    <td>
                      <StatusPill status={r.status} />
                    </td>
                    <td style={{ minWidth: 200, maxWidth: 280 }}>
                      {(r.candidate_evidence || []).length === 0 ? (
                        <span className="muted">No evidence found</span>
                      ) : (
                        <ul className="stack" style={{ gap: 6 }}>
                          {(r.candidate_evidence || []).slice(0, 3).map((e, j) => (
                            <li key={j}>
                              <p className="small">
                                <span className="strong">{e.skill_name}</span> <ConfidenceBadge value={e.confidence} />
                              </p>
                              {e.evidence && <p className="xsmall muted">{e.evidence}</p>}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="muted xsmall" style={{ minWidth: 180, maxWidth: 260 }}>
                      “{r.jd_evidence}”
                    </td>
                    <td className="small" style={{ minWidth: 200, maxWidth: 280 }}>
                      {r.reason}
                    </td>
                    <td className="num small">
                      {fmt(r.weight)} × {fmt(r.match_value)}
                      <p className="xsmall muted">= {fmt(r.weight * r.match_value)}</p>
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
