import { useId, useState } from 'react';
import { X, Plus } from 'lucide-react';
import { Button } from '../ui/Button';

export function TagInput({ label, values, onChange, placeholder = 'Type and press Enter' }) {
  const [draft, setDraft] = useState('');
  const id = useId();
  const add = () => {
    const v = draft.trim();
    if (v && !values.some((x) => x.toLowerCase() === v.toLowerCase())) onChange([...values, v]);
    setDraft('');
  };
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <div className="row" style={{ flexWrap: 'nowrap' }}>
        <input
          id={id}
          className="input input--sm"
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button size="sm" icon={Plus} onClick={add} disabled={!draft.trim()}>
          Add
        </Button>
      </div>
      {values.length > 0 && (
        <ul className="tag-list" style={{ marginTop: 6 }} aria-label={`${label} list`}>
          {values.map((v) => (
            <li key={v} className="tag">
              {v}
              <button
                type="button"
                className="icon-btn icon-btn--sm"
                style={{ width: 20, height: 20 }}
                aria-label={`Remove ${v}`}
                onClick={() => onChange(values.filter((x) => x !== v))}
              >
                <X size={12} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
