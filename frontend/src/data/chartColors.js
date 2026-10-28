// Chart colours mirror the CSS tokens. Fallback hex values provided for environments
// that do not resolve CSS variables (e.g. SVG canvas rasterizers or headless test runners).
export const CHART = {
  matched: 'var(--chart-matched, #0d9488)',
  partial: 'var(--chart-partial, #f59e0b)',
  missing: 'var(--chart-missing, #ef4444)',
  required: 'var(--chart-required, #4f46e5)',
  estimated: 'var(--chart-estimated, #0d9488)',
  grid: 'var(--chart-grid, #e2e8f0)',
  axis: 'var(--chart-text, #64748b)',
  ink: 'var(--text, #0f172a)',
};
