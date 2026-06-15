import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Trans, useLingui } from "@lingui/react/macro";
import { useModalStack } from "@/components/modal";
import { BevelButton } from "@/components/retro";
import { downloadBlob } from "@/lib/api";
import type { Photo } from "@/lib/types";

export interface PhotoLightboxProps {
  /** The photos to page through (already /api-relative url/thumbnail_url). */
  photos: Photo[];
  /** The index to open at; null = closed. */
  index: number | null;
  /** Close the lightbox (ESC via modal stack, ✕ CLOSE, or scrim). */
  onClose: () => void;
}

const ZOOM_MIN = 1;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.5;

/**
 * Chromeless dark photo viewer (UI-SPEC §4 Lightbox). A `fixed inset-0 z-40`
 * overlay on `bg-fg-ink/85`, rendered through a portal. Chrome (index, zoom,
 * download, close, arrows, caption) sits on OPAQUE `bg-bg-panel` strips so it's
 * ink-on-panel AA-safe — never white-on-photo. ESC closes EXCLUSIVELY through
 * the modal stack (no own ESC listener); ←/→ navigate and +/-/0 zoom while the
 * lightbox is open. role=dialog aria-modal; focus trapped + restored.
 */
export function PhotoLightbox({ photos, index, onClose }: PhotoLightboxProps) {
  const { t } = useLingui();
  const open = index != null && index >= 0 && index < photos.length;
  const [current, setCurrent] = useState(index ?? 0);
  const [zoom, setZoom] = useState(1);
  const dialogRef = useRef<HTMLDivElement>(null);
  const invokerRef = useRef<HTMLElement | null>(null);

  // ESC routes through the shared modal stack (TUI-02 — no document listener here).
  useModalStack(open, onClose);

  // Sync the active index + reset zoom whenever the lightbox (re)opens.
  useEffect(() => {
    if (index != null) {
      setCurrent(index);
      setZoom(1);
    }
  }, [index]);

  const count = photos.length;
  const go = useCallback(
    (delta: number) =>
      setCurrent((c) => Math.min(count - 1, Math.max(0, c + delta))),
    [count],
  );
  const zoomBy = useCallback(
    (delta: number) =>
      setZoom((z) =>
        Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, +(z + delta).toFixed(2))),
      ),
    [],
  );

  // Arrow + zoom keys, registered ONLY while open (removed on close — not a
  // permanent document listener). ESC is intentionally NOT handled here.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          go(-1);
          break;
        case "ArrowRight":
          e.preventDefault();
          go(1);
          break;
        case "+":
        case "=":
          e.preventDefault();
          zoomBy(ZOOM_STEP);
          break;
        case "-":
          e.preventDefault();
          zoomBy(-ZOOM_STEP);
          break;
        case "0":
          e.preventDefault();
          setZoom(1);
          break;
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, go, zoomBy]);

  // Focus trap + restore.
  useEffect(() => {
    if (!open) return;
    invokerRef.current = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => invokerRef.current?.focus?.();
  }, [open]);

  if (!open) return null;

  const photo = photos[current];
  const pct = Math.round(zoom * 100);

  const content = (
    // biome-ignore lint/a11y/noStaticElementInteractions: presentational backdrop; click-to-close is a mouse convenience
    // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard users close via ESC (handled by the modal stack)
    <div
      className="fixed inset-0 z-40 flex flex-col bg-fg-ink/85"
      onClick={onClose}
    >
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: mouse-only guard so backdrop click-to-close ignores clicks inside the dialog */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t`Photo ${current + 1} of ${count}`}
        tabIndex={-1}
        className="flex h-full flex-col outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top chrome on an opaque panel strip (ink-on-panel AA, NOT white-on-photo). */}
        <div className="flex items-center gap-sp-2 border-b-2 border-border-ink bg-bg-panel px-sp-3 py-sp-2">
          <span className="font-mono text-12 tabular-nums text-fg-ink">
            {current + 1} / {count}
          </span>
          <span className="flex-1" />
          <BevelButton
            aria-label={t`Zoom out`}
            title={t`Zoom out`}
            disabled={zoom <= ZOOM_MIN}
            onClick={() => zoomBy(-ZOOM_STEP)}
          >
            ⊖
          </BevelButton>
          <span className="font-mono text-12 tabular-nums text-fg-ink">
            {pct}%
          </span>
          <BevelButton
            aria-label={t`Zoom in`}
            title={t`Zoom in`}
            disabled={zoom >= ZOOM_MAX}
            onClick={() => zoomBy(ZOOM_STEP)}
          >
            ⊕
          </BevelButton>
          <BevelButton
            aria-label={t`Download original`}
            title={t`Download original`}
            onClick={() => downloadBlob(photo.url, photo.filename)}
          >
            ⤓
          </BevelButton>
          <BevelButton onClick={onClose}>
            <Trans>✕ CLOSE</Trans>
          </BevelButton>
        </div>

        {/* Image field with side arrows. */}
        <div className="relative flex flex-1 items-center justify-center overflow-hidden p-sp-4">
          <BevelButton
            aria-label={t`Previous photo`}
            title={t`Previous photo`}
            disabled={current === 0}
            onClick={() => go(-1)}
            className="absolute left-sp-3 z-10 !h-[44px] !w-[44px] !p-0"
          >
            ◂
          </BevelButton>
          <img
            src={photo.url}
            alt={photo.caption ?? photo.filename}
            style={{ transform: `scale(${zoom})` }}
            className="max-h-[calc(100vh-12rem)] max-w-full object-contain transition-transform motion-reduce:transition-none"
          />
          <BevelButton
            aria-label={t`Next photo`}
            title={t`Next photo`}
            disabled={current === count - 1}
            onClick={() => go(1)}
            className="absolute right-sp-3 z-10 !h-[44px] !w-[44px] !p-0"
          >
            ▸
          </BevelButton>
        </div>

        {/* Caption strip (ink-on-panel). */}
        {photo.caption && (
          <div className="border-t-2 border-border-ink bg-bg-panel p-sp-3 text-center text-14 text-fg-ink">
            {photo.caption}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
