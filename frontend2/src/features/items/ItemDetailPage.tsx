import { useRef } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useLingui } from "@lingui/react/macro";
import { ArrowLeft, Pencil, Archive, Undo2, Trash2 } from "./icons";
import {
  RetroPanel,
  RetroButton,
  RetroBadge,
  RetroEmptyState,
  HazardStripe,
} from "@/components/retro";
import { useItem } from "./hooks/useItem";
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

/**
 * Items detail page — /items/:id route.
 *
 * Sections:
 *   - Back link → /items
 *   - Amber-rail header with item name + ARCHIVED badge + EDIT/ARCHIVE
 *     (active) or RESTORE/DELETE (archived) button cluster
 *   - DETAILS card with 6 rows: SKU, BARCODE, CATEGORY, DESCRIPTION,
 *     CREATED, UPDATED — timestamps in mono, ISO-formatted; em-dash fallback
 *     for missing optionals
 *   - PHOTOS section: Phase 61 seam, RetroEmptyState placeholder
 *   - LOANS section: Phase 62 seam, RetroEmptyState placeholder
 *   - ItemPanel (edit mode on-page) + ItemArchiveDeleteFlow (archive/delete)
 *
 * Delete flow (Pitfall 9): useDeleteItem({onAfterDelete}) navigates to
 * /items after success; useDeleteItem's onSuccess has already removed
 * the stale detail query from cache before invalidation, so browser-back
 * re-fetches and surfaces the 404 ITEM NOT FOUND state rather than a flash.
 */
function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return iso;
  }
}

export function ItemDetailPage() {
  const { t } = useLingui();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const itemQuery = useItem(id);
  const { map: categoryNameMap } = useCategoryNameMap();

  const archiveMutation = useArchiveItem();
  const restoreMutation = useRestoreItem();
  // CRITICAL (Pitfall 9): onAfterDelete navigates back to list AFTER the
  // detail query has been removed from cache by the hook's onSuccess.
  const deleteMutation = useDeleteItem({
    onAfterDelete: () => navigate("/items"),
  });

  const panelRef = useRef<ItemPanelHandle>(null);
  const archiveFlowRef = useRef<ItemArchiveDeleteFlowHandle>(null);

  if (itemQuery.isPending) {
    return (
      <RetroPanel>
        <p className="font-mono text-retro-charcoal">{t`Loading…`}</p>
      </RetroPanel>
    );
  }

  if (itemQuery.isError || !itemQuery.data) {
    return (
      <RetroPanel>
        <HazardStripe className="mb-md" />
        <h1 className="text-[20px] font-bold uppercase text-retro-ink mb-sm">
          {t`ITEM NOT FOUND`}
        </h1>
        <p className="text-retro-ink mb-md">
          {t`This item may have been deleted.`}
        </p>
        <Link
          to="/items"
          className="inline-flex items-center gap-xs font-mono text-[14px] text-retro-ink underline"
        >
          <ArrowLeft size={14} />
          {t`BACK TO ITEMS`}
        </Link>
      </RetroPanel>
    );
  }

  const item = itemQuery.data;
  const categoryName = item.category_id
    ? (categoryNameMap.get(item.category_id) ?? "—")
    : "—";

  const handleEdit = () => panelRef.current?.open("edit", item);
  const handleArchiveClick = () => archiveFlowRef.current?.open();
  const handleRestore = () => restoreMutation.mutate(item.id);

  return (
    <div className="flex flex-col gap-xl p-lg min-w-0">
      <Link
        to="/items"
        className="inline-flex items-center gap-xs font-mono text-[14px] text-retro-ink"
      >
        <ArrowLeft size={14} />
        {t`BACK TO ITEMS`}
      </Link>

      <div className="border-l-2 border-retro-amber pl-md flex items-center gap-md flex-wrap">
        <h1 className="text-[24px] font-bold uppercase text-retro-ink">
          {item.name}
        </h1>
        {item.is_archived && (
          <RetroBadge variant="neutral" className="font-mono">
            {t`ARCHIVED`}
          </RetroBadge>
        )}
        <div className="flex gap-xs ml-auto flex-wrap">
          {!item.is_archived ? (
            <>
              <RetroButton variant="primary" onClick={handleEdit}>
                <span className="inline-flex items-center gap-xs">
                  <Pencil size={14} />
                  {t`EDIT ITEM`}
                </span>
              </RetroButton>
              <RetroButton variant="neutral" onClick={handleArchiveClick}>
                <span className="inline-flex items-center gap-xs">
                  <Archive size={14} />
                  {t`ARCHIVE`}
                </span>
              </RetroButton>
            </>
          ) : (
            <>
              <RetroButton
                variant="neutral"
                onClick={handleRestore}
                disabled={restoreMutation.isPending}
              >
                <span className="inline-flex items-center gap-xs">
                  <Undo2 size={14} />
                  {t`RESTORE ITEM`}
                </span>
              </RetroButton>
              <RetroButton variant="neutral" onClick={handleArchiveClick}>
                <span className="inline-flex items-center gap-xs">
                  <Trash2 size={14} />
                  {t`DELETE`}
                </span>
              </RetroButton>
            </>
          )}
        </div>
      </div>

      <RetroPanel>
        <h2 className="text-[14px] font-semibold uppercase tracking-wider text-retro-ink mb-md">
          {t`DETAILS`}
        </h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-lg gap-y-sm">
          <dt className="font-sans text-[14px] font-semibold uppercase text-retro-ink">
            {t`SKU`}
          </dt>
          <dd className="font-mono text-[16px] text-retro-ink">{item.sku}</dd>

          <dt className="font-sans text-[14px] font-semibold uppercase text-retro-ink">
            {t`BARCODE`}
          </dt>
          <dd
            className={`font-mono text-[16px] ${
              item.barcode ? "text-retro-ink" : "text-retro-gray"
            }`}
          >
            {item.barcode ? item.barcode : "—"}
          </dd>

          <dt className="font-sans text-[14px] font-semibold uppercase text-retro-ink">
            {t`CATEGORY`}
          </dt>
          <dd
            className={`font-sans text-[16px] ${
              item.category_id ? "text-retro-ink" : "text-retro-gray"
            }`}
          >
            {categoryName}
          </dd>

          <dt className="font-sans text-[14px] font-semibold uppercase text-retro-ink">
            {t`DESCRIPTION`}
          </dt>
          <dd
            className={`font-sans text-[16px] ${
              item.description ? "text-retro-ink" : "text-retro-gray"
            }`}
          >
            {item.description ? item.description : "—"}
          </dd>

          <dt className="font-sans text-[14px] font-semibold uppercase text-retro-ink">
            {t`CREATED`}
          </dt>
          <dd className="font-mono text-[16px] text-retro-ink">
            {formatTimestamp(item.created_at)}
          </dd>

          <dt className="font-sans text-[14px] font-semibold uppercase text-retro-ink">
            {t`UPDATED`}
          </dt>
          <dd className="font-mono text-[16px] text-retro-ink">
            {formatTimestamp(item.updated_at)}
          </dd>
        </dl>
      </RetroPanel>

      <section aria-labelledby="photos-h2">
        <h2
          id="photos-h2"
          className="text-[20px] font-bold uppercase text-retro-ink mb-md"
        >
          {t`PHOTOS`}
        </h2>
        <RetroEmptyState
          title={t`NO PHOTOS`}
          body={t`Photos will appear here after Phase 61.`}
        />
      </section>

      <section aria-labelledby="loans-h2">
        <h2
          id="loans-h2"
          className="text-[20px] font-bold uppercase text-retro-ink mb-md"
        >
          {t`LOANS`}
        </h2>
        <RetroEmptyState
          title={t`NO LOANS`}
          body={t`Loan history will appear here once loans are wired.`}
        />
      </section>

      <ItemPanel ref={panelRef} />
      <ItemArchiveDeleteFlow
        ref={archiveFlowRef}
        nodeName={item.name}
        onArchive={() => archiveMutation.mutateAsync(item.id)}
        onDelete={() => deleteMutation.mutateAsync(item.id)}
      />
    </div>
  );
}
