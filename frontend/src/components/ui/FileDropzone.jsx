import { useId, useRef, useState } from 'react';
import { UploadCloud, FileText, X } from 'lucide-react';
import { Button, IconButton } from './Button';
import { ACCEPT_ATTR, describeFileType } from '../../utils/fileValidation';
import { formatBytes } from '../../utils/format';

export function FileDropzone({ onFile, disabled = false, accept = ACCEPT_ATTR, title, hint, inputLabel = 'Upload a document' }) {
  const inputRef = useRef(null);
  const [active, setActive] = useState(false);
  const id = useId();

  const pick = (fileList) => {
    const file = fileList?.[0];
    if (file) onFile(file);
  };

  return (
    <div
      className={`dropzone${active ? ' dropzone--active' : ''}${disabled ? ' dropzone--disabled' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setActive(true);
      }}
      onDragLeave={() => setActive(false)}
      onDrop={(e) => {
        e.preventDefault();
        setActive(false);
        if (!disabled) pick(e.dataTransfer.files);
      }}
    >
      <div className="dropzone__icon" aria-hidden="true">
        <UploadCloud size={22} />
      </div>
      <p className="strong">{title || 'Drag and drop a file here'}</p>
      <p className="small muted">{hint || 'PDF or DOCX, up to 10 MB'}</p>
      <label htmlFor={id} className="sr-only">
        {inputLabel}
      </label>
      <input
        id={id}
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        tabIndex={-1}
        disabled={disabled}
        onChange={(e) => {
          pick(e.target.files);
          e.target.value = '';
        }}
      />
      <Button variant="secondary" size="sm" onClick={() => inputRef.current?.click()} disabled={disabled} style={{ marginTop: 8 }}>
        Browse files
      </Button>
    </div>
  );
}

export function FileChip({ file, onRemove }) {
  if (!file) return null;
  const name = file.name || file.file_name;
  const size = file.size ?? file.file_size;
  return (
    <div className="file-chip">
      <div className="file-chip__icon" aria-hidden="true">
        <FileText size={18} />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <p className="strong truncate">{name}</p>
        <p className="file-chip__meta">
          {describeFileType(name)} · {size != null ? formatBytes(size) : 'size unknown'}
        </p>
      </div>
      {onRemove && <IconButton icon={X} label={`Remove ${name}`} size="sm" onClick={onRemove} />}
    </div>
  );
}
