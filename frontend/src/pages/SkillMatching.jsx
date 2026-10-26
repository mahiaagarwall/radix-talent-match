import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { GitCompareArrows, Play, RotateCcw, UserRoundPen, BriefcaseBusiness, History } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { DemoNotice } from '../components/layout/DemoNotice';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { SelectField } from '../components/ui/Fields';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/States';
import { MatchResultView } from '../components/skill-matching/MatchResultView';
import { skillMatchService } from '../services/skillMatchService';
import { useAppData } from '../context/AppDataContext';
import { useToast } from '../context/ToastContext';
import { formatRelative } from '../utils/format';

export default function SkillMatching() {
  const [params, setParams] = useSearchParams();
  const { notify } = useToast();
  const { profiles, jds, results, reloadResults, activeProfileId, setActiveProfileId, activeJdId, setActiveJdId, reloadProfiles, reloadJds } = useAppData();
  const profileId = params.get('profile') || activeProfileId || '';
  const jdId = params.get('jd') || activeJdId || '';
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const [current, setCurrent] = useState(null);

  const profileExists = profiles.items.some((p) => p.profile_id === profileId);
  const jdExists = jds.items.some((j) => j.jd_id === jdId);

  // Latest stored result for the selected pair, so a rerun is never required just to view it.
  const lastForPair = useMemo(
    () =>
      results.items
        .filter((r) => r.type === 'skill_match' && r.profile_id === profileId && r.jd_id === jdId)
        .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0] || null,
    [results.items, profileId, jdId],
  );

  useEffect(() => {
    setCurrent(lastForPair);
    setError(null);
  }, [lastForPair]);

  const select = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
    if (key === 'profile') setActiveProfileId(value || null);
    if (key === 'jd') setActiveJdId(value || null);
  };

  const run = async () => {
    setRunning(true);
    setError(null);
    try {
      const result = await skillMatchService.run({ profileId, jdId });
      setCurrent(result);
      await reloadResults();
      notify(`Match complete: ${result.match_score}/100.`, { tone: 'success' });
    } catch (err) {
      setError(err);
    } finally {
      setRunning(false);
    }
  };

  const loading = profiles.loading || jds.loading;
  const listError = profiles.error || jds.error;
  const canRun = profileExists && jdExists && !running;

  return (
    <>
      <PageHeader
        eyebrow="Step 5 · Skill Matching"
        title="Skill Matching"
        description="Compare one saved candidate profile with one analyzed job description: a 0–100 match score with matched, partial and missing skills, evidence from both sides, and an explanation for every classification."
        owner="Akshat Mehra"
      />
      <div className="stack">
        <DemoNotice>
          Scores use the team guide’s proposed weighted formula with demo weights (documented in docs/scoring-rules.md) and are illustrative until the team agrees the
          final rules.
        </DemoNotice>

        <Card>
          <CardHeader icon={GitCompareArrows} title="Select candidate and job" subtitle="Change either selection and rerun to compare." />
          <CardBody>
            {loading ? (
              <LoadingState label="Loading profiles and job descriptions…" />
            ) : listError ? (
              <ErrorState
                error={listError}
                title="Could not load selection data"
                onRetry={() => {
                  reloadProfiles();
                  reloadJds();
                }}
              />
            ) : profiles.items.length === 0 || jds.items.length === 0 ? (
              <EmptyState
                compact
                icon={GitCompareArrows}
                title="Matching needs a saved profile and an analyzed job description"
                description={`You have ${profiles.items.length} saved profile(s) and ${jds.items.length} saved job description(s).`}
                actions={
                  <>
                    {profiles.items.length === 0 && (
                      <Button variant="primary" icon={UserRoundPen} to="/resume-parsing">
                        Create a profile
                      </Button>
                    )}
                    {jds.items.length === 0 && (
                      <Button variant={profiles.items.length === 0 ? 'secondary' : 'primary'} icon={BriefcaseBusiness} to="/jd-analytics">
                        Analyze a JD
                      </Button>
                    )}
                  </>
                }
              />
            ) : (
              <div className="selector-row">
                <SelectField
                  label="Candidate profile"
                  value={profileExists ? profileId : ''}
                  placeholder="Choose a candidate…"
                  onChange={(e) => select('profile', e.target.value)}
                  options={profiles.items.map((p) => ({ value: p.profile_id, label: `${p.name} (${(p.skills || []).length} skills)` }))}
                />
                <SelectField
                  label="Job description"
                  value={jdExists ? jdId : ''}
                  placeholder="Choose a job description…"
                  onChange={(e) => select('jd', e.target.value)}
                  options={jds.items.map((j) => ({ value: j.jd_id, label: `${j.role} — ${j.company}` }))}
                />
                <Button variant="primary" icon={current ? RotateCcw : Play} onClick={run} loading={running} disabled={!canRun}>
                  {current ? 'Rerun match' : 'Run match'}
                </Button>
              </div>
            )}
            {current && !running && (
              <p className="xsmall muted row" style={{ marginTop: 12 }}>
                <History size={13} aria-hidden="true" /> Showing the result from {formatRelative(current.created_at)}. Rerun after editing the profile or JD to refresh it.
              </p>
            )}
          </CardBody>
        </Card>

        {error && <ErrorState error={error} title="Match failed" onRetry={canRun ? run : undefined} />}

        {running ? (
          <Card>
            <LoadingState label="Comparing profile evidence with JD requirements…" />
          </Card>
        ) : current ? (
          <MatchResultView result={current} />
        ) : (
          !loading &&
          profileExists &&
          jdExists && (
            <Card>
              <EmptyState
                icon={GitCompareArrows}
                title="Ready to match"
                description="Run the match to see the score, the category breakdown, and an explanation for every requirement."
                actions={
                  <Button variant="primary" icon={Play} onClick={run}>
                    Run match
                  </Button>
                }
              />
            </Card>
          )
        )}
      </div>
    </>
  );
}
