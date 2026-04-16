import { useRef, useState } from "react";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { useLingui } from "@lingui/react/macro";
import { Pencil, Archive, Undo2, Trash2 } from "./icons";
import {
  RetroPanel,
  RetroButton,
  RetroEmptyState,
  RetroBadge,
  RetroTable,
  RetroPagination,
  HazardStripe,
} from "@/components/retro";
import { useAuth } from "@/features/auth/AuthContext";
import { itemsApi, itemKeys, type Item } from "@/lib/api/items";
import { useItemsList } from "./hooks/useItemsList";
import { useCategoryNameMap } from "./hooks/useCategoryNameMap";
import {
  useArchiveItem,
  useRestoreItem,
  useDeleteItem,
} from "./hooks/useItemMutations";
import { ItemPanel, type ItemPanelHandle } from "./panel/ItemPanel";
import {
  ItemArchiveDeleteFlow,
  type ItemArchiveDeleteFlowHandle,
} from "./actions/ItemArchiveDeleteFlow";
import { ItemsFilterBar } from "./filters/ItemsFilterBar";
import { useItemsListQueryParams } from "./filters/useItemsListQueryParams";

const PAGE_SIZE = 25;

/**
 * Items list page — /items route.
 *
 * Composes:
 *   - ItemsFilterBar (search, category, sort, show-archived chip)
 *   - RetroTable with NAME | SKU | CATEGORY | ACTIONS columns
 *   - RetroPagination (hidden when total <= 25)
 *   - ItemPanel (create/edit slide-over)
 *   - ItemArchiveDeleteFlow (archive-first two-dialog flow)
 *
 * Filter state is URL-driven via useItemsListQueryParams for deep-linking +
 * browser history support.
 *
 * Pitfall 5: the Name cell overrides RetroTable's default font-mono with
 * font-sans. Pitfall 7: category resolver includes archived so historical
 * category assignments still render their name.
 */
export function ItemsListPage() {
  const { t } = useLingui();
  const { workspaceId, isLoading: authLoading } = useAuth();
  const [ui, updateUi, clearFilters] = useItemsListQueryParams();

  const panelRef = useRef<ItemPanelHandle>(null);
  const archiveFlowRef = useRef<ItemArchiveDeleteFlowHandle>(null);
  const [archiveTarget, setArchiveTarget] = useState<Item | null>(null);

  // Main list query — driven by URL state.
  const itemsQuery = useItemsList({
    page: ui.page,
    limit: PAGE_SIZE,
    search: ui.q || undefined,
    category_id: ui.category ?? undefined,
    archived: ui.archived || undefined,
    sort: ui.sort,
    sort_dir: ui.sortDir,
  });

  // Archived count — cheap second query for the chip count display.
  // Small limit because we only need the total, not the items.
  const archivedCountParams = {
    page: 1,
    limit: 1,
    archived: true as const,
  };
  const archivedCountQuery = useQuery({
    queryKey: itemKeys.list(archivedCountParams),
    queryFn: () => itemsApi.list(workspaceId!, archivedCountParams),
    enabled: !!workspaceId,
    staleTime: 30_000,
  });
  const archivedCount = archivedCountQuery.data?.total ?? 0;

  const { map: categoryNameMap } = useCategoryNameMap();
  const archiveMutation = useArchiveItem();
  const restoreMutation = useRestoreItem();
  const deleteMutation = useDeleteItem({
    onAfterDelete: () => setArchiveTarget(null),
  });

  if (authLoading) return null;

  const items: Item[] = itemsQuery.data?.items ?? [];
  const total = itemsQuery.data?.total ?? 0;
  const isFilterActive = !!ui.q || !!ui.category || ui.archived;

  const handleNew = () => panelRef.current?.open("create");
  const handleEdit = (item: Item) => panelRef.current?.open("edit", item);
  const handleArchiveClick = (item: Item) => {
    setArchiveTarget(item);
    archiveFlowRef.current?.open();
  };
  const handleRestore = (item: Item) => restoreMutation.mutate(item.id);

  // Columns use RetroTable's `header` field. Default cell font is font-mono
  // (correct for SKU); per-cell overrides apply font-sans for NAME and
  // CATEGORY (Pitfall 5).
  const columns = [
    { key: "name", header: t`NAME` },
    { key: "sku", header: t`SKU` },
    { key: "category", header: t`CATEGORY` },
    { key: "actions", header: t`ACTIONS`, className: "text-right" },
  ];

  const rows = items.map((item) => ({
    name: (
      <Link
        to={`/items/${item.id}`}
        className={`font-sans no-underline ${
          item.is_archived
            ? "line-through text-retro-gray"
            : "text-retro-ink"
        }`}
      >
        {item.name}
        {item.is_archived && (
          <RetroBadge variant="neutral" className="ml-sm font-mono">
            {t`ARCHIVED`}
          </RetroBadge>
        )}
      </Link>
    ),
    sku: item.sku,
    category: (
      <span
        className={`font-sans ${
          item.category_id ? "text-retro-ink" : "text-retro-gray"
        }`}
      >
        {item.category_id
          ? (categoryNameMap.get(item.category_id) ?? "—")
          : "—"}
      </span>
    ),
    actions: (
      <div className="flex items-center gap-xs justify-end">
        {!item.is_archived ? (
          <>
            <button
              type="button"
              aria-label={t`Edit ${item.name}`}
              onClick={() => handleEdit(item)}
              className="min-h-[44px] min-w-[44px] lg:min-h-[36px] lg:min-w-[36px] inline-flex items-center justify-center gap-xs px-sm border-retro-thick border-retro-ink bg-retro-cream text-[12px] font-bold uppercase cursor-pointer"
            >
              <Pencil size={14} />
              <span className="hidden lg:inline">{t`EDIT`}</span>
            </button>
            <button
              type="button"
              aria-label={t`Archive ${item.name}`}
              onClick={() => handleArchiveClick(item)}
              className="min-h-[44px] min-w-[44px] lg:min-h-[36px] lg:min-w-[36px] inline-flex items-center justify-center gap-xs px-sm border-retro-thick border-retro-ink bg-retro-cream text-[12px] font-bold uppercase cursor-pointer"
            >
              <Archive size={14} />
              <span className="hidden lg:inline">{t`ARCHIVE`}</span>
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              aria-label={t`Restore ${item.name}`}
              onClick={() => handleRestore(item)}
              disabled={restoreMutation.isPending}
              className="min-h-[44px] min-w-[44px] lg:min-h-[36px] lg:min-w-[36px] inline-flex items-center justify-center gap-xs px-sm border-retro-thick border-retro-ink bg-retro-cream text-[12px] font-bold uppercase cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Undo2 size={14} />
              <span className="hidden lg:inline">{t`RESTORE`}</span>
            </button>
            <button
              type="button"
              aria-label={t`Delete ${item.name}`}
              onClick={() => handleArchiveClick(item)}
              className="min-h-[44px] min-w-[44px] lg:min-h-[36px] lg:min-w-[36px] inline-flex items-center justify-center gap-xs px-sm border-retro-thick border-retro-ink bg-retro-cream text-[12px] font-bold uppercase cursor-pointer"
            >
              <Trash2 size={14} />
              <span className="hidden lg:inline">{t`DELETE`}</span>
            </button>
          </>
        )}
      </div>
    ),
  }));

  return (
    <div className="flex flex-col gap-lg p-lg min-w-0">
      <div className="flex items-center justify-between gap-md flex-wrap">
        <h1 className="text-[20px] font-semibold uppercase tracking-wider text-retro-cream">
          {t`ITEMS`}
        </h1>
        <RetroButton variant="primary" onClick={handleNew}>
          {t`+ NEW ITEM`}
        </RetroButton>
      </div>

      <ItemsFilterBar
        state={ui}
        onUpdate={updateUi}
        archivedCount={archivedCount}
      />

      {workspaceId && itemsQuery.isPending && (
        <RetroPanel>
          <p className="font-mono text-retro-charcoal">{t`Loading…`}</p>
        </RetroPanel>
      )}

      {workspaceId && itemsQuery.isError && (
        <RetroPanel>
          <HazardStripe className="mb-md" />
          <h2 className="text-[20px] font-bold uppercase text-retro-ink mb-sm">
            {t`COULD NOT LOAD ITEMS`}
          </h2>
          <p className="text-retro-ink mb-md">
            {t`Check your connection and try again.`}
          </p>
          <RetroButton
            variant="primary"
            onClick={() => itemsQuery.refetch()}
          >
            {t`RETRY`}
          </RetroButton>
        </RetroPanel>
      )}

      {workspaceId &&
        itemsQuery.isSuccess &&
        total === 0 &&
        isFilterActive && (
          <RetroEmptyState
            title={t`NO MATCHES`}
            body={t`No items match your filters. Clear them to see all items.`}
            action={
              <RetroButton variant="neutral" onClick={clearFilters}>
                {t`CLEAR FILTERS`}
              </RetroButton>
            }
          />
        )}

      {workspaceId &&
        itemsQuery.isSuccess &&
        total === 0 &&
        !isFilterActive &&
        archivedCount > 0 && (
          <RetroEmptyState
            title={t`NO ACTIVE ITEMS`}
            body={t`All items are currently archived. Toggle "Show archived" to view them.`}
            action={
              <RetroButton variant="primary" onClick={handleNew}>
                {t`+ NEW ITEM`}
              </RetroButton>
            }
          />
        )}

      {workspaceId &&
        itemsQuery.isSuccess &&
        total === 0 &&
        !isFilterActive &&
        archivedCount === 0 && (
          <RetroEmptyState
            title={t`NO ITEMS YET`}
            body={t`Create your first item to start tracking inventory.`}
            action={
              <RetroButton variant="primary" onClick={handleNew}>
                {t`+ NEW ITEM`}
              </RetroButton>
            }
          />
        )}

      {workspaceId && itemsQuery.isSuccess && items.length > 0 && (
        <>
          <RetroPanel>
            <RetroTable columns={columns} data={rows} />
          </RetroPanel>
          <RetroPagination
            page={ui.page}
            pageSize={PAGE_SIZE}
            totalCount={total}
            onChange={(p) => updateUi({ page: p })}
          />
        </>
      )}

      <ItemPanel ref={panelRef} />
      <ItemArchiveDeleteFlow
        ref={archiveFlowRef}
        nodeName={archiveTarget?.name ?? ""}
        onArchive={() =>
          archiveTarget
            ? archiveMutation
                .mutateAsync(archiveTarget.id)
                .then(() => setArchiveTarget(null))
            : Promise.resolve()
        }
        onDelete={() =>
          archiveTarget
            ? deleteMutation.mutateAsync(archiveTarget.id)
            : Promise.resolve()
        }
      />
    </div>
  );
}
