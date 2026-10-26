// Toggle-button group for filters (aria-pressed), keyboard accessible by default.
export function Segmented({ label, options, value, onChange }) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
          {o.count !== undefined && <span className="count">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}
