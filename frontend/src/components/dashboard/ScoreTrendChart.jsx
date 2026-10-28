import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Segmented } from '../ui/Segmented';
import { ChartTooltip } from '../ui/ChartTooltip';
import { CHART } from '../../data/chartColors';

// One measure at a time: readiness and job-match scores are different metrics,
// so they are never drawn on a shared axis.
export function ScoreTrendChart({ results }) {
  const [type, setType] = useState('skill_match');
  const series = results
    .filter((r) => r.type === type)
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
    .map((r, i) => ({
      i: i + 1,
      score: type === 'talent_check' ? r.readiness_score : r.match_score,
      label: `${r.candidate_name} — ${type === 'talent_check' ? r.company : r.role}`,
    }));
  const name = type === 'talent_check' ? 'Readiness score' : 'Job match score';

  return (
    <div>
      <div className="row row--between" style={{ marginBottom: 12 }}>
        <p className="small muted">{name} for each run, in order</p>
        <Segmented
          label="Choose metric"
          value={type}
          onChange={setType}
          options={[
            { value: 'skill_match', label: 'Skill Match' },
            { value: 'talent_check', label: 'Talent Check' },
          ]}
        />
      </div>
      {series.length < 2 ? (
        <p className="small muted chart-placeholder">
          {series.length === 0 ? 'No runs of this type yet.' : 'Run at least two assessments of this type to see a trend.'}
        </p>
      ) : (
        <div style={{ width: '100%', height: 220 }} role="img" aria-label={`${name} by run: ${series.map((s) => `${s.label} ${s.score}`).join('; ')}`}>
          <ResponsiveContainer>
            <LineChart data={series} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
              <CartesianGrid vertical={false} stroke={CHART.grid} />
              <XAxis dataKey="i" tick={{ fontSize: 11, fill: CHART.axis }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: CHART.axis }} axisLine={false} tickLine={false} />
              <Tooltip
                cursor={{ stroke: CHART.axis, strokeDasharray: '3 3' }}
                content={<ChartTooltip labelFormatter={(_, p) => p?.[0]?.payload?.label} valueFormatter={(v) => `${v}/100`} />}
              />
              <Line type="linear" dataKey="score" name={name} stroke={CHART.required} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: 'var(--surface)' }} activeDot={{ r: 5 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
