import { Trans, useLingui } from "@lingui/react/macro";
import { RetroConfirmDialog } from "@/components/retro";

// Count-to-confirm bulk delete (A1). The X shortcut / FAB / mobile bulk bar all
// route through this instead of deleting N archived items in a silent loop.
// Confirm stays disabled until the user types the exact count — a deliberate
// friction step for an irreversible, multi-row action.
export function BulkDeleteItemsDialog({
  open,
  count,
  confirmValue,
  onConfirmValueChange,
  onConfirm,
  onClose,
}: Readonly<{
  open: boolean;
  count: number;
  confirmValue: string;
  onConfirmValueChange: (value: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}>) {
  const { t } = useLingui();

  return (
    <RetroConfirmDialog
      open={open}
      title={<Trans>DELETE {count} ITEMS?</Trans>}
      confirmLabel={<Trans>DELETE</Trans>}
      confirmDisabled={confirmValue.trim() !== String(count)}
      onConfirm={() => {
        onConfirm();
        onClose();
      }}
      onCancel={onClose}
      onClose={onClose}
    >
      <div className="flex flex-col gap-sp-2">
        <Trans>
          Type {count} to delete {count} archived items. This can't be undone.
        </Trans>
        <input
          type="text"
          inputMode="numeric"
          aria-label={t`Type the number of items to delete`}
          value={confirmValue}
          onChange={(e) => onConfirmValueChange(e.target.value)}
          className="border-2 border-border-ink bg-bg-panel bevel-sunken px-[10px] py-[7px] text-14"
        />
      </div>
    </RetroConfirmDialog>
  );
}
