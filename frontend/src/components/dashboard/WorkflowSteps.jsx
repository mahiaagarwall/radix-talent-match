import { Link } from 'react-router-dom';
import { CheckCircle2, Circle } from 'lucide-react';

// The integrated flow from the participant brief, with completion derived from
// the current data store.
export function WorkflowSteps({ counts }) {
  const steps = [
    { n: 1, label: 'Analyze a JD', to: '/jd-analytics', done: counts.jds > 0, meta: `${counts.jds} saved` },
    { n: 2, label: 'Parse a resume', to: '/resume-parsing', done: counts.parsedProfiles > 0, meta: `${counts.parsedProfiles} with resume` },
    { n: 3, label: 'Build the profile', to: '/profile-builder', done: counts.profiles > 0, meta: `${counts.profiles} saved` },
    { n: 4, label: 'Run Talent Check', to: '/talent-check', done: counts.talentChecks > 0, meta: `${counts.talentChecks} run` },
    { n: 5, label: 'Run Skill Matching', to: '/skill-matching', done: counts.matches > 0, meta: `${counts.matches} run` },
  ];
  return (
    <ol className="workflow" aria-label="Talent Match workflow">
      {steps.map((s) => (
        <li key={s.n} className={`workflow__step${s.done ? ' workflow__step--done' : ''}`}>
          <Link to={s.to} className="workflow__link">
            <span className="workflow__icon" aria-hidden="true">
              {s.done ? <CheckCircle2 size={18} /> : <Circle size={18} />}
            </span>
            <span className="workflow__text">
              <span className="workflow__num">Step {s.n}</span>
              <span className="workflow__label">{s.label}</span>
              <span className="workflow__meta">
                {s.meta}
                <span className="sr-only">{s.done ? ' — complete' : ' — not started'}</span>
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}
