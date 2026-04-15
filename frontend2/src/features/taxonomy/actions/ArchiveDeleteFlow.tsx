import { forwardRef, useImperativeHandle, useRef } from "react";
import { useLingui } from "@lingui/react/macro";
import {
  RetroConfirmDialog,
  type RetroConfirmDialogHandle,
} from "@/components/retro";
import { HttpError } from "@/lib/api";

export type EntityKind = "category" | "location" | "container";

export interface ArchiveDeleteFlowProps {
  entityKind: EntityKind;
  nodeName: string;
  onArchive: () => Promise<unknown>;
  onDelete: () => Promise<unknown>;
}

export interface ArchiveDeleteFlowHandle {
  open: () => void;
  close: () => void;
}

export const ArchiveDeleteFlow = forwardRef<
  ArchiveDeleteFlowHandle,
  ArchiveDeleteFlowProps
>(function ArchiveDeleteFlow(
  { entityKind, nodeName, onArchive, onDelete },
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

  // RESEARCH Q4 RESOLVED: Lingui CLI cannot statically extract dynamic
  // `t`${x}`` interpolation. Use discriminated literals so each label is a
  // standalone catalog entry.
  const archiveLabel =
    entityKind === "category"
      ? t`ARCHIVE CATEGORY`
      : entityKind === "location"
        ? t`ARCHIVE LOCATION`
        : t`ARCHIVE CONTAINER`;
  const deleteLabel =
    entityKind === "category"
      ? t`DELETE CATEGORY`
      : entityKind === "location"
        ? t`DELETE LOCATION`
        : t`DELETE CONTAINER`;

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
      // 409 short-circuit: close both dialogs; toast handled by useDeleteCategory
      if (err instanceof HttpError && err.status === 409) {
        deleteRef.current?.close();
        archiveRef.current?.close();
        return;
      }
      // other errors: leave dialog open for retry
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
        title={t`CONFIRM ARCHIVE`}
        body={t`This will hide '${nodeName}' from item pickers. You can restore it later.`}
        headerBadge={t`HIDES FROM PICKERS`}
        escapeLabel={t`← BACK`}
        destructiveLabel={archiveLabel}
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
        body={t`This permanently deletes '${nodeName}'. This action cannot be undone.`}
        escapeLabel={t`← BACK`}
        destructiveLabel={deleteLabel}
        onConfirm={handleDelete}
      />
    </>
  );
});

ArchiveDeleteFlow.displayName = "ArchiveDeleteFlow";
