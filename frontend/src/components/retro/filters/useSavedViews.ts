import { useCallback, useEffect, useMemo, useState } from "react";

/**
 * A saved VIEW: a named snapshot of the list's filter state (def params + terms),
 * EXCLUDING the live search box, sort, and page. The successor to `SavedFilter`
 * (localStorage, server prefs deferred). The snapshot is a URL-param map so it
 * round-trips through `useUrlFilterState` with zero translation.
 */
export interface SavedView {
  id: string;
  name: string;
  snapshot: Record<string, string>;
  createdAt: string;
}

/** URL params that are NOT part of a view (live search, sort, paging, tab nav). */
export const NON_VIEW_KEYS = new Set(["q", "page", "sort", "sort_dir", "tab"]);

/** The synthetic, non-deletable, non-updatable default view (empty snapshot). */
export const ALL_VIEW_ID = "all";

/** Reduce a URLSearchParams to a view snapshot (drops the non-view keys). Pure. */
export function toViewSnapshot(
  params: URLSearchParams,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of params.entries()) {
    if (!NON_VIEW_KEYS.has(k) && v) out[k] = v;
  }
  return out;
}

// Canonical form of a snapshot: sorted keys, and each value's comma list sorted
// (multi-enum + terms compare order-insensitively). Empty values are dropped.
function canonical(s: Record<string, string>): string {
  return Object.keys(s)
    .filter((k) => s[k] !== "")
    .sort()
    .map((k) => {
      const parts = s[k]
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean)
        .sort();
      return `${k}=${parts.join(",")}`;
    })
    .join("&");
}

/** True when two snapshots differ (order-insensitive on multi-values). Pure. */
export function viewDiff(
  a: Record<string, string>,
  b: Record<string, string>,
): boolean {
  return canonical(a) !== canonical(b);
}

/** Whether a snapshot carries any filter at all (drives the ALL-view dirty test). */
export function snapshotIsEmpty(s: Record<string, string>): boolean {
  return canonical(s) === "";
}

function isSavedViewArray(value: unknown): value is SavedView[] {
  return (
    Array.isArray(value) &&
    value.every(
      (v) =>
        typeof v === "object" &&
        v !== null &&
        typeof (v as SavedView).id === "string" &&
        typeof (v as SavedView).name === "string",
    )
  );
}

// One-time migration of the v1 SavedFilter[] presets (`filters` = a URL-param
// map that already included q/sort) into v2 SavedView[] (snapshot stripped of
// the non-view keys). The v1 key is deleted once migrated.
function migrateV1(v1Key: string): SavedView[] {
  try {
    const raw = localStorage.getItem(v1Key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const views: SavedView[] = [];
    for (const p of parsed as Array<Record<string, unknown>>) {
      if (typeof p.id !== "string" || typeof p.name !== "string") continue;
      const snapshot: Record<string, string> = {};
      const filters = (p.filters ?? {}) as Record<string, unknown>;
      for (const [k, v] of Object.entries(filters)) {
        if (!NON_VIEW_KEYS.has(k) && typeof v === "string" && v)
          snapshot[k] = v;
      }
      views.push({
        id: p.id,
        name: p.name,
        snapshot,
        createdAt: (p.createdAt as string) ?? new Date().toISOString(),
      });
    }
    localStorage.removeItem(v1Key);
    return views;
  } catch {
    return [];
  }
}

function loadViews(storageKey: string, v1Key: string): SavedView[] {
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const candidate: unknown = JSON.parse(stored);
      if (isSavedViewArray(candidate)) return candidate;
    }
  } catch {
    // Malformed payload — fall through to a v1 migration attempt / clean slate.
  }
  return migrateV1(v1Key);
}

export interface UseSavedViewsOptions {
  /** localStorage key for the v2 view array. */
  storageKey: string;
  /** The v1 preset key to migrate from (once), then delete. */
  legacyKey: string;
  /** The current list snapshot (def params + terms), for active/dirty derivation. */
  current: Record<string, string>;
}

/**
 * localStorage-backed saved VIEWS with a derived active view + dirty flag.
 *
 * `activeViewId` is the LAST-APPLIED view (session state, not persisted). The
 * active view is: the view whose snapshot exactly matches `current` (clean), or
 * else the last-applied view (DIRTY), or else ALL. Deriving the clean match by
 * deep-compare — rather than trusting a stored id — means a manual URL edit that
 * lands on a saved view still lights it up, and one that drifts off marks dirty.
 */
export function useSavedViews({
  storageKey,
  legacyKey,
  current,
}: UseSavedViewsOptions) {
  const [views, setViews] = useState<SavedView[]>([]);
  const [activeViewId, setActiveViewId] = useState<string>(ALL_VIEW_ID);

  useEffect(() => {
    setViews(loadViews(storageKey, legacyKey));
  }, [storageKey, legacyKey]);

  const persist = useCallback(
    (next: SavedView[]) => {
      setViews(next);
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // Quota/availability — in-memory state stays authoritative this session.
      }
    },
    [storageKey],
  );

  const saveView = useCallback(
    (name: string): SavedView => {
      const view: SavedView = {
        id: crypto.randomUUID(),
        name,
        snapshot: current,
        createdAt: new Date().toISOString(),
      };
      persist([...views, view]);
      setActiveViewId(view.id);
      return view;
    },
    [current, views, persist],
  );

  const updateView = useCallback(
    (id: string) => {
      persist(
        views.map((v) => (v.id === id ? { ...v, snapshot: current } : v)),
      );
    },
    [current, views, persist],
  );

  const deleteView = useCallback(
    (id: string) => {
      persist(views.filter((v) => v.id !== id));
      setActiveViewId((prev) => (prev === id ? ALL_VIEW_ID : prev));
    },
    [views, persist],
  );

  // Derived: the exact-match view (clean), else the last-applied view (dirty).
  const matched = useMemo(
    () => views.find((v) => !viewDiff(v.snapshot, current)),
    [views, current],
  );
  const lastApplied = useMemo(
    () => views.find((v) => v.id === activeViewId),
    [views, activeViewId],
  );
  const activeView = matched ?? lastApplied ?? null;
  const isDirty = !matched && !snapshotIsEmpty(current);

  return {
    views,
    activeView, // null → the synthetic ALL view
    activeViewId: activeView?.id ?? ALL_VIEW_ID,
    isDirty,
    saveView,
    updateView,
    deleteView,
    setActiveViewId,
  };
}
