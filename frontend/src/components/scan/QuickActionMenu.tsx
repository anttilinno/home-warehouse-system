import { Link } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trans, useLingui } from "@lingui/react/macro";
import {
  BevelButton,
  PixelIcon,
  RetroDialog,
  retroToast,
} from "@/components/retro";
import { itemsApi } from "@/lib/api/items";
import { loansApi } from "@/lib/api/loans";
import { useWorkspace } from "@/features/workspace/useWorkspace";
import { useMarkReviewedItem } from "@/features/items/hooks/useMarkReviewedItem";
import type { Item } from "@/lib/types";

// SCAN-11 — state-adaptive quick-action overlay shown after a MATCH. Rendered
// as a RetroDialog so the camera underneath stays mounted (focus-trap + ESC via
// the modal stack). State-adaptive gating:
//   VIEW ITEM     — always
//   LOAN          — hidden when archived OR an active loan exists (fail-safe:
//                   also hidden while the byItem query is pending)
//   UNARCHIVE     — only when is_archived
//   MARK REVIEWED — only when needs_review
//   BACK TO SCAN  — always (close + resume)
export interface QuickActionMenuProps {
  item: Item;
  onClose: () => void;
}

const BEVEL_LINK =
  "inline-flex w-full cursor-pointer items-center justify-center gap-sp-2 border-2 border-border-ink px-[14px] py-[6px] font-body text-13 font-semibold uppercase tracking-4 bevel-raised-ink hover:brightness-103 active:translate-x-px active:translate-y-px active:bg-bg-pressed active:bevel-pressed";

export function QuickActionMenu({
  item,
  onClose,
}: Readonly<QuickActionMenuProps>) {
  const { currentWorkspaceId: wsId } = useWorkspace();
  const { t } = useLingui();
  const queryClient = useQueryClient();
  const markReviewed = useMarkReviewedItem();

  // Loan-state gate. While this is pending we treat the item AS-IF on a loan so
  // the LOAN action stays hidden until we KNOW it is safe to offer (never offer
  // a duplicate loan — UI-SPEC Surface 6).
  const loansQuery = useQuery({
    queryKey: ["loans", wsId as string, "by-item", item.id],
    queryFn: () => loansApi.byItem(wsId as string, item.id),
  });
  const hasActiveLoan =
    (loansQuery.data?.active.length ?? 0) > 0 || loansQuery.isPending;

  const restore = useMutation({
    mutationFn: () => itemsApi.restore(wsId as string, item.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items", wsId as string] });
      retroToast.success(t`Item unarchived.`);
      onClose();
    },
    onError: () => retroToast.error(t`Couldn't unarchive this item.`),
  });

  const showLoan = !item.is_archived && !hasActiveLoan;

  return (
    <RetroDialog
      open
      onClose={onClose}
      title={t`MATCHED ITEM`}
      titlebarVariant="blue"
    >
      <div className="flex flex-col gap-sp-3">
        <div>
          <p className="font-body text-15 text-fg-ink">{item.name}</p>
          {item.barcode && (
            <p className="font-mono text-13 tabular-nums text-fg-muted">
              {item.barcode}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-sp-2">
          <Link
            to={`/items/${item.id}`}
            className={`${BEVEL_LINK} bg-titlebar-blue text-fg-ink`}
          >
            ◎ <Trans>VIEW ITEM</Trans>
          </Link>

          {showLoan && (
            <Link
              to={`/loans/new?itemId=${encodeURIComponent(item.id)}`}
              className={`${BEVEL_LINK} bg-titlebar-mint text-fg-ink`}
            >
              <PixelIcon name="plus" size={16} /> <Trans>LOAN</Trans>
            </Link>
          )}

          {item.is_archived && (
            <BevelButton
              variant="neutral"
              disabled={restore.isPending}
              onClick={() => restore.mutate()}
            >
              <PixelIcon name="reload" size={16} /> <Trans>UNARCHIVE</Trans>
            </BevelButton>
          )}

          {item.needs_review && (
            <BevelButton
              variant="neutral"
              disabled={markReviewed.isPending}
              onClick={() =>
                markReviewed.mutate(item.id, { onSuccess: onClose })
              }
            >
              ✓ <Trans>MARK REVIEWED</Trans>
            </BevelButton>
          )}

          <BevelButton variant="neutral" onClick={onClose}>
            <PixelIcon name="chevron-left" size={16} />{" "}
            <Trans>BACK TO SCAN</Trans>
          </BevelButton>
        </div>
      </div>
    </RetroDialog>
  );
}
