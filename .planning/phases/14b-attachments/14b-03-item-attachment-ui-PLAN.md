---
phase: 14b-attachments
plan: 03
type: execute
wave: 2
depends_on: ["14b-02"]
files_modified:
  - frontend2/src/lib/api/attachments.ts
  - frontend2/src/features/items/hooks/useItemAttachments.ts
  - frontend2/src/features/items/hooks/useItemAttachments.test.tsx
  - frontend2/src/features/items/components/ItemAttachmentPanel.tsx
  - frontend2/src/features/items/components/ItemAttachmentPanel.test.tsx
  - frontend2/src/features/items/components/AddAttachmentDialog.tsx
autonomous: true
requirements: [ATT-01, ATT-02]
must_haves:
  truths:
    - "User can upload a non-photo file on an item and see it listed"
    - "User can download an uploaded attachment (real bytes)"
    - "User can set an attachment primary and delete one (with confirm)"
    - "Mutations invalidate the attachment list"
  artifacts:
    - path: "frontend2/src/lib/api/attachments.ts"
      provides: "Item-attachment API client (list/upload-multipart/set-primary/delete)"
      contains: "postMultipart"
    - path: "frontend2/src/features/items/components/ItemAttachmentPanel.tsx"
      provides: "FILES panel: list + add + set-primary + delete"
    - path: "frontend2/src/features/items/hooks/useItemAttachments.ts"
      provides: "list query + upload/set-primary/delete mutations"
  key_links:
    - from: "AddAttachmentDialog"
      to: "POST /items/{itemId}/attachments/file"
      via: "postMultipart(FormData)"
      pattern: "postMultipart"
    - from: "ItemAttachmentPanel"
      to: "useItemAttachments"
      via: "items + mutations"
      pattern: "useItemAttachments"
---

<objective>
Build the GREENFIELD item-attachment UI: a FILES panel on the item detail page
that lists attachments, uploads a real file (multipart → the byte-storage route
landed in 14b-02), sets a primary, downloads, and deletes (with confirm). Mirror
the Phase-10b repair-attachment UI, but use REAL multipart upload (postMultipart)
against the new `POST /items/{item_id}/attachments/file` route instead of the
metadata-only mint path.

Purpose: ATT-01 (upload + list non-photo attachments via the FileInput atom) and
ATT-02 (set-primary + delete with confirm; mutations invalidate the list).
Output: api client + hook + panel + add dialog + types. This plan does NOT mount
the panel on the page (that is the single-writer wiring plan 14b-05) — it exports
a self-contained ItemAttachmentPanel that 14b-05 drops into the item tabs.

DEPENDS ON 14b-02 being merged + the :8080 backend rebuilt/restarted, because the
live upload+download round-trip tests against the new byte route.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/14b-attachments/14b-CONTEXT.md
@.planning/phases/14b-attachments/14b-VALIDATION.md
@.planning/phases/14b-attachments/14b-02-SUMMARY.md

<interfaces>
<!-- MIRROR these Phase-10b repair-attachment patterns; swap link-only for real multipart. -->
From frontend2/src/lib/api.ts:
  postMultipart<T>(endpoint, form: FormData): Promise<T>   // POST, FormData body, credentials:"include"
  get<T>, post<T>, del<T>  // standard JSON helpers
  HttpError  // .status

From frontend2/src/lib/api/repairAttachments.ts (envelope + shape to mirror):
  list → get<{ items: RepairAttachment[]; total: number }>(...)   // BARE { items, total }
  create/del helpers keyed by ws + parent id

From frontend2/src/features/repairs/hooks/useRepairAttachments.ts (mirror the hook):
  key = ["repairs", wsId, repairId, "attachments"]; useQuery + useMutation; onSuccess invalidate; onError retroToast.error

From frontend2/src/features/repairs/components/AddAttachmentDialog.tsx (mirror the dialog UX):
  RetroDialog + RetroFileInput + RetroSelect + RetroInput + BevelButton + RetroBadge + retroToast (all from @/components/retro)
  ✓ DONE / ✕ FAILED + RETRY per-file status idiom

From frontend2/src/lib/types.ts (READ-ONLY — reuse, do NOT edit this shared barrel; 14b-04 also touches the items tree in the same wave so the shared lib/types.ts is a parallel-conflict risk):
  export type AttachmentType = "PHOTO" | "MANUAL" | "RECEIPT" | "WARRANTY" | "OTHER"
  // DEFINE the new ItemAttachment interface LOCALLY in lib/api/attachments.ts (precedent: lib/api/repairs.ts exports its own types) — NOT in lib/types.ts.

Backend routes (confirm exact names/fields against 14b-02-SUMMARY before coding):
  GET    /api/workspaces/{ws}/items/{itemId}/attachments                  → list { items }
  POST   /api/workspaces/{ws}/items/{itemId}/attachments/file (multipart) → 201 AttachmentResponse  (NEW in 14b-02; form field "file" + attachment_type + title)
  POST   /api/workspaces/{ws}/items/{itemId}/attachments/{id}/set-primary → 200
  DELETE /api/workspaces/{ws}/attachments/{id}                            → 200
  GET    /api/workspaces/{ws}/attachments/{id}/file                       → download (NEW in 14b-02)
  AttachmentResponse fields: id, item_id, file_id, attachment_type, title?, is_primary, external_doc_id?, dms_type?, created_at, updated_at
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: ItemAttachment type + api client</name>
  <files>frontend2/src/lib/api/attachments.ts</files>
  <action>
    In api/attachments.ts EXPORT an `ItemAttachment` interface (id, item_id,
    file_id?, attachment_type: AttachmentType, title?, is_primary: boolean,
    external_doc_id?, dms_type?, created_at, updated_at; plus optional resolved
    file metadata file_name?/file_mime_type?/file_size_bytes? if the list query
    returns it — confirm against the list response). Import the existing
    AttachmentType from @/lib/types (read-only; do NOT edit lib/types.ts — it is
    a shared barrel and 14b-04 runs in the same wave). Add an
    `itemAttachmentsApi` object:
      list(ws,itemId) → get<{ items: ItemAttachment[] }>(.../attachments)
      upload(ws,itemId, form: FormData) → postMultipart<ItemAttachment>(.../attachments/file, form)
      setPrimary(ws,itemId,id) → post<void>(.../attachments/{id}/set-primary)
      del(ws,id) → del<void>(/workspaces/{ws}/attachments/{id})
      downloadUrl(ws,id) → string `/api/workspaces/{ws}/attachments/{id}/file`
    Use the `/api` prefix convention used by the other api/*.ts clients (the Vite
    proxy rewrites /api → root). LANDMINE FOUND-02: do NOT name anything with the
    substrings sync/idb/offline.
  </action>
  <verify>
    <automated>cd frontend2 && bun run lint:tsc</automated>
  </verify>
  <done>itemAttachmentsApi compiles with multipart upload + download URL helpers; ItemAttachment exported from lib/api/attachments.ts (NOT lib/types.ts).</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: useItemAttachments hook</name>
  <files>frontend2/src/features/items/hooks/useItemAttachments.ts, frontend2/src/features/items/hooks/useItemAttachments.test.tsx</files>
  <behavior>
    - Query keyed ["items", wsId, itemId, "attachments"]; exposes items[] + isLoading/isError.
    - upload mutation (FormData) → onSuccess invalidates the key; onError toasts.
    - setPrimary mutation → invalidates the key.
    - delete mutation → invalidates the key; onError toasts.
    - All three mutations invalidate the SAME list key (ATT-02 contract).
  </behavior>
  <action>
    Mirror useRepairAttachments.ts structure (useQuery + three useMutation +
    invalidate helper + retroToast.error on failure). Key =
    ["items", wsId, itemId, "attachments"]. enabled on Boolean(wsId)&&Boolean(itemId),
    retry:false. Write the test (mirror useRepairAttachments.test.tsx) asserting
    each mutation invalidates the list key.
  </action>
  <verify>
    <automated>cd frontend2 && bun run test -- useItemAttachments</automated>
  </verify>
  <done>Hook + test green; upload/set-primary/delete all invalidate ["items", wsId, itemId, "attachments"].</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: AddAttachmentDialog + ItemAttachmentPanel</name>
  <files>frontend2/src/features/items/components/AddAttachmentDialog.tsx, frontend2/src/features/items/components/ItemAttachmentPanel.tsx, frontend2/src/features/items/components/ItemAttachmentPanel.test.tsx</files>
  <behavior>
    - AddAttachmentDialog: pick a file (RetroFileInput), choose a type
      (RetroSelect, default OTHER — exclude PHOTO for non-photo attachments),
      optional title; on submit builds a FormData (file + attachment_type +
      title) and calls the upload mutation; success closes + toasts, error toasts
      a contextual message (404/400 vs generic).
    - ItemAttachmentPanel: lists attachments (name/title + type badge + a PRIMARY
      badge when is_primary), an ADD FILE button opening the dialog, a download
      link (downloadUrl), a SET PRIMARY action per non-primary row, and a DELETE
      action that opens a confirm before deleting. Empty state when none.
    - Panel test: renders a seeded list, asserts the primary badge, asserts the
      delete action requires confirm, asserts ADD opens the dialog.
  </behavior>
  <action>
    Mirror the repair AddAttachmentDialog UX (RetroDialog/RetroFileInput/
    RetroSelect/RetroInput/BevelButton/RetroBadge/retroToast — all from
    @/components/retro) but use REAL multipart upload (build FormData, append
    "file", "attachment_type", optional "title"; call the hook's upload
    mutation) — NOT the metadata-mint two-step. For the delete confirm, reuse the
    existing confirm-dialog idiom used elsewhere in items (grep
    features/items/components for the delete-confirm pattern, e.g. the
    ItemDetailPage DELETE… flow or a RetroDialog confirm). Download = an anchor
    to itemAttachmentsApi.downloadUrl (the cookie rides same-origin). Use Lingui
    <Trans>/useLingui for all copy. Keep the panel SELF-CONTAINED: it accepts
    {wsId, itemId} props so 14b-05 can mount it without further wiring.
    LANDMINE FOUND-02: no sync/idb/offline substrings in any new name.
  </action>
  <verify>
    <automated>cd frontend2 && bun run test -- ItemAttachmentPanel</automated>
  </verify>
  <done>Panel lists attachments, uploads via multipart, shows a primary badge, set-primary works, delete is confirm-gated, download link present; tests green.</done>
</task>

</tasks>

<verification>
- `cd frontend2 && bun run lint:tsc` green (NOT bare tsc).
- `cd frontend2 && bun run test` green.
- `cd frontend2 && bun run build` green.
- `cd frontend2 && bun run lint:imports` green (no sync/idb/offline substrings).
- Live (after 14b-05 mounts the panel + backend restarted): upload a file on an item, see it listed, download returns the same bytes, set-primary + delete work.
</verification>

<success_criteria>
ATT-01 + ATT-02 frontend satisfied: a self-contained ItemAttachmentPanel uploads real files (multipart → the 14b-02 byte route), lists them, sets primary, downloads, and deletes with confirm; all mutations invalidate the shared list key. Panel is exported ready for the 14b-05 mount.
</success_criteria>

<output>
Create `.planning/phases/14b-attachments/14b-03-SUMMARY.md` when done. Record the ItemAttachmentPanel import path + props so 14b-05 can mount it.
</output>
