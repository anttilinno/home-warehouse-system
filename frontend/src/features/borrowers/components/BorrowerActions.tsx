import { Trans } from "@lingui/react/macro";
import { BevelButton, RetroBadge } from "@/components/retro";

// Phase 9 refactor — the borrower detail titlebar actions (EDIT + DELETE…) with
// the BORR-05 active-loans guard. Extracted from BorrowerDetailPage to lift the
// `blocked` badge + disabled/aria branches out of the page body. DELETE is
// disabled (and no-ops on click) while active loans block deletion.
export function BorrowerActions({
  blocked,
  onEdit,
  onDelete,
}: Readonly<{ blocked: boolean; onEdit: () => void; onDelete: () => void }>) {
  return (
    <span className="flex items-center gap-sp-1">
      {blocked && (
        <RetroBadge variant="danger">
          <Trans>⚠ Active loans</Trans>
        </RetroBadge>
      )}
      <BevelButton className="!px-[8px] !py-[2px] !text-11" onClick={onEdit}>
        <Trans>EDIT</Trans>
      </BevelButton>
      <BevelButton
        variant="danger"
        className="!px-[8px] !py-[2px] !text-11"
        disabled={blocked}
        aria-disabled={blocked || undefined}
        onClick={() => {
          if (blocked) return;
          onDelete();
        }}
      >
        <Trans>DELETE…</Trans>
      </BevelButton>
    </span>
  );
}
