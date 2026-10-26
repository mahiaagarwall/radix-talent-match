import { Plus, Trash2 } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../ui/Card';
import { Button, IconButton } from '../ui/Button';
import { TextField, TextAreaField } from '../ui/Fields';
import { OriginBadge, markEdited } from './OriginBadge';

// Generic add/edit/remove editor for profile entry lists (education, projects,
// internships, hackathons, certifications).
export function EntryListEditor({ title, icon, items, fields, onChange, addLabel = 'Add entry', emptyText, itemLabel = 'entry' }) {
  const blank = () => ({ ...Object.fromEntries(fields.map((f) => [f.key, ''])), origin: 'manual' });
  const update = (index, key, value) => onChange(items.map((it, i) => (i === index ? markEdited({ ...it, [key]: value }) : it)));
  const remove = (index) => onChange(items.filter((_, i) => i !== index));

  return (
    <Card>
      <CardHeader
        icon={icon}
        title={title}
        subtitle={items.length ? `${items.length} ${items.length === 1 ? itemLabel : `${itemLabel}s`}` : undefined}
        actions={
          <Button size="sm" icon={Plus} onClick={() => onChange([...items, blank()])}>
            {addLabel}
          </Button>
        }
      />
      <CardBody>
        {items.length === 0 ? (
          <p className="small muted">{emptyText || `No ${itemLabel}s added.`}</p>
        ) : (
          <div className="stack stack--sm">
            {items.map((item, i) => (
              <fieldset className="entry" key={i}>
                <legend className="sr-only">
                  {itemLabel} {i + 1}
                </legend>
                <div className="entry__head">
                  <span className="label-caps">
                    {itemLabel} {i + 1}
                  </span>
                  <OriginBadge origin={item.origin} />
                  <IconButton icon={Trash2} label={`Remove ${itemLabel} ${i + 1}`} size="sm" danger onClick={() => remove(i)} className="entry__remove" />
                </div>
                <div className="form-grid">
                  {fields.map((f) =>
                    f.multiline ? (
                      <TextAreaField
                        key={f.key}
                        className="span-2"
                        label={f.label}
                        value={item[f.key] || ''}
                        rows={2}
                        placeholder={f.placeholder}
                        onChange={(e) => update(i, f.key, e.target.value)}
                      />
                    ) : (
                      <TextField
                        key={f.key}
                        className={f.span ? 'span-2' : ''}
                        label={f.label}
                        size="sm"
                        value={item[f.key] || ''}
                        placeholder={f.placeholder}
                        onChange={(e) => update(i, f.key, e.target.value)}
                      />
                    ),
                  )}
                </div>
              </fieldset>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
