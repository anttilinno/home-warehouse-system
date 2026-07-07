import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router";
import type { FilterDef } from "./filterDefs";
import { useUrlFilterState } from "./useUrlFilterState";
import {
  ALL_VIEW_ID,
  type SavedView,
  toViewSnapshot,
  useSavedViews,
} from "./useSavedViews";
import { searchFragments } from "./searchMatch";

export interface UseListViewsOptions {
  /** localStorage key for the v2 saved-views array. */
  storageKey: string;
  /** v1 preset key to migrate from once (defaults to `${storageKey}-legacy`). */
  legacyKey?: string;
  /** Localized "Yes" for boolean chips. */
  yesLabel?: string;
  /** Localized name shown for the synthetic ALL view (e.g. "All items"). */
  allViewName: string;
}

/**
 * One hook that wires a list page's whole filtering surface: URL-backed filter
 * state (`useUrlFilterState`), saved views + dirty tracking (`useSavedViews`),
 * the live `?q` box, and the view apply/save handlers — returning a `viewBar`
 * bag ready to spread into <ViewBar/>. Also exposes `fragments` (live q +
 * committed terms) for pages that filter rows on the client.
 */
export function useListViews(
  defs: FilterDef[],
  { storageKey, legacyKey, yesLabel, allViewName }: UseListViewsOptions,
) {
  const filters = useUrlFilterState(defs, { yesLabel });
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get("q") ?? "";

  const currentSnapshot = useMemo(
    () => toViewSnapshot(searchParams),
    [searchParams],
  );
  const views = useSavedViews({
    storageKey,
    legacyKey: legacyKey ?? `${storageKey}-legacy`,
    current: currentSnapshot,
  });

  const setQ = useCallback(
    (value: string) => {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          if (value) p.set("q", value);
          else p.delete("q");
          p.set("page", "1");
          return p;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const applyViewSnapshot = useCallback(
    (snapshot: Record<string, string>) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams();
        // Views own the filter params only; navigation (sort + tab) survives an
        // apply, page resets, live q is dropped.
        for (const key of ["sort", "sort_dir", "tab"]) {
          const v = prev.get(key);
          if (v) next.set(key, v);
        }
        for (const [k, v] of Object.entries(snapshot)) next.set(k, v);
        next.set("page", "1");
        return next;
      });
    },
    [setSearchParams],
  );

  const onApplyView = useCallback(
    (view: SavedView) => {
      applyViewSnapshot(view.snapshot);
      views.setActiveViewId(view.id);
    },
    [applyViewSnapshot, views],
  );
  const onApplyAll = useCallback(() => {
    applyViewSnapshot({});
    views.setActiveViewId(ALL_VIEW_ID);
  }, [applyViewSnapshot, views]);
  const onUpdateActive = useCallback(
    () => views.updateView(views.activeViewId),
    [views],
  );

  const fragments = useMemo(
    () => searchFragments(q, filters.terms),
    [q, filters.terms],
  );

  const viewBar = {
    defs,
    filters,
    views: views.views,
    activeViewId: views.activeViewId,
    isDirty: views.isDirty,
    activeViewName: views.activeView?.name ?? allViewName,
    allViewName,
    onApplyView,
    onApplyAll,
    onSaveAs: views.saveView,
    onUpdateActive,
    onDeleteView: views.deleteView,
    liveValue: q,
    onLiveChange: setQ,
  };

  return { filters, q, fragments, viewBar };
}
