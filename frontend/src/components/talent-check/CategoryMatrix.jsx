import { Grid3x3 } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../ui/Card';
import { StatusPill, ConfidenceBadge } from '../ui/Badges';
import { categoryName } from '../../data/categories';

function LevelBar({ required, estimated }) {
  if (required === null) return <span className="muted small">—</span>;
  const tone = estimated >= required ? 'teal' : required - estimated <= 2 ? 'warning' : 'error';
  return (
    <div className="level-bar" aria-hidden="true">
      <div className={`level-bar__fill level-bar__fill--${tone}`} style={{ width: `${(Math.min(estimated, 10) / 10) * 100}%` }} />
      <div className="level-bar__marker" style={{ left: `${(required / 10) * 100}%` }} />
    </div>
  );
}

const UNCERTAINTY_LABEL = { low: 'Low', medium: 'Medium', high: 'High' };

export function CategoryMatrix({ rows }) {
  return (
    <Card>
      <CardHeader
        icon={Grid3x3}
        title="12-skillset assessment matrix"
        subtitle="Required levels come from the company file. Candidate levels are estimates from resume evidence (0–9; 0 = no evidence)."
      />
      <CardBody flush>
        <div className="table-wrap">
          <table className="table table--min-900">
            <caption className="sr-only">Required level, estimated level, gap and evidence for each RADIX skillset</caption>
            <thead>
              <tr>
                <th scope="col">Skillset</th>
                <th scope="col" className="num">
                  Required
                </th>
                <th scope="col" className="num">
                  Estimated
                </th>
                <th scope="col">Level vs. requirement</th>
                <th scope="col" className="num">
                  Gap
                </th>
                <th scope="col">Status</th>
                <th scope="col">Uncertainty</th>
                <th scope="col">Supporting evidence</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.category_code}>
                  <td>
                    <span className="cat-code">{r.category_code}</span>
                    <p className="xsmall muted" style={{ marginTop: 4 }}>
                      {categoryName(r.category_code)}
                    </p>
                  </td>
                  <td className="num strong">{r.required_level ?? '—'}</td>
                  <td className="num">
                    {r.candidate_level}
                    <span className="xsmall muted"> est.</span>
                  </td>
                  <td style={{ minWidth: 130 }}>
                    <LevelBar required={r.required_level} estimated={r.candidate_level} />
                  </td>
                  <td className="num">{r.gap_size === null ? '—' : r.gap_size === 0 ? '0' : `−${r.gap_size}`}</td>
                  <td>
                    <StatusPill status={r.status} />
                  </td>
                  <td className="small">{UNCERTAINTY_LABEL[r.uncertainty]}</td>
                  <td style={{ minWidth: 220, maxWidth: 320 }}>
                    {r.evidence.length === 0 ? (
                      <span className="small muted">No evidence in the profile</span>
                    ) : (
                      <ul className="stack" style={{ gap: 4 }}>
                        {r.evidence.slice(0, 3).map((e, i) => (
                          <li key={i} className="xsmall">
                            <span className="strong">{e.skill_name}</span> <ConfidenceBadge value={e.confidence} />
                            {e.evidence && <span className="muted"> — {e.evidence}</span>}
                          </li>
                        ))}
                        {r.evidence.length > 3 && <li className="xsmall muted">+{r.evidence.length - 3} more</li>}
                      </ul>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardBody>
    </Card>
  );
}
