// Chart colours mirror the CSS tokens. Validated with the dataviz palette
// checker: matched/partial/missing pass CVD (ΔE ≥ 13.9) and normal-vision
// separation; required/estimated pass at ΔE 24.6. Partial amber is below 3:1
// contrast on white, so every chart ships with a legend and a table view.
export const CHART = {
  matched: '#0F9F91',
  partial: '#E9A23B',
  missing: '#DC2626',
  required: '#3346A8',
  estimated: '#0F9F91',
  grid: '#E2E8F0',
  axis: '#64748B',
  ink: '#172033',
};
