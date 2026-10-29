import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Save,
  X,
  Trash2,
  UserRound,
  GraduationCap,
  FolderGit2,
  Briefcase,
  Trophy,
  BadgeCheck,
  Paperclip,
  Gauge,
  GitCompareArrows,
  FileSearch,
  IdCard,
} from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { DemoNotice } from '../components/layout/DemoNotice';
import { Card, CardHeader, CardBody, CardFooter } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/ui/Alert';
import { Badge, DemoBadge } from '../components/ui/Badges';
import { TextField } from '../components/ui/Fields';
import { LoadingState, ErrorState } from '../components/ui/States';
import { SkillEditor } from '../components/profile/SkillEditor';
import { EntryListEditor } from '../components/profile/EntryListEditor';
import { TagInput } from '../components/profile/TagInput';
import { ProfileSelector } from '../components/profile/ProfileSelector';
import { profileService, emptyProfile } from '../services/profileService';
import { useAppData } from '../context/AppDataContext';
import { useToast } from '../context/ToastContext';
import { validateProfile } from '../utils/validation';
import { validateDocumentFile, fileMeta, describeFileType } from '../utils/fileValidation';
import { formatBytes, formatDate } from '../utils/format';

const EDU_FIELDS = [
  { key: 'degree', label: 'Degree', placeholder: 'B.Tech' },
  { key: 'field', label: 'Field of study', placeholder: 'Computer Science and Engineering' },
  { key: 'institution', label: 'Institution' },
  { key: 'graduation_year', label: 'Graduation year', placeholder: '2026' },
  { key: 'grade', label: 'Grade / CGPA', placeholder: 'CGPA 8.6 / 10', span: true },
];
const PROJECT_FIELDS = [
  { key: 'title', label: 'Title', span: true },
  { key: 'description', label: 'Description', multiline: true },
];
const INTERN_FIELDS = [
  { key: 'role', label: 'Role' },
  { key: 'organization', label: 'Organization' },
  { key: 'description', label: 'Outcome / description', multiline: true },
];
const HACK_FIELDS = [
  { key: 'name', label: 'Event' },
  { key: 'result', label: 'Result', placeholder: 'Winner, Finalist, Participant' },
  { key: 'description', label: 'What you built', multiline: true },
];
const CERT_FIELDS = [
  { key: 'name', label: 'Certification' },
  { key: 'issuer', label: 'Issuer' },
];

const snapshot = (p) => JSON.stringify(p);

export default function ProfileBuilder() {
  const { profileId } = useParams();
  const navigate = useNavigate();
  const { notify } = useToast();
  const { mode, profiles, reloadProfiles, setActiveProfileId, resumeDraft, setResumeDraft } = useAppData();

  const [form, setForm] = useState(null);
  const [baseline, setBaseline] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);
  const [newSession, setNewSession] = useState(0);
  const [attachError, setAttachError] = useState(null);
  const draftRef = useRef(resumeDraft);
  draftRef.current = resumeDraft;
  const attachInput = useRef(null);
  const justSavedId = useRef(null);

  // Load an existing profile, or start a new one (pre-filled from a parsed resume if present).
  useEffect(() => {
    let cancelled = false;
    // Navigating to the URL of a profile we just created: the form already holds it,
    // and the save confirmation must stay visible.
    if (profileId && justSavedId.current === profileId) {
      justSavedId.current = null;
      return undefined;
    }
    setShowErrors(false);
    setSaveMsg(null);
    setLoadError(null);
    if (profileId) {
      setForm(null);
      profileService
        .get(profileId)
        .then((p) => {
          if (cancelled) return;
          setForm(p);
          setBaseline(snapshot(p));
          setActiveProfileId(p.profile_id);
        })
        .catch((err) => !cancelled && setLoadError(err));
    } else {
      const draft = draftRef.current?.profile;
      const start = draft ? JSON.parse(JSON.stringify(draft)) : emptyProfile();
      setForm(start);
      setBaseline(snapshot(draft ? null : start));
    }
    return () => {
      cancelled = true;
    };
  }, [profileId, newSession, setActiveProfileId]);

  const dirty = form && snapshot(form) !== baseline;

  // Keep unsaved NEW-profile edits across navigation by mirroring them into the draft.
  useEffect(() => {
    if (!profileId && form && dirty) {
      setResumeDraft({ ...(draftRef.current || { origin: 'manual' }), profile: form });
    }
  }, [form, dirty, profileId, setResumeDraft]);

  const validation = useMemo(() => (form ? validateProfile(form) : { valid: true, errors: {}, warnings: [] }), [form]);
  const errors = showErrors ? validation.errors : {};

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const save = async () => {
    setShowErrors(true);
    if (!validation.valid) {
      setSaveMsg({ tone: 'error', text: 'Fix the highlighted fields before saving.' });
      document.querySelector('[aria-invalid="true"]')?.focus();
      return;
    }
    setSaving(true);
    setSaveMsg(null);
    try {
      const saved = form.profile_id ? await profileService.update(form.profile_id, form) : await profileService.create(form);
      await reloadProfiles();
      setActiveProfileId(saved.profile_id);
      setForm(saved);
      setBaseline(snapshot(saved));
      setShowErrors(false);
      const where = mode === 'demo' ? 'local demo storage in this browser' : 'the FastAPI backend';
      setSaveMsg({ tone: 'success', text: `Profile saved to ${where}. Profile ID: ${saved.profile_id}` });
      notify(`Saved ${saved.name} to ${mode === 'demo' ? 'local demo storage' : 'the backend'}.`, { tone: 'success' });
      if (!profileId) {
        setResumeDraft(null);
        justSavedId.current = saved.profile_id;
        navigate(`/profile-builder/${saved.profile_id}`, { replace: true });
      }
    } catch (err) {
      setSaveMsg({ tone: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    if (dirty && !window.confirm('Discard unsaved changes?')) return;
    setShowErrors(false);
    setSaveMsg(null);
    if (profileId) {
      setForm(JSON.parse(baseline));
    } else {
      setResumeDraft(null);
      draftRef.current = null;
      setNewSession((n) => n + 1);
    }
  };

  const startNew = () => {
    if (dirty && !window.confirm('Discard unsaved changes and start a new profile?')) return;
    setResumeDraft(null);
    draftRef.current = null;
    if (profileId) navigate('/profile-builder');
    else setNewSession((n) => n + 1);
  };

  const remove = async () => {
    const where = mode === 'demo' ? 'local demo storage' : 'the database';
    if (!window.confirm(`Delete ${form.name}'s profile from ${where}? Results that reference it are kept.`)) return;
    try {
      await profileService.remove(form.profile_id);
      await reloadProfiles();
      setActiveProfileId(null);
      notify(`Profile deleted from ${where}.`, { tone: 'info' });
      navigate('/profile-builder');
    } catch (err) {
      notify(err.message, { tone: 'error' });
    }
  };

  const attachResume = async (file) => {
    setAttachError(null);
    if (!file) return;
    const check = await validateDocumentFile(file);
    if (!check.ok) {
      setAttachError(check.message);
      return;
    }
    set({ resume_reference: { ...fileMeta(file), storage_path: null, source: mode === 'demo' ? 'attached (demo — not uploaded)' : 'attached (pending upload)' } });
  };

  const isNew = !profileId;
  const title = isNew ? 'Profile Builder' : form?.name || 'Profile Builder';

  return (
    <>
      <PageHeader
        eyebrow="Step 3 · Profile Builder"
        title={title}
        description="Review what was extracted, correct it, add anything the resume missed, and save one reusable profile for Talent Check and Skill Matching."
        actions={
          <>
            {!isNew && form && (
              <>
                <Button icon={Gauge} to={`/talent-check?profile=${form.profile_id}`}>
                  Talent Check
                </Button>
                <Button icon={GitCompareArrows} to={`/skill-matching?profile=${form.profile_id}`}>
                  Skill Match
                </Button>
              </>
            )}
            <Button variant="primary" icon={Save} onClick={save} loading={saving} disabled={!form}>
              Save profile
            </Button>
          </>
        }
      />

      <div className="grid grid--sidebar">
        <div className="stack">
          <DemoNotice>Profiles are saved with the local persistence adapter — nothing is sent to Supabase.</DemoNotice>

          {isNew && resumeDraft && (
            <Alert
              tone="info"
              title={resumeDraft.origin === 'manual' ? 'New profile (manual entry)' : 'Pre-filled from Resume Parsing'}
              actions={
                <Button size="sm" variant="ghost" icon={X} onClick={startNew}>
                  Discard draft
                </Button>
              }
            >
              {resumeDraft.notice ||
                'Fields marked “Extracted” came from the parser. Edit anything that is wrong — edited entries are marked “Edited”.'}{' '}
              The draft is kept until you save or discard it.
            </Alert>
          )}

          {loadError ? (
            <ErrorState
              error={loadError}
              title="Could not load this profile"
              onRetry={() => setNewSession((n) => n + 1)}
            />
          ) : !form ? (
            <Card>
              <LoadingState label="Loading profile…" />
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader icon={UserRound} title="Basic information" subtitle="Name is required. Email is validated when provided." />
                <CardBody>
                  <div className="form-grid">
                    <TextField
                      label="Full name"
                      required
                      value={form.name}
                      error={errors.name}
                      autoComplete="name"
                      onChange={(e) => set({ name: e.target.value })}
                    />
                    <TextField
                      label="Email"
                      type="email"
                      value={form.email || ''}
                      error={errors.email}
                      autoComplete="email"
                      hint={!form.email ? 'None of the sample resumes include an email address.' : undefined}
                      onChange={(e) => set({ email: e.target.value })}
                    />
                  </div>
                  <div className="divider" />
                  <div className="row row--between">
                    <div className="row" style={{ flexWrap: 'nowrap', minWidth: 0 }}>
                      <Paperclip size={16} aria-hidden="true" color="var(--text-muted)" />
                      <div style={{ minWidth: 0 }}>
                        <p className="small strong">Resume reference</p>
                        {form.resume_reference ? (
                          <p className="xsmall muted truncate">
                            {form.resume_reference.file_name} · {describeFileType(form.resume_reference.file_name)}
                            {form.resume_reference.file_size ? ` · ${formatBytes(form.resume_reference.file_size)}` : ''} ·{' '}
                            {form.resume_reference.source}
                          </p>
                        ) : (
                          <p className="xsmall muted">No resume attached.</p>
                        )}
                      </div>
                    </div>
                    <div className="row">
                      <input
                        ref={attachInput}
                        type="file"
                        className="sr-only"
                        tabIndex={-1}
                        aria-label="Attach resume file"
                        accept=".pdf,.docx"
                        onChange={(e) => {
                          attachResume(e.target.files?.[0]);
                          e.target.value = '';
                        }}
                      />
                      <Button size="sm" onClick={() => attachInput.current?.click()}>
                        {form.resume_reference ? 'Replace' : 'Attach'}
                      </Button>
                      {form.resume_reference && (
                        <Button size="sm" variant="ghost" onClick={() => set({ resume_reference: null })}>
                          Remove
                        </Button>
                      )}
                    </div>
                  </div>
                  {attachError && (
                    <p className="field__error" role="alert" style={{ marginTop: 8 }}>
                      {attachError}
                    </p>
                  )}
                </CardBody>
              </Card>

              <SkillEditor
                skills={form.skills}
                onChange={(skills) => set({ skills })}
                errors={errors.skills}
                subtitle="Each skill needs exactly one RADIX category. Confidence is how well the evidence supports the skill — not a proficiency level."
              />

              <EntryListEditor title="Education" icon={GraduationCap} itemLabel="education entry" addLabel="Add education" items={form.education} fields={EDU_FIELDS} onChange={(education) => set({ education })} />
              <EntryListEditor title="Projects" icon={FolderGit2} itemLabel="project" addLabel="Add project" items={form.projects} fields={PROJECT_FIELDS} onChange={(projects) => set({ projects })} />
              <EntryListEditor title="Internships & work experience" icon={Briefcase} itemLabel="internship" addLabel="Add experience" items={form.internships} fields={INTERN_FIELDS} onChange={(internships) => set({ internships })} />
              <div className="grid grid--2">
                <EntryListEditor title="Hackathons" icon={Trophy} itemLabel="hackathon" addLabel="Add" items={form.hackathons} fields={HACK_FIELDS} onChange={(hackathons) => set({ hackathons })} />
                <EntryListEditor title="Certifications" icon={BadgeCheck} itemLabel="certification" addLabel="Add" items={form.certifications} fields={CERT_FIELDS} onChange={(certifications) => set({ certifications })} />
              </div>

              <Card>
                <CardHeader icon={Briefcase} title="Preferred roles" />
                <CardBody>
                  <TagInput label="Roles the candidate is targeting" values={form.preferred_roles} onChange={(preferred_roles) => set({ preferred_roles })} placeholder="e.g. Backend Engineer" />
                </CardBody>
                <CardFooter>
                  <span className="small muted" style={{ marginRight: 'auto' }} aria-live="polite">
                    {dirty ? 'Unsaved changes' : form.profile_id ? 'All changes saved' : ''}
                  </span>
                  <Button icon={X} onClick={cancel} disabled={!dirty && !(isNew && resumeDraft)}>
                    Cancel
                  </Button>
                  <Button variant="primary" icon={Save} onClick={save} loading={saving}>
                    Save profile
                  </Button>
                </CardFooter>
              </Card>

              {saveMsg && (
                <Alert tone={saveMsg.tone} title={saveMsg.tone === 'success' ? 'Saved' : 'Not saved'}>
                  {saveMsg.text}
                </Alert>
              )}
              {validation.warnings.length > 0 && (
                <Alert tone="warning" title="Worth checking">
                  <ul>
                    {validation.warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </Alert>
              )}
            </>
          )}
        </div>

        <div className="stack sticky-col">
          <ProfileSelector profiles={profiles} activeId={profileId} onNew={startNew} onRetry={reloadProfiles} />
          {form && (
            <Card>
              <CardHeader icon={IdCard} title="Profile record" />
              <CardBody>
                <dl className="kv">
                  <dt>Profile ID</dt>
                  <dd className="mono">{form.profile_id || 'Assigned on first save'}</dd>
                  <dt>Storage</dt>
                  <dd>{mode === 'demo' ? <DemoBadge>Local demo adapter</DemoBadge> : <Badge tone="indigo">FastAPI</Badge>}</dd>
                  <dt>Created</dt>
                  <dd>{formatDate(form.created_at, { withTime: true })}</dd>
                  <dt>Updated</dt>
                  <dd>{formatDate(form.updated_at, { withTime: true })}</dd>
                  <dt>Skills</dt>
                  <dd>
                    {form.skills.length} ({form.skills.filter((s) => s.origin === 'extracted').length} extracted,{' '}
                    {form.skills.filter((s) => s.origin === 'edited').length} edited, {form.skills.filter((s) => s.origin === 'manual').length} manual)
                  </dd>
                </dl>
                {!isNew && (
                  <Button variant="danger" size="sm" icon={Trash2} onClick={remove} style={{ marginTop: 16 }}>
                    Delete profile
                  </Button>
                )}
              </CardBody>
            </Card>
          )}
          {isNew && !resumeDraft && (
            <Card>
              <CardBody>
                <p className="small strong">Faster: start from a resume</p>
                <p className="small muted" style={{ margin: '4px 0 12px' }}>
                  Resume Parsing pre-fills this form with extracted skills and evidence.
                </p>
                <Button size="sm" icon={FileSearch} to="/resume-parsing">
                  Go to Resume Parsing
                </Button>
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
