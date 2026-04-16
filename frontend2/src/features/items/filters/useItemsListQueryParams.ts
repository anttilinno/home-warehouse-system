import { useCallback } from "react";
import { useSearchParams } from "react-router";

export type ItemsSortField = "name" | "sku" | "created_at" | "updated_at";
export type ItemsSortDir = "asc" | "desc";

export interface ItemsListUiState {
  q: string;
  category: string | null;
  sort: ItemsSortField;
  sortDir: ItemsSortDir;
  archived: boolean;
  page: number;
}

/**
 * URL-state hook for the items list filter bar.
 *
 * Source of truth = URL query string. Supports deep-linking and browser
 * back/forward navigation (the history stack carries filter state).
 *
 * CRITICAL (Pitfall 8): When any non-page filter changes without an explicit
 * page, reset page to 1 (delete the ?page= key). Otherwise, changing from
 * page-5-of-search-A to search-B shows an empty "page 5 of new results"
 * state.
 *
 * clearFilters: removes q/category/archived/page but PRESERVES sort/dir —
 * the user's ordering preference survives a filter reset (UI-SPEC
 * §Interaction Contracts).
 */
export function useItemsListQueryParams(): [
  ItemsListUiState,
  (patch: Partial<ItemsListUiState>) => void,
  () => void,
] {
  const [sp, setSp] = useSearchParams();

  const state: ItemsListUiState = {
    q: sp.get("q") ?? "",
    category: sp.get("category"),
    sort: (sp.get("sort") as ItemsSortField) ?? "name",
    sortDir: (sp.get("dir") as ItemsSortDir) ?? "asc",
    archived: sp.get("archived") === "1",
    page: Math.max(1, Number(sp.get("page") ?? 1)),
  };

  const update = useCallback(
    (patch: Partial<ItemsListUiState>) => {
      setSp((prev) => {
        const next = new URLSearchParams(prev);
        if (patch.q !== undefined) {
          if (patch.q) next.set("q", patch.q);
          else next.delete("q");
        }
        if (patch.category !== undefined) {
          if (patch.category) next.set("category", patch.category);
          else next.delete("category");
        }
        if (patch.sort !== undefined) next.set("sort", patch.sort);
        if (patch.sortDir !== undefined) next.set("dir", patch.sortDir);
        if (patch.archived !== undefined) {
          if (patch.archived) next.set("archived", "1");
          else next.delete("archived");
        }
        if (patch.page !== undefined) {
          if (patch.page > 1) next.set("page", String(patch.page));
          else next.delete("page");
        }
        // Pitfall 8: reset page when any non-page filter changes without an
        // explicit page value in the same patch.
        const nonPageFilterChanged =
          patch.q !== undefined ||
          patch.category !== undefined ||
          patch.archived !== undefined ||
          patch.sort !== undefined ||
          patch.sortDir !== undefined;
        if (nonPageFilterChanged && patch.page === undefined) {
          next.delete("page");
        }
        return next;
      });
    },
    [setSp],
  );

  const clearFilters = useCallback(() => {
    setSp((prev) => {
      const next = new URLSearchParams(prev);
      // Preserve sort + dir; remove q, category, archived, page.
      ["q", "category", "archived"].forEach((k) => next.delete(k));
      next.delete("page");
      return next;
    });
  }, [setSp]);

  return [state, update, clearFilters];
}
