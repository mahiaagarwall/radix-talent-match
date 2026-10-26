import { useEffect, useState } from 'react';
import { CheckCircle2, Circle, Loader2 } from 'lucide-react';

// Step list for long-running work. Steps advance on a timer while the request
// is in flight; the final step never completes until the request resolves.
export function ProcessingSteps({ steps, interval = 450 }) {
  const [current, setCurrent] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setCurrent((c) => Math.min(c + 1, steps.length - 1)), interval);
    return () => clearInterval(t);
  }, [steps.length, interval]);
  const pct = Math.round(((current + 0.5) / steps.length) * 100);
  return (
    <div role="status" aria-live="polite">
      <div className="progress" aria-hidden="true">
        <div className="progress__bar" style={{ width: `${pct}%` }} />
      </div>
      <ol className="steps-list">
        {steps.map((s, i) => {
          const state = i < current ? 'done' : i === current ? 'current' : '';
          return (
            <li key={s} className={state}>
              {state === 'done' ? (
                <CheckCircle2 size={15} aria-hidden="true" />
              ) : state === 'current' ? (
                <Loader2 size={15} className="spin" aria-hidden="true" />
              ) : (
                <Circle size={15} aria-hidden="true" />
              )}
              {s}
              {state === 'current' && <span className="sr-only"> (in progress)</span>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
