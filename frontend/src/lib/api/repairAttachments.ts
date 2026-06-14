import { del, get, post } from "@/lib/api";
import type { AttachmentType, RepairAttachment } from "@/lib/types";

// Phase 10b Plan 01 — repair attachment api (LINK-ONLY per OQ3). create()
// registers an EXISTING file_id against the repair — it does NOT upload bytes
// (the byte-storage path is a backend stub; no multipart here). Mirrors loans.ts
// envelope discipline: list returns a BARE { items, total }.

export interface CreateAttachmentBody {
  file_id: string; // uuid, REQUIRED — must reference an already-uploaded file
  attachment_type: AttachmentType; // PHOTO | MANUAL | RECEIPT | WARRANTY | OTHER
  title?: string;
}

export const repairAttachmentsApi = {
  list: (ws: string, repairId: string) =>
    get<{ items: RepairAttachment[]; total: number }>(
      `/workspaces/${ws}/repairs/${repairId}/attachments`,
    ),
  create: (ws: string, repairId: string, body: CreateAttachmentBody) =>
    post<RepairAttachment>(
      `/workspaces/${ws}/repairs/${repairId}/attachments`,
      body,
    ),
  del: (ws: string, repairId: string, attachmentId: string) =>
    del<void>(
      `/workspaces/${ws}/repairs/${repairId}/attachments/${attachmentId}`,
    ),
};
