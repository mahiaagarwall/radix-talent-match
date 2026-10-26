import { useState } from 'react';
import { Server, FlaskConical, PlugZap, Sigma, Database, ShieldCheck, Download, Trash2, RotateCcw, Save } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { Card, CardHeader, CardBody, CardFooter } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/ui/Alert';
import { Badge } from '../components/ui/Badges';
import { TextField } from '../components/ui/Fields';
import { Segmented } from '../components/ui/Segmented';
import { API_BASE_URL, DEFAULT_DATA_MODE, ENDPOINTS } from '../app/config';
import { setDataMode } from '../services/mode';
import { checkHealth } from '../services/apiClient';
import { getScoringSettings, saveScoringSettings, resetScoringSettings, validateScoringSettings } from '../services/settingsService';
import { loadSampleWorkspace, resetDemoData } from '../services/sampleWorkspace';
import { useAppData } from '../context/AppDataContext';
import { useToast } from '../context/ToastContext';

export default function Settings() {
  const { mode, profiles, jds, results, refreshAll } = useAppData();
  const { notify } = useToast();
  const [health, setHealth] = useState({ status: 'idle' });
  const [scoring, setScoring] = useState(getScoringSettings);
  const [scoringErrors, setScoringErrors] = useState({});

  const switchMode = (next) => {
    if (next === mode) return;
    setDataMode(next);
    setHealth({ status: 'idle' });
    notify(next === 'api' ? `Switched to API mode — requests now go to ${API_BASE_URL}.` : 'Switched to demo mode — local data and fixtures.', { tone: 'info' });
  };

  const testConnection = async () => {
    setHealth({ status: 'loading' });
    try {
      const res = await checkHealth();
      setHealth({ status: 'ok', ...res });
    } catch (err) {
      setHealth({ status: 'error', message: err.message });
    }
  };

  const updateScoring = (patch) => {
    const next = { ...scoring, ...patch, weights: { ...scoring.weights, ...(patch.weights || {}) } };
    setScoring(next);
    setScoringErrors(validateScoringSettings(next));
  };

  const saveScoring = () => {
    try {
      saveScoringSettings(scoring);
      setScoringErrors({});
      notify('Scoring parameters saved. They apply to new Skill Matching runs only.', { tone: 'success' });
    } catch (err) {
      setScoringErrors(err.details || {});
    }
  };

  const exportData = () => {
    const blob = new Blob(
      [JSON.stringify({ exported_at: new Date().toISOString(), mode, profiles: profiles.items, job_descriptions: jds.items, results: results.items }, null, 2)],
      { type: 'application/json' },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `radix-talent-match-${mode}-export.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const reset = async () => {
    if (!window.confirm('Delete all profiles, job descriptions, results, imported requirements and preferences stored in this browser? This cannot be undone.')) return;
    resetDemoData();
    setScoring(getScoringSettings());
    await refreshAll();
    notify('All local demo data was removed.', { tone: 'info' });
  };

  const loadSamples = async () => {
    try {
      const n = loadSampleWorkspace();
      await refreshAll();
      notify(`Loaded ${n.profiles} sample candidates and ${n.jds} sample job descriptions.`, { tone: 'success' });
    } catch (err) {
      notify(err.message, { tone: 'error' });
    }
  };

  const num = (v) => (v === '' ? NaN : Number(v));

  return (
    <>
      <PageHeader title="Settings" description="Data mode, backend connection, demo scoring parameters, and local data management." />
      <div className="grid grid--2 settings-grid">
        <Card>
          <CardHeader icon={mode === 'demo' ? FlaskConical : Server} title="Data mode" subtitle={`Default from environment: ${DEFAULT_DATA_MODE}`} />
          <CardBody>
            <Segmented
              label="Data mode"
              value={mode}
              onChange={switchMode}
              options={[
                { value: 'demo', label: 'Demo (local)' },
                { value: 'api', label: 'API (FastAPI)' },
              ]}
            />
            <div className="stack stack--sm" style={{ marginTop: 16 }}>
              {mode === 'demo' ? (
                <Alert tone="demo" title="Demo mode is active">
                  Records live in this browser’s localStorage. Resume and JD extraction use hand-annotated fixtures for the supplied sample pack only. Nothing is sent to
                  FastAPI or Supabase.
                </Alert>
              ) : (
                <Alert tone="info" title="API mode is active">
                  Every read and write goes to the FastAPI backend. If a request fails, the error is shown — the app never falls back to demo data.
                </Alert>
              )}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader icon={PlugZap} title="Backend connection" subtitle="Configured with VITE_API_BASE_URL" />
          <CardBody>
            <dl className="kv">
              <dt>Base URL</dt>
              <dd className="mono">{API_BASE_URL}</dd>
              <dt>Health check</dt>
              <dd className="mono">GET {ENDPOINTS.health}</dd>
              <dt>Status</dt>
              <dd role="status" aria-live="polite">
                {health.status === 'idle' && <Badge tone="neutral">Not tested</Badge>}
                {health.status === 'loading' && <Badge tone="neutral">Testing…</Badge>}
                {health.status === 'ok' && <Badge tone="success">Connected · {health.latencyMs} ms</Badge>}
                {health.status === 'error' && <Badge tone="error">Unreachable</Badge>}
              </dd>
            </dl>
            {health.status === 'error' && (
              <p className="small" style={{ marginTop: 12, color: 'var(--error-text)' }}>
                {health.message}
              </p>
            )}
          </CardBody>
          <CardFooter>
            <Button icon={PlugZap} onClick={testConnection} loading={health.status === 'loading'}>
              Test connection
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader icon={Sigma} title="Skill Matching parameters" subtitle="Demo defaults — the team guide says weights must be agreed by the team." />
          <CardBody>
            <p className="mono small" style={{ marginBottom: 16 }}>
              Match Score = 100 × Σ(weight × match value) / Σ(weight)
            </p>
            <div className="form-grid form-grid--3">
              <TextField
                label="Partial match value"
                type="number"
                step="0.05"
                min="0.05"
                max="0.95"
                value={Number.isNaN(scoring.partial_value) ? '' : scoring.partial_value}
                error={scoringErrors.partial_value}
                hint="Matched = 1, missing = 0"
                onChange={(e) => updateScoring({ partial_value: num(e.target.value) })}
              />
              <TextField
                label="Required weight"
                type="number"
                step="0.5"
                min="0.5"
                value={Number.isNaN(scoring.weights.required) ? '' : scoring.weights.required}
                error={scoringErrors.required}
                onChange={(e) => updateScoring({ weights: { required: num(e.target.value) } })}
              />
              <TextField
                label="Preferred weight"
                type="number"
                step="0.25"
                min="0"
                value={Number.isNaN(scoring.weights.preferred) ? '' : scoring.weights.preferred}
                error={scoringErrors.preferred}
                onChange={(e) => updateScoring({ weights: { preferred: num(e.target.value) } })}
              />
            </div>
            <p className="xsmall muted" style={{ marginTop: 12 }}>
              Applies to demo-mode runs; each result stores the parameters it used. In API mode the backend’s scoring rules apply.
            </p>
          </CardBody>
          <CardFooter>
            <Button
              variant="ghost"
              icon={RotateCcw}
              onClick={() => {
                setScoring(resetScoringSettings());
                setScoringErrors({});
              }}
            >
              Reset defaults
            </Button>
            <Button variant="primary" icon={Save} onClick={saveScoring} disabled={Object.keys(scoringErrors).length > 0}>
              Save parameters
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader icon={Database} title="Local demo data" subtitle={`${profiles.items.length} profiles · ${jds.items.length} JDs · ${results.items.length} results`} />
          <CardBody>
            <p className="small muted">
              The sample pack contains the 4 supplied candidates and 6 supplied job descriptions, hand-annotated from the hackathon files and labelled as fixtures.
              Loading it again updates the same records instead of duplicating them.
            </p>
          </CardBody>
          <CardFooter>
            <Button icon={Download} onClick={exportData}>
              Export JSON
            </Button>
            {mode === 'demo' && (
              <>
                <Button icon={Database} onClick={loadSamples}>
                  Load sample pack
                </Button>
                <Button variant="danger" icon={Trash2} onClick={reset}>
                  Reset local data
                </Button>
              </>
            )}
          </CardFooter>
        </Card>

        <Card className="span-all">
          <CardHeader icon={ShieldCheck} title="Data and privacy" />
          <CardBody>
            <ul className="bullets small">
              <li>Demo mode keeps resumes’ extracted data in this browser only. Uploaded files are validated locally and never uploaded in demo mode.</li>
              <li>In API mode, files go to the FastAPI backend, which is responsible for storing them in Supabase Storage and returning a reference.</li>
              <li>Extraction confidence describes evidence quality, not candidate proficiency. Talent Check levels are estimates and are labelled as such.</li>
              <li>No authentication is implemented in this frontend; do not load real candidate data into a shared demo machine.</li>
            </ul>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
