import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search,
  Building,
  CheckCircle2,
  AlertCircle,
  CircleDashed,
  HelpCircle,
  ArrowRight,
  Info,
  UserRoundPen,
  ExternalLink,
} from 'lucide-react';
import { useAppData } from '../context/AppDataContext';
import { jobFinderService } from '../services/jobFinderService';
import { writeSelectedCompany } from '@cd/context/CompanyContext';
import { DIRECTORY_PATHS } from '@cd/routes';
import { PageHeader } from '../components/layout/PageHeader';
import { Card, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/ui/Alert';
import { ScoreRing } from '../components/ui/ScoreRing';
import { LoadingState, EmptyState, ErrorState } from '../components/ui/States';
import { pluralize } from '../utils/format';

const GROUPS = [
  { key: 'matched', label: 'Meets requirement', tone: 'success', icon: CheckCircle2 },
  { key: 'partial', label: 'Partially demonstrated', tone: 'warning', icon: CircleDashed },
  { key: 'missing', label: 'Missing from resume', tone: 'error', icon: AlertCircle },
  { key: 'unverified', label: 'Unverified (not shown by a resume)', tone: 'neutral', icon: HelpCircle },
];

const labelStyle = { display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 };
const sectionTitle = { fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', margin: '0 0 6px' };

function RequirementGroup({ group, rows }) {
  if (!rows.length) return null;
  const Icon = group.icon;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
        <Icon size={13} aria-hidden="true" /> {group.label}:
      </span>
      {rows.map((r) => (
        <span
          key={r.category_code}
          className={`badge badge--${group.tone}`}
          style={{ fontSize: 11 }}
          title={`${r.criticality} · required ${r.required_level}/10 · estimated ${r.candidate_level}/10`}
        >
          {r.category_name} {r.candidate_level}/{r.required_level}
        </span>
      ))}
    </div>
  );
}

function CompanyResult({ match, onRunSkillMatch, onOpenCompany }) {
  const evidence = match.requirements.filter((r) => r.evidence.length > 0 && r.classification !== 'missing').slice(0, 3);
  return (
    <Card>
      <CardBody>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 90 }}>
            <ScoreRing score={match.score} size={80} stroke={7} label={`${match.company_name} compatibility`} />
            <span className="badge badge--neutral" style={{ marginTop: 6, fontSize: 11 }}>
              Rank #{match.rank}
            </span>
          </div>

          <div style={{ flex: 1, minWidth: 260 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Building size={16} aria-hidden="true" /> {match.company_name}
                </h3>
                <p className="xsmall muted" style={{ marginTop: 4 }}>
                  Company ID {match.company_id}
                  {match.company_type ? ` · ${match.company_type}` : ''}
                  {match.category ? ` · ${match.category}` : ''}
                  {match.critical_total > 0 && ` · Critical requirements met: ${match.critical_met}/${match.critical_total}`}
                </p>
              </div>
              <div className="row" style={{ gap: 6 }}>
                <Button variant="secondary" size="sm" icon={ExternalLink} onClick={() => onOpenCompany(match)}>
                  Skill Intelligence
                </Button>
                {match.best_role && (
                  <Button variant="secondary" size="sm" icon={ArrowRight} onClick={() => onRunSkillMatch(match.best_role.jd_id)}>
                    Run Skill Match
                  </Button>
                )}
              </div>
            </div>

            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '12px 0', lineHeight: 1.5 }}>{match.explanation}</p>

            <div style={{ padding: '10px 12px', background: 'var(--surface-muted)', borderRadius: 8, marginBottom: 12, fontSize: 13 }}>
              {match.best_role ? (
                <>
                  <strong>Best-matching analyzed role:</strong> {match.best_role.role} — {match.best_role.match_score}/100 job match (Skill
                  Matching). <span className="muted">From a saved JD Analytics record, not a verified live vacancy.</span>
                </>
              ) : (
                <>
                  <strong>Potential employer.</strong>{' '}
                  <span className="muted">No analyzed job description for this company is saved, so no specific role is claimed.</span>
                </>
              )}
              {match.hiring_signal && (
                <p className="xsmall muted" style={{ marginTop: 6 }}>
                  Hiring activity reported in the Company Directory (not verified): {match.hiring_signal}
                </p>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {GROUPS.map((g) => (
                <RequirementGroup key={g.key} group={g} rows={match[g.key]} />
              ))}
            </div>

            {evidence.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <p style={sectionTitle}>Supporting evidence from the profile</p>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--text-secondary)' }}>
                  {evidence.map((r) => (
                    <li key={r.category_code}>
                      <strong>{r.category_name}:</strong>{' '}
                      {r.evidence
                        .slice(0, 2)
                        .map((e) => (e.evidence ? `${e.skill_name} — “${e.evidence}”` : e.skill_name))
                        .join('; ')}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-secondary)' }}>
              <p style={sectionTitle}>{match.short_name || match.company_name} Skill Intelligence (highest required levels)</p>
              <p>{match.skill_intelligence_summary.join(' · ')}</p>
              {match.tech_stack && (
                <p style={{ marginTop: 4 }}>
                  Listed tech stack: {match.tech_stack}
                  {match.tech_stack_matches.length > 0 && <> — in your profile: {match.tech_stack_matches.join(', ')}</>}
                </p>
              )}
            </div>

            {match.limitations.length > 0 && (
              <ul style={{ margin: '12px 0 0', paddingLeft: 0, listStyle: 'none', fontSize: 11, color: 'var(--text-muted)' }}>
                {match.limitations.map((l) => (
                  <li key={l} style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                    <Info size={12} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} /> {l}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

export default function JobFinder() {
  const navigate = useNavigate();
  const { profiles, activeProfile, setActiveProfileId, setActiveJdId } = useAppData();

  const [selectedProfileId, setSelectedProfileId] = useState(activeProfile?.profile_id || (profiles.items[0]?.profile_id ?? ''));
  const [ranking, setRanking] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const requestId = useRef(0);

  useEffect(() => {
    if (!selectedProfileId && profiles.items.length > 0) setSelectedProfileId(profiles.items[0].profile_id);
  }, [profiles.items, selectedProfileId]);

  const currentProfile = useMemo(() => profiles.items.find((p) => p.profile_id === selectedProfileId) || null, [profiles.items, selectedProfileId]);

  const handleRecommend = useCallback(async () => {
    if (!selectedProfileId) return;
    const id = ++requestId.current; // a slower, older request must not overwrite a newer one
    setLoading(true);
    setError(null);
    try {
      const res = await jobFinderService.recommendCompanies({ profileId: selectedProfileId });
      if (id !== requestId.current) return;
      setRanking(res);
      setActiveProfileId(selectedProfileId);
    } catch (err) {
      if (id === requestId.current) {
        setRanking(null);
        setError(err);
      }
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [selectedProfileId, setActiveProfileId]);

  // Rank automatically once a profile is selected.
  useEffect(() => {
    if (selectedProfileId) handleRecommend();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProfileId]);

  const handleRunSkillMatch = (jdId) => {
    setActiveJdId(jdId);
    if (selectedProfileId) setActiveProfileId(selectedProfileId);
    navigate('/skill-matching');
  };

  const handleOpenCompany = (match) => {
    writeSelectedCompany({ companyId: match.company_id, companyName: match.company_name, logoUrl: '' });
    navigate(DIRECTORY_PATHS.skills);
  };

  return (
    <div className="page page--job-finder">
      <PageHeader
        title="Job Finder"
        description="Ranks every Company Directory company against a candidate profile using each company's own Skill Intelligence, and shows the five closest matches with the evidence behind each score."
      />

      <Card style={{ marginBottom: 20 }}>
        <CardBody>
          {profiles.loading ? (
            <LoadingState label="Loading profiles…" />
          ) : profiles.items.length === 0 ? (
            <EmptyState
              compact
              icon={UserRoundPen}
              title="No saved candidate profiles"
              description="Job Finder compares a saved, evidence-backed profile with every company in the Company Directory."
              actions={
                <Button variant="primary" to="/resume-parsing">
                  Create a profile
                </Button>
              }
            />
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, alignItems: 'flex-end' }}>
                <div>
                  <label htmlFor="jf-candidate-select" style={labelStyle}>
                    Candidate Profile
                  </label>
                  <select
                    id="jf-candidate-select"
                    className="select"
                    value={selectedProfileId}
                    onChange={(e) => {
                      setSelectedProfileId(e.target.value);
                      setRanking(null);
                    }}
                    disabled={loading}
                    style={{ width: '100%' }}
                  >
                    {profiles.items.map((p) => (
                      <option key={p.profile_id} value={p.profile_id}>
                        {p.name} {p.preferred_roles?.length ? `(${p.preferred_roles[0]})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Button variant="primary" icon={Search} loading={loading} onClick={handleRecommend} style={{ width: '100%' }}>
                    Find Matching Companies
                  </Button>
                </div>
              </div>

              {currentProfile?.skills?.length > 0 && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>Profile Skills ({currentProfile.skills.length}):</span>
                  {currentProfile.skills.slice(0, 8).map((s, idx) => (
                    <span key={idx} className="badge badge--neutral" style={{ fontSize: 11 }}>
                      {typeof s === 'string' ? s : s.skill_name || s.name}
                    </span>
                  ))}
                  {currentProfile.skills.length > 8 && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>+{currentProfile.skills.length - 8} more</span>}
                </div>
              )}
            </>
          )}
        </CardBody>
      </Card>

      {loading ? (
        <Card>
          <LoadingState label="Comparing the profile with every company in the Company Directory…" />
        </Card>
      ) : error ? (
        <ErrorState error={error} title="Could not rank companies" onRetry={handleRecommend} />
      ) : !ranking ? null : ranking.matches.length === 0 ? (
        <EmptyState
          icon={Building}
          title="No company could be assessed"
          description={`None of the ${pluralize(ranking.total_companies, 'company', 'companies')} in the Company Directory has enough Skill Intelligence data to score.`}
        />
      ) : (
        <div className="stack">
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}>
            Compared {ranking.candidate_name} with {pluralize(ranking.assessed_count, 'company', 'companies')} out of the{' '}
            {ranking.total_companies} in the <Link to={DIRECTORY_PATHS.home}>Company Directory</Link>
            {ranking.excluded.length > 0 && ` (${ranking.excluded.length} skipped for incomplete Skill Intelligence)`}. Top{' '}
            {ranking.matches.length} by compatibility:
          </p>

          {ranking.warnings?.map((w) => (
            <Alert key={w} tone="warning">
              {w}
            </Alert>
          ))}

          {ranking.matches.map((m) => (
            <CompanyResult key={m.company_id} match={m} onRunSkillMatch={handleRunSkillMatch} onOpenCompany={handleOpenCompany} />
          ))}

          <p className="xsmall muted" style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
            <Info size={12} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
            Compatibility measures how well the profile&apos;s evidence covers a company&apos;s Skill Intelligence ({ranking.scoring.formula}, the Talent Check
            readiness formula). Candidate levels are estimates from profile evidence. This is not a probability of being hired.
          </p>

          {ranking.excluded.length > 0 && (
            <details className="small muted">
              <summary>Companies not scored ({ranking.excluded.length})</summary>
              <ul style={{ marginTop: 6, paddingLeft: 18 }}>
                {ranking.excluded.map((e) => (
                  <li key={e.company_id}>
                    {e.company_name} (ID {e.company_id}): {e.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
