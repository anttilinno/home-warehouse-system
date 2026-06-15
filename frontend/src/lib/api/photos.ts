import { del, downloadBlob, get, post, postMultipart, put } from "@/lib/api";
import type { DuplicateCheckResult, Photo } from "@/lib/types";
import { toProxyUrl } from "./url";

// Phase 7 Plan 01 — typed photosApi over api.ts. Covers the two backend route
// families (huma JSON + raw chi multipart/bulk/blob). EVERY absolute backend URL
// (Photo.url / thumbnail_url / DuplicateInfo.thumbnail_url) is rewritten to
// /api-relative at THIS mapper boundary (Pitfall 1 / T-07-01) — no consumer ever
// sees a localhost:8080 URL.

function mapPhoto(raw: Photo): Photo {
  return {
    ...raw,
    url: toProxyUrl(raw.url),
    thumbnail_url: toProxyUrl(raw.thumbnail_url),
  };
}

export interface BulkCaptionUpdate {
  photo_id: string;
  caption: string;
}

export const photosApi = {
  list(wsId: string, itemId: string): Promise<Photo[]> {
    return get<Photo[]>(`/workspaces/${wsId}/items/${itemId}/photos/list`).then(
      (photos) => photos.map(mapPhoto),
    );
  },

  // Multipart upload. Field name MUST be "photo"; optional "caption".
  upload(
    wsId: string,
    itemId: string,
    file: File,
    caption?: string,
  ): Promise<Photo> {
    const form = new FormData();
    form.append("photo", file);
    if (caption) form.append("caption", caption);
    return postMultipart<Photo>(
      `/workspaces/${wsId}/items/${itemId}/photos`,
      form,
    ).then(mapPhoto);
  },

  // Multipart duplicate check (field "photo"). Rewrites each duplicate's
  // thumbnail_url when present.
  checkDuplicate(
    wsId: string,
    itemId: string,
    file: File,
  ): Promise<DuplicateCheckResult> {
    const form = new FormData();
    form.append("photo", file);
    return postMultipart<DuplicateCheckResult>(
      `/workspaces/${wsId}/items/${itemId}/photos/check-duplicate`,
      form,
    ).then((res) => ({
      ...res,
      duplicates: res.duplicates.map((d) =>
        d.thumbnail_url
          ? { ...d, thumbnail_url: toProxyUrl(d.thumbnail_url) }
          : d,
      ),
    }));
  },

  setPrimary(wsId: string, photoId: string): Promise<void> {
    return put<void>(
      `/workspaces/${wsId}/photos/${photoId}/primary`,
      undefined,
    );
  },

  updateCaption(
    wsId: string,
    photoId: string,
    caption: string,
  ): Promise<Photo> {
    return put<Photo>(`/workspaces/${wsId}/photos/${photoId}/caption`, {
      caption,
    }).then(mapPhoto);
  },

  // Reorder requires the FULL ordered id list (else backend 400).
  reorder(wsId: string, itemId: string, photoIds: string[]): Promise<void> {
    return put<void>(`/workspaces/${wsId}/items/${itemId}/photos/order`, {
      photo_ids: photoIds,
    });
  },

  del(wsId: string, photoId: string): Promise<void> {
    return del<void>(`/workspaces/${wsId}/photos/${photoId}`);
  },

  bulkDelete(wsId: string, itemId: string, photoIds: string[]): Promise<void> {
    return post<void>(
      `/workspaces/${wsId}/items/${itemId}/photos/bulk-delete`,
      { photo_ids: photoIds },
    );
  },

  bulkCaption(
    wsId: string,
    itemId: string,
    updates: BulkCaptionUpdate[],
  ): Promise<void> {
    return post<void>(
      `/workspaces/${wsId}/items/${itemId}/photos/bulk-caption`,
      { updates },
    );
  },

  // Zip download — optional id subset via ?ids=uuid1,uuid2.
  downloadZip(wsId: string, itemId: string, ids?: string[]): Promise<void> {
    const query = ids?.length ? `?ids=${ids.join(",")}` : "";
    return downloadBlob(
      `/workspaces/${wsId}/items/${itemId}/photos/download${query}`,
      `photos-${itemId}.zip`,
    );
  },

  exportCsv(wsId: string): Promise<void> {
    return downloadBlob(
      `/workspaces/${wsId}/export/item?format=csv`,
      "item_export.csv",
    );
  },
};
