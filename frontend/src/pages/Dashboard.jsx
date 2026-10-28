import { Link } from 'react-router-dom';
import {
  Users,
  BriefcaseBusiness,
  Gauge,
  GitCompareArrows,
  FileSearch,
  UserRoundPen,
  Activity,
  TrendingUp,
  BarChart3,
  Database,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { StatCard } from '../components/ui/StatCard';
import { Alert } from '../components/ui/Alert';
import { DemoBadge } from '../components/ui/Badges';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/States';
import { WorkflowSteps } from '../components/dashboard/WorkflowSteps';
import { ScoreTrendChart } from '../components/dashboard/ScoreTrendChart';
import { GapCategoryChart } from '../components/dashboard/GapCategoryChart';
import { ActivityFeed, buildActivity } from '../components/dashboard/ActivityFeed';
import { ScoreCell } from '../components/results/ResultsTable';
import { loadSampleWorkspace } from '../services/sampleWorkspace';
import { useAppData } from '../context/AppDataContext';
import { useToast } from '../context/ToastContext';
import { initials, formatRelative, pluralize } from '../utils/format';

const QUICK_ACTIONS = [
  { to: '/resume-parsing', icon: FileSearch, label: 'Upload a resume', desc: 'Extract skills with evidence' },
  { to: '/profile-builder', icon: UserRoundPen, label: 'Create a profile', desc: 'Review and save a candidate' },
  { to: '/jd-analytics', icon: BriefcaseBusiness, label: 'Analyze a JD', desc: 'Structure job requirements' },
  { to: '/skill-matching', icon: GitCompareArrows, label: 'Run Skill Matching', desc: 'Candidate vs. one job' },
  { to: '/talent-check', icon: Gauge, label: 'Run Talent Check', desc: 'Readiness vs. a company' },
];

function QuickActions() {
  return (
    <div className="quick-actions">
      {QUICK_ACTIONS.map(({ to, icon: Icon, label, desc }) => (
        <Link key={to} to={to} className="quick-action">
          <span className="quick-action__icon" aria-hidden="true">
            <Icon size={18} />
          </span>
          <span>
            <span className="quick-action__label">{label}</span>
            <span className="quick-action__desc">{desc}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { mode, profiles, jds, results, refreshAll } = useAppData();
  const { notify } = useToast();
  const loading = profiles.loading || jds.loading || results.loading;
  const error = profiles.error || jds.error || results.error;

  const talentChecks = results.items.filter((r) => r.type === 'talent_check');
  const matches = results.items.filter((r) => r.type === 'skill_match');
  const counts = {
    profiles: profiles.items.length,
    parsedProfiles: profiles.items.filter((p) => p.resume_reference).length,
    jds: jds.items.length,
    talentChecks: talentChecks.length,
    matches: matches.length,
  };
  const isEmpty = !loading && !error && counts.profiles + counts.jds + results.items.length === 0;
  const hasSamples = profiles.items.some((p) => p.profile_id.startsWith('prf_sample_')) || jds.items.some((j) => j.jd_id.startsWith('jd_sample_'));

  const loadSamples = async () => {
    try {
      const n = loadSampleWorkspace();
      await refreshAll();
      notify(`Loaded ${n.profiles} sample candidates and ${n.jds} sample job descriptions.`, { tone: 'success' });
    } catch (err) {
      notify(err.message, { tone: 'error' });
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="PARALLAX · TALENT INTELLIGENCE"
        title="See Talent in True Depth."
        description="Analyze job descriptions, uncover candidate skills, assess technical readiness, and discover the right talent for every role — with evidence behind every match."
        actions={
          mode === 'demo' && !hasSamples && !isEmpty ? (
            <Button icon={Database} onClick={loadSamples}>
              Load sample pack
            </Button>
          ) : null
        }
      />

      {loading ? (
        <Card>
          <LoadingState label="Loading workspace…" />
        </Card>
      ) : error ? (
        <ErrorState error={error} title="Could not load workspace data" onRetry={refreshAll} />
      ) : isEmpty ? (
        <div className="stack">
          <Card>
            <EmptyState
              icon={Sparkles}
              title="Your workspace is empty"
              description={
                mode === 'demo'
                  ? 'Start with your own documents, or load the hackathon sample pack: 4 candidates and 6 job descriptions, hand-annotated from the supplied files and clearly labelled as demo fixtures.'
                  : 'The backend returned no records yet. Upload a resume or analyze a job description to begin.'
              }
              actions={
                <>
                  {mode === 'demo' && (
                    <Button variant="primary" icon={Database} onClick={loadSamples}>
                      Load sample pack
                    </Button>
                  )}
                  <Button icon={BriefcaseBusiness} to="/jd-analytics">
                    Analyze a JD
                  </Button>
                  <Button icon={FileSearch} to="/resume-parsing">
                    Upload a resume
                  </Button>
                </>
              }
            />
          </Card>
          <Card>
            <CardHeader title="Quick actions" />
            <CardBody>
              <QuickActions />
            </CardBody>
          </Card>
        </div>
      ) : (
        <div className="stack">
          {mode === 'demo' && (
            <Alert tone="demo" title="Demo workspace">
              Every number below is computed from records stored in this browser{hasSamples ? ', including the labelled sample-pack fixtures' : ''}. Scores use
              documented demo rules pending team agreement. <Link to="/settings">Settings</Link>
            </Alert>
          )}

          <Card>
            <CardBody>
              <WorkflowSteps counts={counts} />
            </CardBody>
          </Card>

          <div className="grid grid--4">
            <StatCard icon={Users} label="Candidate profiles" value={counts.profiles} meta={`${counts.parsedProfiles} linked to a resume`} />
            <StatCard icon={BriefcaseBusiness} label="Analyzed job descriptions" value={counts.jds} meta={`${new Set(jds.items.map((j) => j.company)).size} companies`} />
            <StatCard icon={Gauge} label="Talent Checks" value={counts.talentChecks} meta="Company-level readiness" tone="teal" />
            <StatCard icon={GitCompareArrows} label="Skill matches" value={counts.matches} meta="Job-specific fit" tone="teal" />
          </div>

          <div className="grid grid--2">
            <Card>
              <CardHeader icon={TrendingUp} title="Score trend" />
              <CardBody>
                <ScoreTrendChart results={results.items} />
              </CardBody>
            </Card>
            <Card>
              <CardHeader icon={BarChart3} title="Most common gap categories" subtitle="Partial and missing requirements across Skill Matching runs" />
              <CardBody>
                <GapCategoryChart results={results.items} />
              </CardBody>
            </Card>
          </div>

          <div className="grid grid--3">
            <Card>
              <CardHeader
                icon={Users}
                title="Recent profiles"
                actions={
                  <Link to="/profile-builder" className="small">
                    All
                  </Link>
                }
              />
              <CardBody flush>
                {profiles.items.length === 0 ? (
                  <EmptyState compact title="No profiles yet" actions={<Button size="sm" to="/resume-parsing">Upload a resume</Button>} />
                ) : (
                  <ul>
                    {profiles.items.slice(0, 5).map((p, idx) => (
                      <li key={p.profile_id || `prf-${idx}`}>
                        <Link to={`/profile-builder/${p.profile_id}`} className="list-item">
                          <span className="avatar" aria-hidden="true">
                            {initials(p.name)}
                          </span>
                          <div className="list-item__main">
                            <p className="list-item__title">{p.name}</p>
                            <p className="list-item__meta">
                              {pluralize((p.skills || []).length, 'skill')} · {formatRelative(p.updated_at)}
                            </p>
                          </div>
                          {p.profile_id && p.profile_id.startsWith('prf_sample_') && <DemoBadge>Sample</DemoBadge>}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
            <Card>
              <CardHeader
                icon={BriefcaseBusiness}
                title="Recent job descriptions"
                actions={
                  <Link to="/jd-analytics" className="small">
                    All
                  </Link>
                }
              />
              <CardBody flush>
                {jds.items.length === 0 ? (
                  <EmptyState compact title="No job descriptions yet" actions={<Button size="sm" to="/jd-analytics">Analyze a JD</Button>} />
                ) : (
                  <ul>
                    {jds.items.slice(0, 5).map((j, idx) => (
                      <li key={j.jd_id || `jd-${idx}`}>
                        <Link to={`/jd-analytics/${j.jd_id}`} className="list-item">
                          <div className="list-item__main">
                            <p className="list-item__title">{j.role}</p>
                            <p className="list-item__meta">
                              {j.company} · {pluralize((j.skills || []).length, 'skill')}
                            </p>
                          </div>
                          {j.source_kind === 'sample-fixture' && <DemoBadge>Sample</DemoBadge>}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
            <Card>
              <CardHeader
                icon={GitCompareArrows}
                title="Recent results"
                actions={
                  <Link to="/results" className="small">
                    All
                  </Link>
                }
              />
              <CardBody flush>
                {results.items.length === 0 ? (
                  <EmptyState compact title="No assessments yet" actions={<Button size="sm" to="/skill-matching">Run a match</Button>} />
                ) : (
                  <ul>
                    {results.items.slice(0, 5).map((r, idx) => (
                      <li key={r.result_id || r.match_id || `res-${idx}`}>
                        <Link to={`/results/${r.result_id || r.match_id}`} className="list-item">
                          <div className="list-item__main">
                            <p className="list-item__title">{r.candidate_name}</p>
                            <p className="list-item__meta">{r.type === 'talent_check' ? `Talent Check · ${r.company}` : `Skill Match · ${r.role}`}</p>
                          </div>
                          <ScoreCell result={r} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          </div>

          <div className="grid grid--2">
            <Card>
              <CardHeader icon={Activity} title="Recent activity" />
              <CardBody flush>
                <ActivityFeed events={buildActivity({ profiles: profiles.items, jds: jds.items, results: results.items })} />
              </CardBody>
            </Card>
            <Card>
              <CardHeader icon={ArrowRight} title="Quick actions" />
              <CardBody>
                <QuickActions />
              </CardBody>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
