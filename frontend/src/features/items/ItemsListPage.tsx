import { useCallback, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Trans, useLingui } from "@lingui/react/macro";
import {
  Window,
  BevelButton,
  useTableSelection,
  FilterBar,
  FilterPopover,
  SavedFilters,
  useSavedFilters,
  retroToast,
} from "@/components/retro";
import { useShortcuts } from "@/components/shortcuts";
import { useWorkspace } from "@/features/workspace/useWorkspace";
import { photosApi } from "@/lib/api/photos";
import type { Item } from "@/lib/types";
import { useItemsQuery } from "./hooks/useItemsQuery";
import { useItemMutations } from "./hooks/useItemMutations";
import { ItemsResults } from "./components/ItemsResults";
import { ItemsBulkBar } from "./components/ItemsBulkBar";
import { DeleteItemDialog } from "./components/DeleteItemDialog";

const SAVED_FILTERS_KEY = "items-list-filters/v1";

export function ItemsListPage() {
  const { t } = useLingui();
  const navigate = useNavigate();
  const { currentWorkspaceId: wsId, workspaces } = useWorkspace();
  const [searchParams, setSearchParams] = useSearchParams();

  const { data, isLoading, isError, state } = useItemsQuery();
  const { archive, restore, del } = useItemMutations();
  // RQ v5 returns a NEW mutation object each render, but the `.mutate` function
  // identity is stable. Depend on the stable mutate fns (NOT the wrapper
  // objects) so the shortcut-binding memos below don't churn the registry into
  // an infinite re-register loop (#Pitfall 3).
  const archiveItem = archive.mutate;
  const restoreItem = restore.mutate;
  const deleteItem = del.mutate;

  const items = useMemo(() => data?.items ?? [], [data]);
  const totalPages = data?.total_pages ?? 1;
  const currentPage = data?.page ?? state.page;

  const workspaceName =
    workspaces?.find((w) => w.id === wsId)?.name ?? t`Workspace`;

  // ── URL param writer (Pattern 1): mutate one key, reset page on filter change.
  const setParam = useCallback(
    (key: string, value: string | null) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value) next.set(key, value);
          else next.delete(key);
          // Any filter/sort change returns to page 1 (stale-page guard).
          if (key !== "page") next.set("page", "1");
          return next;
        },
        { replace: key === "q" },
      );
    },
    [setSearchParams],
  );

  // ── Selection (drives the desktop Bottombar chips + the mobile BulkActionBar).
  const selection = useTableSelection(items);
  const selected = selection.selected;
  const selectedCount = selected.size;
  const clearSelection = selection.clear;

  // Delete is archived-only: the whole selection must be archived (ITEM-06 /
  // T-07-07). A mixed/live selection disables DELETE with a hint toast.
  const selectedItems = useMemo(
    () => items.filter((i) => selected.has(i.id)),
    [items, selected],
  );
  const allSelectedArchived =
    selectedCount > 0 && selectedItems.every((i) => i.is_archived);

  // ── Bulk actions register into the shortcuts SSOT while a selection exists
  // (Phase 3 Bottombar reads the same SSOT → desktop key-cap chips; no second
  // desktop bar). Memoize on stable deps only (Pitfall 3).
  const bulkArchive = useCallback(() => {
    selectedItems.forEach((i) => {
      if (i.is_archived) restoreItem(i.id);
      else archiveItem(i.id);
    });
    clearSelection();
  }, [selectedItems, archiveItem, restoreItem, clearSelection]);

  const onlyArchivedMsg = t`Only archived items can be deleted.`;
  const bulkDelete = useCallback(() => {
    if (!allSelectedArchived) {
      retroToast.error(onlyArchivedMsg);
      return;
    }
    selectedItems.forEach((i) => {
      deleteItem({ id: i.id, isArchived: i.is_archived ?? false });
    });
    clearSelection();
  }, [
    allSelectedArchived,
    selectedItems,
    deleteItem,
    clearSelection,
    onlyArchivedMsg,
  ]);

  // Labels via the `t` macro directly; memo keys on the resolved strings
  // (stable within a locale, re-run on language switch) so the register effect
  // never loops.
  const archiveLabel = t`Archive ${selectedCount} selected`;
  const deleteLabel = t`Delete ${selectedCount} selected`;
  const bulkActions = useMemo(
    () =>
      selectedCount > 0
        ? [
            { key: "A", label: archiveLabel, action: bulkArchive },
            { key: "X", label: deleteLabel, action: bulkDelete, danger: true },
          ]
        : [],
    [selectedCount, bulkArchive, bulkDelete, archiveLabel, deleteLabel],
  );
  useShortcuts("bulk-actions", bulkActions);

  // ── Route shortcuts (ITEM-10): N → new, / → focus search, F → toggle Archived.
  const goNew = useCallback(() => navigate("/items/new"), [navigate]);
  const focusSearch = useCallback(() => {
    document.querySelector<HTMLInputElement>('input[type="search"]')?.focus();
  }, []);
  const toggleArchived = useCallback(() => {
    setParam("archived", state.archived ? null : "true");
  }, [setParam, state.archived]);

  const labelNew = t`New item`;
  const labelSearch = t`Focus search`;
  const labelToggle = t`Toggle archived`;
  const routeShortcuts = useMemo(
    () => [
      { key: "N", label: labelNew, action: goNew },
      { key: "/", label: labelSearch, action: focusSearch },
      { key: "F", label: labelToggle, action: toggleArchived },
    ],
    [goNew, focusSearch, toggleArchived, labelNew, labelSearch, labelToggle],
  );
  useShortcuts("items", routeShortcuts);

  // ── SavedFilters: serialize/restore the full ?q&category&archived&sort shape.
  const applyPreset = useCallback(
    (filters: Record<string, unknown>) => {
      setSearchParams(() => {
        const next = new URLSearchParams();
        for (const [k, v] of Object.entries(filters)) {
          if (typeof v === "string" && v) next.set(k, v);
        }
        next.set("page", "1");
        return next;
      });
    },
    [setSearchParams],
  );
  const { savedFilters, saveFilter, deleteFilter, applyFilter } =
    useSavedFilters({
      storageKey: SAVED_FILTERS_KEY,
      onApplyFilter: applyPreset,
    });

  const onSaveCurrent = useCallback(
    (name: string) => {
      const snapshot: Record<string, string> = {};
      for (const [k, v] of searchParams.entries()) {
        if (k !== "page") snapshot[k] = v;
      }
      saveFilter(name, snapshot);
    },
    [searchParams, saveFilter],
  );

  // ── CSV export (blob download via the photosApi helper).
  const onExport = useCallback(() => {
    if (!wsId) return;
    photosApi
      .exportCsv(wsId)
      .catch(() => retroToast.error(t`Couldn't export the item list.`));
  }, [wsId, t]);

  // ── Type-to-confirm single delete (archived rows only).
  const [pendingDelete, setPendingDelete] = useState<Item | null>(null);
  const [confirmName, setConfirmName] = useState("");

  // ── Sort header toggling.
  function onSort(sortKey: string) {
    if (state.sort === sortKey) {
      setParam("sort_dir", state.sortDir === "asc" ? "desc" : "asc");
    } else {
      setParam("sort", sortKey);
    }
  }
  function sortGlyph(sortKey: string) {
    if (state.sort !== sortKey) return "";
    return state.sortDir === "asc" ? " ↑" : " ↓";
  }

  // ── Active-filter chips (live state) for the FilterBar.
  const filterChips = useMemo(() => {
    const chips: { key: string; label: string; displayValue: string }[] = [];
    if (state.category)
      chips.push({
        key: "category",
        label: t`Category`,
        displayValue: state.category,
      });
    if (state.archived)
      chips.push({
        key: "archived",
        label: t`Archived`,
        displayValue: t`shown`,
      });
    return chips;
  }, [state.category, state.archived, t]);

  const hasFilters = !!state.q || !!state.category || state.archived;

  function clearAllFilters() {
    setSearchParams(() => {
      const next = new URLSearchParams();
      next.set("page", "1");
      return next;
    });
  }

  const toggleAll = () => {
    const allSelected = selectedCount === items.length && items.length > 0;
    if (allSelected) {
      clearSelection();
    } else {
      items.forEach((r) => {
        selection.onRowClick(r.id, {
          metaKey: true,
          ctrlKey: false,
          shiftKey: false,
        });
      });
    }
  };

  return (
    <div className="mx-auto min-w-0 max-w-[1280px]">
      <Window
        title={t`ITEMS — ${workspaceName}`}
        titlebarVariant="mint"
        bodyClassName=""
        actions={
          <BevelButton variant="neutral" onClick={onExport}>
            <Trans>⤓ EXPORT</Trans>
          </BevelButton>
        }
      >
        {/* SavedFilters above the FilterBar, inside the same panel-2 region. */}
        <div className="flex items-center gap-sp-2 bg-bg-panel-2 px-sp-3 pt-sp-3">
          <SavedFilters
            savedFilters={savedFilters}
            onApply={(id) => applyFilter(id)}
            onDelete={deleteFilter}
            onSaveCurrent={onSaveCurrent}
          />
        </div>

        <FilterBar
          searchValue={state.q}
          onSearchChange={(v) => setParam("q", v)}
          searchPlaceholder={t`Filter items…`}
          itemCount={data?.total ?? 0}
          facets={[
            {
              key: "category",
              label: t`Category`,
              trigger: (
                <FilterPopover
                  label={<Trans>CATEGORY</Trans>}
                  options={[]}
                  selected={state.category ? [state.category] : []}
                  onChange={(next) =>
                    setParam("category", next[next.length - 1] ?? null)
                  }
                />
              ),
            },
            {
              key: "archived",
              label: t`Archived`,
              trigger: (
                <FilterPopover
                  label={<Trans>ARCHIVED</Trans>}
                  options={[
                    { value: "true", label: <Trans>Show archived</Trans> },
                  ]}
                  selected={state.archived ? ["true"] : []}
                  onChange={(next) =>
                    setParam("archived", next.includes("true") ? "true" : null)
                  }
                />
              ),
            },
          ]}
          filterChips={filterChips}
          onRemoveFilter={(key) => setParam(key, null)}
          onClearAll={clearAllFilters}
          primaryAction={
            <BevelButton variant="mint" onClick={goNew}>
              <Trans>⊕ ADD ITEM</Trans>
            </BevelButton>
          }
        />

        {/* Mobile-only bulk surface (desktop uses the Bottombar SSOT chips). */}
        <ItemsBulkBar
          selectedCount={selectedCount}
          allSelectedArchived={allSelectedArchived}
          onClear={clearSelection}
          onArchive={bulkArchive}
          onDelete={bulkDelete}
        />

        <ItemsResults
          isLoading={isLoading}
          isError={isError}
          items={items}
          selectedCount={selectedCount}
          isSelected={(id) => selected.has(id)}
          onToggleAll={toggleAll}
          onSort={onSort}
          sortGlyph={sortGlyph}
          hasFilters={hasFilters}
          onAdd={goNew}
          onClearAll={clearAllFilters}
          currentPage={currentPage}
          totalPages={totalPages}
          perPage={25}
          onPageChange={(p) => setParam("page", String(p))}
          rowActions={{
            onNavigate: (id) => navigate(`/items/${id}`),
            onNavigateEdit: (id) => navigate(`/items/${id}/edit`),
            onArchive: archiveItem,
            onRestore: restoreItem,
            onRequestDelete: (item) => {
              setPendingDelete(item);
              setConfirmName("");
            },
            onToggleSelect: (id) =>
              selection.onRowClick(id, {
                metaKey: true,
                ctrlKey: false,
                shiftKey: false,
              }),
          }}
        />
      </Window>

      {/* Type-to-confirm single delete (ITEM-06). */}
      <DeleteItemDialog
        item={pendingDelete}
        confirmName={confirmName}
        onConfirmNameChange={setConfirmName}
        onConfirm={(item) =>
          deleteItem({ id: item.id, isArchived: item.is_archived ?? false })
        }
        onClose={() => {
          setPendingDelete(null);
          setConfirmName("");
        }}
      />
    </div>
  );
}
