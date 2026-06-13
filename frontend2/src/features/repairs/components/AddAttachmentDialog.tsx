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
import { post, HttpError } from "@/lib/api";
import type { AttachmentType } from "@/lib/types";
import { useRepairAttachments } from "../hooks/useRepairAttachments";

// Phase 10b Plan 03 — the ADD FILE dialog (RPR-04, link-only, OQ3). Two steps:
//   1. Pick a file → JSON-POST /items/{itemId}/attachments/upload (metadata only)
//      to MINT a file_id. NOTE: the backend upload endpoint is metadata-only — it
//      records a File row but stores NO BYTES (a pre-existing project-wide stub).
//      This is the RPR-04 byte-storage residue; logged in the SUMMARY.
//   2. Submit → link via repairAttachmentsApi.create({file_id, attachment_type,
//      title?}). On link error (404 file / 400 cross-workspace) a contextual toast.
//
// The footer ADD FILE is disabled until a file_id is minted AND a type is chosen.
// The per-file mint status reuses the PhotoUpload ✓ DONE / ✕ FAILED + RETRY idiom.

const TYPE_OPTIONS: AttachmentType[] = [
  "MANUAL",
  "RECEIPT",
  "WARRANTY",
  "OTHER",
];

// The metadata-only upload response (carries the minted file_id, handler.go:348).
interface UploadResponse {
  file_id: string;
}

type MintStatus = "idle" | "uploading" | "done" | "failed";

export interface AddAttachmentDialogProps {
  wsId: string;
  repairId: string;
  /** The repair's owning item — the file_id mint endpoint is item-scoped. */
  itemId: string;
  open: boolean;
  onClose: () => void;
}

export function AddAttachmentDialog({
  wsId,
  repairId,
  itemId,
  open,
  onClose,
}: AddAttachmentDialogProps) {
  const { t } = useLingui();
  const { createAttachment } = useRepairAttachments(wsId, repairId);

  const [file, setFile] = useState<File | null>(null);
  const [fileId, setFileId] = useState<string | null>(null);
  const [mint, setMint] = useState<MintStatus>("idle");
  const [type, setType] = useState<AttachmentType>("MANUAL");
  const [title, setTitle] = useState("");

  function reset() {
    setFile(null);
    setFileId(null);
    setMint("idle");
    setType("MANUAL");
    setTitle("");
  }

  function handleClose() {
    reset();
    onClose();
  }

  // Step 1 — mint a file_id from the item-attachment metadata endpoint. The
  // endpoint stores NO bytes (the byte-storage stub residue) — it only records a
  // File row and returns its id, which the repair attachment then links.
  async function mintFileId(picked: File) {
    setFile(picked);
    setFileId(null);
    setMint("uploading");
    try {
      const res = await post<UploadResponse>(
        `/workspaces/${wsId}/items/${itemId}/attachments/upload`,
        {
          file_name: picked.name,
          mime_type: picked.type || "application/octet-stream",
          size_bytes: picked.size,
        },
      );
      setFileId(res.file_id);
      setMint("done");
      if (!title) setTitle(picked.name);
    } catch {
      setMint("failed");
    }
  }

  // Step 2 — link the minted file_id to the repair.
  async function handleSubmit() {
    if (!fileId) return;
    try {
      await createAttachment.mutateAsync({
        file_id: fileId,
        attachment_type: type,
        title: title.trim() || undefined,
      });
      retroToast.success(t`DONE · File attached.`);
      handleClose();
    } catch (err) {
      const reason =
        err instanceof HttpError && err.status === 404
          ? t`That file no longer exists.`
          : err instanceof HttpError && err.status === 400
            ? t`The file belongs to a different workspace.`
            : t`Try again.`;
      retroToast.error(t`Couldn't attach this file. ${reason}`);
    }
  }

  const canSubmit = Boolean(fileId) && mint === "done";

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
            disabled={!canSubmit || createAttachment.isPending}
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
              if (files[0]) void mintFileId(files[0]);
            }}
          />
          {/* Per-file mint status — PhotoUpload idiom (✓ DONE / ✕ FAILED + RETRY). */}
          {file && mint !== "idle" && (
            <div className="flex items-center gap-sp-2">
              <span className="flex-1 truncate font-mono text-[12px] text-fg-ink">
                {file.name}
              </span>
              {mint === "uploading" && (
                <span className="font-mono text-[12px] text-fg-muted">
                  <Trans>uploading…</Trans>
                </span>
              )}
              {mint === "done" && (
                <RetroBadge variant="ok">
                  <span aria-hidden="true">✓ </span>
                  <Trans>DONE</Trans>
                </RetroBadge>
              )}
              {mint === "failed" && (
                <span className="flex items-center gap-sp-1">
                  <RetroBadge variant="danger">
                    <span aria-hidden="true">✕ </span>
                    <Trans>FAILED</Trans>
                  </RetroBadge>
                  <BevelButton
                    className="!px-[8px] !py-[2px] !text-[11px]"
                    onClick={() => file && void mintFileId(file)}
                  >
                    <Trans>RETRY</Trans>
                  </BevelButton>
                </span>
              )}
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
