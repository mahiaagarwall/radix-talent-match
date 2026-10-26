// Shared Recharts tooltip: text stays in text tokens; a swatch carries identity.
export function ChartTooltip({ active, payload, label, labelFormatter, valueFormatter = (v) => v }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip__title">{labelFormatter ? labelFormatter(label, payload) : label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="chart-tooltip__row">
          <i style={{ background: p.color || p.fill || p.stroke }} />
          {p.name}
          <b>{valueFormatter(p.value, p)}</b>
        </p>
      ))}
    </div>
  );
}
