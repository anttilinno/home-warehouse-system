import { useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import {
  BevelButton,
  RetroBadge,
  RetroDialog,
  RetroFileInput,
  RetroInput,
  RetroSelect,
  retroToast,
} from "@/components/retro";
import { HttpError } from "@/lib/api";
import type { AttachmentType } from "@/lib/types";
import { useItemAttachments } from "../hooks/useItemAttachments";

// Phase 14b Plan 03 — the ADD FILE dialog (ATT-01). Unlike the Phase-10b repair
// dialog (link-only, two-step file_id mint), this does a SINGLE REAL multipart
// upload: pick a file → on submit build a FormData (file + attachment_type +
// optional title) → call the upload mutation against the 14b-02 byte route. PHOTO
// is excluded from the type picker (non-photo attachments only; photos have their
// own gallery). On error a contextual toast (404/400 vs generic).

// Non-photo attachment types (PHOTO excluded — photos use the photo gallery).
const TYPE_OPTIONS: AttachmentType[] = [
  "MANUAL",
  "RECEIPT",
  "WARRANTY",
  "OTHER",
];

export interface AddAttachmentDialogProps {
  wsId: string;
  itemId: string;
  open: boolean;
  onClose: () => void;
}

export function AddAttachmentDialog({
  wsId,
  itemId,
  open,
  onClose,
}: AddAttachmentDialogProps) {
  const { t } = useLingui();
  const { upload } = useItemAttachments(wsId, itemId);

  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState<AttachmentType>("OTHER");
  const [title, setTitle] = useState("");

  function reset() {
    setFile(null);
    setType("OTHER");
    setTitle("");
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSubmit() {
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    form.append("attachment_type", type);
    const trimmed = title.trim();
    if (trimmed) form.append("title", trimmed);

    try {
      await upload.mutateAsync(form);
      retroToast.success(t`DONE · File uploaded.`);
      handleClose();
    } catch (err) {
      const reason =
        err instanceof HttpError && err.status === 404
          ? t`That item no longer exists.`
          : err instanceof HttpError && err.status === 400
            ? t`That file was rejected — check its type and size.`
            : t`Try again.`;
      retroToast.error(t`Couldn't upload this file. ${reason}`);
    }
  }

  const canSubmit = Boolean(file);

  return (
    <RetroDialog
      open={open}
      onClose={handleClose}
      title={<Trans>ADD FILE</Trans>}
      titlebarVariant="blue"
      footer={
        <>
          <BevelButton onClick={handleClose}>
            <Trans>CANCEL</Trans>
          </BevelButton>
          <BevelButton
            variant="primary"
            disabled={!canSubmit || upload.isPending}
            onClick={handleSubmit}
          >
            <Trans>ADD FILE</Trans>
          </BevelButton>
        </>
      }
    >
      <div className="flex flex-col gap-sp-3">
        <div className="flex flex-col gap-sp-1">
          <RetroFileInput
            label={<Trans>File *</Trans>}
            multiple={false}
            onChange={(files) => {
              const picked = files[0] ?? null;
              setFile(picked);
              if (picked && !title) setTitle(picked.name);
            }}
          />
          {file && (
            <div className="flex items-center gap-sp-2">
              <span className="flex-1 truncate font-mono text-12 text-fg-ink">
                {file.name}
              </span>
              <RetroBadge variant="ok">
                <span aria-hidden="true">✓ </span>
                <Trans>READY</Trans>
              </RetroBadge>
            </div>
          )}
        </div>

        <RetroSelect
          label={<Trans>Type *</Trans>}
          value={type}
          onChange={(e) => setType(e.target.value as AttachmentType)}
        >
          {TYPE_OPTIONS.map((ty) => (
            <option key={ty} value={ty}>
              {ty}
            </option>
          ))}
        </RetroSelect>

        <RetroInput
          label={<Trans>Title</Trans>}
          value={title}
          placeholder={file?.name ?? ""}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
    </RetroDialog>
  );
}
