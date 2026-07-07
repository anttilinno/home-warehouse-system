import { Trans, useLingui } from "@lingui/react/macro";
import {
  PixelIcon,
  RetroTable,
  RetroEmptyState,
  RetroPagination,
} from "@/components/retro";
import type { Condition, Inventory, InventoryStatus } from "@/lib/types";
import type { SortKey } from "../hooks/useInventoryFilters";
import { InventoryRow } from "./InventoryRow";

// Phase 7b refactor — the inventory list results region: the loading / error /
// empty / table+pagination switch the page used to inline. Pulling the four
// mutually-exclusive view branches out of InventoryListPage is what drops its
// cyclomatic count below the gate; the row action handlers thread straight
// through to InventoryRow. Behavior is identical (same guards, same empty-state
// copy split on hasFilters, same pager wiring).

export interface InventoryRowActions {
  onNavigateItem: (itemId: string) => void;
  onNavigateEdit: (id: string) => void;
  onMove: (entry: Inventory) => void;
  onArchive: (id: string) => void;
  onRestore: (id: string) => void;
  onSetQuantity: (id: string, quantity: number) => void;
  onSetStatus: (id: string, status: InventoryStatus) => void;
  onSetCondition: (entry: Inventory, condition: Condition) => void;
  onMovements: (id: string) => void;
  onRepairs: (id: string) => void;
  onMaintenance: (id: string) => void;
}

function SortableTh({
  sortKey,
  label,
  ariaLabel,
  align,
  onSort,
  sortGlyph,
}: Readonly<{
  sortKey: SortKey;
  label: string;
  ariaLabel: string;
  align?: "right";
  onSort: (key: SortKey) => void;
  sortGlyph: (key: SortKey) => string;
}>) {
  return (
    <th className={align === "right" ? "text-right" : undefined}>
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={() => onSort(sortKey)}
        className="cursor-pointer font-bold uppercase tracking-7 focus-visible:outline focus-visible:outline-2 focus-visible:outline-border-ink"
      >
        {label}
        <span aria-hidden="true">{sortGlyph(sortKey)}</span>
      </button>
    </th>
  );
}

export function InventoryResults({
  isLoading,
  isError,
  visible,
  itemName,
  hasFilters,
  onAdd,
  onClearAll,
  onSort,
  sortGlyph,
  currentPage,
  totalPages,
  perPage,
  onPageChange,
  rowActions,
}: Readonly<{
  isLoading: boolean;
  isError: boolean;
  visible: Inventory[];
  itemName: (id: string) => string | undefined;
  hasFilters: boolean;
  onAdd: () => void;
  onClearAll: () => void;
  onSort: (key: SortKey) => void;
  sortGlyph: (key: SortKey) => string;
  currentPage: number;
  totalPages: number;
  perPage: number;
  onPageChange: (page: number) => void;
  rowActions: InventoryRowActions;
}>) {
  const { t } = useLingui();

  if (isLoading) {
    return (
      <p className="p-sp-4 font-mono text-13 text-fg-muted">
        <Trans>Loading…</Trans>
      </p>
    );
  }

  if (isError) {
    return (
      <p className="p-sp-4 text-13 font-semibold text-danger">
        <Trans>Couldn't load inventory. Try again.</Trans>
      </p>
    );
  }

  if (visible.length === 0) {
    return (
      <div className="p-sp-4">
        {hasFilters ? (
          <RetroEmptyState
            eyebrow={<Trans>Inventory</Trans>}
            glyph="grid-3x3"
            heading={<Trans>NO MATCHES</Trans>}
            body={
              <Trans>
                No entries match these filters. Clear a filter or adjust your
                search.
              </Trans>
            }
            action={{ label: <Trans>CLEAR ALL</Trans>, onClick: onClearAll }}
          />
        ) : (
          <RetroEmptyState
            eyebrow={<Trans>Inventory</Trans>}
            glyph="grid-3x3"
            heading={<Trans>NO STOCK ENTRIES</Trans>}
            body={
              <Trans>
                Nothing is stocked yet. Add your first inventory entry to start
                tracking quantity, location, and condition.
              </Trans>
            }
            action={{
              label: (
                <>
                  <PixelIcon name="plus" size={16} /> <Trans>ADD ENTRY</Trans>
                </>
              ),
              onClick: onAdd,
            }}
          />
        )}
      </div>
    );
  }

  return (
    <>
      <RetroTable>
        <thead>
          <tr>
            <th>{t`Item`}</th>
            <th>{t`Location`}</th>
            <SortableTh
              sortKey="qty"
              label={t`Qty`}
              ariaLabel={t`Sort by quantity`}
              align="right"
              onSort={onSort}
              sortGlyph={sortGlyph}
            />
            <SortableTh
              sortKey="status"
              label={t`Status`}
              ariaLabel={t`Sort by status`}
              onSort={onSort}
              sortGlyph={sortGlyph}
            />
            <SortableTh
              sortKey="condition"
              label={t`Condition`}
              ariaLabel={t`Sort by condition`}
              onSort={onSort}
              sortGlyph={sortGlyph}
            />
            <th>{t`Expiry`}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {visible.map((entry) => (
            <InventoryRow
              key={entry.id}
              entry={entry}
              name={itemName(entry.item_id)}
              {...rowActions}
            />
          ))}
        </tbody>
      </RetroTable>

      <RetroPagination
        page={currentPage}
        pageCount={Math.max(1, totalPages)}
        perPage={perPage}
        onPageChange={onPageChange}
      />
    </>
  );
}
