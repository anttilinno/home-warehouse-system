import { useCallback, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Trans, useLingui } from "@lingui/react/macro";
import {
  Window,
  BevelButton,
  RetroTable,
  RetroBadge,
  RetroEmptyState,
  RetroPagination,
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
import { InlineEditCell } from "./components/InlineEditCell";
import { MovementsDrawer } from "./components/MovementsDrawer";
import { RepairsDrawer } from "@/features/repairs/components/RepairsDrawer";
import { MaintenanceDrawer } from "@/features/maintenance/components/MaintenanceDrawer";
import { MoveDialog } from "./components/MoveDialog";

// Phase 7b Plan 02 — the /inventory list surface (INV-01 + INV-05 + INV-07).
// Mirrors ItemsListPage density + the URL-driven pager, with inventory's twist:
// the list endpoint has NO server filter params (R1), so search + status +
// condition + location facets are CLIENT-side React state applied to the loaded
// page; only `?page` round-trips to the URL. Qty/Status/Condition cells are
// InlineEditCell instances wired to the optimistic mutation `.mutate` fns.
// A per-row `↧` opens the MovementsDrawer; the MOVE action opens the MoveDialog
// for that entry (Plan 04 connected the `onMove` seam Plan 02 left).

// Client-side sortable columns (the loaded page only — the endpoint can't sort).
type SortKey = "qty" | "status" | "condition";

export function InventoryListPage() {
  const { t } = useLingui();
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();
  const { currentWorkspaceId: wsId, workspaces } = useWorkspace();

  const { data, isLoading, isError, state } = useInventoryQuery();
  const {
    updateQuantity,
    updateStatus,
    updateCondition,
    archive,
    restore,
  } = useInventoryMutations();
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

  // ── Client-side filter state (R1 — none of this round-trips to the URL).
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<InventoryStatus[]>([]);
  const [conditionFilter, setConditionFilter] = useState<Condition[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // ── Movements drawer + the MOVE target (Plan 04 wires MoveDialog here).
  const [movementsId, setMovementsId] = useState<string | null>(null);
  // Repairs drawer (Plan 10b-02).
  const [repairsId, setRepairsId] = useState<string | null>(null);
  // Maintenance drawer (Plan 10b-04 — this plan's serial single-writer edit,
  // mounted alongside the repairs drawer; the REPAIRS trigger stays untouched).
  const [maintenanceId, setMaintenanceId] = useState<string | null>(null);
  const [moveTarget, setMoveTarget] = useState<Inventory | null>(null);
  const onMove = useCallback((entry: Inventory) => {
    setMoveTarget(entry);
  }, []);
  // Location/container options for the MoveDialog selects (shared with the form
  // pickers — same workspace-scoped reads, cached under their own prefixes).
  const { locations: locationOptions, containers: containerOptions } =
    usePickerOptions();

  // ── Apply client filters + sort to the loaded page.
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = entries.filter((e) => {
      if (!showArchived && e.is_archived) return false;
      if (statusFilter.length && !statusFilter.includes(e.status)) return false;
      if (conditionFilter.length && !conditionFilter.includes(e.condition))
        return false;
      if (q) {
        const name = (itemName(e.item_id) ?? "").toLowerCase();
        if (!name.includes(q)) return false;
      }
      return true;
    });
    if (sortKey) {
      const dir = sortDir === "asc" ? 1 : -1;
      rows = [...rows].sort((a, b) => {
        let av: string | number;
        let bv: string | number;
        if (sortKey === "qty") {
          av = a.quantity;
          bv = b.quantity;
        } else {
          av = a[sortKey];
          bv = b[sortKey];
        }
        if (av < bv) return -1 * dir;
        if (av > bv) return 1 * dir;
        return 0;
      });
    }
    return rows;
  }, [
    entries,
    search,
    statusFilter,
    conditionFilter,
    showArchived,
    sortKey,
    sortDir,
    itemName,
  ]);

  // ── Route shortcuts (N → new, / → focus search).
  const goNew = useCallback(() => navigate("/inventory/new"), [navigate]);
  const focusSearch = useCallback(() => {
    document.querySelector<HTMLInputElement>('input[type="search"]')?.focus();
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

  function onSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }
  function sortGlyph(key: SortKey) {
    if (sortKey !== key) return "";
    return sortDir === "asc" ? " ↑" : " ↓";
  }

  const hasFilters =
    !!search ||
    statusFilter.length > 0 ||
    conditionFilter.length > 0 ||
    showArchived;

  function clearAllFilters() {
    setSearch("");
    setStatusFilter([]);
    setConditionFilter([]);
    setShowArchived(false);
  }

  const filterChips = useMemo(() => {
    const chips: { key: string; label: string; displayValue: string }[] = [];
    if (statusFilter.length)
      chips.push({
        key: "status",
        label: t`Status`,
        displayValue: statusFilter.map((s) => STATUS_LABEL[s]).join(", "),
      });
    if (conditionFilter.length)
      chips.push({
        key: "condition",
        label: t`Condition`,
        displayValue: conditionFilter.map((c) => CONDITION_LABEL[c]).join(", "),
      });
    if (showArchived)
      chips.push({ key: "archived", label: t`Archived`, displayValue: t`shown` });
    return chips;
  }, [statusFilter, conditionFilter, showArchived, t]);

  function removeFilter(key: string) {
    if (key === "status") setStatusFilter([]);
    else if (key === "condition") setConditionFilter([]);
    else if (key === "archived") setShowArchived(false);
  }

  function renderEmpty() {
    if (hasFilters) {
      return (
        <RetroEmptyState
          eyebrow={<Trans>Inventory</Trans>}
          glyph="◇"
          heading={<Trans>NO MATCHES</Trans>}
          body={
            <Trans>
              No entries match these filters. Clear a filter or adjust your
              search.
            </Trans>
          }
          action={{ label: <Trans>CLEAR ALL</Trans>, onClick: clearAllFilters }}
        />
      );
    }
    return (
      <RetroEmptyState
        eyebrow={<Trans>Inventory</Trans>}
        glyph="◇"
        heading={<Trans>NO STOCK ENTRIES</Trans>}
        body={
          <Trans>
            Nothing is stocked yet. Add your first inventory entry to start
            tracking quantity, location, and condition.
          </Trans>
        }
        action={{ label: <Trans>⊕ ADD ENTRY</Trans>, onClick: goNew }}
      />
    );
  }

  // After client filtering, the page can be visibly empty even when the loaded
  // page carried rows (a filter narrowed them all out).
  const showEmpty =
    !isLoading && !isError && visible.length === 0;

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
            {
              key: "archived",
              label: t`Archived`,
              trigger: (
                <FilterPopover
                  label={<Trans>ARCHIVED</Trans>}
                  options={[
                    { value: "true", label: <Trans>Show archived</Trans> },
                  ]}
                  selected={showArchived ? ["true"] : []}
                  onChange={(next) => setShowArchived(next.includes("true"))}
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
                <Trans>⤓ EXPORT CSV</Trans>
              </BevelButton>
              <BevelButton variant="mint" onClick={goNew}>
                <Trans>⊕ ADD ENTRY</Trans>
              </BevelButton>
            </span>
          }
        />

        {isLoading && (
          <p className="p-sp-4 font-mono text-[13px] text-fg-muted">
            <Trans>Loading…</Trans>
          </p>
        )}

        {isError && (
          <p className="p-sp-4 text-[13px] font-semibold text-danger">
            <Trans>Couldn't load inventory. Try again.</Trans>
          </p>
        )}

        {showEmpty && <div className="p-sp-4">{renderEmpty()}</div>}

        {!isLoading && !isError && visible.length > 0 && (
          <>
            <RetroTable>
              <thead>
                <tr>
                  <th>{t`Item`}</th>
                  <th>{t`Location`}</th>
                  <th className="text-right">
                    <button
                      type="button"
                      aria-label={t`Sort by quantity`}
                      onClick={() => onSort("qty")}
                      className="cursor-pointer font-bold uppercase tracking-[0.07em] focus-visible:outline focus-visible:outline-2 focus-visible:outline-border-ink"
                    >
                      {t`Qty`}
                      <span aria-hidden="true">{sortGlyph("qty")}</span>
                    </button>
                  </th>
                  <th>
                    <button
                      type="button"
                      aria-label={t`Sort by status`}
                      onClick={() => onSort("status")}
                      className="cursor-pointer font-bold uppercase tracking-[0.07em] focus-visible:outline focus-visible:outline-2 focus-visible:outline-border-ink"
                    >
                      {t`Status`}
                      <span aria-hidden="true">{sortGlyph("status")}</span>
                    </button>
                  </th>
                  <th>
                    <button
                      type="button"
                      aria-label={t`Sort by condition`}
                      onClick={() => onSort("condition")}
                      className="cursor-pointer font-bold uppercase tracking-[0.07em] focus-visible:outline focus-visible:outline-2 focus-visible:outline-border-ink"
                    >
                      {t`Condition`}
                      <span aria-hidden="true">{sortGlyph("condition")}</span>
                    </button>
                  </th>
                  <th>{t`Expiry`}</th>
                  <th aria-hidden="true" />
                </tr>
              </thead>
              <tbody>
                {visible.map((entry) => {
                  const archived = entry.is_archived;
                  const name = itemName(entry.item_id);
                  const expiry =
                    entry.expiration_date ?? entry.warranty_expires;
                  return (
                    <tr
                      key={entry.id}
                      onClick={() => navigate(`/items/${entry.item_id}`)}
                      className={`cursor-pointer ${archived ? "text-fg-muted" : ""}`}
                    >
                      <td className="font-semibold">
                        {name ?? <span className="text-fg-muted">—</span>}
                      </td>
                      <td className="text-fg-muted">—</td>
                      <td
                        className="text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <InlineEditCell
                          field="quantity"
                          value={entry.quantity}
                          itemName={name ?? t`this entry`}
                          disabled={archived}
                          onCommit={(quantity) =>
                            setQuantity({ id: entry.id, quantity })
                          }
                        />
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        {archived && (
                          <RetroBadge variant="neutral">
                            <Trans>ARCHIVED</Trans>
                          </RetroBadge>
                        )}{" "}
                        <InlineEditCell
                          field="status"
                          value={entry.status}
                          itemName={name ?? t`this entry`}
                          disabled={archived}
                          onCommit={(status) =>
                            setStatus({ id: entry.id, status })
                          }
                        />
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <InlineEditCell
                          field="condition"
                          value={entry.condition}
                          itemName={name ?? t`this entry`}
                          disabled={archived}
                          onCommit={(condition) =>
                            setCondition({
                              id: entry.id,
                              condition,
                              location_id: entry.location_id,
                              quantity: entry.quantity,
                            })
                          }
                        />
                      </td>
                      <td className="mono text-fg-muted">
                        {expiry ? expiry.slice(0, 10) : "—"}
                      </td>
                      <td
                        className="actions text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="inline-flex gap-sp-1">
                          {!archived && (
                            <BevelButton onClick={() => onMove(entry)}>
                              <Trans>MOVE</Trans>
                            </BevelButton>
                          )}
                          {archived ? (
                            <BevelButton
                              variant="mint"
                              onClick={() => restoreEntry(entry.id)}
                            >
                              <Trans>RESTORE</Trans>
                            </BevelButton>
                          ) : (
                            <>
                              <BevelButton
                                onClick={() =>
                                  navigate(`/inventory/${entry.id}/edit`)
                                }
                              >
                                <Trans>EDIT</Trans>
                              </BevelButton>
                              <BevelButton
                                onClick={() => archiveEntry(entry.id)}
                              >
                                <Trans>ARCHIVE</Trans>
                              </BevelButton>
                            </>
                          )}
                          <BevelButton
                            aria-label={t`Movement history`}
                            title={t`Movement history`}
                            onClick={() => setMovementsId(entry.id)}
                          >
                            <Trans>↧</Trans>
                          </BevelButton>
                          {!archived && (
                            <BevelButton
                              aria-label={t`Repairs`}
                              title={t`Repairs`}
                              onClick={() => setRepairsId(entry.id)}
                            >
                              <Trans>🔧</Trans>
                            </BevelButton>
                          )}
                          {!archived && (
                            <BevelButton
                              aria-label={t`Maintenance`}
                              title={t`Maintenance`}
                              onClick={() => setMaintenanceId(entry.id)}
                            >
                              <Trans>⟳</Trans>
                            </BevelButton>
                          )}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </RetroTable>

            <RetroPagination
              page={currentPage}
              pageCount={Math.max(1, totalPages)}
              perPage={INVENTORY_LIMIT}
              onPageChange={(p) =>
                setSearchParams((prev) => {
                  const next = new URLSearchParams(prev);
                  next.set("page", String(p));
                  return next;
                })
              }
            />
          </>
        )}
      </Window>

      <MovementsDrawer
        invId={movementsId}
        itemName={
          movementsId
            ? itemName(
                entries.find((e) => e.id === movementsId)?.item_id ?? "",
              )
            : undefined
        }
        onClose={() => setMovementsId(null)}
      />

      <RepairsDrawer
        invId={repairsId}
        itemName={
          repairsId
            ? itemName(
                entries.find((e) => e.id === repairsId)?.item_id ?? "",
              )
            : undefined
        }
        onClose={() => setRepairsId(null)}
      />

      <MaintenanceDrawer
        invId={maintenanceId}
        itemName={
          maintenanceId
            ? itemName(
                entries.find((e) => e.id === maintenanceId)?.item_id ?? "",
              )
            : undefined
        }
        onClose={() => setMaintenanceId(null)}
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
