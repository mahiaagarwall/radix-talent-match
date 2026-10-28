import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Briefcase,
  Building,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowRight,
  Info,
} from 'lucide-react';
import { useAppData } from '../context/AppDataContext';
import { jobFinderService } from '../services/jobFinderService';
import { PageHeader } from '../components/layout/PageHeader';
import { Card, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { ScoreRing } from '../components/ui/ScoreRing';
import { LoadingState, EmptyState, ErrorState } from '../components/ui/States';

export default function JobFinder() {
  const navigate = useNavigate();
  const { profiles, activeProfile, setActiveProfileId, setActiveJdId } = useAppData();

  const [selectedProfileId, setSelectedProfileId] = useState(
    activeProfile?.profile_id || (profiles.items[0]?.profile_id ?? '')
  );
  const [roleFilter, setRoleFilter] = useState('');
  const [minScore, setMinScore] = useState(0);

  const [recommendations, setRecommendations] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Sync default profile selection
  useEffect(() => {
    if (!selectedProfileId && profiles.items.length > 0) {
      setSelectedProfileId(profiles.items[0].profile_id);
    }
  }, [profiles.items, selectedProfileId]);

  const currentProfile = useMemo(() => {
    return profiles.items.find((p) => p.profile_id === selectedProfileId) || null;
  }, [profiles.items, selectedProfileId]);

  const handleRecommend = async () => {
    if (!selectedProfileId && !currentProfile) return;
    setLoading(true);
    setError(null);
    try {
      const res = await jobFinderService.recommend({
        profileId: selectedProfileId,
        candidateProfile: currentProfile,
        roleFilter,
        minScore,
        limit: 15,
      });
      setRecommendations(res);
      if (selectedProfileId) {
        setActiveProfileId(selectedProfileId);
      }
    } catch (err) {
      setError(err?.message || 'Could not load job recommendations.');
    } finally {
      setLoading(false);
    }
  };

  // Auto-run once profile is available
  useEffect(() => {
    if (selectedProfileId && !recommendations && !loading) {
      handleRecommend();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProfileId]);

  const handleProceedToMatch = (jdId) => {
    setActiveJdId(jdId);
    if (selectedProfileId) {
      setActiveProfileId(selectedProfileId);
    }
    navigate('/skill-matching');
  };

  return (
    <div className="page page--job-finder">
      <PageHeader
        title="Job Finder"
        subtitle="Recommend and rank suitable roles using candidate skill evidence and multi-factor matching."
      />

      {/* Profile & Filter Bar */}
      <Card style={{ marginBottom: 20 }}>
        <CardBody>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, alignItems: 'flex-end' }}>
            <div>
              <label htmlFor="jf-candidate-select" style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                Candidate Profile
              </label>
              <select
                id="jf-candidate-select"
                className="select"
                value={selectedProfileId}
                onChange={(e) => {
                  setSelectedProfileId(e.target.value);
                  setRecommendations(null);
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
              <label htmlFor="jf-role-filter" style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                Filter by Role or Company
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="jf-role-filter"
                  type="text"
                  className="input"
                  placeholder="e.g. Software, Data, Google..."
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  disabled={loading}
                  style={{ width: '100%', paddingLeft: 34 }}
                />
                <Search size={16} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }} />
              </div>
            </div>

            <div>
              <label htmlFor="jf-min-score" style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                Min. Match Threshold
              </label>
              <select
                id="jf-min-score"
                className="select"
                value={minScore}
                onChange={(e) => setMinScore(Number(e.target.value))}
                disabled={loading}
                style={{ width: '100%' }}
              >
                <option value={0}>All Matches (0%+)</option>
                <option value={40}>Moderate & Strong (&ge; 40%)</option>
                <option value={60}>High Fit (&ge; 60%)</option>
                <option value={75}>Top Tier (&ge; 75%)</option>
              </select>
            </div>

            <div>
              <Button
                variant="primary"
                icon={Search}
                loading={loading}
                onClick={handleRecommend}
                style={{ width: '100%' }}
              >
                Find Matching Jobs
              </Button>
            </div>
          </div>

          {currentProfile?.skills?.length > 0 && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
                Profile Skills ({currentProfile.skills.length}):
              </span>
              {currentProfile.skills.slice(0, 8).map((s, idx) => (
                <span key={idx} className="badge badge--neutral" style={{ fontSize: 11 }}>
                  {typeof s === 'string' ? s : s.skill_name || s.name}
                </span>
              ))}
              {currentProfile.skills.length > 8 && (
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  +{currentProfile.skills.length - 8} more
                </span>
              )}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Main Content Area */}
      {loading ? (
        <LoadingState label="Evaluating roles against candidate profile..." />
      ) : error ? (
        <ErrorState error={error} title="Could not evaluate jobs" onRetry={handleRecommend} />
      ) : !recommendations || recommendations.matches.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No Matching Jobs Found"
          description="Try loosening your role filter or lowering the minimum match threshold."
        />
      ) : (
        <div className="recommendations-container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>
              {recommendations.evaluation_summary}
            </p>
            <span className="badge badge--info" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Sparkles size={12} /> Deterministic Multi-Factor Ranking
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {recommendations.matches.map((job) => (
              <Card key={job.jd_id} className="job-card" style={{ transition: 'border-color 0.15s ease' }}>
                <CardBody>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
                    {/* Score Ring */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 90 }}>
                      <ScoreRing score={job.overall_score} size={80} strokeWidth={7} />
                      <span
                        className={`badge badge--${
                          job.match_tier === 'Strong Match'
                            ? 'success'
                            : job.match_tier === 'Good Match'
                            ? 'info'
                            : 'neutral'
                        }`}
                        style={{ marginTop: 6, fontSize: 11 }}
                      >
                        {job.match_tier}
                      </span>
                    </div>

                    {/* Job Details */}
                    <div style={{ flex: 1, minWidth: 260 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                        <div>
                          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{job.role}</h3>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4, color: 'var(--text-muted)', fontSize: 13 }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Building size={14} /> {job.company}
                            </span>
                            <span>&bull;</span>
                            <span>{job.location}</span>
                            <span>&bull;</span>
                            <span>{job.employment_type}</span>
                          </div>
                        </div>

                        <Button
                          variant="secondary"
                          size="sm"
                          icon={ArrowRight}
                          onClick={() => handleProceedToMatch(job.jd_id)}
                        >
                          Run Skill Match
                        </Button>
                      </div>

                      {/* Rationale */}
                      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 12, marginBottom: 12, lineHeight: 1.5 }}>
                        {job.rationale}
                      </p>

                      {/* Score Breakdown Bars */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, padding: '10px 12px', background: 'var(--bg-subtle, rgba(255,255,255,0.03))', borderRadius: 8, marginBottom: 14 }}>
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Required Skills (50%)</div>
                          <div style={{ fontSize: 14, fontWeight: 600 }}>{job.breakdown.required_skills_match}%</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Preferred Skills (20%)</div>
                          <div style={{ fontSize: 14, fontWeight: 600 }}>{job.breakdown.preferred_skills_match}%</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Category Alignment (15%)</div>
                          <div style={{ fontSize: 14, fontWeight: 600 }}>{job.breakdown.category_relevance}%</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Experience Fit (15%)</div>
                          <div style={{ fontSize: 14, fontWeight: 600 }}>{job.breakdown.experience_relevance}%</div>
                        </div>
                      </div>

                      {/* Skills Overlap */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {job.matching_skills.length > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <CheckCircle2 size={13} /> Matched:
                            </span>
                            {job.matching_skills.map((s, idx) => (
                              <span key={idx} className="badge badge--success" style={{ fontSize: 11 }}>
                                {s}
                              </span>
                            ))}
                          </div>
                        )}

                        {job.missing_required_skills.length > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <AlertCircle size={13} /> Unverified Required:
                            </span>
                            {job.missing_required_skills.map((s, idx) => (
                              <span key={idx} className="badge badge--warning" style={{ fontSize: 11 }}>
                                {s}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Limitations Note */}
                      {job.limitations?.length > 0 && (
                        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                          <Info size={12} /> {job.limitations[0]}
                        </div>
                      )}
                    </div>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
