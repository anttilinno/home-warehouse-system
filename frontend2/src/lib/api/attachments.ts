import { del, get, post, postMultipart } from "@/lib/api";
import type { AttachmentType } from "@/lib/types";

// Phase 14b Plan 03 — item-attachment api (REAL multipart, NOT link-only). Unlike
// repairAttachments.ts (which mints a metadata-only file_id), upload() POSTs the
// actual bytes to the 14b-02 byte-storage route
// `POST /items/{itemId}/attachments/file` (multipart field "file"). The
// ItemAttachment shape is defined LOCALLY here (precedent: lib/api/repairs.ts owns
// its own types) — lib/types.ts is a shared barrel touched by 14b-04 in the same
// wave, so we MUST NOT edit it. The list returns a BARE { items } envelope.

// ItemAttachment — mirrors the backend AttachmentResponse (handler.go). List rows
// MAY carry the resolved file metadata (file_name/file_mime_type/file_size_bytes)
// for display; all are optional so the panel degrades gracefully if absent.
export interface ItemAttachment {
  id: string;
  item_id: string;
  file_id?: string;
  attachment_type: AttachmentType;
  title?: string;
  is_primary: boolean;
  external_doc_id?: string;
  dms_type?: string;
  created_at: string;
  updated_at: string;
  // Optional resolved file metadata (when the list query joins the files row).
  file_name?: string;
  file_mime_type?: string;
  file_size_bytes?: number;
}

export const itemAttachmentsApi = {
  list: (ws: string, itemId: string) =>
    get<{ items: ItemAttachment[] }>(
      `/workspaces/${ws}/items/${itemId}/attachments`,
    ),
  // REAL multipart byte upload (14b-02 route). The FormData carries "file" +
  // "attachment_type" + optional "title"; the browser supplies the boundary.
  upload: (ws: string, itemId: string, form: FormData) =>
    postMultipart<ItemAttachment>(
      `/workspaces/${ws}/items/${itemId}/attachments/file`,
      form,
    ),
  setPrimary: (ws: string, itemId: string, id: string) =>
    post<void>(
      `/workspaces/${ws}/items/${itemId}/attachments/${id}/set-primary`,
    ),
  del: (ws: string, id: string) =>
    del<void>(`/workspaces/${ws}/attachments/${id}`),
  // Same-origin download URL for the 14b-02 serve route; the cookie rides along.
  downloadUrl: (ws: string, id: string) =>
    `/api/workspaces/${ws}/attachments/${id}/file`,
};
