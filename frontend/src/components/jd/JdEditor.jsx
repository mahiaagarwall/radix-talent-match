import { Building2 } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../ui/Card';
import { TextField, TextAreaField } from '../ui/Fields';
import { SkillEditor } from '../profile/SkillEditor';

export function JdEditor({ jd, onChange, errors = {} }) {
  const set = (patch) => onChange({ ...jd, ...patch });
  return (
    <div className="stack">
      <Card>
        <CardHeader icon={Building2} title="Job metadata" subtitle={`Source: ${jd.source_file || 'manual entry'}`} />
        <CardBody>
          <div className="form-grid">
            <TextField label="Job title" required value={jd.role} error={errors.role} onChange={(e) => set({ role: e.target.value })} />
            <TextField label="Company" required value={jd.company} error={errors.company} onChange={(e) => set({ company: e.target.value })} />
            <TextField label="Role category" value={jd.role_category || ''} onChange={(e) => set({ role_category: e.target.value })} />
            <TextField label="Location" value={jd.location || ''} onChange={(e) => set({ location: e.target.value })} />
            <TextAreaField
              className="span-2"
              label="Experience requirements"
              rows={2}
              value={jd.experience_requirements || ''}
              hint="Only record what the JD actually states."
              onChange={(e) => set({ experience_requirements: e.target.value })}
            />
            <TextAreaField
              className="span-2"
              label="Education requirements"
              rows={2}
              value={jd.education_requirements || ''}
              onChange={(e) => set({ education_requirements: e.target.value })}
            />
          </div>
        </CardBody>
      </Card>
      {errors.skillsEmpty && (
        <p className="field__error" role="alert">
          {errors.skillsEmpty}
        </p>
      )}
      <SkillEditor
        title="Required skills"
        subtitle="Duplicates are merged on save. Required vs. preferred is a proposed contract extension used for weighting."
        skills={jd.skills}
        onChange={(skills) => set({ skills })}
        errors={errors.skills}
        showRequirement
        showOrigin={false}
        idPrefix="jd-skill"
      />
    </div>
  );
}
