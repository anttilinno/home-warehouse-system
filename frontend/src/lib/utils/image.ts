// Phase 07 Plan 02 — client-side image utilities for the photo-upload pipeline.
//
// Two responsibilities, both lib-free (native browser APIs only):
//   1. validateUploadFile — UX pre-check of the upload accept-list + size cap.
//      Defense-in-depth ONLY: the backend's AllowedMimeTypes / MaxFileSize is the
//      authoritative gate (handler.go). HEIC is rejected here AND server-side.
//   2. compressImage — EXIF-correct canvas downscale. Ports the legacy
//      `frontend/lib/utils/image.ts` STRUCTURE and ADDS the EXIF-orientation fix
//      the legacy port lacked (createImageBitmap imageOrientation:"from-image").

/** Maximum client-side upload size: 10 MB (mirrors backend MaxFileSize). */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Accept-list for client uploads. JPEG / PNG / WebP ONLY — HEIC is intentionally
 * absent because the backend rejects it server-side (07-RESEARCH Pitfall 2).
 */
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/** Exact UI-SPEC copy strings (07-UI-SPEC.md → Upload errors). */
const REASON_BAD_TYPE = "That file type isn't allowed.";
const REASON_TOO_LARGE = "File is too large (max 10.0 MB).";

export type UploadValidation = { ok: true } | { ok: false; reason: string };

/**
 * Validate a user-picked file against the client accept-list and size cap.
 *
 * Type is checked first so an empty/zero-byte file (no MIME) reports the type
 * message rather than passing the size check. Returns the exact UI-SPEC copy as
 * the rejection `reason`.
 */
export function validateUploadFile(file: File): UploadValidation {
  if (!ALLOWED_MIME_TYPES.includes(file.type as (typeof ALLOWED_MIME_TYPES)[number])) {
    return { ok: false, reason: REASON_BAD_TYPE };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { ok: false, reason: REASON_TOO_LARGE };
  }
  return { ok: true };
}

/**
 * Downscale + re-encode an image File on a canvas, baking in EXIF orientation.
 *
 * Ports the legacy `frontend/lib/utils/image.ts` compress STRUCTURE (scale by a
 * single ratio, drawImage onto a sized canvas, toBlob, wrap in File) and ADDS
 * the EXIF fix the legacy port lacked: `createImageBitmap(file,
 * { imageOrientation: "from-image" })` bakes the photo's orientation into the
 * bitmap so portrait phone photos are not stored sideways (07-RESEARCH Pitfall 3).
 *
 * The scale is clamped to 1 so under-sized images are never upscaled. Output is
 * image/png for PNG sources and image/jpeg for everything else.
 *
 * @param maxDim   Longest-edge ceiling in px (default 1600).
 * @param quality  toBlob quality 0..1 for lossy encodes (default 0.85).
 * @throws Error("no canvas ctx") if the 2d context is unavailable.
 * @throws Error("toBlob failed") if encoding yields no Blob.
 */
export async function compressImage(
  file: File,
  maxDim = 1600,
  quality = 0.85,
): Promise<File> {
  // createImageBitmap bakes EXIF orientation into the bitmap (native, zero-dep).
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas ctx");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  const type = file.type === "image/png" ? "image/png" : "image/jpeg";
  const blob: Blob = await new Promise((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error("toBlob failed"))), type, quality),
  );
  return new File([blob], file.name, { type, lastModified: Date.now() });
}
