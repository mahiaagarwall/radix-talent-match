import { useState } from 'react';
import {
  FileSearch,
  ClipboardList,
  CheckCircle2,
  CircleDashed,
  XCircle,
  HelpCircle,
  Copy,
  Check,
  X,
  ListChecks,
  ShieldCheck,
  MessageCircleQuestion,
} from 'lucide-react';
import { Card, CardHeader, CardBody } from '../ui/Card';
import { Button } from '../ui/Button';
import { Alert } from '../ui/Alert';
import { Badge } from '../ui/Badges';
import { ScoreRing } from '../ui/ScoreRing';
import { Segmented } from '../ui/Segmented';
import { SelectField, TextAreaField } from '../ui/Fields';
import { FileDropzone, FileChip } from '../ui/FileDropzone';
import { LoadingState, ErrorState } from '../ui/States';
import { resumeCoachService, jdRecordText, GAP_RESUME_EXTENSIONS } from '../../services/resumeCoachService';

const CLASSES = [
  { key: 'matched', label: 'Matched', tone: 'success', icon: CheckCircle2, hint: 'Explicitly supported by resume evidence.' },
  { key: 'partial', label: 'Partially matched', tone: 'warning', icon: CircleDashed, hint: 'Related evidence, but not a full demonstration.' },
  { key: 'missing', label: 'Missing from resume', tone: 'error', icon: XCircle, hint: 'Not demonstrated by this resume — not proof the skill is absent.' },
  { key: 'unverified', label: 'Unverified', tone: 'neutral', icon: HelpCircle, hint: 'Not enough information to decide either way.' },
];

const GAP_LABEL = { skill_gap: 'Skill gap', presentation_gap: 'Presentation gap', information_gap: 'Needs information' };

const PRIORITIES = {
  1: 'Priority 1 · Mandatory requirements not demonstrated',
  2: 'Priority 2 · Relevant experience that is poorly presented',
  3: 'Priority 3 · Preferred qualifications and optional improvements',
};

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function RequirementItem({ r }) {
  return (
    <li style={{ padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 14 }}>{r.requirement}</strong>
        <Badge tone={r.importance === 'mandatory' ? 'indigo' : 'outline'}>{r.importance === 'mandatory' ? 'Mandatory' : 'Preferred'}</Badge>
        {GAP_LABEL[r.gap_type] && <Badge tone="neutral">{GAP_LABEL[r.gap_type]}</Badge>}
      </div>
      {r.jd_evidence && <p className="xsmall muted" style={{ marginTop: 4 }}>Job description: “{r.jd_evidence}”</p>}
      {r.resume_evidence.length > 0 && (
        <ul style={{ margin: '4px 0 0', paddingLeft: 18, fontSize: 12 }}>
          {r.resume_evidence.map((q) => (
            <li key={q}>
              Resume{r.resume_section ? ` (${r.resume_section})` : ''}: “{q}”
            </li>
          ))}
        </ul>
      )}
      {r.missing_information && <p className="small" style={{ marginTop: 4 }}>Missing evidence: {r.missing_information}</p>}
      {r.next_step && <p className="small" style={{ marginTop: 2 }}>Next step: {r.next_step}</p>}
      {r.note && <p className="xsmall muted" style={{ marginTop: 2 }}>{r.note}</p>}
    </li>
  );
}

function Suggestion({ s, state, onChange }) {
  const [copied, setCopied] = useState(false);
  const text = state.text;
  return (
    <div style={{ padding: 12, border: '1px solid var(--border-subtle)', borderRadius: 8 }}>
      <div className="row row--between" style={{ marginBottom: 6 }}>
        <span className="xsmall muted">Original resume text</span>
        {state.status !== 'pending' && <Badge tone={state.status === 'accepted' ? 'success' : 'neutral'}>{state.status === 'accepted' ? 'Accepted' : 'Rejected'}</Badge>}
      </div>
      <p className="small" style={{ color: 'var(--text-secondary)' }}>“{s.original_text}”</p>
      <p className="small" style={{ marginTop: 8 }}>
        <strong>Problem:</strong> {s.problem}
      </p>
      <p className="small">
        <strong>Recommendation:</strong> {s.recommendation}
      </p>
      <TextAreaField
        label="Improved example (editable)"
        rows={2}
        value={text}
        onChange={(e) => onChange({ ...state, text: e.target.value })}
        disabled={state.status === 'rejected'}
      />
      {s.alignment && <p className="xsmall muted">Why it helps: {s.alignment}</p>}
      {s.follow_up_question && <p className="xsmall" style={{ marginTop: 4 }}>To strengthen it further, answer: {s.follow_up_question}</p>}
      <div className="row" style={{ gap: 6, marginTop: 8 }}>
        <Button
          size="sm"
          variant="secondary"
          icon={copied ? Check : Copy}
          onClick={async () => {
            if (await copyText(text)) {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </Button>
        <Button size="sm" variant={state.status === 'accepted' ? 'primary' : 'secondary'} icon={Check} onClick={() => onChange({ ...state, status: 'accepted' })}>
          Accept
        </Button>
        <Button size="sm" variant="ghost" icon={X} onClick={() => onChange({ ...state, status: 'rejected' })}>
          Reject
        </Button>
      </div>
    </div>
  );
}

function Results({ result }) {
  const [view, setView] = useState('all');
  const [suggestions, setSuggestions] = useState(() => result.bullet_improvements.map((s) => ({ status: 'pending', text: s.improved_example })));
  const [copiedAll, setCopiedAll] = useState(false);
  const accepted = suggestions.filter((s) => s.status === 'accepted');
  const shown = view === 'all' ? CLASSES : CLASSES.filter((c) => c.key === view);
  const plan = [1, 2, 3].map((p) => ({ p, items: result.action_plan.filter((a) => a.priority === p) })).filter((g) => g.items.length);

  return (
    <div className="stack">
      <Card>
        <CardHeader icon={ClipboardList} title="Alignment with this job" subtitle={`${result.resume.label} vs. ${result.job.label}`} />
        <CardBody>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center' }}>
            <ScoreRing score={result.alignment.score} size={110} label="Resume-to-job alignment" />
            <div style={{ flex: 1, minWidth: 240 }}>
              {result.summary && <p style={{ marginBottom: 8 }}>{result.summary}</p>}
              <p className="small">{result.alignment.explanation}</p>
              <p className="xsmall muted" style={{ marginTop: 4 }}>Method: {result.alignment.method}</p>
              <div className="row" style={{ gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                {CLASSES.map((c) => (
                  <Badge key={c.key} tone={c.tone} icon={c.icon}>
                    {result.counts[c.key]} {c.label.toLowerCase()}
                  </Badge>
                ))}
                <Badge tone="outline">
                  {result.counts.mandatory} mandatory · {result.counts.preferred} preferred
                </Badge>
              </div>
            </div>
          </div>
          <p className="xsmall muted" style={{ marginTop: 12 }}>{result.disclaimer}</p>
        </CardBody>
      </Card>

      {result.safeguards.notes.length > 0 && (
        <Alert tone="info" title="Checked against your documents">
          <ul>
            {result.safeguards.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </Alert>
      )}

      <Card>
        <CardHeader
          icon={ListChecks}
          title="Requirement-by-requirement comparison"
          actions={
            <Segmented
              label="Filter requirements"
              value={view}
              onChange={setView}
              options={[{ value: 'all', label: 'All', count: result.requirements.length }, ...CLASSES.map((c) => ({ value: c.key, label: c.label, count: result.counts[c.key] }))]}
            />
          }
        />
        <CardBody>
          {shown.map((c) => {
            const items = result.requirements.filter((r) => r.classification === c.key);
            if (!items.length) return null;
            return (
              <section key={c.key} style={{ marginBottom: 12 }} aria-label={c.label}>
                <h3 className="row" style={{ gap: 6, fontSize: 14 }}>
                  <c.icon size={15} aria-hidden="true" /> {c.label} ({items.length})
                </h3>
                <p className="xsmall muted">{c.hint}</p>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {items.map((r) => (
                    <RequirementItem key={r.requirement} r={r} />
                  ))}
                </ul>
              </section>
            );
          })}
        </CardBody>
      </Card>

      {plan.length > 0 && (
        <Card>
          <CardHeader icon={ListChecks} title="Prioritized action plan" />
          <CardBody>
            {plan.map(({ p, items }) => (
              <div key={p} style={{ marginBottom: 10 }}>
                <p className="strong small">{PRIORITIES[p]}</p>
                <ul style={{ paddingLeft: 18, fontSize: 13 }}>
                  {items.map((a, i) => (
                    <li key={i}>
                      {a.action}
                      {a.requirement ? <span className="muted"> ({a.requirement})</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <p className="xsmall muted">Learning and project suggestions are future work, not existing qualifications — add them to the resume only once done.</p>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader
          icon={ShieldCheck}
          title="Evidence-based resume improvements"
          subtitle="Suggestions only. Your uploaded resume and saved profile are never changed."
          actions={
            accepted.length > 0 && (
              <Button
                size="sm"
                variant="secondary"
                icon={copiedAll ? Check : Copy}
                onClick={async () => {
                  if (await copyText(accepted.map((s) => `• ${s.text}`).join('\n'))) {
                    setCopiedAll(true);
                    setTimeout(() => setCopiedAll(false), 2000);
                  }
                }}
              >
                {copiedAll ? 'Copied' : `Copy ${accepted.length} accepted`}
              </Button>
            )
          }
        />
        <CardBody>
          {result.bullet_improvements.length === 0 ? (
            <p className="small muted">No rewrite suggestions passed the evidence checks for this resume.</p>
          ) : (
            <div className="stack">
              {result.bullet_improvements.map((s, i) => (
                <Suggestion
                  key={i}
                  s={s}
                  state={suggestions[i]}
                  onChange={(next) => setSuggestions((all) => all.map((x, j) => (j === i ? next : x)))}
                />
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {result.follow_up_questions.length > 0 && (
        <Card>
          <CardHeader icon={MessageCircleQuestion} title="Questions that would strengthen the analysis" />
          <CardBody>
            <ul style={{ paddingLeft: 18, fontSize: 13 }}>
              {result.follow_up_questions.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}
      <p className="xsmall muted">Analyzed by {result.model_used}.</p>
    </div>
  );
}

export function GapAnalysis({ jds }) {
  const [inputMode, setInputMode] = useState('file');
  const [file, setFile] = useState(null);
  const [resumeText, setResumeText] = useState('');
  const [jdId, setJdId] = useState('');
  const [jdText, setJdText] = useState('');
  const [state, setState] = useState({ loading: false, error: null, result: null, run: 0 });

  const hasResume = inputMode === 'file' ? Boolean(file) : resumeText.trim().length > 0;
  const canAnalyze = hasResume && jdText.trim().length > 0 && !state.loading;

  const loadJd = (id) => {
    setJdId(id);
    const jd = jds.find((j) => j.jd_id === id);
    if (jd) setJdText(jdRecordText(jd));
  };

  const analyze = async () => {
    setState((s) => ({ ...s, loading: true, error: null, result: null }));
    try {
      const result = await resumeCoachService.analyzeGap({
        file: inputMode === 'file' ? file : null,
        resumeText: inputMode === 'text' ? resumeText : '',
        jdText,
      });
      setState((s) => ({ loading: false, error: null, result, run: s.run + 1 }));
    } catch (error) {
      setState((s) => ({ ...s, loading: false, error, result: null }));
    }
  };

  return (
    <div className="stack">
      <Card>
        <CardHeader icon={FileSearch} title="Compare a resume with one job" subtitle="The backend's configured LLM compares every stated requirement with evidence in the resume." />
        <CardBody>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
            <div className="stack">
              <div className="row row--between">
                <span className="strong small">Resume</span>
                <Segmented
                  label="Resume input"
                  value={inputMode}
                  onChange={setInputMode}
                  options={[
                    { value: 'file', label: 'Upload file' },
                    { value: 'text', label: 'Paste text' },
                  ]}
                />
              </div>
              {inputMode === 'file' ? (
                file ? (
                  <FileChip file={file} onRemove={() => setFile(null)} />
                ) : (
                  <FileDropzone
                    onFile={setFile}
                    accept={GAP_RESUME_EXTENSIONS.join(',')}
                    hint="PDF, DOCX or TXT, up to 10 MB. Scanned (image-only) PDFs cannot be read."
                    inputLabel="Upload a resume"
                  />
                )
              ) : (
                <TextAreaField label="Resume text" rows={10} value={resumeText} onChange={(e) => setResumeText(e.target.value)} placeholder="Paste the full resume text…" />
              )}
            </div>
            <div className="stack">
              <span className="strong small">Target job description</span>
              {jds.length > 0 && (
                <SelectField
                  label="Load a saved job description (optional)"
                  value={jdId}
                  placeholder="Choose a saved JD…"
                  onChange={(e) => loadJd(e.target.value)}
                  options={jds.map((j) => ({ value: j.jd_id, label: `${j.company} — ${j.role}` }))}
                  hint={jdId ? 'Loaded from the saved record. You can edit it before analyzing.' : undefined}
                />
              )}
              <TextAreaField
                label="Job description text"
                rows={10}
                value={jdText}
                onChange={(e) => setJdText(e.target.value)}
                placeholder="Paste the specific job posting you are applying for…"
              />
            </div>
          </div>
          <Button variant="primary" icon={FileSearch} onClick={analyze} loading={state.loading} disabled={!canAnalyze} style={{ marginTop: 16 }}>
            Analyze resume against this job
          </Button>
        </CardBody>
      </Card>

      {state.loading ? (
        <Card>
          <LoadingState label="Comparing each requirement with your resume…" />
        </Card>
      ) : state.error ? (
        <ErrorState error={state.error} title="Gap analysis failed" onRetry={canAnalyze ? analyze : undefined} />
      ) : state.result ? (
        <Results key={state.run} result={state.result} />
      ) : null}
    </div>
  );
}
