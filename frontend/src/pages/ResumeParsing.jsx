import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, FileSearch, RotateCcw, UserPlus, FileText } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { DemoNotice } from '../components/layout/DemoNotice';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/ui/Alert';
import { DemoBadge, Badge } from '../components/ui/Badges';
import { FileDropzone, FileChip } from '../components/ui/FileDropzone';
import { ProcessingSteps } from '../components/ui/ProcessingSteps';
import { EmptyState } from '../components/ui/States';
import { ParsedResumeView } from '../components/resume/ParsedResumeView';
import { resumeService } from '../services/resumeService';
import { emptyProfile, profileFromParsedResume } from '../services/profileService';
import { useAppData } from '../context/AppDataContext';
import { useToast } from '../context/ToastContext';
import { fileMeta } from '../utils/fileValidation';

const STEPS_API = ['Validating file', 'Uploading to resume parser', 'Extracting fields and skills', 'Normalizing to shared contract'];
const STEPS_DEMO = ['Validating file', 'Looking up sample-pack fixture', 'Preparing review'];

export default function ResumeParsing() {
  const { mode, setResumeDraft } = useAppData();
  const { notify } = useToast();
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | processing | done | error
  const [outcome, setOutcome] = useState(null);
  const [error, setError] = useState(null);

  const handleOutcome = (res) => {
    setOutcome(res);
    setStatus('done');
  };

  const parseFile = async (f) => {
    setFile(f);
    setOutcome(null);
    setError(null);
    setStatus('processing');
    try {
      handleOutcome(await resumeService.parse(f));
    } catch (err) {
      setError(err);
      setStatus('error');
    }
  };

  const loadSample = async (key) => {
    setFile(null);
    setError(null);
    setStatus('processing');
    try {
      handleOutcome(await resumeService.loadSample(key));
    } catch (err) {
      setError(err);
      setStatus('error');
    }
  };

  const reset = () => {
    setFile(null);
    setOutcome(null);
    setError(null);
    setStatus('idle');
  };

  const continueToProfile = () => {
    setResumeDraft({
      profile: profileFromParsedResume(outcome.parsed, outcome.resumeReference),
      origin: outcome.origin,
      notice: outcome.notice,
      created_at: new Date().toISOString(),
    });
    notify('Parsed resume sent to Profile Builder for review.', { tone: 'success' });
    navigate('/profile-builder');
  };

  const startManualProfile = () => {
    setResumeDraft({
      profile: { ...emptyProfile(), resume_reference: file ? { ...fileMeta(file), storage_path: null, source: 'upload (not parsed)' } : null },
      origin: 'manual',
      notice: 'This resume was not parsed. Enter the candidate details manually.',
      created_at: new Date().toISOString(),
    });
    navigate('/profile-builder');
  };

  return (
    <>
      <PageHeader
        eyebrow="Step 2 · Resume Parsing"
        title="Resume Parsing"
        description="Upload a candidate resume to extract education, experience, projects and evidence-backed skills, then review them before building the profile."
        owner="Mahi Aggarwal"
        actions={
          status !== 'idle' && (
            <Button icon={RotateCcw} onClick={reset}>
              Parse another resume
            </Button>
          )
        }
      />

      <div className="stack">
        <DemoNotice>
          No document parsing happens in the browser. In demo mode, the four supplied sample resumes map to hand-annotated fixtures; other files show an
          explanation instead of invented data.
        </DemoNotice>

        <div className="grid grid--sidebar">
          <Card>
            <CardHeader icon={FileSearch} title="Upload resume" subtitle="PDF or DOCX. Files are validated before anything is sent." />
            <CardBody>
              {status === 'processing' ? (
                <div className="stack stack--sm">
                  {file && <FileChip file={file} />}
                  <ProcessingSteps steps={mode === 'api' ? STEPS_API : STEPS_DEMO} />
                </div>
              ) : (
                <div className="stack stack--sm">
                  <FileDropzone onFile={parseFile} title="Drop a resume here" inputLabel="Upload resume file" />
                  {file && <FileChip file={file} onRemove={reset} />}
                </div>
              )}
              {status === 'error' && error && (
                <div style={{ marginTop: 16 }}>
                  {error.code === 'demo_unavailable' ? (
                    <Alert
                      tone="warning"
                      title="This file can't be parsed in demo mode"
                      actions={
                        <>
                          <Button size="sm" variant="primary" icon={UserPlus} onClick={startManualProfile}>
                            Enter details manually
                          </Button>
                          <Button size="sm" to="/settings">
                            Connect backend
                          </Button>
                        </>
                      }
                    >
                      {error.message}
                    </Alert>
                  ) : (
                    <Alert tone="error" title={error.code === 'unreadable' ? 'Unreadable file' : error.code === 'unsupported' ? 'Unsupported file' : 'Parsing failed'}>
                      {error.message}
                    </Alert>
                  )}
                </div>
              )}
            </CardBody>
          </Card>

          {mode === 'demo' ? (
            <Card>
              <CardHeader icon={FileText} title="Supplied sample resumes" subtitle="From the hackathon pack — loads the annotated fixture." />
              <CardBody flush>
                <ul>
                  {resumeService.sampleList().map((s) => (
                    <li key={s.key}>
                      <button type="button" className="list-item" onClick={() => loadSample(s.key)} disabled={status === 'processing'}>
                        <div className="list-item__main">
                          <p className="list-item__title">{s.name}</p>
                          <p className="list-item__meta">{s.headline}</p>
                        </div>
                        <ArrowRight size={16} aria-hidden="true" color="var(--text-muted)" />
                      </button>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ) : (
            <Card>
              <CardHeader icon={FileText} title="Sample files" />
              <CardBody>
                <p className="small muted">
                  The supplied resumes are in <span className="mono">data/resumes/</span>. Upload one to test the FastAPI parser end to end.
                </p>
              </CardBody>
            </Card>
          )}
        </div>

        {status === 'done' && outcome && (
          <>
            <Card>
              <CardBody>
                <div className="row row--between">
                  <div className="row">
                    <Badge tone="success">Extraction complete</Badge>
                    {outcome.origin === 'fixture' ? <DemoBadge>Demo fixture</DemoBadge> : <Badge tone="indigo">FastAPI parser</Badge>}
                    <span className="small muted">
                      Source: {outcome.resumeReference?.file_name || 'unknown'} · {outcome.parsed.skills.length} skills
                    </span>
                  </div>
                  <Button variant="primary" iconRight={ArrowRight} onClick={continueToProfile}>
                    Review in Profile Builder
                  </Button>
                </div>
                {outcome.notice && (
                  <p className="small muted" style={{ marginTop: 12 }}>
                    {outcome.notice}
                  </p>
                )}
              </CardBody>
            </Card>
            <ParsedResumeView parsed={outcome.parsed} />
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <Button variant="primary" iconRight={ArrowRight} onClick={continueToProfile}>
                Review in Profile Builder
              </Button>
            </div>
          </>
        )}

        {status === 'idle' && (
          <Card>
            <EmptyState
              icon={FileSearch}
              title="No resume parsed yet"
              description="Extracted candidate details, skills with evidence, and confidence levels will appear here for review."
            />
          </Card>
        )}
      </div>
    </>
  );
}
