import { del, get, postMultipart } from "@/lib/api";

// Photos attached to a location (backend migration 010 / the locationphoto
// domain). The link rows are location-scoped, the bytes live in
// warehouse.files, and the serve route streams them back.
//
// The backend returns `url` as a ROOT-relative backend path
// ("/workspaces/…/location-photos/{id}/file"). Every consumer needs the
// /api-prefixed form the Vite proxy (and prod same-origin) serves, so the
// rewrite happens HERE, at the mapper boundary — no component ever sees a bare
// backend path (same rule as photos.ts / toProxyUrl).

export interface LocationPhoto {
  id: string;
  location_id: string;
  file_id: string;
  caption?: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
  /** Renderable directly in an <img src>. */
  url: string;
}

interface LocationPhotoListResponse {
  items: LocationPhoto[];
}

function mapPhoto(raw: LocationPhoto): LocationPhoto {
  return { ...raw, url: `/api${raw.url}` };
}

export const locationPhotosApi = {
  async list(wsId: string, locationId: string): Promise<LocationPhoto[]> {
    const res = await get<LocationPhotoListResponse>(
      `/workspaces/${wsId}/locations/${locationId}/photos`,
    );
    return (res.items ?? []).map(mapPhoto);
  },

  // Multipart upload. Field name MUST be "photo" (matches the chi handler);
  // optional "caption".
  upload(
    wsId: string,
    locationId: string,
    file: File,
    caption?: string,
  ): Promise<LocationPhoto> {
    const form = new FormData();
    form.append("photo", file);
    if (caption) form.append("caption", caption);
    return postMultipart<LocationPhoto>(
      `/workspaces/${wsId}/locations/${locationId}/photos`,
      form,
    ).then(mapPhoto);
  },

  del(wsId: string, photoId: string): Promise<void> {
    return del<void>(`/workspaces/${wsId}/location-photos/${photoId}`);
  },
};
