import { Trans, useLingui } from "@lingui/react/macro";
import {
  RetroTable,
  RetroCheckbox,
  RetroEmptyState,
  RetroPagination,
} from "@/components/retro";
import type { Item } from "@/lib/types";
import { ItemRow, type ItemRowActions } from "./ItemRow";

// Sortable columns the backend supports (07-RESEARCH: name|sku|created_at|
// updated_at). The list surfaces Name + SKU headers as sort triggers; the table
// also shows Location/Qty/Status columns per the sketch-008 density set.
const SORTABLE: { key: string; label: string; sort: string }[] = [
  { key: "name", label: "Name", sort: "name" },
  { key: "sku", label: "SKU", sort: "sku" },
];

// Phase 7 refactor — the items list results region: the loading / error / empty
// / table+pagination switch the page used to inline. Pulling the four mutually-
// exclusive view branches (and the select-all header + row map) out of
// ItemsListPage is what drops its cyclomatic count below the gate. Behavior is
// identical (same guards, same empty-state copy split on hasFilters, same pager).
export function ItemsResults({
  isLoading,
  isError,
  items,
  selectedCount,
  isSelected,
  onToggleAll,
  onSort,
  sortGlyph,
  hasFilters,
  onAdd,
  onClearAll,
  currentPage,
  totalPages,
  perPage,
  onPageChange,
  rowActions,
}: Readonly<{
  isLoading: boolean;
  isError: boolean;
  items: Item[];
  selectedCount: number;
  isSelected: (id: string) => boolean;
  onToggleAll: () => void;
  onSort: (sortKey: string) => void;
  sortGlyph: (sortKey: string) => string;
  hasFilters: boolean;
  onAdd: () => void;
  onClearAll: () => void;
  currentPage: number;
  totalPages: number;
  perPage: number;
  onPageChange: (page: number) => void;
  rowActions: ItemRowActions;
}>) {
  const { t } = useLingui();
  const allSelected = selectedCount === items.length && items.length > 0;
  const someSelected = selectedCount > 0 && !allSelected;

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
        <Trans>Couldn't load items. Try again.</Trans>
      </p>
    );
  }

  if (items.length === 0) {
    return (
      <div className="p-sp-4">
        {hasFilters ? (
          <RetroEmptyState
            eyebrow={<Trans>Inventory</Trans>}
            heading={<Trans>NO MATCHES</Trans>}
            body={
              <Trans>
                No items match these filters. Clear a filter or adjust your
                search.
              </Trans>
            }
            action={{ label: <Trans>CLEAR ALL</Trans>, onClick: onClearAll }}
          />
        ) : (
          <RetroEmptyState
            eyebrow={<Trans>Inventory</Trans>}
            heading={<Trans>NO ITEMS YET</Trans>}
            body={
              <Trans>
                Your warehouse is empty. Add your first item to start tracking
                it.
              </Trans>
            }
            action={{ label: <Trans>⊕ ADD ITEM</Trans>, onClick: onAdd }}
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
            <th>
              <RetroCheckbox
                label=""
                aria-label={t`Select all rows`}
                checked={allSelected}
                indeterminate={someSelected}
                onChange={onToggleAll}
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
          {items.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              selected={isSelected(item.id)}
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
