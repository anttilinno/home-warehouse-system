import { get, del, postMultipart } from "@/lib/api";

export interface ItemPhoto {
  id: string;
  item_id: string;
  workspace_id: string;
  filename: string;
  file_size: number;
  mime_type: string;
  width: number;
  height: number;
  display_order: number;
  is_primary: boolean;
  caption?: string | null;
  url: string;
  thumbnail_url: string;
  created_at: string;
  updated_at: string;
}

export const itemPhotosApi = {
  listForItem: (wsId: string, itemId: string) =>
    get<ItemPhoto[]>(`/workspaces/${wsId}/items/${itemId}/photos/list`),
  get: (wsId: string, photoId: string) =>
    get<ItemPhoto>(`/workspaces/${wsId}/photos/${photoId}`),
  upload: (wsId: string, itemId: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return postMultipart<ItemPhoto>(`/workspaces/${wsId}/items/${itemId}/photos`, form);
  },
  remove: (wsId: string, photoId: string) =>
    del<void>(`/workspaces/${wsId}/photos/${photoId}`),
};

export const itemPhotoKeys = {
  all: ["itemPhotos"] as const,
  lists: () => [...itemPhotoKeys.all, "list"] as const,
  list: (itemId: string) => [...itemPhotoKeys.lists(), itemId] as const,
  details: () => [...itemPhotoKeys.all, "detail"] as const,
  detail: (id: string) => [...itemPhotoKeys.details(), id] as const,
};
