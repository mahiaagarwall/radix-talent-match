// Demo persistence adapter: a tiny keyed collection over browser storage.
// Swap-out point for API persistence — services only call these methods.

import { readJson, writeJson } from './storage';

export function createLocalCollection(storageKey, idField) {
  const all = () => readJson(storageKey, []);
  const saveAll = (items) => writeJson(storageKey, items);

  return {
    list() {
      return [...all()].sort((a, b) => String(b.updated_at || b.created_at).localeCompare(String(a.updated_at || a.created_at)));
    },
    get(id) {
      return all().find((item) => item[idField] === id) || null;
    },
    upsert(item) {
      const items = all();
      const idx = items.findIndex((x) => x[idField] === item[idField]);
      if (idx >= 0) items[idx] = item;
      else items.push(item);
      saveAll(items);
      return item;
    },
    remove(id) {
      saveAll(all().filter((x) => x[idField] !== id));
    },
    clear() {
      saveAll([]);
    },
  };
}

// Lets demo operations resolve asynchronously like real requests, so loading
// states render the same way in both modes.
export const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));
