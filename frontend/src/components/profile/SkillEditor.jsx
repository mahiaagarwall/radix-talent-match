import { Plus, Trash2, Star } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../ui/Card';
import { Button, IconButton } from '../ui/Button';
import { ALL_CATEGORIES, CONFIDENCE_LEVELS } from '../../data/categories';
import { OriginBadge, markEdited } from './OriginBadge';

const blankSkill = () => ({ skill_name: '', category_code: '', evidence: '', confidence: 'medium', origin: 'manual' });

// Editable list of shared-contract skill objects. Used by Profile Builder and
// (with `showRequirement`) by JD Analytics.
export function SkillEditor({
  skills,
  onChange,
  errors = {},
  title = 'Skills',
  subtitle,
  showRequirement = false,
  showOrigin = true,
  idPrefix = 'skill',
}) {
  const update = (index, patch) => {
    onChange(skills.map((s, i) => (i === index ? markEdited({ ...s, ...patch }) : s)));
  };
  const remove = (index) => onChange(skills.filter((_, i) => i !== index));
  const add = () => onChange([...skills, showRequirement ? { ...blankSkill(), requirement: 'required' } : blankSkill()]);

  return (
    <Card>
      <CardHeader
        icon={Star}
        title={title}
        subtitle={subtitle}
        actions={
          <Button size="sm" icon={Plus} onClick={add}>
            Add skill
          </Button>
        }
      />
      <CardBody flush>
        {skills.length === 0 ? (
          <p className="small muted" style={{ padding: 20 }}>
            No skills yet. Add skills with a RADIX category, a short evidence quote, and an extraction confidence.
          </p>
        ) : (
          <div className={`skill-grid${showRequirement ? ' skill-grid--req' : ''}`} role="table" aria-label={title}>
            <div className="skill-grid__head" role="row">
              <span role="columnheader">Skill</span>
              <span role="columnheader">Category</span>
              <span role="columnheader">Evidence</span>
              <span role="columnheader">Confidence</span>
              {showRequirement && <span role="columnheader">Type</span>}
              <span role="columnheader">
                <span className="sr-only">Actions</span>
              </span>
            </div>
            {skills.map((s, i) => {
              const e = errors[i] || {};
              const label = s.skill_name || `skill ${i + 1}`;
              return (
                <div className="skill-grid__row" role="row" key={i}>
                  <div role="cell" className="skill-grid__name">
                    <input
                      id={`${idPrefix}-name-${i}`}
                      className="input input--sm"
                      value={s.skill_name}
                      placeholder="e.g. Python"
                      aria-label={`Skill name for row ${i + 1}`}
                      aria-invalid={e.skill_name ? 'true' : undefined}
                      onChange={(ev) => update(i, { skill_name: ev.target.value })}
                    />
                    {showOrigin && <OriginBadge origin={s.origin} />}
                    {e.skill_name && <span className="field__error">{e.skill_name}</span>}
                  </div>
                  <div role="cell">
                    <select
                      className="select select--sm"
                      value={s.category_code}
                      aria-label={`Category for ${label}`}
                      aria-invalid={e.category_code ? 'true' : undefined}
                      onChange={(ev) => update(i, { category_code: ev.target.value })}
                    >
                      <option value="">Category…</option>
                      {ALL_CATEGORIES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.code} — {c.name}
                        </option>
                      ))}
                    </select>
                    {e.category_code && <span className="field__error">{e.category_code}</span>}
                  </div>
                  <div role="cell">
                    <input
                      className="input input--sm"
                      value={s.evidence}
                      placeholder="Short quote or reason"
                      aria-label={`Evidence for ${label}`}
                      onChange={(ev) => update(i, { evidence: ev.target.value })}
                    />
                  </div>
                  <div role="cell">
                    <select
                      className="select select--sm"
                      value={s.confidence}
                      aria-label={`Extraction confidence for ${label}`}
                      aria-invalid={e.confidence ? 'true' : undefined}
                      onChange={(ev) => update(i, { confidence: ev.target.value })}
                    >
                      {CONFIDENCE_LEVELS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  {showRequirement && (
                    <div role="cell">
                      <select
                        className="select select--sm"
                        value={s.requirement || 'required'}
                        aria-label={`Requirement type for ${label}`}
                        onChange={(ev) => update(i, { requirement: ev.target.value })}
                      >
                        <option value="required">Required</option>
                        <option value="preferred">Preferred</option>
                      </select>
                    </div>
                  )}
                  <div role="cell" className="skill-grid__actions">
                    <IconButton icon={Trash2} label={`Remove ${label}`} size="sm" danger onClick={() => remove(i)} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
