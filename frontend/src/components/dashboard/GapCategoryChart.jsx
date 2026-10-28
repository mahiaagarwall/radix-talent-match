import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ChartTooltip } from '../ui/ChartTooltip';
import { categoryName } from '../../data/categories';
import { CHART } from '../../data/chartColors';

// Across all Skill Matching runs: which RADIX categories most often contain
// missing or partial requirements.
export function GapCategoryChart({ results }) {
  const map = new Map();
  results
    .filter((r) => r.type === 'skill_match')
    .forEach((r) =>
      (r.skill_results || []).forEach((s) => {
        if (s.status === 'matched') return;
        const row = map.get(s.category_code) || { code: s.category_code, partial: 0, missing: 0 };
        row[s.status] += 1;
        map.set(s.category_code, row);
      }),
    );
  const data = [...map.values()].sort((a, b) => b.missing + b.partial - (a.missing + a.partial)).slice(0, 8);

  if (!data.length) return <p className="small muted chart-placeholder">Gap categories appear after the first Skill Matching run with partial or missing skills.</p>;

  return (
    <div>
      <div className="chart-legend" style={{ marginBottom: 8 }}>
        <span>
          <i style={{ background: CHART.missing }} />
          Missing
        </span>
        <span>
          <i style={{ background: CHART.partial }} />
          Partial
        </span>
      </div>
      <div style={{ width: '100%', height: 220 }} role="img" aria-label={`Gap counts by category: ${data.map((d) => `${d.code} ${d.missing} missing, ${d.partial} partial`).join('; ')}`}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }} barCategoryGap="28%">
            <CartesianGrid vertical={false} stroke={CHART.grid} />
            <XAxis dataKey="code" tick={{ fontSize: 11, fill: CHART.ink, fontWeight: 600 }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: CHART.axis }} axisLine={false} tickLine={false} />
            <Tooltip cursor={{ fill: 'rgba(51,70,168,0.06)' }} content={<ChartTooltip labelFormatter={(c) => `${c} — ${categoryName(c)}`} />} />
            <Bar dataKey="missing" name="Missing" stackId="g" fill={CHART.missing} stroke="var(--surface)" strokeWidth={2} maxBarSize={28} isAnimationActive={false} />
            <Bar dataKey="partial" name="Partial" stackId="g" fill={CHART.partial} stroke="var(--surface)" strokeWidth={2} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
