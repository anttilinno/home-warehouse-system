import { useState, type ReactNode } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import {
  BevelButton,
  RetroBadge,
  RetroConfirmDialog,
  RetroEmptyState,
  type RetroBadgeVariant,
  retroToast,
} from "@/components/retro";
import type { AttachmentType, RepairAttachment } from "@/lib/types";
import { useRepairAttachments } from "../hooks/useRepairAttachments";
import { AddAttachmentDialog } from "./AddAttachmentDialog";

// Phase 10b Plan 03 — the FILES tab of the repair record sub-view (RPR-04,
// link-only). Lists attachment rows (type badge + title/file_name fallback + mime
// + DELETE), an ⊕ ADD FILE CTA opening AddAttachmentDialog, and a NO FILES empty
// state. Rows are display-only — no blob serve route is confirmed for non-photo
// attachments (F1), so there is no open-in-new-tab affordance.

export interface RepairAttachmentPanelProps {
  wsId: string;
  repairId: string;
  /** The repair's owning item — needed to mint a file_id in the add dialog. */
  itemId: string;
}

const BADGE_VARIANT: Record<AttachmentType, RetroBadgeVariant> = {
  MANUAL: "info",
  RECEIPT: "ok",
  WARRANTY: "warn",
  OTHER: "neutral",
  PHOTO: "info",
};

export function RepairAttachmentPanel({
  wsId,
  repairId,
  itemId,
}: Readonly<RepairAttachmentPanelProps>) {
  const { t } = useLingui();
  const { items, isLoading, isError, deleteAttachment } = useRepairAttachments(
    wsId,
    repairId,
  );
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RepairAttachment | null>(
    null,
  );

  function handleDelete() {
    if (!deleteTarget) return;
    deleteAttachment.mutate(deleteTarget.id, {
      onSuccess: () => {
        retroToast.success(t`DONE · File removed.`);
        setDeleteTarget(null);
      },
    });
  }

  let listContent: ReactNode;
  if (isLoading) {
    listContent = (
      <p className="bg-bg-panel-2 p-sp-4 font-mono text-12 text-fg-muted">
        <Trans>Loading…</Trans>
      </p>
    );
  } else if (isError) {
    listContent = (
      <p className="bg-bg-panel-2 p-sp-4 text-14 text-danger">
        <Trans>Couldn't load files. Try again.</Trans>
      </p>
    );
  } else if (items.length === 0) {
    listContent = (
      <div className="bg-bg-panel-2 p-sp-3">
        <RetroEmptyState
          eyebrow={<Trans>Files</Trans>}
          glyph="◇"
          heading={<Trans>NO FILES</Trans>}
          body={
            <Trans>No manuals, receipts, or warranties attached yet.</Trans>
          }
          action={{
            label: <Trans>⊕ ADD FILE</Trans>,
            onClick: () => setAddOpen(true),
          }}
        />
      </div>
    );
  } else {
    listContent = (
      <ul className="bg-bg-panel-2">
        {items.map((att) => (
          <li
            key={att.id}
            className="flex items-center gap-sp-2 border-b border-table-rule px-sp-3 py-sp-2"
          >
            <RetroBadge variant={BADGE_VARIANT[att.attachment_type]}>
              {att.attachment_type}
            </RetroBadge>
            <span className="flex-1 truncate text-14 font-semibold text-fg-ink">
              {att.title || att.file_name || t`Untitled`}
            </span>
            {att.file_mime_type && (
              <span className="font-mono text-12 text-fg-muted">
                {att.file_mime_type}
              </span>
            )}
            <BevelButton
              variant="danger"
              className="!px-[8px] !py-[2px] !text-11"
              onClick={() => setDeleteTarget(att)}
            >
              <Trans>DELETE</Trans>
            </BevelButton>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="flex flex-col gap-sp-2">
      {listContent}

      {/* ⊕ ADD FILE — shown below a non-empty list (the empty state has its own). */}
      {items.length > 0 && (
        <div className="flex justify-end">
          <BevelButton variant="mint" onClick={() => setAddOpen(true)}>
            <Trans>⊕ ADD FILE</Trans>
          </BevelButton>
        </div>
      )}

      {addOpen && (
        <AddAttachmentDialog
          wsId={wsId}
          repairId={repairId}
          itemId={itemId}
          open={addOpen}
          onClose={() => setAddOpen(false)}
        />
      )}

      {deleteTarget && (
        <RetroConfirmDialog
          open
          title={<Trans>DELETE FILE?</Trans>}
          confirmLabel={<Trans>Delete</Trans>}
          confirmDisabled={deleteAttachment.isPending}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          onClose={() => setDeleteTarget(null)}
        >
          <Trans>This file link will be permanently removed.</Trans>
        </RetroConfirmDialog>
      )}
    </div>
  );
}
