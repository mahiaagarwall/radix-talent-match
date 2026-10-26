import { Badge } from '../ui/Badges';

// Frontend-only provenance marker: shows whether an entry came from Resume
// Parsing, was edited after extraction, or was added by hand.
export function OriginBadge({ origin }) {
  if (origin === 'extracted') return <Badge tone="indigo" title="Pre-filled from Resume Parsing">Extracted</Badge>;
  if (origin === 'edited') return <Badge tone="warning" title="Extracted, then changed by the candidate">Edited</Badge>;
  if (origin === 'manual') return <Badge tone="outline" title="Added manually">Manual</Badge>;
  return null;
}

export function markEdited(item) {
  return item.origin === 'extracted' ? { ...item, origin: 'edited' } : item;
}
