import { describe, it, expect } from 'vitest';
import { validateDocumentFile } from '../src/utils/fileValidation';
import { findResumeFixtureByFile, findJdFixtureByFile } from '../src/data/fixtures';

const make = (bytes, name, type = '') => new File([bytes], name, { type });

describe('document validation', () => {
  it('accepts a real PDF signature and a DOCX (zip) signature', async () => {
    expect((await validateDocumentFile(make('%PDF-1.7 rest', 'cv.pdf'))).ok).toBe(true);
    expect((await validateDocumentFile(make(new Uint8Array([0x50, 0x4b, 3, 4, 0]), 'cv.docx'))).ok).toBe(true);
  });

  it('rejects unsupported extensions, empty files and renamed files', async () => {
    expect((await validateDocumentFile(make('hello', 'notes.txt'))).code).toBe('unsupported');
    expect((await validateDocumentFile(make('x', 'old.doc'))).code).toBe('unsupported');
    expect((await validateDocumentFile(make('', 'empty.pdf'))).code).toBe('unreadable');
    expect((await validateDocumentFile(make('not a pdf', 'fake.pdf'))).code).toBe('unreadable');
  });
});

describe('sample fixtures', () => {
  it('map only exact sample-pack file names', () => {
    expect(findResumeFixtureByFile('Ananya Rao.pdf')?.key).toBe('ananya-rao');
    expect(findResumeFixtureByFile('Ananya Rao (1).docx')?.key).toBe('ananya-rao');
    expect(findResumeFixtureByFile('my_resume.pdf')).toBeNull();
    expect(findJdFixtureByFile('Google LLC - Data Scientist.pdf')?.key).toBe('google-ds');
  });
});
