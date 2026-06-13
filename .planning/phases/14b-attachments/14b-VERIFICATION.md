---
phase: 14b-attachments
verified: 2026-06-13T00:00:00Z
status: passed
score: 6/6 must-haves verified
overrides_applied: 0
---

# Phase 14b: Attachments + Paperless Verification Report

**Phase Goal:** User can attach non-photo files to items (upload, list, set-primary, delete) and integrate Paperless-ngx — a workspace settings page, document search, and link-to-item — with the cross-tenant attachment IDOR audit finding fixed as part of the work.
**Verified:** 2026-06-13
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Requirements ATT-01..03, PPL-01..03)

| #  | Truth (Requirement) | Status | Evidence |
| -- | ------------------- | ------ | -------- |
| 1  | **ATT-01** Upload + list non-photo attachments on item detail via Phase-4 FileInput, persisting REAL bytes | ✓ VERIFIED | `ItemAttachmentPanel.tsx` lists rows + download anchors to serve route; `AddAttachmentDialog.tsx` uses `RetroFileInput`, builds `FormData` (file+type+title), calls `upload`; `lib/api/attachments.ts:upload` POSTs multipart to `/workspaces/{ws}/items/{itemId}/attachments/file`; backend `service.go:UploadFileBytes` does `io.TeeReader → storage.Save` (real bytes, SHA-256, rollback on failure) — NOT the old placeholder-key stub; `router.go:305` injects `photoStorage` into `attachment.NewService`; `router.go:534` registers the Chi upload handler. Byte round-trip proven by `storage_integration_test.go` (upload 201 → download 200 byte-equal + nosniff). |
| 2  | **ATT-02** Set-primary + confirm-gated delete, mutations invalidate list | ✓ VERIFIED | `ItemAttachmentPanel.tsx`: SET PRIMARY only on non-primary rows (l.112), DELETE → `RetroConfirmDialog` (l.152-164); `useItemAttachments.ts` `setPrimary`/`deleteAttachment` mutations both `onSuccess: invalidate` of LOCKED key `["items", wsId, itemId, "attachments"]`; backend `handler.go` set-primary (l.200) + delete (l.237) routes both workspace-scoped. |
| 3  | **ATT-03** Cross-tenant attachment IDOR fixed + test-guarded; audit F1 RESOLVED | ✓ VERIFIED | Every attachment route reads `GetWorkspaceID(ctx)` and threads `workspaceID` to service; SQL scopes `WHERE id=$1 AND workspace_id=$2`. `handler_integration_test.go` (`//go:build integration`) asserts cross-tenant GET→404 (no title leak) + cross-tenant DELETE→404 with row survival + same-tenant GET→200. `docs/audit/BACKEND-SECURITY.md` F1 row (l.9) = ✅ RESOLVED + detail block (l.60) cites the integration guard. Orchestrator confirms tagged suite GREEN. |
| 4  | **PPL-01** Configure Paperless settings (get/put/delete) from a page in the Settings hub | ✓ VERIFIED | `PaperlessPage.tsx` + `usePaperlessSettings.ts` wire `paperlessApi.getSettings/saveSettings/deleteSettings` → backend `paperless/handler.go` GET/PUT/DELETE `/paperless/settings`. Route `/settings/paperless` registered under `SettingsLayout` (`routes/index.tsx:298`, lazy+Suspense, sibling of profile/members/data). `SettingsLandingPage.tsx:107` real `<LinkRow to="paperless">` (replaced COMING SOON). |
| 5  | **PPL-02** Search Paperless documents from within the app | ✓ VERIFIED | `PaperlessPage.tsx` embeds `PaperlessSearch` querying `paperlessApi.search` → backend GET `/paperless/search` (`handler.go:80`). Search gated on configured+enabled. |
| 6  | **PPL-03** Link a Paperless document to an item | ✓ VERIFIED | `PaperlessLinkDialog.tsx` link mutation POSTs `/workspaces/{ws}/items/{itemId}/attachments` with `external_doc_id: String(doc.id)`, `attachment_type: OTHER`, `file_id: null`; backend `entity.go:148-152` derives `dms_type="paperless"` from non-nil `external_doc_id`; `onSuccess` invalidates `["items", wsId, itemId, "attachments"]`. Dialog mounted on `ItemDetailPage.tsx:339` via "Link Paperless document" overflow action. |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact | Status | Details |
| -------- | ------ | ------- |
| `backend/.../attachment/service.go` | ✓ VERIFIED | Storage injected; `UploadFileBytes` persists real bytes + rollback; all sigs take `workspaceID`. |
| `backend/.../attachment/handler.go` | ✓ VERIFIED | Chi `RegisterUploadHandler` (`/file`) + `RegisterServeHandler` (`/{id}/file`, nosniff + Content-Disposition); huma metadata route untouched. |
| `backend/.../attachment/handler_integration_test.go` | ✓ VERIFIED | `//go:build integration`; cross-tenant GET/DELETE→404 + survival. |
| `backend/.../attachment/storage_integration_test.go` | ✓ VERIFIED | `//go:build integration`; byte round-trip + cross-tenant serve 404. |
| `backend/internal/api/router.go` | ✓ VERIFIED | l.305 `NewService(fileRepo, attachmentRepo, photoStorage)`; l.534-535 Chi handlers registered. |
| `docs/audit/BACKEND-SECURITY.md` | ✓ VERIFIED | F1 ✅ RESOLVED row + detail block. |
| `frontend2/src/lib/api/attachments.ts` | ✓ VERIFIED | Multipart upload to byte route + downloadUrl. |
| `frontend2/.../ItemAttachmentPanel.tsx` + `AddAttachmentDialog.tsx` | ✓ VERIFIED | List/set-primary/confirm-delete + FileInput multipart dialog. |
| `frontend2/.../hooks/useItemAttachments.ts` | ✓ VERIFIED | LOCKED key + 3 mutations invalidate. |
| `frontend2/src/lib/api/paperless.ts` | ✓ VERIFIED | get/put/delete settings + search + resolve. |
| `frontend2/.../settings/PaperlessPage.tsx` + `usePaperlessSettings.ts` | ✓ VERIFIED | Settings CRUD + embedded search. |
| `frontend2/.../items/components/PaperlessLinkDialog.tsx` | ✓ VERIFIED | Create-attachment with external_doc_id + invalidate. |
| `frontend2/src/routes/index.tsx` | ✓ VERIFIED | `/settings/paperless` under SettingsLayout. |
| `frontend2/.../ItemDetailPage.tsx` | ✓ VERIFIED | FILES tab mounts panel; link dialog mounted + opened from overflow. |
| `frontend2/e2e/attachments-paperless.spec.ts` | ✓ VERIFIED | 2 tests present; orchestrator confirms 2/2 chromium green. |

### Key Link Verification

| From | To | Via | Status |
| ---- | -- | --- | ------ |
| AddAttachmentDialog | `POST .../attachments/file` | FormData multipart upload | ✓ WIRED |
| UploadFileBytes | storage | `storage.Save` (TeeReader) | ✓ WIRED (no stub) |
| router.go | attachment.NewService | `photoStorage` injected | ✓ WIRED |
| ItemDetailPage FILES tab | ItemAttachmentPanel | `<ItemAttachmentPanel wsId itemId />` | ✓ WIRED |
| PaperlessLinkDialog | create-attachment endpoint | `external_doc_id=String(doc.id)` → server derives `dms_type` | ✓ WIRED |
| PaperlessPage | `/paperless/{settings,search}` | usePaperlessSettings + search query | ✓ WIRED |
| routes/index.tsx | PaperlessPage | lazy route under SettingsLayout | ✓ WIRED |
| SettingsLandingPage | `/settings/paperless` | real LinkRow (not COMING SOON) | ✓ WIRED |

### Anti-Patterns Found

None. The pre-existing byte-storage stub (placeholder storage_key, discarded bytes) is REPLACED by `UploadFileBytes` on the new Chi route; the huma metadata route intentionally remains metadata-only (load-bearing for Phase-10b repair file-id minting, documented NON-GOAL). No unreferenced TBD/FIXME/XXX markers in modified files.

### Gaps Summary

None. All 6 requirements (ATT-01/02/03, PPL-01/02/03) are wired end-to-end in source: real byte persistence (not the old stub), workspace-scoped routes with a `//go:build integration` cross-tenant 404 guard + byte round-trip guard, audit F1 flipped to RESOLVED, Paperless settings page registered in the Settings hub with a real landing row, document search, and link-to-item creating an external_doc_id attachment that invalidates the item attachments query key. Gates (frontend lint:tsc/test 1098/build/lint:imports; backend build/test + tagged integration; live E2E 2/2) confirmed GREEN by the orchestrator.

---

_Verified: 2026-06-13_
_Verifier: Claude (gsd-verifier)_
