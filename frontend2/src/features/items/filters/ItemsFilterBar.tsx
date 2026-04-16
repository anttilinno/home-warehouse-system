import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLingui } from "@lingui/react/macro";
import {
  RetroInput,
  RetroCombobox,
  RetroSelect,
  type RetroOption,
} from "@/components/retro";
import { categoriesApi, categoryKeys } from "@/lib/api/categories";
import { useAuth } from "@/features/auth/AuthContext";
import { ShowArchivedChip } from "./ShowArchivedChip";
import type {
  ItemsListUiState,
  ItemsSortField,
  ItemsSortDir,
} from "./useItemsListQueryParams";

export interface ItemsFilterBarProps {
  state: ItemsListUiState;
  onUpdate: (patch: Partial<ItemsListUiState>) => void;
  archivedCount: number;
}

/**
 * Composite filter bar above the items table.
 *
 * Debounce: 300ms for the search input (planner-tuned per UI-SPEC Interaction
 * Contracts). Only the search input is debounced; category / sort / chip
 * changes are immediate.
 *
 * Sort is rendered as a single RetroSelect combining field + direction so
 * the user has one control, not two. Values: "name:asc", "name:desc", etc.
 */
export function ItemsFilterBar({
  state,
  onUpdate,
  archivedCount,
}: ItemsFilterBarProps) {
  const { t } = useLingui();
  const { workspaceId } = useAuth();

  // Category combobox — picker uses archived:false (Pitfall 7). staleTime
  // 60s to avoid refetching on every mount.
  const params = { page: 1, limit: 100, archived: false } as const;
  const categoriesQuery = useQuery({
    queryKey: categoryKeys.list(params),
    queryFn: () => categoriesApi.list(workspaceId!, params),
    enabled: !!workspaceId,
    staleTime: 60_000,
  });
  const categoryOptions: RetroOption[] = useMemo(() => {
    const base: RetroOption[] = [{ value: "", label: t`All categories` }];
    const fetched = (categoriesQuery.data?.items ?? []).map((c) => ({
      value: c.id,
      label: c.name,
    }));
    return [...base, ...fetched];
  }, [categoriesQuery.data, t]);

  // Sort — combined dropdown. Labels are human-readable; value is
  // "{field}:{dir}" and split back on change.
  const sortOptions: RetroOption[] = useMemo(
    () => [
      { value: "name:asc", label: t`SORT: NAME (A → Z)` },
      { value: "name:desc", label: t`SORT: NAME (Z → A)` },
      { value: "sku:asc", label: t`SORT: SKU (A → Z)` },
      { value: "sku:desc", label: t`SORT: SKU (Z → A)` },
      { value: "created_at:desc", label: t`SORT: CREATED (NEWEST FIRST)` },
      { value: "created_at:asc", label: t`SORT: CREATED (OLDEST FIRST)` },
      { value: "updated_at:desc", label: t`SORT: UPDATED (NEWEST FIRST)` },
      { value: "updated_at:asc", label: t`SORT: UPDATED (OLDEST FIRST)` },
    ],
    [t],
  );
  const sortValue = `${state.sort}:${state.sortDir}`;

  // Search — controlled local input, debounced write-through to URL.
  const [searchInput, setSearchInput] = useState(state.q);

  // If the URL state changes externally (browser back, clearFilters), resync
  // the local input. The matching react-hooks lint rule fires on this
  // pattern; it is also fired on many pre-existing files (AuthContext,
  // AppShell, ActivityFeed, …) — this is the project convention for syncing
  // controlled state to an external source.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSearchInput(state.q);
  }, [state.q]);

  // Debounced write: local input → URL state after 300ms of no keystrokes.
  useEffect(() => {
    if (searchInput === state.q) return; // already in sync
    const handle = setTimeout(() => {
      onUpdate({ q: searchInput });
    }, 300);
    return () => clearTimeout(handle);
  }, [searchInput, state.q, onUpdate]);

  return (
    <div className="flex items-center gap-md flex-wrap" role="search">
      <RetroInput
        type="search"
        placeholder={t`Search name, SKU, or barcode…`}
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        aria-label={t`Search items`}
      />
      <RetroCombobox
        options={categoryOptions}
        value={state.category ?? ""}
        onChange={(value) => onUpdate({ category: value || null })}
        placeholder={t`CATEGORY: ALL`}
      />
      <RetroSelect
        options={sortOptions}
        value={sortValue}
        onChange={(v) => {
          const [field, dir] = v.split(":");
          onUpdate({
            sort: field as ItemsSortField,
            sortDir: dir as ItemsSortDir,
          });
        }}
      />
      <ShowArchivedChip
        active={state.archived}
        count={archivedCount}
        onToggle={() => onUpdate({ archived: !state.archived })}
      />
    </div>
  );
}
