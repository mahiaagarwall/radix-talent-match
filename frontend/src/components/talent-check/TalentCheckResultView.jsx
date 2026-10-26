import { Link } from 'react-router-dom';
import { Radar as RadarIcon, TrendingUp, AlertTriangle, Lightbulb } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../ui/Card';
import { Badge, DemoBadge } from '../ui/Badges';
import { Alert } from '../ui/Alert';
import { ScoreRing, scoreBand } from '../ui/ScoreRing';
import { ReadinessRadar } from './ReadinessRadar';
import { CategoryMatrix } from './CategoryMatrix';
import { categoryName } from '../../data/categories';
import { formatDate } from '../../utils/format';

export function TalentCheckResultView({ result }) {
  const rows = result.skillset_gap || [];
  const band = scoreBand(result.readiness_score);
  const isDemo = result.mode === 'demo' || String(result.scoring?.method || '').startsWith('demo');
  const byCode = Object.fromEntries(rows.map((r) => [r.category_code, r]));

  return (
    <div className="stack">
      {result.requirements_source?.synthetic && (
        <Alert tone="warning" title="Synthetic requirements">
          This result was computed against a synthetic format-reference file, not official company data. Do not present it as a real readiness assessment.
        </Alert>
      )}
      <Card>
        <CardBody>
          <div className="result-hero">
            <ScoreRing score={result.readiness_score} label="Company readiness score" />
            <div className="result-hero__body">
              <div className="row">
                <Badge tone={band.tone}>{band.label} readiness</Badge>
                <Badge tone="outline">Talent Check · company-level</Badge>
                {isDemo && <DemoBadge>Illustrative demo scoring</DemoBadge>}
              </div>
              <h2 className="result-hero__title">
                <Link to={`/profile-builder/${result.profile_id}`}>{result.candidate_name}</Link>
                <span className="muted"> against </span>
                {result.company}
              </h2>
              <p className="result-hero__summary">{result.summary}</p>
              <p className="xsmall muted">
                Requirements: {result.requirements_source?.file || 'backend'} · Formula: <span className="mono">{result.scoring?.formula}</span> · Run{' '}
                {formatDate(result.created_at, { withTime: true })} · Result ID <span className="mono">{result.result_id}</span>
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="grid grid--2">
        <Card>
          <CardHeader icon={RadarIcon} title="Breakdown across skillsets" subtitle="Required vs. estimated level (0–10 scale)" />
          <CardBody>
            <ReadinessRadar rows={rows} />
          </CardBody>
        </Card>
        <div className="stack">
          <Card>
            <CardHeader icon={TrendingUp} title="Strongest areas" />
            <CardBody>
              {result.strongest?.length ? (
                <ul className="stack stack--sm">
                  {result.strongest.map((code) => (
                    <li key={code} className="row row--between">
                      <span className="small">
                        <span className="cat-code">{code}</span> {categoryName(code)}
                      </span>
                      <span className="small muted">
                        est. {byCode[code]?.candidate_level} / req. {byCode[code]?.required_level}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="small muted">No assessed skillset has supporting evidence yet.</p>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader icon={AlertTriangle} title="Priority gaps" />
            <CardBody>
              {result.priority_gaps?.length ? (
                <ul className="stack stack--sm">
                  {result.priority_gaps.map((code) => (
                    <li key={code} className="row row--between">
                      <span className="small">
                        <span className="cat-code">{code}</span> {categoryName(code)}
                      </span>
                      <Badge tone="error">gap {byCode[code]?.gap_size}</Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="small muted">The estimated levels meet every assessed requirement.</p>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      {result.recommendations?.length > 0 && (
        <Card>
          <CardHeader icon={Lightbulb} title="Recommendations" subtitle="Linked to the priority gaps above" />
          <CardBody>
            <ol className="rec-list">
              {result.recommendations.map((r) => (
                <li key={r.category_code}>
                  <span className="cat-code">{r.category_code}</span>
                  <span className="small">{r.text}</span>
                </li>
              ))}
            </ol>
          </CardBody>
        </Card>
      )}

      <CategoryMatrix rows={rows} />
    </div>
  );
}
