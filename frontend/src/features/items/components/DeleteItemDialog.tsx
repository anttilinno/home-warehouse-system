import { Trans, useLingui } from "@lingui/react/macro";
import { RetroConfirmDialog } from "@/components/retro";
import type { Item } from "@/lib/types";

// Phase 7 refactor — the type-to-confirm single delete (ITEM-06). Extracted from
// ItemsListPage so the page no longer carries the confirm-disabled name compare
// or the per-handler null guards. Confirm stays disabled until the exact item
// name is typed; the dialog is open whenever `item` is non-null.
export function DeleteItemDialog({
  item,
  confirmName,
  onConfirmNameChange,
  onConfirm,
  onClose,
}: Readonly<{
  item: Item | null;
  confirmName: string;
  onConfirmNameChange: (value: string) => void;
  onConfirm: (item: Item) => void;
  onClose: () => void;
}>) {
  const { t } = useLingui();

  return (
    <RetroConfirmDialog
      open={item !== null}
      title={<Trans>DELETE ITEM?</Trans>}
      confirmLabel={<Trans>DELETE</Trans>}
      confirmDisabled={confirmName !== (item?.name ?? "")}
      onConfirm={() => {
        if (item) onConfirm(item);
        onClose();
      }}
      onCancel={onClose}
      onClose={onClose}
    >
      <div className="flex flex-col gap-sp-2">
        <Trans>Type the item name to confirm. This can't be undone.</Trans>
        <input
          type="text"
          aria-label={t`Confirm item name`}
          value={confirmName}
          onChange={(e) => onConfirmNameChange(e.target.value)}
          className="border-2 border-border-ink bg-bg-panel bevel-sunken px-[10px] py-[7px] text-14"
        />
      </div>
    </RetroConfirmDialog>
  );
}
