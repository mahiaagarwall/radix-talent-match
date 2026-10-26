import { Link } from 'react-router-dom';
import { Lightbulb, BarChart3, Sigma, CheckCircle2, CircleDashed, XCircle } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../ui/Card';
import { Badge, DemoBadge } from '../ui/Badges';
import { ScoreRing, scoreBand } from '../ui/ScoreRing';
import { CategoryBreakdownChart } from './CategoryBreakdownChart';
import { MatchTable } from './MatchTable';
import { formatDate } from '../../utils/format';

function CountTile({ icon: Icon, label, value, tone }) {
  return (
    <div className={`count-tile count-tile--${tone}`}>
      <Icon size={16} aria-hidden="true" />
      <span className="count-tile__value">{value}</span>
      <span className="count-tile__label">{label}</span>
    </div>
  );
}

export function MatchResultView({ result }) {
  const results = result.skill_results || [];
  const required = results.filter((r) => r.requirement !== 'preferred');
  const supportedRequired = required.filter((r) => r.status === 'matched').length;
  const partialRequired = required.filter((r) => r.status === 'partial').length;
  const band = scoreBand(result.match_score);
  const isDemo = result.mode === 'demo' || String(result.scoring?.method || '').startsWith('demo');

  return (
    <div className="stack">
      <Card>
        <CardBody>
          <div className="result-hero">
            <ScoreRing score={result.match_score} label="Job match score" />
            <div className="result-hero__body">
              <div className="row">
                <Badge tone={band.tone}>{band.label} match</Badge>
                <Badge tone="outline">Skill Matching · job-specific</Badge>
                {isDemo && <DemoBadge>Illustrative demo scoring</DemoBadge>}
              </div>
              <h2 className="result-hero__title">
                <Link to={`/profile-builder/${result.profile_id}`}>{result.candidate_name}</Link>
                <span className="muted"> for </span>
                <Link to={`/jd-analytics/${result.jd_id}`}>
                  {result.role} · {result.company}
                </Link>
              </h2>
              <p className="result-hero__summary">{result.summary}</p>
              <div className="count-tiles">
                <CountTile icon={CheckCircle2} label="Matched" value={result.counts?.matched ?? result.matched_skills.length} tone="matched" />
                <CountTile icon={CircleDashed} label="Partial" value={result.counts?.partial ?? result.partial_skills.length} tone="partial" />
                <CountTile icon={XCircle} label="Missing" value={result.counts?.missing ?? result.missing_skills.length} tone="missing" />
              </div>
              <p className="xsmall muted">
                Required skills supported: {supportedRequired} of {required.length}
                {partialRequired ? ` (+${partialRequired} partial)` : ''} · Run {formatDate(result.created_at, { withTime: true })} · Result ID{' '}
                <span className="mono">{result.result_id}</span>
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="grid grid--2">
        <Card>
          <CardHeader icon={BarChart3} title="Category breakdown" subtitle="JD requirements per RADIX category, by classification" />
          <CardBody>
            <CategoryBreakdownChart skillResults={results} />
          </CardBody>
        </Card>
        <div className="stack">
          <Card>
            <CardHeader icon={Lightbulb} title="Recommended next steps" subtitle="Generated from the actual gaps below" />
            <CardBody>
              {result.recommendations?.length ? (
                <ol className="rec-list">
                  {result.recommendations.map((r, i) => (
                    <li key={i}>
                      <Badge tone={r.priority === 'high' ? 'error' : 'warning'}>{r.priority === 'high' ? 'High' : 'Medium'}</Badge>
                      <span className="small">{r.text}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="small muted">No gaps found — every requirement has supporting evidence.</p>
              )}
            </CardBody>
          </Card>
          {result.scoring && (
            <Card>
              <CardHeader icon={Sigma} title="How this score was calculated" />
              <CardBody>
                <p className="mono small">{result.scoring.formula}</p>
                <dl className="kv" style={{ marginTop: 12 }}>
                  <dt>Match values</dt>
                  <dd>Matched 1 · Partial {result.scoring.partial_value} · Missing 0</dd>
                  <dt>Weights</dt>
                  <dd>
                    Required {result.scoring.weights?.required} · Preferred {result.scoring.weights?.preferred}
                  </dd>
                  <dt>Method</dt>
                  <dd>
                    <span className="mono">{result.scoring.method}</span>
                    {result.scoring.status ? ` (${result.scoring.status})` : ''}
                  </dd>
                </dl>
              </CardBody>
            </Card>
          )}
        </div>
      </div>

      <MatchTable skillResults={results} />
    </div>
  );
}
