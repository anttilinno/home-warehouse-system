import { del, get, postMultipart, put } from "@/lib/api";
import type { RepairPhoto, RepairPhotoType } from "@/lib/types";
import { toProxyUrl } from "./url";

// Phase 10b Plan 01 — repair photo api (a focused fork of photos.ts per OQ2).
// EVERY absolute backend URL (url / thumbnail_url) is rewritten to /api-relative
// at THIS mapper boundary (Pitfall 1 / open-redirect guard) — no <img> consumer
// ever sees a localhost:8080 URL.
//
// Upload is REAL multipart: the file field MUST be "photo" and "photo_type"
// (BEFORE | DURING | AFTER) is REQUIRED (Pitfall 1) — omitting it 400s. Surface
// is intentionally minimal: list / upload / caption / delete ONLY (no
// reorder/bulk/zip/set-primary — not confirmed for repairs, F2).

function mapRepairPhoto(raw: RepairPhoto): RepairPhoto {
  return {
    ...raw,
    url: toProxyUrl(raw.url),
    thumbnail_url: toProxyUrl(raw.thumbnail_url),
  };
}

export const repairPhotosApi = {
  list(ws: string, repairId: string): Promise<RepairPhoto[]> {
    return get<RepairPhoto[]>(
      `/workspaces/${ws}/repairs/${repairId}/photos/list`,
    ).then((photos) => photos.map(mapRepairPhoto));
  },

  // Multipart upload. Field name MUST be "photo"; "photo_type" REQUIRED
  // (Pitfall 1); optional "caption".
  upload(
    ws: string,
    repairId: string,
    file: File,
    photoType: RepairPhotoType,
    caption?: string,
  ): Promise<RepairPhoto> {
    const form = new FormData();
    form.append("photo", file);
    form.append("photo_type", photoType);
    if (caption) form.append("caption", caption);
    return postMultipart<RepairPhoto>(
      `/workspaces/${ws}/repairs/${repairId}/photos`,
      form,
    ).then(mapRepairPhoto);
  },

  updateCaption(
    ws: string,
    repairId: string,
    id: string,
    caption: string,
  ): Promise<RepairPhoto> {
    return put<RepairPhoto>(
      `/workspaces/${ws}/repairs/${repairId}/photos/${id}/caption`,
      { caption },
    ).then(mapRepairPhoto);
  },

  del(ws: string, repairId: string, id: string): Promise<void> {
    return del<void>(`/workspaces/${ws}/repairs/${repairId}/photos/${id}`);
  },
};
