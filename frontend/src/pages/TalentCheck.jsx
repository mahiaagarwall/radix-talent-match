import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Gauge, Play, RotateCcw, UserRoundPen, History, FileJson, Users } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { DemoNotice } from '../components/layout/DemoNotice';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/ui/Alert';
import { SelectField } from '../components/ui/Fields';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/States';
import { RequirementsSetup } from '../components/talent-check/RequirementsSetup';
import { TalentCheckResultView } from '../components/talent-check/TalentCheckResultView';
import { CandidateComparisonView } from '../components/talent-check/CandidateComparisonView';
import { talentCheckService } from '../services/talentCheckService';
import { useAppData } from '../context/AppDataContext';
import { useToast } from '../context/ToastContext';
import { formatRelative, pluralize } from '../utils/format';

export default function TalentCheck() {
  const [params, setParams] = useSearchParams();
  const { notify } = useToast();
  const { mode, profiles, results, reloadResults, reloadProfiles, activeProfileId, setActiveProfileId } = useAppData();
  const [reqState, setReqState] = useState({ loading: true, data: null, error: null });
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const [current, setCurrent] = useState(null);

  // Mode: 'single' (Individual assessment) vs 'compare' (Compare two candidates)
  const [activeTab, setActiveTab] = useState(params.get('tab') || 'single');
  const [profileIdB, setProfileIdB] = useState(params.get('profile_b') || '');
  const [comparison, setComparison] = useState(null);
  const [runningCompare, setRunningCompare] = useState(false);

  const profileId = params.get('profile') || activeProfileId || '';
  const companyId = params.get('company') || '';

  const loadRequirements = useCallback(async () => {
    setReqState({ loading: true, data: null, error: null });
    try {
      setReqState({ loading: false, data: await talentCheckService.loadRequirements(), error: null });
    } catch (err) {
      setReqState({ loading: false, data: null, error: err });
    }
  }, []);

  useEffect(() => {
    loadRequirements();
  }, [loadRequirements, mode]);

  const companies = reqState.data?.companies || [];
  const company = companies.find((c) => c.company_id === companyId) || null;
  const profileExists = profiles.items.some((p) => p.profile_id === profileId);
  const profileBExists = profiles.items.some((p) => p.profile_id === profileIdB);

  const lastForPair = useMemo(
    () =>
      results.items
        .filter((r) => r.type === 'talent_check' && r.profile_id === profileId && r.company_id === companyId)
        .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0] || null,
    [results.items, profileId, companyId],
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
    if (key === 'profile_b') setProfileIdB(value || '');
  };

  const switchTab = (tab) => {
    setActiveTab(tab);
    const next = new URLSearchParams(params);
    next.set('tab', tab);
    setParams(next, { replace: true });
  };

  const importFile = async (file) => {
    setImporting(true);
    setImportError(null);
    try {
      const data = await talentCheckService.importRequirementsFile(file);
      setReqState({ loading: false, data, error: null });
      notify(`Loaded requirements for ${data.companies.length} companies from ${file.name}.`, { tone: 'success' });
    } catch (err) {
      setImportError(err.message);
    } finally {
      setImporting(false);
    }
  };

  const clearImported = () => {
    if (!window.confirm('Remove the imported requirements file from this browser?')) return;
    talentCheckService.clearImportedRequirements();
    loadRequirements();
  };

  const run = async () => {
    setRunning(true);
    setError(null);
    try {
      const result = await talentCheckService.run({ profileId, company, requirements: reqState.data });
      setCurrent(result);
      await reloadResults();
      notify(`Talent Check complete: ${result.readiness_score}/100 readiness.`, { tone: 'success' });
    } catch (err) {
      setError(err);
    } finally {
      setRunning(false);
    }
  };

  const runCompare = async () => {
    if (!profileExists || !profileBExists || !company) return;
    setRunningCompare(true);
    setError(null);
    try {
      const result = await talentCheckService.compare({
        profileIdA: profileId,
        profileIdB,
        company,
        requirements: reqState.data,
      });
      setComparison(result);
      notify(`Comparison complete: ${result.overall_explanation.slice(0, 75)}…`, { tone: 'success' });
    } catch (err) {
      setError(err);
    } finally {
      setRunningCompare(false);
    }
  };

  const canRun = profileExists && company && !running;
  const canCompare = profileExists && profileBExists && profileId !== profileIdB && company && !runningCompare;

  return (
    <>
      <PageHeader
        eyebrow="Step 4 · Talent Check"
        title="Talent Check"
        description="Estimate how ready a candidate is for one company’s expectations across all 12 RADIX skillsets. This is company-level readiness — separate from job-specific Skill Matching."
        owner="Krishna Khanna"
      />
      <div className="stack">
        <DemoNotice>Candidate levels are estimated from profile evidence with a documented demo rubric. Company levels are used exactly as supplied.</DemoNotice>

        {reqState.loading ? (
          <Card>
            <LoadingState label="Loading company requirements…" />
          </Card>
        ) : reqState.error && mode === 'demo' ? (
          <ErrorState error={reqState.error} title="Company requirements file is invalid" onRetry={loadRequirements} />
        ) : !reqState.data ? (
          <>
            {reqState.error && <ErrorState error={reqState.error} title="Could not load company requirements" />}
            <RequirementsSetup mode={mode} onImport={importFile} onRetry={loadRequirements} importing={importing} importError={importError} />
          </>
        ) : (
          <>
            {reqState.data.synthetic && (
              <Alert tone="warning" title="Synthetic requirements loaded">
                The loaded file is marked synthetic (a format reference). Results are for UI testing only — replace it with the official file before any demo.
              </Alert>
            )}
            {reqState.data.warnings?.length > 0 && (
              <Alert tone="warning" title="Some entries in the requirements file were ignored">
                <ul>
                  {reqState.data.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </Alert>
            )}
            <Card>
              <CardHeader
                icon={Gauge}
                title="Select candidate and company"
                subtitle={`${pluralize(companies.length, 'company', 'companies')} loaded from ${reqState.data.source}`}
                actions={
                  mode === 'demo' &&
                  reqState.data.source !== '/data/talent_check_company_skillsets.json' && (
                    <Button size="sm" variant="ghost" icon={FileJson} onClick={clearImported}>
                      Remove imported file
                    </Button>
                  )
                }
              />
              <CardBody>
                <div style={{ display: 'flex', gap: 8, marginBottom: 18, borderBottom: '1px solid var(--color-border)', paddingBottom: 12 }}>
                  <Button
                    size="sm"
                    variant={activeTab === 'single' ? 'primary' : 'ghost'}
                    icon={Gauge}
                    onClick={() => switchTab('single')}
                  >
                    Individual Candidate
                  </Button>
                  <Button
                    size="sm"
                    variant={activeTab === 'compare' ? 'primary' : 'ghost'}
                    icon={Users}
                    onClick={() => switchTab('compare')}
                  >
                    Compare Two Candidates (Acceptance Test)
                  </Button>
                </div>

                {profiles.loading ? (
                  <LoadingState label="Loading profiles…" />
                ) : profiles.error ? (
                  <ErrorState error={profiles.error} title="Could not load profiles" onRetry={reloadProfiles} />
                ) : profiles.items.length === 0 ? (
                  <EmptyState
                    compact
                    icon={UserRoundPen}
                    title="No saved candidate profiles"
                    description="Talent Check needs a saved profile with evidence-backed skills."
                    actions={
                      <Button variant="primary" to="/resume-parsing">
                        Create a profile
                      </Button>
                    }
                  />
                ) : activeTab === 'single' ? (
                  <div className="selector-row">
                    <SelectField
                      label="Candidate profile"
                      value={profileExists ? profileId : ''}
                      placeholder="Choose a candidate…"
                      onChange={(e) => select('profile', e.target.value)}
                      options={profiles.items.map((p) => ({ value: p.profile_id, label: p.name }))}
                    />
                    <SelectField
                      label="Company"
                      value={company ? companyId : ''}
                      placeholder="Choose a company…"
                      onChange={(e) => select('company', e.target.value)}
                      options={companies.map((c) => ({ value: c.company_id, label: c.company_name + (c.synthetic ? ' (synthetic)' : '') }))}
                    />
                    <Button variant="primary" icon={current ? RotateCcw : Play} onClick={run} loading={running} disabled={!canRun}>
                      {current ? 'Rerun assessment' : 'Run assessment'}
                    </Button>
                  </div>
                ) : (
                  <div className="selector-row" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                    <SelectField
                      label="Candidate A"
                      value={profileExists ? profileId : ''}
                      placeholder="Choose Candidate A…"
                      onChange={(e) => select('profile', e.target.value)}
                      options={profiles.items.map((p) => ({ value: p.profile_id, label: p.name }))}
                    />
                    <SelectField
                      label="Candidate B"
                      value={profileBExists ? profileIdB : ''}
                      placeholder="Choose Candidate B…"
                      onChange={(e) => select('profile_b', e.target.value)}
                      options={profiles.items.map((p) => ({ value: p.profile_id, label: p.name }))}
                    />
                    <SelectField
                      label="Company"
                      value={company ? companyId : ''}
                      placeholder="Choose a company…"
                      onChange={(e) => select('company', e.target.value)}
                      options={companies.map((c) => ({ value: c.company_id, label: c.company_name + (c.synthetic ? ' (synthetic)' : '') }))}
                    />
                    <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                      <Button variant="primary" icon={Users} onClick={runCompare} loading={runningCompare} disabled={!canCompare} style={{ width: '100%' }}>
                        Compare candidates
                      </Button>
                    </div>
                  </div>
                )}
                {company?.missing_categories?.length > 0 && (
                  <p className="xsmall muted" style={{ marginTop: 12 }}>
                    The file has no level for {company.missing_categories.join(', ')} at {company.company_name}; those skillsets are shown as “Not in file” and excluded
                    from the score.
                  </p>
                )}
                {activeTab === 'single' && current && !running && (
                  <p className="xsmall muted row" style={{ marginTop: 12 }}>
                    <History size={13} aria-hidden="true" /> Showing the result from {formatRelative(current.created_at)}.
                  </p>
                )}
                {activeTab === 'compare' && profileId && profileIdB && profileId === profileIdB && (
                  <p className="xsmall muted" style={{ marginTop: 12, color: 'var(--color-warning)' }}>
                    Please select two different candidate profiles to compare.
                  </p>
                )}
              </CardBody>
            </Card>

            {error && <ErrorState error={error} title="Assessment failed" onRetry={activeTab === 'single' ? (canRun ? run : undefined) : (canCompare ? runCompare : undefined)} />}

            {activeTab === 'single' ? (
              running ? (
                <Card>
                  <LoadingState label="Estimating levels across 12 skillsets…" />
                </Card>
              ) : current ? (
                <TalentCheckResultView result={current} />
              ) : (
                profileExists &&
                company && (
                  <Card>
                    <EmptyState
                      icon={Gauge}
                      title="Ready to assess"
                      description="Run the assessment to see the readiness score and the 12-skillset gap breakdown."
                      actions={
                        <Button variant="primary" icon={Play} onClick={run}>
                          Run assessment
                        </Button>
                      }
                    />
                  </Card>
                )
              )
            ) : (
              runningCompare ? (
                <Card>
                  <LoadingState label="Comparing candidate levels and explaining 12-skillset gaps…" />
                </Card>
              ) : comparison ? (
                <CandidateComparisonView comparison={comparison} />
              ) : (
                profileExists &&
                profileBExists &&
                company && (
                  <Card>
                    <EmptyState
                      icon={Users}
                      title="Ready to compare candidates"
                      description="Click compare to see a side-by-side evaluation against company expectations across all 12 RADIX categories."
                      actions={
                        <Button variant="primary" icon={Users} onClick={runCompare} disabled={!canCompare}>
                          Compare candidates
                        </Button>
                      }
                    />
                  </Card>
                )
              )
            )}
          </>
        )}
      </div>
    </>
  );
}
