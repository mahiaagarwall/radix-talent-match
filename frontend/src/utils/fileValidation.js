import { MAX_UPLOAD_BYTES } from '../app/config';
import { formatBytes } from './format';

export const ACCEPTED_EXTENSIONS = ['.pdf', '.docx'];
export const ACCEPT_ATTR =
  '.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const TYPE_LABELS = { pdf: 'PDF document', docx: 'Word document (DOCX)' };

export function fileKind(name) {
  const m = /\.([a-z0-9]+)$/i.exec(name || '');
  return m ? m[1].toLowerCase() : '';
}

export function describeFileType(name) {
  return TYPE_LABELS[fileKind(name)] || 'Unsupported type';
}

// Synchronous checks: extension, size, emptiness.
export function validateFileBasics(file) {
  if (!file) return { ok: false, code: 'missing', message: 'Choose a file to continue.' };
  const kind = fileKind(file.name);
  if (kind === 'doc') {
    return {
      ok: false,
      code: 'unsupported',
      message: 'Legacy .doc files are not supported. Save the document as .docx or PDF and try again.',
    };
  }
  if (!['pdf', 'docx'].includes(kind)) {
    return {
      ok: false,
      code: 'unsupported',
      message: `"${file.name}" is not a supported file. Upload a PDF or DOCX document.`,
    };
  }
  if (file.size === 0) {
    return { ok: false, code: 'unreadable', message: `"${file.name}" is empty and cannot be read.` };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      code: 'too_large',
      message: `"${file.name}" is ${formatBytes(file.size)}. The limit is ${formatBytes(MAX_UPLOAD_BYTES)}.`,
    };
  }
  return { ok: true, kind };
}

function readHeader(file, n) {
  if (typeof file.slice !== 'function') return Promise.resolve(null);
  const blob = file.slice(0, n);
  if (typeof blob.arrayBuffer === 'function') {
    return blob.arrayBuffer().then((buf) => new Uint8Array(buf));
  }
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result));
    reader.onerror = () => resolve(null);
    reader.readAsArrayBuffer(blob);
  });
}

// Full validation: basics + signature ("magic bytes") check so a renamed or
// corrupted file is rejected as unreadable before it is ever sent anywhere.
export async function validateDocumentFile(file) {
  const basic = validateFileBasics(file);
  if (!basic.ok) return basic;
  let header;
  try {
    header = await readHeader(file, 5);
  } catch {
    header = null;
  }
  if (!header) {
    return { ok: false, code: 'unreadable', message: `"${file.name}" could not be read by the browser.` };
  }
  const ascii = String.fromCharCode(...header);
  const looksPdf = ascii.startsWith('%PDF');
  const looksZip = header[0] === 0x50 && header[1] === 0x4b; // "PK" — DOCX is a ZIP container
  if (basic.kind === 'pdf' && !looksPdf) {
    return {
      ok: false,
      code: 'unreadable',
      message: `"${file.name}" has a .pdf extension but is not a valid PDF file. It may be corrupted or renamed.`,
    };
  }
  if (basic.kind === 'docx' && !looksZip) {
    return {
      ok: false,
      code: 'unreadable',
      message: `"${file.name}" has a .docx extension but is not a valid Word document. It may be corrupted or renamed.`,
    };
  }
  return { ok: true, kind: basic.kind };
}

export function fileMeta(file) {
  return {
    file_name: file.name,
    file_type: fileKind(file.name),
    file_size: file.size,
  };
}
