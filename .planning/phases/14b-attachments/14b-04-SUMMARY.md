---
phase: 14b-attachments
plan: 04
subsystem: frontend2 (Paperless-ngx UI)
tags: [paperless, settings, attachments, ppl]
requires: ["14b-02 (paperless backend — already live)"]
provides:
  - "PaperlessPage (Settings-hub page: PPL-01 settings + PPL-02 search)"
  - "PaperlessLinkDialog (PPL-03 link-a-document-to-item)"
  - "paperlessApi client + local Paperless types"
  - "usePaperlessSettings hook"
affects:
  - "14b-05 (must register the /settings/paperless route + landing row + mount the dialog)"
tech-stack:
  patterns: ["Phase-12 settings-page shape", "RetroDialog overlay", "React-Query key tuples"]
key-files:
  created:
    - frontend2/src/lib/api/paperless.ts
    - frontend2/src/features/settings/hooks/usePaperlessSettings.ts
    - frontend2/src/features/settings/PaperlessPage.tsx
    - frontend2/src/features/settings/PaperlessPage.test.tsx
    - frontend2/src/features/items/components/PaperlessLinkDialog.tsx
    - frontend2/src/features/items/components/PaperlessLinkDialog.test.tsx
  modified: []
decisions:
  - "Local Paperless types in lib/api/paperless.ts — never touch shared lib/types.ts (14b-03 same-wave collision)"
  - "PaperlessLinkDialog calls post() directly instead of importing 14b-03's api/attachments.ts (disjoint plans)"
  - "Hardcoded the exact item-attachment invalidation tuple [\"items\", wsId, itemId, \"attachments\"]"
metrics:
  duration: ~35m
  completed: 2026-06-13
---

# Phase 14b Plan 04: Paperless UI (PPL-01/02/03) Summary

Greenfield Paperless-ngx frontend: a Settings-hub `PaperlessPage` (connection
settings + document search) and a `PaperlessLinkDialog` that links a found
Paperless document to an item by creating an attachment with
`external_doc_id = String(doc.id)` over the existing create-attachment endpoint
(no new backend route). Both are exported self-contained for 14b-05 to wire.

## Files & Exported Symbols

| File | Exports |
| ---- | ------- |
| `frontend2/src/lib/api/paperless.ts` | `paperlessApi`, types `PaperlessSettings`, `PaperlessSettingsInput`, `PaperlessDocument`, `PaperlessDocumentDetails`, `PaperlessSearchResponse` |
| `frontend2/src/features/settings/hooks/usePaperlessSettings.ts` | `usePaperlessSettings(wsId)` |
| `frontend2/src/features/settings/PaperlessPage.tsx` | `PaperlessPage` (named export) |
| `frontend2/src/features/settings/PaperlessPage.test.tsx` | — (test) |
| `frontend2/src/features/items/components/PaperlessLinkDialog.tsx` | `PaperlessLinkDialog`, `PaperlessLinkDialogProps` |
| `frontend2/src/features/items/components/PaperlessLinkDialog.test.tsx` | — (test) |

### Component contracts (for 14b-05 wiring)

- `PaperlessPage` — **named export**, no props (reads `wsId` from `useWorkspace()`).
  Import: `import { PaperlessPage } from "@/features/settings/PaperlessPage";`
- `PaperlessLinkDialog` — props `{ wsId: string; itemId: string; open: boolean; onClose: () => void }`.
  Import: `import { PaperlessLinkDialog } from "@/features/items/components/PaperlessLinkDialog";`
  Requires a `ModalStackProvider` ancestor (RetroDialog routes ESC through the modal stack).

## Route 14b-05 should register

`PaperlessPage` expects to mount at **`/settings/paperless`** (under the Phase-12
`SettingsLayout`), with a corresponding Settings-landing row. 14b-05 owns the
single-writer edits to `routes/index.tsx` + `SettingsLayout`/landing.
`PaperlessLinkDialog` should be mounted on the item detail page (Phase 7) and
opened from a "Link Paperless document" action.

## Key links

- `PaperlessPage` → `GET/PUT/DELETE /paperless/settings` + `GET /paperless/search` (via `usePaperlessSettings` + a search query).
- `PaperlessLinkDialog` → `POST /items/{itemId}/attachments` with `{ attachment_type: "OTHER", title, external_doc_id: String(doc.id), file_id: null, is_primary: false }`; `dms_type` derived server-side. On success invalidates `["items", wsId, itemId, "attachments"]` (14b-03's key).

## Deviations from Plan

None — plan executed as written. (Test-only adjustments inside this plan's own
test files: a `waitFor(enabled)` guard before typing in the search input, and a
`ModalStackProvider` wrapper for the dialog test — both are standard
testing-harness requirements, not behavior changes.)

## React-Query keys introduced

- `["paperless", wsId, "settings"]` — settings (save/delete invalidate).
- `["paperless", wsId, "search", query]` — PaperlessPage embedded search.
- `["paperless", wsId, "link-search", query]` — PaperlessLinkDialog search.
- Invalidated (not owned): `["items", wsId, itemId, "attachments"]` — 14b-03's tuple.

## Known Stubs

None. All data sources are wired to live backend endpoints.

## Gate Results

| Gate | Result |
| ---- | ------ |
| `bun run lint:tsc` | PASS (clean) |
| `bun run test` | PASS — 171 files / 1087 tests (incl. 3 new: 2 PaperlessPage + 1 PaperlessLinkDialog) |
| `bun run build` | PASS (built in ~1.1s) |
| `bun run lint:imports` | PASS — no forbidden imports; no sync/idb/offline substrings in new names (FOUND-02 clean) |

## Self-Check: PASSED
