import { useState, type ReactNode } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import {
  BevelButton,
  PixelIcon,
  RetroBadge,
  RetroConfirmDialog,
  RetroEmptyState,
  type RetroBadgeVariant,
  retroToast,
} from "@/components/retro";
import { itemAttachmentsApi, type ItemAttachment } from "@/lib/api/attachments";
import type { AttachmentType } from "@/lib/types";
import { useItemAttachments } from "../hooks/useItemAttachments";
import { AddAttachmentDialog } from "./AddAttachmentDialog";

// Phase 14b Plan 03 — the FILES panel for the item detail page (ATT-01/02). Lists
// attachment rows (type badge + title/file_name fallback + a PRIMARY badge when
// is_primary + mime + a download link to the 14b-02 serve route), a SET PRIMARY
// action per NON-primary row, a confirm-gated DELETE, and an ⊕ ADD FILE CTA opening
// AddAttachmentDialog. SELF-CONTAINED: takes {wsId, itemId} so 14b-05 can mount it
// into the item tabs with no further wiring. NOT mounted here (14b-05's job).

export interface ItemAttachmentPanelProps {
  wsId: string;
  itemId: string;
}

const BADGE_VARIANT: Record<AttachmentType, RetroBadgeVariant> = {
  MANUAL: "info",
  RECEIPT: "ok",
  WARRANTY: "warn",
  OTHER: "neutral",
  PHOTO: "info",
};

export function ItemAttachmentPanel({
  wsId,
  itemId,
}: Readonly<ItemAttachmentPanelProps>) {
  const { t } = useLingui();
  const { items, isLoading, isError, setPrimary, deleteAttachment } =
    useItemAttachments(wsId, itemId);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ItemAttachment | null>(null);

  function handleSetPrimary(att: ItemAttachment) {
    setPrimary.mutate(att.id, {
      onSuccess: () => retroToast.success(t`DONE · Primary file set.`),
    });
  }

  function handleDelete() {
    if (!deleteTarget) return;
    deleteAttachment.mutate(deleteTarget.id, {
      onSuccess: () => {
        retroToast.success(t`DONE · File removed.`);
        setDeleteTarget(null);
      },
    });
  }

  let content: ReactNode;
  if (isLoading) {
    content = (
      <p className="bg-bg-panel-2 p-sp-4 font-mono text-12 text-fg-muted">
        <Trans>Loading…</Trans>
      </p>
    );
  } else if (isError) {
    content = (
      <p className="bg-bg-panel-2 p-sp-4 text-14 text-danger">
        <Trans>Couldn't load files. Try again.</Trans>
      </p>
    );
  } else if (items.length === 0) {
    content = (
      <div className="bg-bg-panel-2 p-sp-3">
        <RetroEmptyState
          eyebrow={<Trans>Files</Trans>}
          glyph="attachment"
          heading={<Trans>NO FILES</Trans>}
          body={
            <Trans>No manuals, receipts, or warranties attached yet.</Trans>
          }
          action={{
            label: (
              <>
                <PixelIcon name="plus" size={16} /> <Trans>ADD FILE</Trans>
              </>
            ),
            onClick: () => setAddOpen(true),
          }}
        />
      </div>
    );
  } else {
    content = (
      <ul className="bg-bg-panel-2">
        {items.map((att) => (
          <li
            key={att.id}
            className="flex items-center gap-sp-2 border-b border-table-rule px-sp-3 py-sp-2"
          >
            <RetroBadge variant={BADGE_VARIANT[att.attachment_type]}>
              {att.attachment_type}
            </RetroBadge>
            {att.is_primary && (
              <RetroBadge variant="ok">
                <Trans>PRIMARY</Trans>
              </RetroBadge>
            )}
            <a
              href={itemAttachmentsApi.downloadUrl(wsId, att.id)}
              target="_blank"
              rel="noreferrer"
              className="flex-1 truncate text-14 font-semibold text-fg-ink underline-offset-2 hover:underline"
            >
              {att.title || att.file_name || t`Untitled`}
            </a>
            {att.file_mime_type && (
              <span className="font-mono text-12 text-fg-muted">
                {att.file_mime_type}
              </span>
            )}
            {!att.is_primary && (
              <BevelButton
                variant="mint"
                className="!px-[8px] !py-[2px] !text-11"
                disabled={setPrimary.isPending}
                onClick={() => handleSetPrimary(att)}
              >
                <Trans>SET PRIMARY</Trans>
              </BevelButton>
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
      {content}

      {/* ⊕ ADD FILE — shown below a non-empty list (the empty state has its own). */}
      {items.length > 0 && (
        <div className="flex justify-end">
          <BevelButton variant="mint" onClick={() => setAddOpen(true)}>
            <PixelIcon name="plus" size={16} /> <Trans>ADD FILE</Trans>
          </BevelButton>
        </div>
      )}

      {addOpen && (
        <AddAttachmentDialog
          wsId={wsId}
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
          <Trans>This file will be permanently removed.</Trans>
        </RetroConfirmDialog>
      )}
    </div>
  );
}
