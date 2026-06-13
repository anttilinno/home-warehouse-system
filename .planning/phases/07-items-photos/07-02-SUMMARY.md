---
phase: 07-items-photos
plan: 02
subsystem: frontend2/upload-utils
tags: [image, upload, exif, canvas, validation]
requires:
  - "native browser APIs: createImageBitmap, HTMLCanvasElement, File"
provides:
  - "validateUploadFile (accept-list jpeg/png/webp + 10MB cap) → UploadValidation"
  - "compressImage (EXIF-aware canvas downscale) → File"
affects:
  - "Plan 07-04 photo pipeline (consumes both before network upload)"
tech-stack:
  added: []
  patterns:
    - "createImageBitmap({imageOrientation:'from-image'}) for zero-dep EXIF baking"
    - "jsdom canvas-mock: spy getContext/toBlob + stub createImageBitmap, assert call shapes not pixels"
key-files:
  created:
    - frontend2/src/lib/utils/image.ts
    - frontend2/src/lib/utils/image.test.ts
  modified: []
decisions:
  - "Accept-list excludes HEIC (server-rejected, Pitfall 2); empty/zero-byte file reports type message"
  - "compressImage scale clamped to min(1,...) — never upscales under-sized images"
  - "Output MIME: image/png preserved, all else → image/jpeg (matches RESEARCH code example)"
metrics:
  duration: "~5m"
  completed: "2026-06-13"
  tasks: 2
  files: 2
---

# Phase 07 Plan 02: Image Utils (validateUploadFile + compressImage with EXIF) Summary

EXIF-correct, size-bounded, accept-validated client image utilities in `frontend2/src/lib/utils/image.ts` — `validateUploadFile` (jpeg/png/webp + 10MB UX pre-check) and `compressImage` (canvas downscale with `createImageBitmap({imageOrientation:"from-image"})` baking orientation), the EXIF ADDITION the legacy port lacked. 18 jsdom-aware tests, all green; tsc clean.

## What Was Built

- **`validateUploadFile(file): UploadValidation`** — pure accept-list + size check. Accept set is `{image/jpeg, image/png, image/webp}` ONLY; HEIC (`image/heic`/`image/heif`), non-image MIMEs, and empty/zero-byte files reject with the exact UI-SPEC copy `"That file type isn't allowed."`; files `> 10MB` reject with `"File is too large (max 10.0 MB)."`. Type is checked before size so a zero-byte file reports the type message. This is a defense-in-depth UX pre-check — the backend `AllowedMimeTypes`/`MaxFileSize` remains the authoritative gate (T-07-05).
- **`compressImage(file, maxDim=1600, quality=0.85): Promise<File>`** — ports the legacy compress STRUCTURE and ADDS EXIF handling. `createImageBitmap(file, { imageOrientation: "from-image" })` bakes orientation; `scale = min(1, maxDim/max(w,h))` (no upscale); draws onto a sized canvas; `bitmap.close()`; `toBlob(type, quality)` where PNG sources stay `image/png` and everything else becomes `image/jpeg`; wraps the Blob in a `File` preserving the source name. Error paths: `Error("no canvas ctx")` when the 2d context is null, `Error("toBlob failed")` when encoding yields no Blob.

## Test Strategy (jsdom canvas-mock)

jsdom has no canvas and no `createImageBitmap`. The compressImage tests therefore stub `globalThis.createImageBitmap` (returns a `{width,height,close}` bitmap stub) and spy `HTMLCanvasElement.prototype.getContext`/`toBlob` so assertions target CALL SHAPES — the `imageOrientation:"from-image"` flag (the EXIF guard), downscale math (`3200×2400 → 1600×1200 @ maxDim 1600`, plus a no-upscale case), output MIME per source type, quality forwarding, `bitmap.close()`, and both error paths — without rasterizing a single pixel. The strategy is documented in the test-file header (closes VALIDATION Wave 0 jsdom-canvas gap). `validateUploadFile` is pure and runs un-shimmed.

## Verification

- `cd frontend2 && bun run test src/lib/utils/image.test.ts` → 18 passed (18).
- `cd frontend2 && bun run lint:tsc` (`tsc -b --noEmit`) → exit 0, clean.

## Deviations from Plan

None — plan executed exactly as written. Both tasks are `tdd="true"`; each followed RED (failing tests) → GREEN (minimal impl) → committed. No REFACTOR needed.

## Threat Surface

Per the plan's `<threat_model>`: T-07-05 (oversized/wrong-type upload) mitigated client-side by `validateUploadFile` with HEIC + oversize rejection proven in tests; T-07-06 (SVG XSS) — SVG is absent from the accept-list, no client SVG path exists; T-07-SC — zero new installs (native `createImageBitmap`/canvas only). No new security-relevant surface introduced beyond the plan's register.

## Commits

- `e30dd330` feat(07-02): validateUploadFile accept-list + 10MB cap
- `56c49e0d` feat(07-02): compressImage canvas resize + EXIF orientation

## Self-Check: PASSED

All created files and both commits verified present on disk and in git history.
