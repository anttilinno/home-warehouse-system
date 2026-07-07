import { Trans, useLingui } from "@lingui/react/macro";
import { BevelButton, PixelIcon, RetroBadge } from "@/components/retro";
import type { GalleryPhoto } from "./PhotoGallery";

// Phase 10b refactor — one PhotoGallery grid cell. Extracted from the gallery's
// per-photo map (whose inline callback carried the heaviest branch load: the
// select-vs-open click, the primary badge/set-primary split, the reorder arrows,
// and the caption/delete controls). `showSetPrimary`/`showReorder` are resolved
// by the parent (capability gate AND mutation presence) so the tile only checks
// select-mode; `label` is computed once from caption→filename. Behavior verbatim.
export function PhotoTile({
  photo,
  index,
  total,
  selected,
  selecting,
  showSetPrimary,
  showReorder,
  onToggleSelect,
  onOpenLightbox,
  onSetPrimary,
  onMove,
  onEditCaption,
  onDelete,
}: Readonly<{
  photo: GalleryPhoto;
  index: number;
  total: number;
  selected: boolean;
  selecting: boolean;
  showSetPrimary: boolean;
  showReorder: boolean;
  onToggleSelect: (id: string, shiftKey: boolean) => void;
  onOpenLightbox: (index: number) => void;
  onSetPrimary: (id: string) => void;
  onMove: (index: number, dir: -1 | 1) => void;
  onEditCaption: (photo: GalleryPhoto) => void;
  onDelete: (photo: GalleryPhoto) => void;
}>) {
  const { t } = useLingui();
  const label = photo.caption ?? photo.filename;

  return (
    <li
      className={`group relative h-24 w-24 border-2 ${
        selected
          ? "border-border-ink ring-2 ring-titlebar-blue"
          : "border-border-ink"
      }`}
    >
      <button
        type="button"
        aria-label={selecting ? t`Toggle ${label}` : t`Open ${label}`}
        aria-pressed={selecting ? selected : undefined}
        onClick={(e) => {
          if (selecting) {
            onToggleSelect(photo.id, e.shiftKey);
          } else {
            onOpenLightbox(index);
          }
        }}
        className="block h-full w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-border-ink focus-visible:outline-offset-2"
      >
        <img
          src={photo.thumbnail_url}
          alt={label}
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
        showSetPrimary &&
        !selecting && (
          <BevelButton
            className="absolute left-[2px] top-[2px] !px-[6px] !py-[1px] !text-10 opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
            onClick={() => onSetPrimary(photo.id)}
          >
            <Trans>★ SET PRIMARY</Trans>
          </BevelButton>
        )
      )}

      {/* Per-photo controls (hidden in select mode) */}
      {!selecting && (
        <div className="absolute inset-x-[2px] bottom-[2px] flex items-center justify-between opacity-0 focus-within:opacity-100 group-hover:opacity-100">
          <span className="flex gap-[2px]">
            {showReorder && (
              <>
                <BevelButton
                  className="!px-[5px] !py-px !text-10"
                  aria-label={t`Move ${label} earlier`}
                  title={t`Move ${label} earlier`}
                  disabled={index === 0}
                  onClick={() => onMove(index, -1)}
                >
                  <PixelIcon name="chevron-left" size={16} />
                </BevelButton>
                <BevelButton
                  className="!px-[5px] !py-px !text-10"
                  aria-label={t`Move ${label} later`}
                  title={t`Move ${label} later`}
                  disabled={index === total - 1}
                  onClick={() => onMove(index, 1)}
                >
                  <PixelIcon name="chevron-right" size={16} />
                </BevelButton>
              </>
            )}
          </span>
          <span className="flex gap-[2px]">
            <BevelButton
              className="!px-[5px] !py-px !text-10"
              aria-label={t`Edit caption for ${photo.filename}`}
              title={t`Edit caption for ${photo.filename}`}
              onClick={() => onEditCaption(photo)}
            >
              <PixelIcon name="pencil" size={16} />
            </BevelButton>
            <BevelButton
              variant="danger"
              className="!px-[5px] !py-px !text-10"
              aria-label={t`Delete ${photo.filename}`}
              title={t`Delete ${photo.filename}`}
              onClick={() => onDelete(photo)}
            >
              ✕
            </BevelButton>
          </span>
        </div>
      )}
    </li>
  );
}
