// Phase 10 Plan 01 — tiny try/catch wrapper around sessionStorage for the
// RetroTree expand-set persistence. There is NO sessionStorage precedent in
// frontend (verified grep), so this is the canonical helper. The try/catch
// guards private-mode / quota / disabled-storage failures: a read failure
// yields [] (collapsed default), a write failure is silently swallowed (the UI
// stays usable, it just won't persist).
//
// Values are JSON-serialized string[] (the expanded node-id set, flattened).

export function getSet(key: string): string[] {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === "string");
  } catch {
    return [];
  }
}

export function saveSet(key: string, ids: string[]): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(ids));
  } catch {
    // private mode / quota exceeded — non-fatal; expand state just won't persist.
  }
}

export const safeSessionStorage = { getSet, saveSet };
