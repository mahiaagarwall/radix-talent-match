import { useState, useMemo } from 'react';
import {
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Copy,
  Check,
  HelpCircle,
  FileText,
} from 'lucide-react';
import { useAppData } from '../context/AppDataContext';
import { resumeCoachService } from '../services/resumeCoachService';
import { PageHeader } from '../components/layout/PageHeader';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { LoadingState, ErrorState } from '../components/ui/States';
import { Segmented } from '../components/ui/Segmented';
import { GapAnalysis } from '../components/resume-coach/GapAnalysis';

const SAMPLE_WEAK_BULLETS = [
  {
    role: 'Backend Engineer',
    bullet: 'Worked on implementing authentication service in order to improve security across various microservices',
  },
  {
    role: 'Data Scientist',
    bullet: 'Was responsible for building machine learning models for customer churn prediction using Python and SQL',
  },
  {
    role: 'Frontend Developer',
    bullet: 'Helped with developing interactive React components and fixing bugs in the web app',
  },
  {
    role: 'DevOps / SRE',
    bullet: 'Handled Docker container deployment and maintained CI/CD pipelines for staging environments',
  },
];

export default function ResumeCoach() {
  const { profiles, jds } = useAppData();
  const [tab, setTab] = useState('gap');

  const [inputBullet, setInputBullet] = useState(SAMPLE_WEAK_BULLETS[0].bullet);
  const [roleContext, setRoleContext] = useState(SAMPLE_WEAK_BULLETS[0].role);
  const [selectedJdId, setSelectedJdId] = useState('');

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  // Extract bullets from existing candidate profiles for 1-click coaching
  const candidateBullets = useMemo(() => {
    const list = [];
    profiles.items.forEach((p) => {
      (p.projects || []).forEach((proj) => {
        if (proj.description) {
          list.push({ candidate: p.name, source: proj.title || 'Project', text: proj.description });
        }
      });
      (p.internships || []).forEach((intern) => {
        if (intern.description) {
          list.push({ candidate: p.name, source: `${intern.role} at ${intern.company}`, text: intern.description });
        }
      });
    });
    return list;
  }, [profiles.items]);

  const handleImprove = async () => {
    if (!inputBullet.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await resumeCoachService.improve({
        bullet: inputBullet,
        roleContext,
        targetJdId: selectedJdId || undefined,
      });
      setResult(res);
    } catch (err) {
      setError(err?.message || 'Could not improve bullet point.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!result?.improved_bullet) return;
    navigator.clipboard.writeText(result.improved_bullet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="page page--resume-coach">
      <PageHeader
        title="Resume Coach"
        description="Compare a resume with one specific job, or strengthen weak bullets — without fabricating achievements."
        actions={
          <Segmented
            label="Resume Coach mode"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'gap', label: 'Job gap analysis' },
              { value: 'bullet', label: 'Bullet coach' },
            ]}
          />
        }
      />

      {tab === 'gap' ? (
        <GapAnalysis jds={jds.items} />
      ) : (
      <>
      {/* Anti-fabrication Guarantee Callout */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 16px',
          background: 'rgba(56, 189, 248, 0.08)',
          border: '1px solid rgba(56, 189, 248, 0.25)',
          borderRadius: 8,
          marginBottom: 20,
        }}
      >
        <ShieldCheck size={20} color="var(--cyan, #06b6d4)" style={{ flexShrink: 0 }} />
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          <strong style={{ color: 'var(--text-primary)' }}>Strict Anti-Fabrication Guarantee:</strong> This tool
          replaces passive phrasing with powerful action verbs and eliminates filler words. It will{' '}
          <em>never</em> invent metrics, revenue percentages, or responsibilities you did not achieve.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
        {/* Left Column: Input Form & Samples */}
        <div>
          <Card>
            <CardHeader
              title="Input Bullet Point"
              subtitle="Enter a bullet from your experience, projects, or select a sample"
              icon={FileText}
            />
            <CardBody>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label htmlFor="rc-bullet-input" style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                    Resume Bullet Point
                  </label>
                  <textarea
                    id="rc-bullet-input"
                    className="input"
                    rows={4}
                    value={inputBullet}
                    onChange={(e) => setInputBullet(e.target.value)}
                    placeholder="e.g. Worked on building user authentication and database models..."
                    style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label htmlFor="rc-role-context" style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                      Target / Current Role
                    </label>
                    <input
                      id="rc-role-context"
                      type="text"
                      className="input"
                      value={roleContext}
                      onChange={(e) => setRoleContext(e.target.value)}
                      placeholder="e.g. Backend Engineer"
                      style={{ width: '100%' }}
                    />
                  </div>

                  <div>
                    <label htmlFor="rc-target-jd" style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                      Target Job Context (Optional)
                    </label>
                    <select
                      id="rc-target-jd"
                      className="select"
                      value={selectedJdId}
                      onChange={(e) => setSelectedJdId(e.target.value)}
                      style={{ width: '100%' }}
                    >
                      <option value="">None (Generic Role)</option>
                      {jds.items.map((j) => (
                        <option key={j.jd_id} value={j.jd_id}>
                          {j.company} - {j.role}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <Button
                  variant="primary"
                  icon={Sparkles}
                  loading={loading}
                  onClick={handleImprove}
                  disabled={!inputBullet.trim()}
                  style={{ width: '100%', marginTop: 6 }}
                >
                  Coach &amp; Enhance Bullet
                </Button>
              </div>

              {/* Sample Weak Bullets */}
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 8 }}>
                  Or try a sample weak bullet:
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {SAMPLE_WEAK_BULLETS.map((sample, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className="btn btn--subtle"
                      onClick={() => {
                        setInputBullet(sample.bullet);
                        setRoleContext(sample.role);
                      }}
                      style={{
                        textAlign: 'left',
                        fontSize: 12,
                        padding: '8px 10px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        borderRadius: 6,
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '85%' }}>
                        &bull; {sample.bullet}
                      </span>
                      <span className="badge badge--neutral" style={{ fontSize: 10 }}>{sample.role}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Bullets from Candidate Profiles */}
              {candidateBullets.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 8 }}>
                    Or select from candidate profiles:
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {candidateBullets.slice(0, 3).map((cb, idx) => (
                      <button
                        key={idx}
                        type="button"
                        className="btn btn--subtle"
                        onClick={() => {
                          setInputBullet(cb.text);
                          setRoleContext(cb.source);
                        }}
                        style={{
                          textAlign: 'left',
                          fontSize: 12,
                          padding: '8px 10px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          borderRadius: 6,
                          border: '1px solid var(--border-subtle)',
                        }}
                      >
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75%' }}>
                          &bull; {cb.text}
                        </span>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{cb.candidate}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Right Column: Coaching Results & Comparison */}
        <div>
          {loading ? (
            <Card>
              <CardBody>
                <LoadingState label="Analyzing phrasing and elevating action verbs..." />
              </CardBody>
            </Card>
          ) : error ? (
            <Card>
              <CardBody>
                <ErrorState error={error} title="Coaching failed" onRetry={handleImprove} />
              </CardBody>
            </Card>
          ) : !result ? (
            <Card style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CardBody style={{ textAlign: 'center', padding: '40px 20px' }}>
                <Sparkles size={36} color="var(--indigo, #6366f1)" style={{ margin: '0 auto 12px' }} />
                <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>Ready to Coach</h3>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 320, margin: '0 auto' }}>
                  Click &ldquo;Coach &amp; Enhance Bullet&rdquo; to see a side-by-side comparison, verb improvements, and safe follow-up questions.
                </p>
              </CardBody>
            </Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Comparison Card */}
              <Card>
                <CardHeader
                  title="Side-by-Side Comparison"
                  icon={Sparkles}
                  actions={
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={copied ? Check : Copy}
                      onClick={handleCopy}
                    >
                      {copied ? 'Copied!' : 'Copy Improved'}
                    </Button>
                  }
                />
                <CardBody>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {/* Original */}
                    <div style={{ padding: 12, background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 6 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--danger, #ef4444)', textTransform: 'uppercase', marginBottom: 4 }}>
                        Original Bullet (Passive / Wordy)
                      </div>
                      <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                        &bull; {result.original_bullet}
                      </div>
                    </div>

                    {/* Improved */}
                    <div style={{ padding: 14, background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--success, #10b981)', textTransform: 'uppercase' }}>
                          Improved Bullet (Active &amp; High Impact)
                        </span>
                        <span className="badge badge--success" style={{ fontSize: 10 }}>Action-Driven</span>
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                        &bull; {result.improved_bullet}
                      </div>
                    </div>
                  </div>
                </CardBody>
              </Card>

              {/* Changes & Policy Breakdown */}
              <Card>
                <CardHeader title="Improvement Breakdown" icon={CheckCircle2} />
                <CardBody>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {/* Improvements made */}
                    <div>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                        Key Refinements Applied:
                      </span>
                      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {result.improvements_made.map((imp, idx) => (
                          <li key={idx}>{imp}</li>
                        ))}
                      </ul>
                    </div>

                    {/* Claims avoided */}
                    <div style={{ padding: '10px 12px', background: 'var(--bg-subtle, rgba(255,255,255,0.02))', borderRadius: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--info, #0284c7)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <ShieldCheck size={14} /> Unsupported Claims Avoided:
                      </span>
                      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {result.unsupported_claims_avoided.map((cl, idx) => (
                          <li key={idx}>{cl}</li>
                        ))}
                      </ul>
                    </div>

                    {/* Follow-up Questions for User Quantification */}
                    {result.follow_up_questions?.length > 0 && (
                      <div>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--warning, #f59e0b)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                          <HelpCircle size={14} /> Prompts to Add Genuine Metrics (If Known):
                        </span>
                        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {result.follow_up_questions.map((q, idx) => (
                            <li key={idx}>{q}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </CardBody>
              </Card>
            </div>
          )}
        </div>
      </div>
      </>
      )}
    </div>
  );
}
