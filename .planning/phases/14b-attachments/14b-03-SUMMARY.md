---
phase: 14b-attachments
plan: 03
subsystem: frontend / item attachments UI
tags: [attachments, multipart, react-query, items, frontend, ATT-01, ATT-02]
requires:
  - 14b-02 (byte-storage route POST /items/{id}/attachments/file + serve GET /attachments/{id}/file)
  - Phase 4 (RetroFileInput atom + retro component barrel)
  - Phase 10b (repair-attachment UI — pattern mirrored)
provides:
  - itemAttachmentsApi (list/upload-multipart/setPrimary/del/downloadUrl)
  - useItemAttachments hook (list query + 3 mutations, all invalidate the shared key)
  - ItemAttachmentPanel (self-contained FILES panel — exported for 14b-05 mount)
  - AddAttachmentDialog (real multipart upload dialog)
affects:
  - 14b-05 (mounts ItemAttachmentPanel on ItemDetailPage — single writer)
  - 14b-04 (paperless link-to-item invalidates the SAME query key tuple)
tech-stack:
  added: []
  patterns:
    - mirror repair-attachment UI (Phase 10b) but REAL multipart, not link-only mint
    - React-Query key tuple LOCKED ["items", wsId, itemId, "attachments"]
    - download via same-origin anchor to the 14b-02 serve route (cookie rides along)
key-files:
  created:
    - frontend2/src/lib/api/attachments.ts
    - frontend2/src/features/items/hooks/useItemAttachments.ts
    - frontend2/src/features/items/hooks/useItemAttachments.test.tsx
    - frontend2/src/features/items/components/AddAttachmentDialog.tsx
    - frontend2/src/features/items/components/ItemAttachmentPanel.tsx
    - frontend2/src/features/items/components/ItemAttachmentPanel.test.tsx
  modified: []
decisions:
  - ItemAttachment interface defined LOCALLY in lib/api/attachments.ts (NOT lib/types.ts — shared barrel, 14b-04 parallel-conflict risk)
  - AddAttachmentDialog uses a SINGLE real multipart upload (FormData) — NOT the Phase-10b two-step file_id mint
  - PHOTO excluded from the type picker (non-photo attachments; photos use the gallery); default type OTHER
  - download = anchor to itemAttachmentsApi.downloadUrl (target=_blank); no blob helper needed (cookie same-origin)
  - hook upload test asserts the byte route + multipart Content-Type via headers (undici request.formData() is unreliable under jsdom)
metrics:
  duration: ~12m
  completed: 2026-06-13
---

# Phase 14b Plan 03: Item-Attachment UI Summary

Built the greenfield item-attachment FILES UI (ATT-01/ATT-02): an API client, a
React-Query hook, a real-multipart upload dialog, and a self-contained panel that
lists attachments, uploads real bytes to the 14b-02 byte route, sets a primary,
downloads, and deletes with confirm — all mutations invalidating the shared list
key. The panel is exported ready for 14b-05 to mount; it is NOT mounted here.

## Exported symbols (14b-05 needs these)

| Symbol | Kind | Import path | Props / shape |
|--------|------|-------------|---------------|
| `ItemAttachmentPanel` | component | `@/features/items/components/ItemAttachmentPanel` | `{ wsId: string; itemId: string }` |
| `AddAttachmentDialog` | component | `@/features/items/components/AddAttachmentDialog` | `{ wsId: string; itemId: string; open: boolean; onClose: () => void }` |
| `useItemAttachments` | hook | `@/features/items/hooks/useItemAttachments` | `(wsId, itemId) → { items, isLoading, isError, upload, setPrimary, deleteAttachment }` |
| `itemAttachmentsApi` | object | `@/lib/api/attachments` | `list/upload/setPrimary/del/downloadUrl` |
| `ItemAttachment` | interface | `@/lib/api/attachments` | backend AttachmentResponse + optional file metadata |

**14b-05 mount:** `<ItemAttachmentPanel wsId={…} itemId={…} />` — drop into the
item-detail tabs (e.g. a FILES tab). No further wiring; the panel owns its dialog,
confirm, query, and mutations.

## Files created

- `frontend2/src/lib/api/attachments.ts` — `itemAttachmentsApi` + `ItemAttachment`.
  `upload()` POSTs multipart to `POST /items/{itemId}/attachments/file` (field
  `file`); `downloadUrl()` returns `/api/workspaces/{ws}/attachments/{id}/file`.
- `frontend2/src/features/items/hooks/useItemAttachments.ts` — list query keyed
  `["items", wsId, itemId, "attachments"]` (LOCKED) + `upload`/`setPrimary`/
  `deleteAttachment` mutations, all invalidating that key; `retroToast.error` on
  failure.
- `frontend2/src/features/items/hooks/useItemAttachments.test.tsx` — 4 tests
  (list keyed; upload hits the byte route w/ multipart Content-Type + invalidates;
  set-primary invalidates; delete invalidates).
- `frontend2/src/features/items/components/AddAttachmentDialog.tsx` — RetroDialog +
  RetroFileInput + RetroSelect (PHOTO excluded, default OTHER) + RetroInput; builds
  FormData and calls the upload mutation; contextual 404/400 error toast.
- `frontend2/src/features/items/components/ItemAttachmentPanel.tsx` — list rows
  (type badge + PRIMARY badge + download anchor + mime + SET PRIMARY on non-primary
  rows + DELETE), NO FILES empty state, ⊕ ADD FILE CTA, confirm-gated delete.
- `frontend2/src/features/items/components/ItemAttachmentPanel.test.tsx` — 5 tests
  (rows + PRIMARY badge + download href; empty state; ADD opens dialog; DELETE is
  confirm-gated; SET PRIMARY only on non-primary rows).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Hook upload test could not parse multipart server-side**
- **Found during:** Task 2 (TDD GREEN)
- **Issue:** MSW's `request.formData()` under jsdom+undici threw a webidl
  assertion on the File polyfill, so a server-side `form.get("file")` assertion
  was unreachable.
- **Fix:** Assert the upload hits the byte route AND that the request carries a
  `multipart/form-data` Content-Type (the browser sets the boundary for a FormData
  body) instead of parsing the body server-side. The FormData *construction* is
  still covered by the panel test (which drives the real dialog).
- **Files modified:** `useItemAttachments.test.tsx`
- **Commit:** `28d4f681`

**2. [Rule 1 - Test bug] Confirm-delete button selector matched the row DELETE**
- **Found during:** Task 3 (TDD GREEN)
- **Issue:** Both the row button (`DELETE`) and the confirm button (`Delete`)
  matched a case-insensitive `/delete/i` selector, so the test clicked the wrong
  one and the network delete never fired.
- **Fix:** Exact-text role queries — row button `name: "DELETE"`, confirm button
  `name: "Delete"` (distinct DOM text; the uppercase is CSS-only).
- **Files modified:** `ItemAttachmentPanel.test.tsx`
- **Commit:** `fe20aa7b`

## Landmine FOUND-02 compliance

No directory, file, or identifier I introduced contains the substrings
`sync` / `idb` / `offline`. (A literal grep matches the JS `async` keyword only —
not a name; `bun run lint:imports` — the actual enforcement — passed clean.)

## Verification (gate — all green)

- `bun run lint:tsc` → clean (`tsc -b --noEmit`, exit 0).
- `bun run test` → **171 files / 1093 tests passed** (includes the 4 hook + 5 panel
  tests added here).
- `bun run build` → built OK (pre-existing >500 kB chunk-size warning only — not an
  error).
- `bun run lint:imports` → `check-forbidden-imports: OK`.

## Known Stubs

None. The panel uploads real bytes (14b-02 byte route) and downloads via the real
serve route. The panel is intentionally NOT mounted on ItemDetailPage — that is
14b-05's single-writer responsibility (documented above, not a stub).

## Self-Check: PASSED

All 6 created files exist on disk; all task commits present in `git log`.
