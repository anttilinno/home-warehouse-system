/**
 * Command-palette MRU store.
 *
 * Persists recently-selected palette rows (routes, workspaces, and entity hits)
 * to localStorage under `hws-palette-recent`. 1:1 shape-port of
 * `lib/scanner/scan-history.ts`:
 *  - rolling list, newest first, capped at MAX_RECENT (10);
 *  - de-duplication by `id` (re-selecting moves the entry to the top);
 *  - read-side validator drops malformed entries and NEVER throws on bad JSON
 *    (the store is attacker-tamperable — T-16-04; ids are treated as opaque and
 *    re-validated by the existing route guards on navigate).
 *
 * LINT LANDMINE (FOUND-02): `palette`/`recent`/`command` are SAFE substrings;
 * nothing here is named `*sync*`/`*idb*`/`*offline*`.
 */

const RECENT_KEY = "hws-palette-recent";
const MAX_RECENT = 10;

/** What a palette row points at — drives the navigation it replays. */
export type RecentKind =
  | "route"
  | "workspace"
  | "item"
  | "borrower"
  | "location"
  | "container";

export interface RecentEntry {
  /** Stable opaque id (route path, workspace id, or entity id). */
  id: string;
  kind: RecentKind;
  /** Display label rendered in the Recent group. */
  label: string;
  /** Navigation target (absent for workspace rows, which call setWorkspace). */
  to?: string;
}

function isRecentEntry(value: unknown): value is RecentEntry {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.id === "string" &&
    typeof entry.kind === "string" &&
    typeof entry.label === "string" &&
    (entry.to === undefined || typeof entry.to === "string")
  );
}

/**
 * All recent entries, newest first. Returns `[]` (never throws) on missing key,
 * non-array payload, or malformed JSON; entries failing the shape validator are
 * filtered out (tolerant of stale/tampered data — T-16-04).
 */
export function getRecent(): RecentEntry[] {
  if (typeof globalThis.window === "undefined") {
    return [];
  }

  try {
    const stored = localStorage.getItem(RECENT_KEY);
    if (!stored) {
      return [];
    }

    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isRecentEntry);
  } catch {
    // Bad JSON / storage error → empty list (never throw on stale data).
    return [];
  }
}

/**
 * Record a palette selection. De-dupes by `id` (existing entry removed),
 * prepends the new entry, and caps the list at 10. Storage failures are
 * swallowed (the MRU is best-effort).
 */
export function addRecent(entry: RecentEntry): void {
  if (typeof globalThis.window === "undefined") {
    return;
  }

  try {
    const recent = getRecent();
    const filtered = recent.filter((r) => r.id !== entry.id);
    const updated = [entry, ...filtered].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
  } catch {
    // Quota / serialization failure — drop silently.
  }
}
