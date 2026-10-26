import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { ChartTooltip } from '../ui/ChartTooltip';
import { categoryName } from '../../data/categories';
import { categoryBreakdown } from '../../utils/skillMatcher';
import { CHART } from '../../data/chartColors';

const SERIES = [
  { key: 'matched', name: 'Matched', color: CHART.matched },
  { key: 'partial', name: 'Partial', color: CHART.partial },
  { key: 'missing', name: 'Missing', color: CHART.missing },
];

// Stacked bars: how each RADIX category's JD requirements were classified.
// Legend + full table below the chart mean colour is never the only cue.
export function CategoryBreakdownChart({ skillResults }) {
  const data = categoryBreakdown(skillResults).sort((a, b) => b.total - a.total);
  const height = Math.max(160, data.length * 34 + 40);
  return (
    <div>
      <div className="chart-legend" style={{ marginBottom: 8 }}>
        {SERIES.map((s) => (
          <span key={s.key}>
            <i style={{ background: s.color }} />
            {s.name}
          </span>
        ))}
      </div>
      <div style={{ width: '100%', height }} role="img" aria-label={`Requirement classification by category: ${data
        .map((d) => `${d.category_code} ${d.matched} matched, ${d.partial} partial, ${d.missing} missing`)
        .join('; ')}`}>
        <ResponsiveContainer>
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, bottom: 4, left: 4 }} barCategoryGap={8}>
            <CartesianGrid horizontal={false} stroke={CHART.grid} />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: CHART.axis }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="category_code" width={52} tick={{ fontSize: 11, fill: CHART.ink, fontWeight: 600 }} axisLine={false} tickLine={false} />
            <Tooltip
              cursor={{ fill: 'rgba(51,70,168,0.06)' }}
              content={<ChartTooltip labelFormatter={(code) => `${code} — ${categoryName(code)}`} />}
            />
            {SERIES.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.name}
                stackId="a"
                fill={s.color}
                stroke="#fff"
                strokeWidth={2}
                radius={i === SERIES.length - 1 ? [0, 4, 4, 0] : 0}
                maxBarSize={20}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
