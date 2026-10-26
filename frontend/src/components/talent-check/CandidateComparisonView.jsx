import { Users, Trophy, Award, TrendingUp, AlertTriangle, ArrowRight } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../ui/Card';
import { Badge } from '../ui/Badges';
import { ScoreRing, scoreBand } from '../ui/ScoreRing';
import { categoryName } from '../../data/categories';
import { formatDate } from '../../utils/format';

export function CandidateComparisonView({ comparison }) {
  if (!comparison) return null;

  const { candidate_a: candA, candidate_b: candB, company_name, category_comparisons, score_difference, leader, overall_explanation, created_at } = comparison;

  const bandA = scoreBand(candA.readiness_score);
  const bandB = scoreBand(candB.readiness_score);

  return (
    <div className="stack" style={{ gap: '20px' }}>
      {/* Hero Comparison Card */}
      <Card>
        <CardBody>
          <div className="row row--between" style={{ flexWrap: 'wrap', gap: '24px', alignItems: 'center' }}>
            {/* Candidate A Score */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <ScoreRing score={candA.readiness_score} label={`${candA.candidate_name}`} />
              <div>
                <Badge tone={bandA.tone}>{bandA.label} readiness</Badge>
                <h3 style={{ margin: '6px 0 2px 0', fontSize: '1.25rem' }}>{candA.candidate_name}</h3>
                <span className="small muted">Candidate A</span>
              </div>
            </div>

            {/* VS & Leader Badge */}
            <div style={{ textAlign: 'center', minWidth: '180px' }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-muted)' }}>
                Target: {company_name}
              </div>
              <div style={{ margin: '8px 0' }}>
                {leader === 'tie' ? (
                  <Badge tone="neutral">Identical readiness scores</Badge>
                ) : (
                  <Badge tone="success" style={{ padding: '6px 12px', fontSize: '0.85rem' }}>
                    <Trophy size={14} style={{ marginRight: 6, display: 'inline' }} />
                    {leader === 'candidate_a' ? candA.candidate_name : candB.candidate_name} (+{Math.abs(score_difference)} pts)
                  </Badge>
                )}
              </div>
              <span className="xsmall muted">12-category comparison</span>
            </div>

            {/* Candidate B Score */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexDirection: 'row-reverse' }}>
              <ScoreRing score={candB.readiness_score} label={`${candB.candidate_name}`} />
              <div style={{ textAlign: 'right' }}>
                <Badge tone={bandB.tone}>{bandB.label} readiness</Badge>
                <h3 style={{ margin: '6px 0 2px 0', fontSize: '1.25rem' }}>{candB.candidate_name}</h3>
                <span className="small muted">Candidate B</span>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '20px', padding: '16px', background: 'var(--color-bg-subtle, rgba(255,255,255,0.03))', borderRadius: '8px', borderLeft: '4px solid var(--color-primary, #6366f1)' }}>
            <p className="small" style={{ margin: 0, lineHeight: 1.6 }}>
              <strong>Assessment Analysis: </strong>
              {overall_explanation}
            </p>
          </div>
        </CardBody>
      </Card>

      {/* Side-by-side Strengths & Priority Gaps */}
      <div className="grid grid--2">
        {/* Candidate A Card */}
        <Card>
          <CardHeader icon={Award} title={`${candA.candidate_name} Profile Highlights`} subtitle={`Readiness: ${candA.readiness_score}/100`} />
          <CardBody>
            <div className="stack stack--sm">
              <div>
                <span className="xsmall uppercase muted" style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <TrendingUp size={13} style={{ color: 'var(--color-success)' }} /> Strongest Skillsets
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {candA.strongest?.length ? (
                    candA.strongest.map((c) => (
                      <Badge key={c} tone="success">
                        <span className="cat-code" style={{ marginRight: 4 }}>{c}</span> {categoryName(c)}
                      </Badge>
                    ))
                  ) : (
                    <span className="small muted">No strong evidence yet</span>
                  )}
                </div>
              </div>
              <div style={{ marginTop: 12 }}>
                <span className="xsmall uppercase muted" style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <AlertTriangle size={13} style={{ color: 'var(--color-error)' }} /> Priority Gaps for {company_name}
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {candA.priority_gaps?.length ? (
                    candA.priority_gaps.map((c) => (
                      <Badge key={c} tone="error">
                        <span className="cat-code" style={{ marginRight: 4 }}>{c}</span> {categoryName(c)}
                      </Badge>
                    ))
                  ) : (
                    <span className="small muted">Meets or exceeds all requirements</span>
                  )}
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Candidate B Card */}
        <Card>
          <CardHeader icon={Award} title={`${candB.candidate_name} Profile Highlights`} subtitle={`Readiness: ${candB.readiness_score}/100`} />
          <CardBody>
            <div className="stack stack--sm">
              <div>
                <span className="xsmall uppercase muted" style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <TrendingUp size={13} style={{ color: 'var(--color-success)' }} /> Strongest Skillsets
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {candB.strongest?.length ? (
                    candB.strongest.map((c) => (
                      <Badge key={c} tone="success">
                        <span className="cat-code" style={{ marginRight: 4 }}>{c}</span> {categoryName(c)}
                      </Badge>
                    ))
                  ) : (
                    <span className="small muted">No strong evidence yet</span>
                  )}
                </div>
              </div>
              <div style={{ marginTop: 12 }}>
                <span className="xsmall uppercase muted" style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <AlertTriangle size={13} style={{ color: 'var(--color-error)' }} /> Priority Gaps for {company_name}
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {candB.priority_gaps?.length ? (
                    candB.priority_gaps.map((c) => (
                      <Badge key={c} tone="error">
                        <span className="cat-code" style={{ marginRight: 4 }}>{c}</span> {categoryName(c)}
                      </Badge>
                    ))
                  ) : (
                    <span className="small muted">Meets or exceeds all requirements</span>
                  )}
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* 12-Category Comparison Table */}
      <Card>
        <CardHeader
          icon={Users}
          title="12 RADIX Skillsets Comparison Breakdown"
          subtitle={`Side-by-side level comparison against ${company_name} expected levels (0–10 scale)`}
        />
        <CardBody>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ padding: '12px 10px', width: '22%' }}>RADIX Skillset</th>
                  <th style={{ padding: '12px 10px', textAlign: 'center', width: '10%' }}>Required</th>
                  <th style={{ padding: '12px 10px', textAlign: 'center', width: '14%' }}>{candA.candidate_name}</th>
                  <th style={{ padding: '12px 10px', textAlign: 'center', width: '14%' }}>{candB.candidate_name}</th>
                  <th style={{ padding: '12px 10px', textAlign: 'center', width: '12%' }}>Advantage</th>
                  <th style={{ padding: '12px 10px', width: '28%' }}>Evidence & Gap Explanation</th>
                </tr>
              </thead>
              <tbody>
                {category_comparisons?.map((row) => {
                  const isA = row.leader === 'candidate_a';
                  const isB = row.leader === 'candidate_b';
                  return (
                    <tr key={row.category_code} style={{ borderBottom: '1px solid var(--color-border-subtle, rgba(255,255,255,0.06))' }}>
                      <td style={{ padding: '12px 10px' }}>
                        <span className="cat-code" style={{ marginRight: 6 }}>{row.category_code}</span>
                        <strong className="small">{row.category_name}</strong>
                      </td>
                      <td style={{ padding: '12px 10px', textAlign: 'center', fontWeight: 600 }}>
                        {row.required_level ?? '—'}/10
                      </td>
                      <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
                          <span style={{ fontWeight: isA ? 700 : 400, color: isA ? 'var(--color-success)' : 'inherit' }}>
                            {row.candidate_a_level}/10
                          </span>
                          <span className="xsmall muted">{row.candidate_a_status}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
                          <span style={{ fontWeight: isB ? 700 : 400, color: isB ? 'var(--color-success)' : 'inherit' }}>
                            {row.candidate_b_level}/10
                          </span>
                          <span className="xsmall muted">{row.candidate_b_status}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                        {isA ? (
                          <Badge tone="success">A +{row.difference}</Badge>
                        ) : isB ? (
                          <Badge tone="primary">B +{Math.abs(row.difference)}</Badge>
                        ) : (
                          <span className="xsmall muted">Tie</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 10px' }}>
                        <span className="small muted" style={{ lineHeight: 1.4 }}>
                          {row.explanation}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="xsmall muted" style={{ marginTop: 16 }}>
            Report generated at {formatDate(created_at, { withTime: true })}. Both candidates evaluated against official company requirements from data/talent_check_company_skillsets.json.
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
