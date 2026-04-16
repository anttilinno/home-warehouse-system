import { forwardRef, useImperativeHandle, useRef } from "react";
import { useLingui } from "@lingui/react/macro";
import {
  RetroConfirmDialog,
  type RetroConfirmDialogHandle,
} from "@/components/retro";
import { HttpError } from "@/lib/api";

export interface BorrowerArchiveDeleteFlowProps {
  nodeName: string;
  onArchive: () => Promise<unknown>;
  onDelete: () => Promise<unknown>;
}

export interface BorrowerArchiveDeleteFlowHandle {
  open: () => void;
  close: () => void;
}

export const BorrowerArchiveDeleteFlow = forwardRef<
  BorrowerArchiveDeleteFlowHandle,
  BorrowerArchiveDeleteFlowProps
>(function BorrowerArchiveDeleteFlow(
  { nodeName, onArchive, onDelete },
  ref,
) {
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
    } catch (err) {
      // 400 = active loans guard fired; close both; toast handled by useDeleteBorrower
      if (err instanceof HttpError && err.status === 400) {
        deleteRef.current?.close();
        archiveRef.current?.close();
        return;
      }
      // Other errors: swallow — useDeleteBorrower's onError has already surfaced
      // the connection-lost toast. We mirror taxonomy/ArchiveDeleteFlow's behaviour
      // (no rethrow) to avoid unhandled rejections from RetroConfirmDialog.handleConfirm.
      // The dialog stays open or closes depending on RetroConfirmDialog's resolved-only
      // close path; current design closes on any swallowed outcome.
    }
  };

  const switchToDelete = () => {
    archiveRef.current?.close();
    setTimeout(() => deleteRef.current?.open(), 0);
  };

  return (
    <>
      <RetroConfirmDialog
        ref={archiveRef}
        variant="soft"
        title={t`ARCHIVE BORROWER`}
        body={t`This will hide ${nodeName} from loan pickers. You can restore them later.`}
        headerBadge={t`HIDES FROM LOAN PICKERS`}
        escapeLabel={t`← BACK`}
        destructiveLabel={t`ARCHIVE BORROWER`}
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
        body={t`Permanently delete ${nodeName}? This action cannot be undone.`}
        escapeLabel={t`← BACK`}
        destructiveLabel={t`DELETE BORROWER`}
        onConfirm={handleDelete}
      />
    </>
  );
});

BorrowerArchiveDeleteFlow.displayName = "BorrowerArchiveDeleteFlow";
