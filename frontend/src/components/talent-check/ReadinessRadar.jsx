import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { ChartTooltip } from '../ui/ChartTooltip';
import { categoryName } from '../../data/categories';
import { CHART } from '../../data/chartColors';

// Required (company file) vs. estimated (resume evidence) levels across the
// assessed skillsets. The matrix below is the table view of the same data.
export function ReadinessRadar({ rows }) {
  const data = rows
    .filter((r) => r.required_level !== null)
    .map((r) => ({ code: r.category_code, required: r.required_level, estimated: r.candidate_level }));
  if (data.length < 3) return <p className="small muted">At least three assessed skillsets are needed for this chart.</p>;
  return (
    <div>
      <div className="chart-legend" style={{ marginBottom: 4 }}>
        <span>
          <i style={{ background: CHART.required }} />
          Required level (company file)
        </span>
        <span>
          <i style={{ background: CHART.estimated }} />
          Estimated candidate level
        </span>
      </div>
      <div style={{ width: '100%', height: 300 }} role="img" aria-label="Radar chart of required versus estimated levels; the matrix below lists the same values.">
        <ResponsiveContainer>
          <RadarChart data={data} outerRadius="72%">
            <PolarGrid stroke={CHART.grid} />
            <PolarAngleAxis dataKey="code" tick={{ fontSize: 11, fill: CHART.ink, fontWeight: 600 }} />
            <PolarRadiusAxis domain={[0, 10]} tickCount={6} tick={false} axisLine={false} />
            <Radar name="Required" dataKey="required" stroke={CHART.required} fill={CHART.required} fillOpacity={0.08} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
            <Radar name="Estimated" dataKey="estimated" stroke={CHART.estimated} fill={CHART.estimated} fillOpacity={0.18} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
            <Tooltip content={<ChartTooltip labelFormatter={(code) => `${code} — ${categoryName(code)}`} valueFormatter={(v) => `${v}/10`} />} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
