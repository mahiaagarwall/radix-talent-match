// Single-value gauge. Colour encodes the band; the number and band label are
// always printed so meaning never depends on colour alone.

export function scoreBand(score) {
  if (score === null || score === undefined) return { tone: 'neutral', label: 'Not Scored', color: 'var(--text-muted)' };
  if (score >= 75) return { tone: 'teal', label: 'Strong', color: 'var(--teal)' };
  if (score >= 50) return { tone: 'warning', label: 'Moderate', color: 'var(--warning)' };
  return { tone: 'error', label: 'Low', color: 'var(--error)' };
}

export function ScoreRing({ score, size = 132, stroke = 11, label = 'score', small = false }) {
  const isUnscored = score === null || score === undefined;
  const value = isUnscored ? 0 : Math.max(0, Math.min(100, Number(score) || 0));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const band = scoreBand(score);
  return (
    <div
      className={`score-ring${small ? ' score-ring--sm' : ''}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${label}: ${isUnscored ? 'Not scored' : `${value} out of 100 (${band.label})`}`}
    >
      <svg width={size} height={size} aria-hidden="true">
        <circle className="score-ring__track" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} />
        <circle
          className="score-ring__value"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={band.color}
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={isUnscored ? c : c * (1 - value / 100)}
        />
      </svg>
      <div className="score-ring__label" aria-hidden="true">
        <span className="score-ring__num">{isUnscored ? '—' : value}</span>
        {!small && !isUnscored && <span className="score-ring__unit">/ 100</span>}
      </div>
    </div>
  );
}
