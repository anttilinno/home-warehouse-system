import { Trans } from "@lingui/react/macro";
import { BevelButton, PixelIcon, RetroDialog } from "@/components/retro";
import type { DuplicateInfo } from "@/lib/types";

export interface DuplicateWarningDialogProps {
  /** Whether the dialog is open (a per-file duplicate hit). */
  open: boolean;
  /** The name of the file being checked (shown in the body). */
  filename: string;
  /** Existing similar photos returned by check-duplicate (already /api-relative). */
  duplicates: DuplicateInfo[];
  /** Whether the upload is in flight (disables both buttons). */
  uploading?: boolean;
  /** UPLOAD ANYWAY — proceed with this file. */
  onProceed: () => void;
  /** CANCEL — skip this file. Also the ESC/scrim/close handler. */
  onCancel: () => void;
}

// Up to 4 existing thumbnails are shown; the rest collapse into a +{n} tile.
const MAX_THUMBS = 4;

/**
 * Butter-titled warning dialog (MANIFEST: butter = warning, NOT pink danger —
 * this is a "possible duplicate" advisory, not a destructive confirm). Shows up
 * to 4 existing similar thumbnails with a `{similarity}%` badge each; the
 * per-file decision is CANCEL (skip) vs UPLOAD ANYWAY (proceed).
 */
export function DuplicateWarningDialog({
  open,
  filename,
  duplicates,
  uploading = false,
  onProceed,
  onCancel,
}: Readonly<DuplicateWarningDialogProps>) {
  const shown = duplicates.slice(0, MAX_THUMBS);
  const overflow = duplicates.length - shown.length;

  return (
    <RetroDialog
      open={open}
      onClose={onCancel}
      title={<Trans>POSSIBLE DUPLICATE</Trans>}
      titlebarVariant="butter"
      width="min(460px,92vw)"
      footer={
        <>
          <BevelButton
            variant="neutral"
            disabled={uploading}
            onClick={onCancel}
          >
            <Trans>CANCEL</Trans>
          </BevelButton>
          <BevelButton
            variant="primary"
            disabled={uploading}
            aria-disabled={uploading || undefined}
            onClick={onProceed}
          >
            <Trans>UPLOAD ANYWAY</Trans>
          </BevelButton>
        </>
      }
    >
      <p className="font-body text-14 text-fg-ink">
        <Trans>
          Found {duplicates.length} similar photo(s) already on this item.
        </Trans>
      </p>
      <p className="truncate font-mono text-12 text-fg-muted">{filename}</p>
      {shown.length > 0 && (
        <div className="flex flex-wrap gap-sp-2">
          {shown.map((d) => (
            <div
              key={d.photo_id}
              className="relative h-[80px] w-[80px] flex-none border-2 border-border-ink bg-bg-panel-2"
            >
              {d.thumbnail_url ? (
                <img
                  src={d.thumbnail_url}
                  alt={d.filename}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="flex h-full w-full items-center justify-center text-fg-faint"
                >
                  <PixelIcon name="image" size={32} />
                </span>
              )}
              <span className="absolute bottom-[2px] right-[2px] rounded-chip border border-border-ink bg-bg-panel px-[4px] py-px font-mono text-10 tabular-nums text-fg-ink">
                {d.similarity_pct}%
              </span>
            </div>
          ))}
          {overflow > 0 && (
            <div className="flex h-[80px] w-[80px] flex-none items-center justify-center border-2 border-border-ink bg-bg-panel-2 font-mono text-14 text-fg-muted">
              +{overflow}
            </div>
          )}
        </div>
      )}
    </RetroDialog>
  );
}
