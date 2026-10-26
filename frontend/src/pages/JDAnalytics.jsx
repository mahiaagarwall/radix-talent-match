import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  BriefcaseBusiness,
  ScanText,
  Save,
  Pencil,
  X,
  Trash2,
  GitCompareArrows,
  Plus,
  ArrowRight,
  FileText,
  RotateCcw,
} from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { DemoNotice } from '../components/layout/DemoNotice';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/ui/Alert';
import { Badge, DemoBadge } from '../components/ui/Badges';
import { TextField, TextAreaField } from '../components/ui/Fields';
import { Segmented } from '../components/ui/Segmented';
import { FileDropzone, FileChip } from '../components/ui/FileDropzone';
import { ProcessingSteps } from '../components/ui/ProcessingSteps';
import { LoadingState, ErrorState } from '../components/ui/States';
import { JdEditor } from '../components/jd/JdEditor';
import { JdRequirementsView } from '../components/jd/JdRequirementsView';
import { JdList } from '../components/jd/JdList';
import { jdService } from '../services/jdService';
import { useAppData } from '../context/AppDataContext';
import { useToast } from '../context/ToastContext';
import { validateJd } from '../utils/validation';
import { formatDate } from '../utils/format';

const SOURCE_LABELS = {
  'sample-fixture': { label: 'Demo fixture', demo: true },
  'keyword-scan': { label: 'Demo keyword scan', demo: true },
  manual: { label: 'Manual entry', demo: false },
  api: { label: 'FastAPI extractor', demo: false },
};

function SourceBadge({ kind }) {
  const meta = SOURCE_LABELS[kind] || { label: kind || 'Unknown', demo: false };
  return meta.demo ? <DemoBadge>{meta.label}</DemoBadge> : <Badge tone="indigo">{meta.label}</Badge>;
}

export default function JDAnalytics() {
  const { jdId } = useParams();
  return jdId ? <JdDetail jdId={jdId} /> : <JdAnalyze />;
}

function useSaveJd() {
  const { mode, reloadJds, setActiveJdId } = useAppData();
  const { notify } = useToast();
  return async (draft) => {
    const saved = await jdService.save(draft);
    await reloadJds();
    setActiveJdId(saved.jd_id);
    notify(`Saved "${saved.role}" to ${mode === 'demo' ? 'local demo storage' : 'the backend'}.`, { tone: 'success' });
    return saved;
  };
}

function JdAnalyze() {
  const navigate = useNavigate();
  const { mode, jds, reloadJds } = useAppData();
  const saveJd = useSaveJd();
  const [inputMode, setInputMode] = useState('file');
  const [file, setFile] = useState(null);
  const [text, setText] = useState('');
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('idle');
  const [outcome, setOutcome] = useState(null);
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState(null);
  const [inputErrors, setInputErrors] = useState({});
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const begin = (res) => {
    setOutcome(res);
    setDraft(res.draft);
    setStatus('review');
    setShowErrors(false);
  };

  const run = async (fn) => {
    setError(null);
    setStatus('processing');
    try {
      begin(await fn());
    } catch (err) {
      setError(err);
      setStatus('error');
    }
  };

  const analyzeFile = (f) => {
    setFile(f);
    run(() => jdService.analyzeFile(f, { company, role }));
  };

  const analyzeText = () => {
    const errs = {};
    if (text.trim().length < 40) errs.text = 'Paste the full job description text (at least a few sentences).';
    if (!company.trim()) errs.company = 'Company is required for pasted text.';
    if (!role.trim()) errs.role = 'Job title is required for pasted text.';
    setInputErrors(errs);
    if (Object.keys(errs).length) return;
    run(() => jdService.analyzeText({ text, company, role }));
  };

  const reset = () => {
    setStatus('idle');
    setOutcome(null);
    setDraft(null);
    setError(null);
    setFile(null);
    setSaveError(null);
  };

  const save = async () => {
    setShowErrors(true);
    setSaveError(null);
    if (!validateJd(draft).valid) return;
    setSaving(true);
    try {
      const saved = await saveJd(draft);
      navigate(`/jd-analytics/${saved.jd_id}`);
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const validation = draft ? validateJd(draft) : { errors: {} };

  return (
    <>
      <PageHeader
        eyebrow="Step 1 · JD Analytics"
        title="JD Analytics"
        description="Turn a job description into a normalized list of required skills — each with one RADIX category, an evidence phrase and an extraction confidence."
        owner="Krishna Pandey"
        actions={
          status !== 'idle' && (
            <Button icon={RotateCcw} onClick={reset}>
              Start over
            </Button>
          )
        }
      />
      <div className="grid grid--sidebar">
        <div className="stack">
          <DemoNotice>
            Uploaded sample-pack JDs load hand-annotated fixtures. Pasted text uses a simple, clearly labelled keyword scan — not the LLM extractor planned for the
            backend.
          </DemoNotice>

          {status !== 'review' && (
            <Card>
              <CardHeader
                icon={ScanText}
                title="Analyze a job description"
                actions={
                  <Segmented
                    label="Input method"
                    value={inputMode}
                    onChange={setInputMode}
                    options={[
                      { value: 'file', label: 'Upload file' },
                      { value: 'text', label: 'Paste text' },
                    ]}
                  />
                }
              />
              <CardBody>
                <div className="stack stack--sm">
                  <div className="form-grid">
                    <TextField
                      label="Job title"
                      required={inputMode === 'text'}
                      value={role}
                      error={inputErrors.role}
                      placeholder="e.g. Software Engineer"
                      onChange={(e) => setRole(e.target.value)}
                      hint={inputMode === 'file' ? 'Optional — overrides the detected title.' : undefined}
                    />
                    <TextField
                      label="Company"
                      required={inputMode === 'text'}
                      value={company}
                      error={inputErrors.company}
                      placeholder="e.g. Google LLC"
                      onChange={(e) => setCompany(e.target.value)}
                      hint={inputMode === 'file' ? 'Optional — overrides the detected company.' : undefined}
                    />
                  </div>
                  {status === 'processing' ? (
                    <div className="stack stack--sm">
                      {file && inputMode === 'file' && <FileChip file={file} />}
                      <ProcessingSteps
                        steps={
                          mode === 'api'
                            ? ['Validating input', 'Uploading to JD analyzer', 'Extracting and categorising skills', 'Deduplicating']
                            : inputMode === 'file'
                              ? ['Validating file', 'Looking up sample-pack fixture', 'Preparing review']
                              : ['Splitting sentences', 'Scanning for known skill terms', 'Deduplicating']
                        }
                      />
                    </div>
                  ) : inputMode === 'file' ? (
                    <>
                      <FileDropzone onFile={analyzeFile} title="Drop a job description here" inputLabel="Upload job description file" />
                      {file && <FileChip file={file} onRemove={reset} />}
                    </>
                  ) : (
                    <>
                      <TextAreaField
                        label="Job description text"
                        required
                        rows={10}
                        value={text}
                        error={inputErrors.text}
                        placeholder="Paste the full JD, including the responsibilities and requirements sections."
                        onChange={(e) => setText(e.target.value)}
                      />
                      <div className="row" style={{ justifyContent: 'flex-end' }}>
                        <Button variant="primary" icon={ScanText} onClick={analyzeText}>
                          Analyze text
                        </Button>
                      </div>
                    </>
                  )}
                  {status === 'error' && error && (
                    <Alert
                      tone={error.code === 'demo_unavailable' ? 'warning' : 'error'}
                      title={
                        error.code === 'demo_unavailable'
                          ? "This file can't be analyzed in demo mode"
                          : error.code === 'unreadable'
                            ? 'Unreadable file'
                            : error.code === 'unsupported'
                              ? 'Unsupported file'
                              : 'Analysis failed'
                      }
                      actions={
                        error.code === 'demo_unavailable' && (
                          <Button size="sm" onClick={() => { setInputMode('text'); setStatus('idle'); }}>
                            Paste text instead
                          </Button>
                        )
                      }
                    >
                      {error.message}
                    </Alert>
                  )}
                </div>
              </CardBody>
            </Card>
          )}

          {status === 'review' && draft && (
            <>
              <Card>
                <CardBody>
                  <div className="row row--between">
                    <div className="row">
                      <Badge tone="success">Analysis ready for review</Badge>
                      <SourceBadge kind={draft.source_kind} />
                      <span className="small muted">{draft.skills.length} skills extracted</span>
                    </div>
                    <Button variant="primary" icon={Save} onClick={save} loading={saving}>
                      Save job description
                    </Button>
                  </div>
                  {outcome?.notice && (
                    <p className="small muted" style={{ marginTop: 12 }}>
                      {outcome.notice}
                    </p>
                  )}
                </CardBody>
              </Card>
              <JdEditor jd={draft} onChange={setDraft} errors={showErrors ? validation.errors : {}} />
              {saveError && <Alert tone="error" title="Not saved">{saveError}</Alert>}
              {showErrors && !validation.valid && <Alert tone="error" title="Not saved">Fix the highlighted fields before saving.</Alert>}
              <div className="row" style={{ justifyContent: 'flex-end' }}>
                <Button icon={X} onClick={reset}>
                  Discard
                </Button>
                <Button variant="primary" icon={Save} onClick={save} loading={saving}>
                  Save job description
                </Button>
              </div>
            </>
          )}
        </div>

        <div className="stack sticky-col">
          <JdList jds={jds} onRetry={reloadJds} />
          {mode === 'demo' && (
            <Card>
              <CardHeader icon={FileText} title="Supplied sample JDs" subtitle="Six roles across three companies" />
              <CardBody flush>
                <ul>
                  {jdService.sampleList().map((s) => (
                    <li key={s.key}>
                      <button type="button" className="list-item" onClick={() => begin(jdService.loadSampleDraft(s.key))}>
                        <div className="list-item__main">
                          <p className="list-item__title">{s.role}</p>
                          <p className="list-item__meta">{s.company}</p>
                        </div>
                        <ArrowRight size={16} aria-hidden="true" color="var(--text-muted)" />
                      </button>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function JdDetail({ jdId }) {
  const navigate = useNavigate();
  const { mode, jds, reloadJds, setActiveJdId, activeJdId } = useAppData();
  const { notify } = useToast();
  const saveJd = useSaveJd();
  const [jd, setJd] = useState(null);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(null);
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setJd(null);
    setError(null);
    setEditing(false);
    jdService
      .get(jdId)
      .then((j) => {
        if (cancelled) return;
        setJd(j);
        setActiveJdId(j.jd_id);
      })
      .catch((err) => !cancelled && setError(err));
    return () => {
      cancelled = true;
    };
  }, [jdId, reloadKey, setActiveJdId]);

  const startEdit = () => {
    setDraft(JSON.parse(JSON.stringify(jd)));
    setEditing(true);
    setShowErrors(false);
    setSaveError(null);
  };

  const save = async () => {
    setShowErrors(true);
    if (!validateJd(draft).valid) return;
    setSaving(true);
    setSaveError(null);
    try {
      const saved = await saveJd(draft);
      setJd(saved);
      setEditing(false);
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete "${jd.role}" from local demo storage? Results that reference it are kept.`)) return;
    try {
      await jdService.remove(jd.jd_id);
      await reloadJds();
      if (activeJdId === jd.jd_id) setActiveJdId(null);
      notify('Job description deleted.', { tone: 'info' });
      navigate('/jd-analytics');
    } catch (err) {
      notify(err.message, { tone: 'error' });
    }
  };

  const validation = draft ? validateJd(draft) : { errors: {} };

  return (
    <>
      <PageHeader
        eyebrow="JD Analytics · Saved job description"
        title={jd ? jd.role : 'Job description'}
        description={jd ? `${jd.company}${jd.location ? ` · ${jd.location}` : ''}` : 'Loading the analyzed job description.'}
        owner="Krishna Pandey"
        actions={
          jd && !editing ? (
            <>
              <Button icon={Plus} to="/jd-analytics">
                Analyze another
              </Button>
              <Button icon={Pencil} onClick={startEdit}>
                Edit
              </Button>
              <Button variant="primary" icon={GitCompareArrows} to={`/skill-matching?jd=${jd.jd_id}`}>
                Match a candidate
              </Button>
            </>
          ) : null
        }
      />
      <div className="grid grid--sidebar">
        <div className="stack">
          {error ? (
            <ErrorState error={error} title="Could not load this job description" onRetry={() => setReloadKey((k) => k + 1)} />
          ) : !jd ? (
            <Card>
              <LoadingState label="Loading job description…" />
            </Card>
          ) : editing ? (
            <>
              <JdEditor jd={draft} onChange={setDraft} errors={showErrors ? validation.errors : {}} />
              {saveError && <Alert tone="error" title="Not saved">{saveError}</Alert>}
              <div className="row" style={{ justifyContent: 'flex-end' }}>
                <Button icon={X} onClick={() => setEditing(false)}>
                  Cancel
                </Button>
                <Button variant="primary" icon={Save} onClick={save} loading={saving}>
                  Save changes
                </Button>
              </div>
            </>
          ) : (
            <>
              <Card>
                <CardHeader icon={BriefcaseBusiness} title="Job metadata" actions={<SourceBadge kind={jd.source_kind} />} />
                <CardBody>
                  <dl className="kv">
                    <dt>JD ID</dt>
                    <dd className="mono">{jd.jd_id}</dd>
                    <dt>Company</dt>
                    <dd>{jd.company}</dd>
                    <dt>Role</dt>
                    <dd>{jd.role}</dd>
                    {jd.role_category && (
                      <>
                        <dt>Role category</dt>
                        <dd>{jd.role_category}</dd>
                      </>
                    )}
                    {jd.location && (
                      <>
                        <dt>Location</dt>
                        <dd>{jd.location}</dd>
                      </>
                    )}
                    <dt>Source</dt>
                    <dd>{jd.source_file || 'Manual entry'}</dd>
                    <dt>Experience</dt>
                    <dd>{jd.experience_requirements || 'Not stated in the JD'}</dd>
                    <dt>Education</dt>
                    <dd>{jd.education_requirements || 'Not stated in the JD'}</dd>
                    <dt>Updated</dt>
                    <dd>{formatDate(jd.updated_at, { withTime: true })}</dd>
                  </dl>
                </CardBody>
              </Card>
              <JdRequirementsView jd={jd} />
              {mode === 'demo' && (
                <div>
                  <Button variant="danger" size="sm" icon={Trash2} onClick={remove}>
                    Delete job description
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
        <div className="stack sticky-col">
          <JdList jds={jds} activeId={jdId} onRetry={reloadJds} />
        </div>
      </div>
    </>
  );
}
