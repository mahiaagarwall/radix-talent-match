// Demo-mode keyword scan for PASTED job-description text.
//
// This is deliberately simple and labelled as such in the UI: it only reports
// terms that literally occur in the text, quotes the sentence they occur in as
// evidence, and marks every result "low" confidence. The real extractor (LLM-based,
// per the participant brief) belongs to the FastAPI backend.

import { dedupeSkills } from './skillNormalizer';

const LEXICON = [
  { re: /\bsql\b|\bquer(y|ies)\b/i, skill: 'SQL', cat: 'SQL' },
  { re: /\bschema\b|\bnormali[sz]e\b|\bindex(ing)?\b/i, skill: 'Database Schema Design', cat: 'SQL' },
  { re: /data structures?|algorithms?|complexity analysis/i, skill: 'Data Structures & Algorithms', cat: 'DSA' },
  { re: /object[- ]oriented|\boop\b|solid principles|design patterns|polymorphism|inheritance/i, skill: 'Object-Oriented Design', cat: 'OOD' },
  { re: /system design|distributed system|design at the system level|scalab/i, skill: 'System Design', cat: 'SYSD' },
  { re: /operating systems?|virtual memory|process scheduling|multithreading|concurrency|threads?\b/i, skill: 'Operating Systems', cat: 'OS' },
  { re: /\blinux\b|command[- ]line/i, skill: 'Linux', cat: 'OS' },
  { re: /network|tcp|udp|\bhttp\b|ip address|latency|rest apis?/i, skill: 'Networking', cat: 'NETW' },
  { re: /machine learning|\bml\b|regression|classification|overfitting|gradient descent|predictive model/i, skill: 'Machine Learning', cat: 'AI' },
  { re: /\bcloud\b|\bazure\b|\baws\b|\bgcp\b/i, skill: 'Cloud Infrastructure', cat: 'CLOUD' },
  { re: /communicat|stakeholder|present (findings|results)|explain .* to/i, skill: 'Communication', cat: 'COMM' },
  { re: /quantitative|aptitude|logical reasoning|analytical reasoning|probability|arithmetic/i, skill: 'Quantitative Aptitude', cat: 'APTI' },
  { re: /\bstatistic/i, skill: 'Statistics', cat: 'APTI' },
  { re: /a\/b test|experiment/i, skill: 'A/B Testing', cat: 'APTI' },
  { re: /testing strategy|unit test|code review|ci\/cd|technical debt|agile|waterfall|sdlc|software development lifecycle/i, skill: 'Software Engineering Practices', cat: 'SWE' },
  { re: /\bcoding\b|programming|write (clean|efficient) code|working, efficient code/i, skill: 'Programming', cat: 'COD' },
  { re: /\bpython\b/i, skill: 'Python', cat: 'COD' },
  { re: /\bjava\b/i, skill: 'Java', cat: 'COD' },
  { re: /\bc\+\+/i, skill: 'C++', cat: 'COD' },
  { re: /javascript|typescript/i, skill: 'JavaScript', cat: 'COD' },
  { re: /power bi|tableau|dashboard|visuali[sz]ation/i, skill: 'Data Visualization', cat: 'OTHER' },
  { re: /troubleshoot|triage|incident/i, skill: 'Technical Troubleshooting', cat: 'OTHER' },
];

const PREFERRED_HEADING = /^(nice to have|preferred|bonus|good to have)/i;

function splitSentences(text) {
  const lines = text.split(/\r?\n/);
  const out = [];
  let preferred = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (PREFERRED_HEADING.test(line)) preferred = true;
    else if (/^(key responsibilities|what we're looking for|requirements|role overview|benefits)/i.test(line)) preferred = false;
    line
      .split(/(?<=[.;!?])\s+/)
      .filter(Boolean)
      .forEach((s) => out.push({ text: s, preferred }));
  }
  return out;
}

export function scanJobDescriptionText(text) {
  const trimmed = String(text || '').trim();
  if (trimmed.length < 40) {
    throw new Error('Paste the full job description text (at least a few sentences) before analyzing.');
  }
  const sentences = splitSentences(trimmed);
  const found = [];
  for (const entry of LEXICON) {
    const hits = sentences.filter((s) => entry.re.test(s.text));
    if (!hits.length) continue;
    const first = hits.find((h) => !h.preferred) || hits[0];
    found.push({
      skill_name: entry.skill,
      category_code: entry.cat,
      evidence: first.text.length > 220 ? `${first.text.slice(0, 217)}…` : first.text,
      confidence: 'low',
      requirement: hits.some((h) => !h.preferred) ? 'required' : 'preferred',
    });
  }
  return dedupeSkills(found);
}
