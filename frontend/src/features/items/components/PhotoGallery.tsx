import { useEffect, useMemo, useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import {
  BevelButton,
  RetroBadge,
  RetroConfirmDialog,
  useTableSelection,
} from "@/components/retro";
import { photosApi } from "@/lib/api/photos";
import { usePhotoMutations } from "../hooks/usePhotoMutations";
import { CaptionDialog } from "./CaptionDialog";

// Phase 10b Plan 03 — DATA SEAM (single-writer). PhotoGallery is shared between
// item photos and repair photos. The grid + caption/delete affordances are
// IDENTICAL; the heavy item-only affordances (set-primary, reorder, bulk,
// zip-download) are CAPABILITY-GATED so the repair scope (whose backend lacks
// those routes, F2) renders a clean caption+delete grid. When no seam props are
// supplied the component behaves EXACTLY as the shipped item gallery — the visual
// contract and every item affordance are unchanged (guarded by item tests).

/**
 * The structural shape the gallery renders. `Photo` satisfies it; `RepairPhoto`
 * maps onto it (filename ← caption fallback, is_primary omitted, display_order
 * irrelevant). Repair scope adapts its photos into this shape upstream.
 */
export interface GalleryPhoto {
  id: string;
  thumbnail_url: string;
  caption?: string;
  filename?: string;
  is_primary?: boolean;
}

/** The mutation surface the gallery may call (item provides the full set). */
export interface PhotoGalleryMutations {
  setPrimary?: { mutate: (photoId: string) => void };
  updateCaption: {
    mutate: (vars: { photoId: string; caption: string }) => void;
  };
  del: { mutate: (photoId: string) => void };
  bulkDelete?: {
    mutate: (
      photoIds: string[],
      opts?: { onSuccess?: () => void },
    ) => void;
  };
  bulkCaption?: {
    mutate: (
      updates: { photo_id: string; caption: string }[],
      opts?: { onSuccess?: () => void },
    ) => void;
  };
  reorder?: {
    mutate: (photoIds: string[], opts?: { onError?: () => void }) => void;
  };
}

export interface PhotoGalleryProps {
  wsId: string;
  itemId: string;
  /** The photos (already /api-relative thumbnail_url / url from Plan 01). */
  photos: GalleryPhoto[];
  /** Open the lightbox at the clicked photo index. */
  onOpenLightbox: (index: number) => void;
  /**
   * SEAM: injected mutations. Defaults to usePhotoMutations(wsId, itemId).
   * Repair scope passes a REDUCED set (updateCaption + del only).
   */
  mutations?: PhotoGalleryMutations;
  /** SEAM: render the set-primary affordance (default true / items). */
  canSetPrimary?: boolean;
  /** SEAM: render ◂/▸ reorder (default true / items). */
  canReorder?: boolean;
  /** SEAM: render the SELECT/bulk toolbar (default true / items). */
  canBulk?: boolean;
  /** SEAM: render the ⤓ DOWNLOAD toolbar (default true / items). */
  canDownloadZip?: boolean;
}

/**
 * The PHOTOS-tab gallery (UI-SPEC §4). Renders the /api-relative thumbnails in
 * an auto-fill grid; each cell exposes set-primary, per-photo delete-confirm,
 * caption edit, and ◂/▸ reorder (buttons, NOT drag — swaps with the neighbor and
 * PUTs the FULL ordered id list, optimistic with revert). A SELECT toggle drives
 * bulk caption / delete / zip-download via useTableSelection.
 */
export function PhotoGallery({
  wsId,
  itemId,
  photos,
  onOpenLightbox,
  mutations,
  canSetPrimary = true,
  canReorder = true,
  canBulk = true,
  canDownloadZip = true,
}: PhotoGalleryProps) {
  const { t } = useLingui();
  const itemMutations = usePhotoMutations(wsId, itemId);
  // SEAM: injected mutations win; default to the item photo hook.
  const { setPrimary, updateCaption, del, bulkDelete, bulkCaption, reorder } =
    mutations ?? itemMutations;

  // Local ordered copy so reorder is optimistic; revert on server rejection.
  const [order, setOrder] = useState<GalleryPhoto[]>(photos);
  useEffect(() => setOrder(photos), [photos]);

  const [selecting, setSelecting] = useState(false);
  const selection = useTableSelection(order);

  const [deleteTarget, setDeleteTarget] = useState<GalleryPhoto | null>(null);
  const [captionTarget, setCaptionTarget] = useState<GalleryPhoto | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkCaptionOpen, setBulkCaptionOpen] = useState(false);

  const selectedIds = useMemo(
    () => order.filter((p) => selection.selected.has(p.id)).map((p) => p.id),
    [order, selection.selected],
  );

  const move = (index: number, dir: -1 | 1) => {
    if (!reorder) return;
    const target = index + dir;
    if (target < 0 || target >= order.length) return;
    const prev = order;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    setOrder(next); // optimistic
    reorder.mutate(
      next.map((p) => p.id),
      { onError: () => setOrder(prev) }, // revert
    );
  };

  if (order.length === 0) {
    return (
      <p className="text-[14px] text-fg-muted">
        <Trans>No photos yet.</Trans>
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-sp-2">
      {/* Toolbar — SELECT (bulk) + DOWNLOAD (zip); both capability-gated. */}
      {(canBulk || canDownloadZip) && (
        <div className="flex items-center gap-sp-2 bg-bg-panel-2 p-sp-2">
          {canBulk && (
            <BevelButton
              aria-pressed={selecting}
              onClick={() => {
                setSelecting((s) => !s);
                selection.clear();
              }}
            >
              <Trans>SELECT</Trans>
            </BevelButton>
          )}
          <span className="flex-1" />
          {canDownloadZip && (
            <BevelButton
              onClick={() =>
                photosApi.downloadZip(
                  wsId,
                  itemId,
                  selectedIds.length ? selectedIds : undefined,
                )
              }
            >
              {selectedIds.length ? (
                <Trans>⤓ DOWNLOAD {selectedIds.length}</Trans>
              ) : (
                <Trans>⤓ DOWNLOAD ALL</Trans>
              )}
            </BevelButton>
          )}
        </div>
      )}

      {/* Bulk action bar */}
      {canBulk && selecting && selectedIds.length > 0 && (
        <div
          data-testid="bulk-action-bar"
          className="flex items-center gap-sp-2 bg-bg-panel-2 p-sp-2"
        >
          <RetroBadge variant="info">
            <Trans>{selectedIds.length} SELECTED</Trans>
          </RetroBadge>
          <BevelButton onClick={() => setBulkCaptionOpen(true)}>
            <Trans>EDIT CAPTION</Trans>
          </BevelButton>
          <BevelButton variant="danger" onClick={() => setBulkDeleteOpen(true)}>
            <Trans>DELETE</Trans>
          </BevelButton>
          <BevelButton onClick={() => selection.clear()}>
            <Trans>✕ CLEAR</Trans>
          </BevelButton>
        </div>
      )}

      {/* Grid */}
      <ul
        className="grid gap-sp-1"
        style={{
          gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))",
        }}
      >
        {order.map((photo, index) => {
          const isSelected = selection.selected.has(photo.id);
          return (
            <li
              key={photo.id}
              className={`group relative h-24 w-24 border-2 ${
                isSelected
                  ? "border-border-ink ring-2 ring-titlebar-blue"
                  : "border-border-ink"
              }`}
            >
              <button
                type="button"
                aria-label={
                  selecting
                    ? t`Toggle ${photo.caption ?? photo.filename}`
                    : t`Open ${photo.caption ?? photo.filename}`
                }
                aria-pressed={selecting ? isSelected : undefined}
                onClick={(e) => {
                  if (selecting) {
                    // In gallery select mode each tile TOGGLES independently —
                    // force the ctrl/cmd toggle path of useTableSelection so a
                    // plain click adds/removes rather than single-selecting.
                    selection.onRowClick(photo.id, {
                      shiftKey: e.shiftKey,
                      metaKey: true,
                      ctrlKey: true,
                    });
                  } else {
                    onOpenLightbox(index);
                  }
                }}
                className="block h-full w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-border-ink focus-visible:outline-offset-2"
              >
                <img
                  src={photo.thumbnail_url}
                  alt={photo.caption ?? photo.filename}
                  className="h-full w-full object-cover"
                />
              </button>

              {/* Primary badge / set-primary (capability-gated) */}
              {photo.is_primary ? (
                <span className="absolute left-[2px] top-[2px]">
                  <RetroBadge variant="info">
                    <Trans>★ PRIMARY</Trans>
                  </RetroBadge>
                </span>
              ) : (
                canSetPrimary &&
                setPrimary &&
                !selecting && (
                  <BevelButton
                    className="absolute left-[2px] top-[2px] !px-[6px] !py-[1px] !text-[10px] opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
                    onClick={() => setPrimary.mutate(photo.id)}
                  >
                    <Trans>★ SET PRIMARY</Trans>
                  </BevelButton>
                )
              )}

              {/* Per-photo controls (hidden in select mode) */}
              {!selecting && (
                <div className="absolute inset-x-[2px] bottom-[2px] flex items-center justify-between opacity-0 focus-within:opacity-100 group-hover:opacity-100">
                  <span className="flex gap-[2px]">
                    {canReorder && reorder && (
                      <>
                        <BevelButton
                          className="!px-[5px] !py-px !text-[10px]"
                          aria-label={t`Move ${photo.caption ?? photo.filename} earlier`}
                          title={t`Move ${photo.caption ?? photo.filename} earlier`}
                          disabled={index === 0}
                          onClick={() => move(index, -1)}
                        >
                          ◂
                        </BevelButton>
                        <BevelButton
                          className="!px-[5px] !py-px !text-[10px]"
                          aria-label={t`Move ${photo.caption ?? photo.filename} later`}
                          title={t`Move ${photo.caption ?? photo.filename} later`}
                          disabled={index === order.length - 1}
                          onClick={() => move(index, 1)}
                        >
                          ▸
                        </BevelButton>
                      </>
                    )}
                  </span>
                  <span className="flex gap-[2px]">
                    <BevelButton
                      className="!px-[5px] !py-px !text-[10px]"
                      aria-label={t`Edit caption for ${photo.filename}`}
                      title={t`Edit caption for ${photo.filename}`}
                      onClick={() => setCaptionTarget(photo)}
                    >
                      ✎
                    </BevelButton>
                    <BevelButton
                      variant="danger"
                      className="!px-[5px] !py-px !text-[10px]"
                      aria-label={t`Delete ${photo.filename}`}
                      title={t`Delete ${photo.filename}`}
                      onClick={() => setDeleteTarget(photo)}
                    >
                      ✕
                    </BevelButton>
                  </span>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {/* Per-photo delete confirm */}
      <RetroConfirmDialog
        open={deleteTarget != null}
        title={<Trans>DELETE PHOTO?</Trans>}
        confirmLabel={<Trans>DELETE</Trans>}
        onCancel={() => setDeleteTarget(null)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          const target = deleteTarget;
          setDeleteTarget(null);
          if (target) del.mutate(target.id);
        }}
      >
        <Trans>This photo will be permanently removed.</Trans>
      </RetroConfirmDialog>

      {/* Bulk delete confirm */}
      <RetroConfirmDialog
        open={bulkDeleteOpen}
        title={<Trans>DELETE PHOTOS?</Trans>}
        confirmLabel={<Trans>DELETE</Trans>}
        onCancel={() => setBulkDeleteOpen(false)}
        onClose={() => setBulkDeleteOpen(false)}
        onConfirm={() => {
          setBulkDeleteOpen(false);
          bulkDelete?.mutate(selectedIds, {
            onSuccess: () => selection.clear(),
          });
        }}
      >
        <Trans>
          {selectedIds.length} photo(s) will be permanently removed.
        </Trans>
      </RetroConfirmDialog>

      {/* Per-photo caption editor */}
      <CaptionDialog
        open={captionTarget != null}
        initial={captionTarget?.caption ?? ""}
        onClose={() => setCaptionTarget(null)}
        onSave={(caption) => {
          const target = captionTarget;
          setCaptionTarget(null);
          if (target) updateCaption.mutate({ photoId: target.id, caption });
        }}
      />

      {/* Bulk caption editor (one caption across the selection) */}
      <CaptionDialog
        open={bulkCaptionOpen}
        initial=""
        title={<Trans>EDIT CAPTION</Trans>}
        onClose={() => setBulkCaptionOpen(false)}
        onSave={(caption) => {
          setBulkCaptionOpen(false);
          bulkCaption?.mutate(
            selectedIds.map((photo_id) => ({ photo_id, caption })),
            { onSuccess: () => selection.clear() },
          );
        }}
      />
    </div>
  );
}
