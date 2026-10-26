import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, UserRound, BriefcaseBusiness, ClipboardList } from 'lucide-react';
import { useAppData } from '../../context/AppDataContext';

// Searches the records currently loaded in the data store (profiles, JDs, results).
export function GlobalSearch() {
  const { profiles, jds, results } = useAppData();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const navigate = useNavigate();
  const boxRef = useRef(null);
  const listId = useId();

  const hits = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const has = (...xs) => xs.some((x) => String(x || '').toLowerCase().includes(q));
    const p = profiles.items
      .filter((x) => has(x.name, x.email, x.profile_id, ...(x.skills || []).map((s) => s.skill_name)))
      .map((x) => ({ key: `p-${x.profile_id}`, icon: UserRound, title: x.name, kind: 'Profile', to: `/profile-builder/${x.profile_id}` }));
    const j = jds.items
      .filter((x) => has(x.role, x.company, x.source_file, x.jd_id))
      .map((x) => ({ key: `j-${x.jd_id}`, icon: BriefcaseBusiness, title: `${x.role} — ${x.company}`, kind: 'Job description', to: `/jd-analytics/${x.jd_id}` }));
    const r = results.items
      .filter((x) => has(x.candidate_name, x.company, x.role, x.result_id))
      .map((x) => ({
        key: `r-${x.result_id}`,
        icon: ClipboardList,
        title: `${x.candidate_name} · ${x.type === 'talent_check' ? x.company : `${x.role}, ${x.company}`}`,
        kind: x.type === 'talent_check' ? 'Talent Check' : 'Skill Match',
        to: `/results/${x.result_id}`,
      }));
    return [...p, ...j, ...r].slice(0, 12);
  }, [query, profiles.items, jds.items, results.items]);

  useEffect(() => {
    const onDoc = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const go = (hit) => {
    navigate(hit.to);
    setQuery('');
    setOpen(false);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, hits.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === 'Enter' && hits[cursor]) {
      e.preventDefault();
      go(hits[cursor]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const showList = open && query.trim().length > 0;

  return (
    <div className="global-search search-input" ref={boxRef}>
      <label htmlFor={`${listId}-input`} className="sr-only">
        Search profiles, job descriptions and results
      </label>
      <Search size={15} aria-hidden="true" />
      <input
        id={`${listId}-input`}
        type="search"
        className="input input--sm"
        placeholder="Search candidates, JDs, results…"
        value={query}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && hits[cursor] ? `${listId}-${cursor}` : undefined}
        onChange={(e) => {
          setQuery(e.target.value);
          setCursor(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {showList && (
        <div className="global-search__results" id={listId} role="listbox" aria-label="Search results">
          {hits.length === 0 ? (
            <p className="search-empty">No matching records in the current data store.</p>
          ) : (
            hits.map((hit, i) => {
              const Icon = hit.icon;
              return (
                <button
                  type="button"
                  key={hit.key}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === cursor}
                  className="search-result"
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => go(hit)}
                >
                  <Icon size={16} aria-hidden="true" color="var(--indigo)" />
                  <span className="truncate small strong">{hit.title}</span>
                  <span className="search-result__kind">{hit.kind}</span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
