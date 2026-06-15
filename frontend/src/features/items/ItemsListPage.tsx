import { useCallback, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Trans, useLingui } from "@lingui/react/macro";
import {
  Window,
  BevelButton,
  RetroTable,
  RetroBadge,
  RetroCheckbox,
  StatusPill,
  RetroEmptyState,
  RetroConfirmDialog,
  RetroPagination,
  useTableSelection,
  FilterBar,
  FilterPopover,
  BulkActionBar,
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

// Sortable columns the backend supports (07-RESEARCH: name|sku|created_at|
// updated_at). The list surfaces Name + Category headers as sort triggers; the
// table also shows Location/Qty/Status columns per the sketch-008 density set.
//
// NOTE (deviation — backend data gap): the shipped ItemResponse (lib/types.ts)
// carries category_id (a uuid, no name), and does NOT carry location, quantity,
// or a derived stock status. Those cells render a `—` placeholder until the
// detail/inventory wire contract surfaces them (tracked in SUMMARY Known Stubs).
const SORTABLE: { key: string; label: string; sort: string }[] = [
  { key: "name", label: "Name", sort: "name" },
  { key: "sku", label: "SKU", sort: "sku" },
];

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
            {
              key: "A",
              label: archiveLabel,
              action: bulkArchive,
            },
            {
              key: "X",
              label: deleteLabel,
              action: bulkDelete,
              danger: true,
            },
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

  const allSelected = selectedCount === items.length && items.length > 0;
  const someSelected = selectedCount > 0 && !allSelected;

  const hasFilters = !!state.q || !!state.category || state.archived;

  // ── Empty-state branches (rendered inside the table window body).
  function renderEmpty() {
    if (hasFilters) {
      return (
        <RetroEmptyState
          eyebrow={<Trans>Inventory</Trans>}
          heading={<Trans>NO MATCHES</Trans>}
          body={
            <Trans>
              No items match these filters. Clear a filter or adjust your
              search.
            </Trans>
          }
          action={{
            label: <Trans>CLEAR ALL</Trans>,
            onClick: clearAllFilters,
          }}
        />
      );
    }
    return (
      <RetroEmptyState
        eyebrow={<Trans>Inventory</Trans>}
        heading={<Trans>NO ITEMS YET</Trans>}
        body={
          <Trans>
            Your warehouse is empty. Add your first item to start tracking it.
          </Trans>
        }
        action={{ label: <Trans>⊕ ADD ITEM</Trans>, onClick: goNew }}
      />
    );
  }

  function clearAllFilters() {
    setSearchParams(() => {
      const next = new URLSearchParams();
      next.set("page", "1");
      return next;
    });
  }

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
        {selectedCount > 0 && (
          <div className="md:hidden">
            <BulkActionBar
              selectedCount={selectedCount}
              onClear={clearSelection}
              destructiveAction={
                allSelectedArchived
                  ? {
                      label: <Trans>DELETE</Trans>,
                      confirmTitle: <Trans>DELETE ITEMS?</Trans>,
                      confirmBody: (
                        <Trans>
                          The selected archived items will be permanently
                          removed.
                        </Trans>
                      ),
                      onConfirm: bulkDelete,
                    }
                  : undefined
              }
            >
              <BevelButton onClick={bulkArchive}>
                <Trans>ARCHIVE</Trans>
              </BevelButton>
            </BulkActionBar>
          </div>
        )}

        {isLoading && (
          <p className="p-sp-4 font-mono text-13 text-fg-muted">
            <Trans>Loading…</Trans>
          </p>
        )}

        {isError && (
          <p className="p-sp-4 text-13 font-semibold text-danger">
            <Trans>Couldn't load items. Try again.</Trans>
          </p>
        )}

        {!isLoading && !isError && items.length === 0 && (
          <div className="p-sp-4">{renderEmpty()}</div>
        )}

        {!isLoading && !isError && items.length > 0 && (
          <>
            <RetroTable>
              <thead>
                <tr>
                  <th>
                    <RetroCheckbox
                      label=""
                      aria-label={t`Select all rows`}
                      checked={allSelected}
                      indeterminate={someSelected}
                      onChange={() =>
                        allSelected
                          ? clearSelection()
                          : items.forEach((r) => {
                              selection.onRowClick(r.id, {
                                metaKey: true,
                                ctrlKey: false,
                                shiftKey: false,
                              });
                            })
                      }
                    />
                  </th>
                  <th />
                  {SORTABLE.map((col) => (
                    <th key={col.key}>
                      <button
                        type="button"
                        aria-label={t`Sort by ${col.label}`}
                        onClick={() => onSort(col.sort)}
                        className="cursor-pointer font-bold uppercase tracking-7 focus-visible:outline focus-visible:outline-2 focus-visible:outline-border-ink"
                      >
                        {col.label}
                        <span aria-hidden="true">{sortGlyph(col.sort)}</span>
                      </button>
                    </th>
                  ))}
                  <th>{t`Location`}</th>
                  <th className="text-right">{t`Qty`}</th>
                  <th>{t`Status`}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const archived = item.is_archived ?? false;
                  return (
                    <tr
                      key={item.id}
                      aria-selected={selected.has(item.id)}
                      onClick={() => navigate(`/items/${item.id}`)}
                      className={`cursor-pointer ${archived ? "text-fg-muted" : ""}`}
                    >
                      {/* biome-ignore lint/a11y/useKeyWithClickEvents: mouse-only guard to stop the row navigate; keyboard users focus the nested checkbox directly */}
                      <td onClick={(e) => e.stopPropagation()}>
                        <RetroCheckbox
                          label=""
                          aria-label={item.name}
                          checked={selected.has(item.id)}
                          onChange={() =>
                            selection.onRowClick(item.id, {
                              metaKey: true,
                              ctrlKey: false,
                              shiftKey: false,
                            })
                          }
                        />
                      </td>
                      <td>
                        {item.primary_photo_thumbnail_url ? (
                          <img
                            src={item.primary_photo_thumbnail_url}
                            alt=""
                            className={`h-[26px] w-[26px] border border-border-ink object-cover ${archived ? "opacity-60" : ""}`}
                          />
                        ) : (
                          <span
                            aria-hidden="true"
                            className="flex h-[26px] w-[26px] items-center justify-center border border-border-ink bg-bg-panel-2 text-fg-faint"
                          >
                            ◇
                          </span>
                        )}
                      </td>
                      <td className="font-semibold">{item.name}</td>
                      {/* SKU stands in for the second sort header column. */}
                      <td className="mono">{item.sku}</td>
                      {/* Location/Qty are not on the wire ItemResponse yet. */}
                      <td className="text-fg-muted">—</td>
                      <td className="mono text-right text-fg-muted">—</td>
                      <td>
                        {archived ? (
                          <RetroBadge variant="neutral">
                            <Trans>ARCHIVED</Trans>
                          </RetroBadge>
                        ) : (
                          <StatusPill variant="ok">
                            <Trans>IN STOCK</Trans>
                          </StatusPill>
                        )}
                      </td>
                      {/* biome-ignore lint/a11y/useKeyWithClickEvents: mouse-only guard to stop the row navigate; keyboard users focus the nested action buttons directly */}
                      <td
                        className="actions text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {archived ? (
                          <span className="inline-flex gap-sp-1">
                            <BevelButton
                              variant="mint"
                              onClick={() => restoreItem(item.id)}
                            >
                              <Trans>RESTORE</Trans>
                            </BevelButton>
                            <BevelButton
                              variant="danger"
                              onClick={() => {
                                setPendingDelete(item);
                                setConfirmName("");
                              }}
                            >
                              <Trans>DELETE…</Trans>
                            </BevelButton>
                          </span>
                        ) : (
                          <span className="inline-flex gap-sp-1">
                            <BevelButton
                              onClick={() => navigate(`/items/${item.id}/edit`)}
                            >
                              <Trans>EDIT</Trans>
                            </BevelButton>
                            <BevelButton onClick={() => archiveItem(item.id)}>
                              <Trans>ARCHIVE</Trans>
                            </BevelButton>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </RetroTable>

            <RetroPagination
              page={currentPage}
              pageCount={Math.max(1, totalPages)}
              perPage={25}
              onPageChange={(p) => setParam("page", String(p))}
            />
          </>
        )}
      </Window>

      {/* Type-to-confirm single delete (ITEM-06) — confirm stays disabled until
          the exact item name is typed. */}
      <RetroConfirmDialog
        open={pendingDelete !== null}
        title={<Trans>DELETE ITEM?</Trans>}
        confirmLabel={<Trans>DELETE</Trans>}
        confirmDisabled={confirmName !== (pendingDelete?.name ?? "")}
        onConfirm={() => {
          if (pendingDelete) {
            deleteItem({
              id: pendingDelete.id,
              isArchived: pendingDelete.is_archived ?? false,
            });
          }
          setPendingDelete(null);
          setConfirmName("");
        }}
        onCancel={() => {
          setPendingDelete(null);
          setConfirmName("");
        }}
        onClose={() => {
          setPendingDelete(null);
          setConfirmName("");
        }}
      >
        <div className="flex flex-col gap-sp-2">
          <Trans>Type the item name to confirm. This can't be undone.</Trans>
          <input
            type="text"
            aria-label={t`Confirm item name`}
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            className="border-2 border-border-ink bg-bg-panel bevel-sunken px-[10px] py-[7px] text-14"
          />
        </div>
      </RetroConfirmDialog>
    </div>
  );
}
