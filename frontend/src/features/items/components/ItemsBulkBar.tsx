import { Trans } from "@lingui/react/macro";
import { BevelButton, BulkActionBar } from "@/components/retro";

// Phase 7 refactor — the mobile-only bulk surface (desktop uses the Bottombar
// SSOT chips). Extracted from ItemsListPage so the page no longer carries the
// `selectedCount > 0` guard or the archived-only destructive-action ternary.
// Renders nothing when the selection is empty; the DELETE affordance only
// appears when every selected row is archived (ITEM-06).
export function ItemsBulkBar({
  selectedCount,
  allSelectedArchived,
  onClear,
  onArchive,
  onDelete,
}: Readonly<{
  selectedCount: number;
  allSelectedArchived: boolean;
  onClear: () => void;
  onArchive: () => void;
  onDelete: () => void;
}>) {
  if (selectedCount === 0) return null;

  return (
    <div className="md:hidden">
      <BulkActionBar
        selectedCount={selectedCount}
        onClear={onClear}
        destructiveAction={
          allSelectedArchived
            ? {
                label: <Trans>DELETE</Trans>,
                confirmTitle: <Trans>DELETE ITEMS?</Trans>,
                confirmBody: (
                  <Trans>
                    The selected archived items will be permanently removed.
                  </Trans>
                ),
                onConfirm: onDelete,
              }
            : undefined
        }
      >
        <BevelButton onClick={onArchive}>
          <Trans>ARCHIVE</Trans>
        </BevelButton>
      </BulkActionBar>
    </div>
  );
}
