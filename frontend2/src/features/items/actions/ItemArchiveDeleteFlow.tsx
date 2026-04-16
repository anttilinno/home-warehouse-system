import { forwardRef, useImperativeHandle, useRef } from "react";
import { useLingui } from "@lingui/react/macro";
import {
  RetroConfirmDialog,
  type RetroConfirmDialogHandle,
} from "@/components/retro";

export interface ItemArchiveDeleteFlowProps {
  nodeName: string;
  onArchive: () => Promise<unknown>;
  onDelete: () => Promise<unknown>;
}

export interface ItemArchiveDeleteFlowHandle {
  open: () => void;
  close: () => void;
}

/**
 * Two-stage archive-first destructive flow for items.
 *
 * DIVERGES from BorrowerArchiveDeleteFlow: items have no loan-bound server
 * guard (D-04), so handleDelete does NOT short-circuit on any specific HTTP
 * status. All errors are surfaced by the mutation hook's onError toast; the
 * dialog's own close-on-resolve behaviour handles UX.
 *
 * Copy rules per 60-UI-SPEC §Destructive confirmations:
 *   - Archive dialog escape label: "← BACK" (two-step flow continuation)
 *   - Delete  dialog escape label: "KEEP ITEM" (terminal confirmation)
 *   - nodeName interpolation is UNQUOTED (per borrower fix commit 1b84a45)
 */
export const ItemArchiveDeleteFlow = forwardRef<
  ItemArchiveDeleteFlowHandle,
  ItemArchiveDeleteFlowProps
>(function ItemArchiveDeleteFlow({ nodeName, onArchive, onDelete }, ref) {
  const { t } = useLingui();
  const archiveRef = useRef<RetroConfirmDialogHandle>(null);
  const deleteRef = useRef<RetroConfirmDialogHandle>(null);

  useImperativeHandle(ref, () => ({
    open: () => archiveRef.current?.open(),
    close: () => {
      archiveRef.current?.close();
      deleteRef.current?.close();
    },
  }));

  const handleArchive = async () => {
    try {
      await onArchive();
      archiveRef.current?.close();
    } catch {
      // mutation hook already emits a toast; keep dialog open for retry context
    }
  };

  const handleDelete = async () => {
    try {
      await onDelete();
      deleteRef.current?.close();
    } catch {
      // No 400 active-loans branch (items have no equivalent server guard
      // per D-04). Swallow to avoid unhandled rejection from
      // RetroConfirmDialog.handleConfirm; the mutation hook's onError has
      // already fired a toast.
    }
  };

  const switchToDelete = () => {
    archiveRef.current?.close();
    // 0ms setTimeout avoids a dialog-race where both dialogs are briefly
    // open at once. Verified pattern from Phase 59.
    setTimeout(() => deleteRef.current?.open(), 0);
  };

  return (
    <>
      <RetroConfirmDialog
        ref={archiveRef}
        variant="soft"
        title={t`ARCHIVE ITEM`}
        body={t`This will hide ${nodeName} from the items list. You can restore it later.`}
        headerBadge={t`HIDES FROM DEFAULT VIEW`}
        escapeLabel={t`← BACK`}
        destructiveLabel={t`ARCHIVE ITEM`}
        onConfirm={handleArchive}
        secondaryLink={{
          label: t`delete permanently`,
          onClick: switchToDelete,
        }}
      />
      <RetroConfirmDialog
        ref={deleteRef}
        variant="destructive"
        title={t`CONFIRM DELETE`}
        body={t`Permanently delete ${nodeName}? This cannot be undone.`}
        escapeLabel={t`KEEP ITEM`}
        destructiveLabel={t`DELETE ITEM`}
        onConfirm={handleDelete}
      />
    </>
  );
});

ItemArchiveDeleteFlow.displayName = "ItemArchiveDeleteFlow";
