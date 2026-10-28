import { Link } from 'react-router-dom';
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronRight } from 'lucide-react';
import { Badge, DemoBadge } from '../ui/Badges';
import { scoreBand } from '../ui/ScoreRing';
import { formatDate } from '../../utils/format';

export const scoreOf = (r) => (r.type === 'talent_check' ? r.readiness_score : r.match_score);

function SortHeader({ label, field, sort, onSort, className }) {
  const active = sort.field === field;
  const Icon = !active ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th scope="col" className={className} aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className="th-sort" onClick={() => onSort(field)}>
        {label}
        <Icon size={12} aria-hidden="true" />
      </button>
    </th>
  );
}

export function ScoreCell({ result }) {
  const score = scoreOf(result);
  const band = scoreBand(score);
  return (
    <div className="score-cell">
      <span className="strong">{score}</span>
      <div className="progress" style={{ width: 64 }} aria-hidden="true">
        <div className={`progress__bar progress__bar--${band.tone === 'teal' ? 'teal' : band.tone}`} style={{ width: `${score}%` }} />
      </div>
      <span className="xsmall muted">{result.type === 'talent_check' ? 'readiness' : 'job match'}</span>
    </div>
  );
}

export function ResultsTable({ rows, sort, onSort }) {
  return (
    <div className="table-wrap">
      <table className="table table--min-900">
        <caption className="sr-only">Assessment results</caption>
        <thead>
          <tr>
            <th scope="col">Assessment</th>
            <SortHeader label="Candidate" field="candidate" sort={sort} onSort={onSort} />
            <th scope="col">Company / job</th>
            <SortHeader label="Score" field="score" sort={sort} onSort={onSort} />
            <SortHeader label="Date" field="date" sort={sort} onSort={onSort} />
            <th scope="col">Status</th>
            <th scope="col">
              <span className="sr-only">Details</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => (
            <tr key={r.result_id || r.match_id || `res-${idx}`}>
              <td>
                {r.type === 'talent_check' ? <Badge tone="indigo">Talent Check</Badge> : <Badge tone="teal">Skill Match</Badge>}
              </td>
              <td>
                <p className="strong">{r.candidate_name}</p>
                <p className="xsmall muted mono">{r.profile_id}</p>
              </td>
              <td>
                <p>{r.company}</p>
                <p className="xsmall muted">{r.type === 'talent_check' ? 'Company-level readiness' : r.role}</p>
              </td>
              <td>
                <ScoreCell result={r} />
              </td>
              <td className="small">{formatDate(r.created_at, { withTime: true })}</td>
              <td>
                <div className="row" style={{ gap: 4 }}>
                  <Badge tone="success">{r.status || 'completed'}</Badge>
                  {r.mode === 'demo' && <DemoBadge />}
                </div>
              </td>
              <td>
                <Link to={`/results/${r.result_id || r.match_id}`} className="btn btn--secondary btn--sm" aria-label={`View details for ${r.candidate_name}, ${r.company}`}>
                  Details <ChevronRight size={14} aria-hidden="true" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
