import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import {
  BevelButton,
  RetroBadge,
  RetroDialog,
  RetroFileInput,
} from "@/components/retro";
import type { DuplicateCheckResult, DuplicateInfo } from "@/lib/types";
import { photosApi } from "@/lib/api/photos";
import { compressImage, validateUploadFile } from "@/lib/utils/image";
import { usePhotoMutations } from "../hooks/usePhotoMutations";
import { DuplicateWarningDialog } from "./DuplicateWarningDialog";

// Phase 10b Plan 03 — DATA SEAM (single-writer). PhotoUpload is shared between
// item photos and repair photos. The visual contract (dialog, per-file progress
// rows, footer) is IDENTICAL for both; only the data dependency is injectable:
//   - `mutations.upload`  — the upload mutation (defaults to usePhotoMutations).
//   - `checkDuplicate`    — the dup-check step (defaults to photosApi for items;
//                           repairs omit it → the gate is skipped entirely).
//   - `uploadVars`        — extra upload payload (repairs thread `photoType`).
//   - `title` / `extraFields` — repair scope renders a BEFORE/DURING/AFTER select
//                           above the file input; items pass neither (unchanged).
// When NONE of the seam props are supplied the component behaves EXACTLY as the
// shipped item uploader (no behavior/JSX change — guarded by the item tests).

/** The minimal upload-mutation surface the dialog calls. */
export interface PhotoUploadMutations {
  upload: {
    mutateAsync: (vars: {
      file: File;
      caption?: string;
      photoType?: string;
    }) => Promise<unknown>;
  };
}

export interface PhotoUploadProps {
  wsId: string;
  itemId: string;
  /** Whether the upload dialog is open. */
  open: boolean;
  /** Close the dialog (ESC/scrim/close box/DONE). */
  onClose: () => void;
  /**
   * SEAM: injected upload mutations. Defaults to the item photo hook
   * (usePhotoMutations(wsId, itemId)). Repair scope passes the repair hook.
   */
  mutations?: PhotoUploadMutations;
  /**
   * SEAM: duplicate-check step. Defaults to photosApi.checkDuplicate (items).
   * When undefined-by-override (repair scope passes `null`) the dup gate is
   * skipped — the repair backend has no check-duplicate route.
   */
  checkDuplicate?: ((file: File) => Promise<DuplicateCheckResult>) | null;
  /** SEAM: extra upload payload merged into every upload (e.g. `{ photoType }`). */
  uploadVars?: { caption?: string; photoType?: string };
  /** SEAM: dialog title override (defaults to ADD PHOTOS). */
  title?: ReactNode;
  /** SEAM: extra fields rendered above the file input (e.g. a photo_type select). */
  extraFields?: ReactNode;
  /** SEAM: whether the upload is gated until extra fields are valid (repair scope). */
  uploadDisabled?: boolean;
}

type QueueStatus =
  | "pending"
  | "compressing"
  | "checking"
  | "uploading"
  | "duplicate"
  | "done"
  | "failed";

interface QueueItem {
  id: string;
  file: File;
  status: QueueStatus;
  pct: number;
  error?: string;
  duplicates?: DuplicateInfo[];
}

let seq = 0;
const nextId = () => `q-${seq++}`;

/**
 * The ADD PHOTOS dialog (UI-SPEC §4 Upload zone). Pipeline per file:
 * validateUploadFile → compressImage → checkDuplicate → (dup? confirm) → upload.
 * Each file is its own progress row (pending → {pct}% → ✓ DONE / ✕ FAILED +
 * RETRY) so a single failure is isolated and retryable; the footer reads
 * `{done}/{total} uploaded`. HEIC is rejected client-side (Pitfall 2).
 */
export function PhotoUpload({
  wsId,
  itemId,
  open,
  onClose,
  mutations,
  checkDuplicate,
  uploadVars,
  title,
  extraFields,
  uploadDisabled = false,
}: Readonly<PhotoUploadProps>) {
  const { t } = useLingui();
  const itemMutations = usePhotoMutations(wsId, itemId);
  // SEAM: injected mutations win; default to the item photo hook.
  const upload = (mutations ?? itemMutations).upload;
  // SEAM: `checkDuplicate === null` ⇒ skip the gate (repair scope); `undefined`
  // ⇒ fall back to the items api; a function ⇒ use it directly.
  const runCheckDuplicate:
    | ((file: File) => Promise<DuplicateCheckResult>)
    | null =
    checkDuplicate === undefined
      ? (file: File) => photosApi.checkDuplicate(wsId, itemId, file)
      : checkDuplicate;
  const [queue, setQueue] = useState<QueueItem[]>([]);

  const patch = useCallback(
    (id: string, next: Partial<QueueItem>) =>
      setQueue((q) => q.map((it) => (it.id === id ? { ...it, ...next } : it))),
    [],
  );

  // Run the validate→compress→check-duplicate→upload pipeline for one queue
  // item. Stops at "duplicate" when check-duplicate hits, waiting for the
  // per-file decision; `proceed(id)` resumes the upload.
  // biome-ignore lint/correctness/useExhaustiveDependencies: commitUpload is declared below (TDZ — cannot be a dep here); t is locale-stable. wsId/itemId pin the closure deliberately; launchedRef guards against relaunch.
  const runFile = useCallback(
    async (item: QueueItem) => {
      const valid = validateUploadFile(item.file);
      if (!valid.ok) {
        patch(item.id, { status: "failed", error: valid.reason });
        return;
      }
      try {
        patch(item.id, { status: "compressing", pct: 0 });
        const compressed = await compressImage(item.file);
        // SEAM: skip the dup-check entirely when no checker is wired (repairs).
        if (runCheckDuplicate) {
          patch(item.id, { status: "checking" });
          const dup = await runCheckDuplicate(compressed);
          if (dup.has_duplicates) {
            patch(item.id, { status: "duplicate", duplicates: dup.duplicates });
            // Stash the compressed file for the proceed path.
            setQueue((q) =>
              q.map((it) =>
                it.id === item.id ? { ...it, file: compressed } : it,
              ),
            );
            return;
          }
        }
        await commitUpload(item.id, compressed);
      } catch {
        patch(item.id, { status: "failed", error: t`Upload failed.` });
      }
    },
    [wsId, itemId, patch, runCheckDuplicate],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: t is locale-stable; only used in the failure path.
  const commitUpload = useCallback(
    async (id: string, file: File) => {
      patch(id, { status: "uploading", pct: 50 });
      try {
        // SEAM: merge injected upload vars (repairs thread `photoType`/caption).
        await upload.mutateAsync({ file, ...uploadVars });
        patch(id, { status: "done", pct: 100 });
      } catch {
        patch(id, { status: "failed", error: t`Upload failed.` });
      }
    },
    [patch, upload, uploadVars],
  );

  const onFilesChosen = useCallback((files: File[]) => {
    // Only enqueue files not already queued (RetroFileInput emits the full
    // accumulated list on every change). The pipeline is kicked off by the
    // effect below AFTER the new rows commit — launching it inside the updater
    // would patch ids that don't exist in state yet (lost updates).
    setQueue((prev) => {
      const known = new Set(prev.map((q) => q.file));
      const added: QueueItem[] = files
        .filter((f) => !known.has(f))
        .map((f) => ({ id: nextId(), file: f, status: "pending", pct: 0 }));
      return [...prev, ...added];
    });
  }, []);

  // Launch the pipeline for any freshly-enqueued "pending" file exactly once.
  // SEAM: when `uploadDisabled` (repair scope, no photo_type chosen yet) the
  // launch is held — files sit in "pending" until the gate clears, at which point
  // this effect re-runs and launches them.
  const launchedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (uploadDisabled) return;
    for (const item of queue) {
      if (item.status === "pending" && !launchedRef.current.has(item.id)) {
        launchedRef.current.add(item.id);
        void runFile(item);
      }
    }
  }, [queue, runFile, uploadDisabled]);

  const retry = useCallback(
    (item: QueueItem) => {
      patch(item.id, { status: "pending", pct: 0, error: undefined });
      void runFile({ ...item, status: "pending" });
    },
    [patch, runFile],
  );

  const proceed = useCallback(
    (item: QueueItem) => {
      patch(item.id, { status: "uploading", duplicates: undefined });
      void commitUpload(item.id, item.file);
    },
    [patch, commitUpload],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: t is locale-stable; only used to build the skip message.
  const skip = useCallback(
    (id: string) =>
      patch(id, {
        status: "failed",
        error: t`Skipped (possible duplicate).`,
        duplicates: undefined,
      }),
    [patch],
  );

  const done = queue.filter((q) => q.status === "done").length;
  const dupItem = queue.find((q) => q.status === "duplicate");

  return (
    <RetroDialog
      open={open}
      onClose={onClose}
      title={title ?? <Trans>ADD PHOTOS</Trans>}
      titlebarVariant="blue"
      width="min(560px,92vw)"
      footer={
        <>
          <span className="mr-auto font-mono text-12 tabular-nums text-fg-muted">
            <Trans>
              {done}/{queue.length} uploaded
            </Trans>
          </span>
          <BevelButton variant="primary" onClick={onClose}>
            <Trans>CLOSE</Trans>
          </BevelButton>
        </>
      }
    >
      {/* SEAM: repair scope renders a BEFORE/DURING/AFTER select here. */}
      {extraFields}

      <RetroFileInput
        label={<Trans>Photos</Trans>}
        accept="image/jpeg,image/png,image/webp"
        maxSize={10 * 1024 * 1024}
        multiple
        onChange={onFilesChosen}
      />

      {queue.length > 0 && (
        <ul className="flex flex-col gap-sp-2">
          {queue.map((item) => (
            <li
              key={item.id}
              className="flex flex-col gap-sp-1 border-2 border-border-ink bg-bg-panel-2 px-sp-2 py-sp-1"
            >
              <div className="flex items-center gap-sp-2">
                <span className="flex-1 truncate font-mono text-12 text-fg-ink">
                  {item.file.name}
                </span>
                <span className="font-mono text-12 tabular-nums text-fg-muted">
                  {(item.file.size / (1024 * 1024)).toFixed(1)} MB
                </span>
                <PhotoUploadStatus item={item} onRetry={() => retry(item)} />
              </div>
              {item.status === "failed" && item.error && (
                <p className="text-12 font-semibold text-danger">
                  <span aria-hidden="true">✕ </span>
                  {item.error}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {dupItem && (
        <DuplicateWarningDialog
          open
          filename={dupItem.file.name}
          duplicates={dupItem.duplicates ?? []}
          onProceed={() => proceed(dupItem)}
          onCancel={() => skip(dupItem.id)}
        />
      )}
    </RetroDialog>
  );
}

function PhotoUploadStatus({
  item,
  onRetry,
}: Readonly<{
  item: QueueItem;
  onRetry: () => void;
}>) {
  switch (item.status) {
    case "done":
      return (
        <RetroBadge variant="ok">
          <span aria-hidden="true">✓ </span>
          <Trans>DONE</Trans>
        </RetroBadge>
      );
    case "failed":
      return (
        <span className="flex items-center gap-sp-1">
          <RetroBadge variant="danger">
            <span aria-hidden="true">✕ </span>
            <Trans>FAILED</Trans>
          </RetroBadge>
          <BevelButton
            className="!px-[8px] !py-[2px] !text-11"
            onClick={onRetry}
          >
            <Trans>RETRY</Trans>
          </BevelButton>
        </span>
      );
    case "uploading":
    case "compressing":
    case "checking":
    case "duplicate":
      return (
        <span
          role="progressbar"
          aria-valuenow={item.pct}
          className="font-mono text-12 tabular-nums text-fg-muted"
        >
          {item.pct}%
        </span>
      );
    default:
      return (
        <span className="font-mono text-12 tabular-nums text-fg-muted">
          <Trans>pending</Trans>
        </span>
      );
  }
}
