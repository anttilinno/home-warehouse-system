import { useCallback, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Trans, useLingui } from "@lingui/react/macro";
import {
  Window,
  BevelButton,
  PixelIcon,
  FilterBar,
  FilterPopover,
  retroToast,
} from "@/components/retro";
import { useShortcuts } from "@/components/shortcuts";
import { useQuery } from "@tanstack/react-query";
import { useWorkspace } from "@/features/workspace/useWorkspace";
import { itemsApi } from "@/lib/api/items";
import type { Condition, Inventory, InventoryStatus } from "@/lib/types";
import {
  CONDITIONS,
  CONDITION_LABEL,
  STATUSES,
  STATUS_LABEL,
} from "./inventoryEnums";
import { inventoryToCsvBlob, triggerCsvDownload } from "./inventoryCsv";
import { useInventoryQuery, INVENTORY_LIMIT } from "./hooks/useInventoryQuery";
import { useInventoryMutations } from "./hooks/useInventoryMutations";
import { usePickerOptions } from "./hooks/usePickerOptions";
import { useInventoryFilters } from "./hooks/useInventoryFilters";
import { InventoryResults } from "./components/InventoryResults";
import { InventoryDrawers } from "./components/InventoryDrawers";
import { MoveDialog } from "./components/MoveDialog";

// Phase 7b Plan 02 — the /inventory list surface (INV-01 + INV-05 + INV-07).
// Mirrors ItemsListPage density + the URL-driven pager, with inventory's twist:
// the list endpoint has NO server filter params (R1), so search + status +
// condition + archived facets are CLIENT-side state applied to the loaded page
// (owned by useInventoryFilters); only `?page` round-trips to the URL. The
// loading/error/empty/table switch + per-row inline-edit cells live in
// InventoryResults; this page owns the data join, filter wiring, and drawers.

export function InventoryListPage() {
  const { t } = useLingui();
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();
  const { currentWorkspaceId: wsId, workspaces } = useWorkspace();

  const { data, isLoading, isError, state } = useInventoryQuery();
  const { updateQuantity, updateStatus, updateCondition, archive, restore } =
    useInventoryMutations();
  // RQ v5 returns a NEW mutation wrapper each render; the `.mutate` identity is
  // stable. Destructure the stable mutates so the shortcut memos never churn.
  const setQuantity = updateQuantity.mutate;
  const setStatus = updateStatus.mutate;
  const setCondition = updateCondition.mutate;
  const archiveEntry = archive.mutate;
  const restoreEntry = restore.mutate;

  // ── Item name join: a lightweight items query keyed under the ["items", wsId]
  // prefix so it shares the Phase 6 SSE invalidation. Location labels have no
  // list endpoint this phase → unresolved renders muted "—" (R7).
  //
  // limit=100 is the backend item-list cap (handler.go `maximum:"100"`); request
  // 200 and the endpoint 422s, the join never resolves, and EVERY row's Item
  // column renders "—" (D-07b-A). The join therefore only resolves names for the
  // first 100 items; workspaces with >100 items show "—" for entries whose item
  // falls beyond that page. Proper fix is deferred (see deferred-items.md):
  // batch per-id name resolution or a backend items-by-ids endpoint. For v3.0
  // parity (seeded ~45 items) limit=100 resolves every name.
  const itemsQuery = useQuery({
    queryKey: ["items", wsId, { limit: 100, page: 1 }],
    queryFn: () => itemsApi.list(wsId as string, { limit: 100, page: 1 }),
    enabled: !!wsId,
    retry: false,
  });
  const itemName = useCallback(
    (id: string) => itemsQuery.data?.items.find((i) => i.id === id)?.name,
    [itemsQuery.data],
  );

  const entries = useMemo(() => data?.items ?? [], [data]);
  const totalPages = data?.total_pages ?? 1;
  const currentPage = data?.page ?? state.page;

  const workspaceName =
    workspaces?.find((w) => w.id === wsId)?.name ?? t`Workspace`;

  // ── Client-side filter/sort machine (R1 — none of this round-trips to the URL).
  const {
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    conditionFilter,
    setConditionFilter,
    visible,
    onSort,
    sortGlyph,
    hasFilters,
    clearAllFilters,
    filterChips,
    removeFilter,
  } = useInventoryFilters(entries, itemName);

  // ── Movements drawer + the MOVE target (Plan 04 wires MoveDialog here).
  const [movementsId, setMovementsId] = useState<string | null>(null);
  // Repairs drawer (Plan 10b-02).
  const [repairsId, setRepairsId] = useState<string | null>(null);
  // Maintenance drawer (Plan 10b-04).
  const [maintenanceId, setMaintenanceId] = useState<string | null>(null);
  const [moveTarget, setMoveTarget] = useState<Inventory | null>(null);
  const onMove = useCallback((entry: Inventory) => {
    setMoveTarget(entry);
  }, []);
  // Location/container options for the MoveDialog selects (shared with the form
  // pickers — same workspace-scoped reads, cached under their own prefixes).
  const { locations: locationOptions, containers: containerOptions } =
    usePickerOptions();

  // ── Route shortcuts (N → new, / → focus search).
  const goNew = useCallback(() => navigate("/inventory/new"), [navigate]);
  const focusSearch = useCallback(() => {
    document.querySelector<HTMLInputElement>("[data-search-input]")?.focus();
  }, []);
  const labelNew = t`New entry`;
  const labelSearch = t`Focus search`;
  const routeShortcuts = useMemo(
    () => [
      { key: "N", label: labelNew, action: goNew },
      { key: "/", label: labelSearch, action: focusSearch },
    ],
    [goNew, focusSearch, labelNew, labelSearch],
  );
  useShortcuts("inventory", routeShortcuts);

  // ── Client CSV export (parity §4 — built in-memory from the current filtered
  // rows; no /export/inventory endpoint exists, so this is client-side like
  // loans). Deps = the visible-rows variable only (tRef is a stable ref).
  const nothingToExport = t`Nothing to export.`;
  const exportCsv = useCallback(() => {
    if (visible.length === 0) {
      retroToast.error(nothingToExport);
      return;
    }
    triggerCsvDownload(inventoryToCsvBlob(visible), "inventory.csv");
  }, [visible, nothingToExport]);

  return (
    <div className="mx-auto min-w-0 max-w-[1280px]">
      <Window title={t`INVENTORY — ${workspaceName}`} titlebarVariant="mint">
        <FilterBar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder={t`Filter inventory…`}
          itemCount={visible.length}
          facets={[
            {
              key: "status",
              label: t`Status`,
              trigger: (
                <FilterPopover
                  label={<Trans>STATUS</Trans>}
                  options={STATUSES.map((s) => ({
                    value: s,
                    label: STATUS_LABEL[s],
                  }))}
                  selected={statusFilter}
                  onChange={(next) =>
                    setStatusFilter(next as InventoryStatus[])
                  }
                />
              ),
            },
            {
              key: "condition",
              label: t`Condition`,
              trigger: (
                <FilterPopover
                  label={<Trans>CONDITION</Trans>}
                  options={CONDITIONS.map((c) => ({
                    value: c,
                    label: CONDITION_LABEL[c],
                  }))}
                  selected={conditionFilter}
                  onChange={(next) => setConditionFilter(next as Condition[])}
                />
              ),
            },
          ]}
          filterChips={filterChips}
          onRemoveFilter={removeFilter}
          onClearAll={clearAllFilters}
          primaryAction={
            <span className="flex items-center gap-sp-2">
              <BevelButton
                onClick={exportCsv}
                disabled={visible.length === 0}
                aria-disabled={visible.length === 0 || undefined}
              >
                <PixelIcon name="download" size={16} />{" "}
                <Trans>EXPORT CSV</Trans>
              </BevelButton>
              <BevelButton variant="mint" onClick={goNew}>
                <PixelIcon name="plus" size={16} /> <Trans>ADD ENTRY</Trans>
              </BevelButton>
            </span>
          }
        />

        <InventoryResults
          isLoading={isLoading}
          isError={isError}
          visible={visible}
          itemName={itemName}
          hasFilters={hasFilters}
          onAdd={goNew}
          onClearAll={clearAllFilters}
          onSort={onSort}
          sortGlyph={sortGlyph}
          currentPage={currentPage}
          totalPages={totalPages}
          perPage={INVENTORY_LIMIT}
          onPageChange={(p) =>
            setSearchParams((prev) => {
              const next = new URLSearchParams(prev);
              next.set("page", String(p));
              return next;
            })
          }
          rowActions={{
            onNavigateItem: (itemId) => navigate(`/items/${itemId}`),
            onNavigateEdit: (id) => navigate(`/inventory/${id}/edit`),
            onMove,
            onArchive: archiveEntry,
            onRestore: restoreEntry,
            onSetQuantity: (id, quantity) =>
              setQuantity({ wsId: wsId as string, id, quantity }),
            onSetStatus: (id, status) => setStatus({ id, status }),
            onSetCondition: (e, condition) =>
              setCondition({
                id: e.id,
                condition,
                location_id: e.location_id,
                quantity: e.quantity,
              }),
            onMovements: setMovementsId,
            onRepairs: setRepairsId,
            onMaintenance: setMaintenanceId,
          }}
        />
      </Window>

      <InventoryDrawers
        entries={entries}
        itemName={itemName}
        movementsId={movementsId}
        repairsId={repairsId}
        maintenanceId={maintenanceId}
        onCloseMovements={() => setMovementsId(null)}
        onCloseRepairs={() => setRepairsId(null)}
        onCloseMaintenance={() => setMaintenanceId(null)}
      />

      {/* MoveDialog seeds its target state from the entry on mount, so mount it
          per-target (keyed) only while a move is active. */}
      {moveTarget && (
        <MoveDialog
          key={moveTarget.id}
          open
          entry={moveTarget}
          locationOptions={locationOptions}
          containerOptions={containerOptions}
          onClose={() => setMoveTarget(null)}
        />
      )}
    </div>
  );
}
