# Phase 14b — Attachment IDOR + Byte-Storage Serve Route — SECURITY VERIFICATION

**Audit finding under verification:** `docs/audit/BACKEND-SECURITY.md` F1 — "Cross-tenant
IDOR on attachment/file (read + destructive delete)". Also touches F14 (zip-slip), F15
(content-type sniffing on serve), F20 (path-containment).

**Verdict:** F1 is GENUINELY RESOLVED. No residual IDOR, path-traversal, or content-sniffing
BLOCKER. All declared mitigations verified present in real source (not docs/intent).

**Closed:** 6/6 verified dimensions | **Open:** 0 | **ASVS focus:** L2 (access control + file handling)

---

## Threat Verification

| ID | Threat | Disposition | Evidence (file:line) | Status |
|----|--------|-------------|----------------------|--------|
| F1-routes | Every attachment route threads `GetWorkspaceID` | mitigate | handler.go:34,56,74,151,201,238,305,408 — all 8 routes read `GetWorkspaceID(ctx)`, 401 if absent | CLOSED |
| F1-svc | Service signatures take `workspaceID` | mitigate | service.go:28-33 (interface), GetAttachment:190, ListByItem:201, DeleteAttachment:205, SetPrimary:224, GetFile:139 | CLOSED |
| F1-sql | SQL scopes `WHERE id=$1 AND workspace_id=$2` | mitigate | attachments.sql.go:110 (DeleteAttachment), :124 (DeleteFile), :138 (FindByID attach), :166 (FindByID file), :197 (ListByItem), :261 (SetPrimary) | CLOSED |
| F1-serve | NEW serve route byte-fetch is workspace-scoped | mitigate | handler.go:421 `svc.GetAttachment(ctx, id, workspaceID)` + :433 `svc.GetFile(ctx, *FileID, workspaceID)` — both scoped before any byte read; 404 on cross-tenant | CLOSED |
| F14/F20 | Byte-write path sanitises (zip-slip + containment) | mitigate | service.go:99 `storage.Save(...header.Filename...)` → local_storage.go:64 `SanitizeFilename` (filepath.Base + `^[a-zA-Z0-9_\-. ]+$` whitelist) + :70 UUID prefix; reads via :115 `resolveWithinBase` (filepath.Rel, not HasPrefix) | CLOSED |
| F15 | Serve route sets nosniff + Content-Disposition: attachment | mitigate | handler.go:457 `X-Content-Type-Options: nosniff`, :458 `Content-Disposition: attachment; filename=%q` (SanitizeFilename'd); :447 mime from STORED value, not client-echoed at serve | CLOSED |

---

## Detail per audit question

### 1. Every route reads GetWorkspaceID and passes workspaceID — VERIFIED

All eight attachment routes confirmed in `handler.go`:

- `GET /items/{item_id}/attachments` (List) — :34 → `svc.ListByItem(.., workspaceID)`
- `GET /attachments/{id}` (Get) — :56 → `svc.GetAttachment(.., workspaceID)`
- `POST /items/{item_id}/attachments/upload` (huma JSON metadata) — :74, threads `WorkspaceID`
- `POST /items/{item_id}/attachments/file` (NEW chi multipart bytes) — :305 → `UploadFileBytes(.., workspaceID, ..)`
- `POST /items/{item_id}/attachments` (Create) — :151, threads `WorkspaceID`
- `POST /items/{item_id}/attachments/{id}/set-primary` (SetPrimary) — :201 → `svc.SetPrimary(.., workspaceID)`
- `DELETE /attachments/{id}` (Delete) — :238 → `svc.DeleteAttachment(.., workspaceID)`
- `GET /attachments/{id}/file` (NEW chi serve) — :408 → scoped Get + GetFile

No route discards the workspace. The old `_ = workspaceID` / `// In production, verify...`
comments cited in the F1 evidence are GONE.

**Mount path (router.go:472-535):** all routes sit under `r.Route("/workspaces/{workspace_id}")`
which applies `JWTAuth` (:434) then `Workspace(NewMemberAdapter(memberRepo))` (:473). The
Workspace middleware verifies membership AND is what populates `GetWorkspaceID`. So the chi
byte-upload (:534) and serve (:535) routes cannot be reached without an authenticated, member-
verified workspace context — `GetWorkspaceID` returns the caller's own verified workspace, never
an attacker-supplied one.

### 2. Serve route byte-fetch is workspace-scoped — VERIFIED (was the BLOCKER risk)

`ServeAttachmentHandler.HandleServe` (handler.go:405-462) does TWO scoped lookups before any
byte streaming:
- :421 `attachment, err := h.svc.GetAttachment(ctx, id, workspaceID)` → repo FindByID
  `WHERE id=$1 AND workspace_id=$2` (sql.go:138) → cross-tenant id ⇒ `ErrAttachmentNotFound` ⇒ 404.
- :433 `file, err := h.svc.GetFile(ctx, *attachment.FileID(), workspaceID)` → repo FindByID file
  `WHERE id=$1 AND workspace_id=$2` (sql.go:166) → also workspace-scoped.

Only after both succeed does :439 `storage.Get(file.StorageKey())` read bytes. A serve route that
streamed bytes by id without the workspace clause would be the re-introduced IDOR — it is NOT
present. NO BLOCKER.

### 3. Byte-write sanitisation + serve security headers — VERIFIED

- **Write path:** `UploadFileBytes` (service.go:88) passes raw `header.Filename` into
  `storage.Save` (service.go:99). `Save` (local_storage.go:58) runs `SanitizeFilename` (:64) which
  `filepath.Base`-strips separators and whitelists `^[a-zA-Z0-9_\-. ]+$`, rejects `.`/`..`/empty,
  then prefixes a fresh UUID (:70). User-controlled filename can never inject path separators or
  `..`. **Zip-slip (F14) closed at persist time.**
- **Path containment (F20):** read/delete/exists go through `resolveWithinBase` (:115) which uses
  `filepath.Rel(cleanBase, cleanPath)` and rejects `..`/`../`-escaping results — NOT the old
  `strings.HasPrefix` sibling-dir-prone check. `validateStoragePath` (:261) additionally rejects
  `..` substrings and absolute paths. **F20 closed.**
- **Content sniffing (F15):** serve route sets `X-Content-Type-Options: nosniff` (handler.go:457)
  and `Content-Disposition: attachment; filename=%q` with a SanitizeFilename'd name (:458).
  Content-Type comes from the STORED `file.MimeType()` (:447), falling back to extension sniff,
  not a per-request client echo. Forced-download + nosniff neutralises the browser-sniff XSS
  vector. **F15 closed for this route.**

### 4. Integration tests prove cross-tenant 404 (not just happy path) — VERIFIED

Two `//go:build integration` test files, both wire REAL Postgres + REAL repos + REAL service
(no mocks), seeding workspace A then driving calls from workspace B:

`handler_integration_test.go` — `TestAttachmentHandler_CrossTenant_Integration`:
- control same-tenant GET → 200 with seeded row (:156)
- **cross-tenant GET → 404** and body must NOT contain the other tenant's title (:168-178)
- **cross-tenant DELETE → 404 AND the row survives** — re-GET from A returns 200, and a direct
  `svc.GetAttachment(.., workspaceA)` still finds it (:180-200). Destructive-delete IDOR proven
  blocked, not just read.

`storage_integration_test.go` — `TestAttachment_ByteRoundTrip_Integration`:
- byte upload → 201 mints file id (:124-138)
- download round-trip → 200, exact bytes equal, `Content-Type==application/pdf`,
  `X-Content-Type-Options==nosniff`, `Content-Disposition` contains `attachment` (:140-150)
- **serve route cross-tenant (workspace B GET of A's attachment /file) → 404** (:152-165) —
  the new byte-serve IDOR path is explicitly regression-guarded.

Both suites are `-tags=integration` gated, so default `go test ./...` stays fast; a revert of the
`f49e4b48` tenant-isolation threading fails here.

---

## Unregistered Flags

None. The two new attack surfaces introduced this phase (chi byte-upload `POST .../attachments/file`
and chi serve `GET /attachments/{id}/file`) both map to F1 (IDOR) + F14/F15/F20 (file handling) and
are mitigated + test-guarded as above.

## Residual / out-of-phase notes (informational, NOT blockers for F1)

- `UploadFileBytes` derives serve-time MIME from the client multipart `Content-Type`
  (service.go:107). This is the same residual as audit F15's root note, but the serve route's
  `nosniff` + `Content-Disposition: attachment` (handler.go:457-458) forces download and prevents
  the browser from acting on a spoofed type, so the XSS-via-sniff vector is closed for this route.
  Storing a decoder-detected MIME would be a defence-in-depth nicety, not a gap.
- The huma JSON metadata upload route (`/attachments/upload`, handler.go:73) still builds a
  placeholder `storageKey` and stores no bytes — that is intentional (Phase-10b repair-attachment
  minting depends on it) and carries no traversal risk since the key is composed from
  `uuid.String()` segments only.

SECURITY.md: /home/antti/Repos/Misc/home-warehouse-system/.planning/phases/14b-attachments/14b-SECURITY.md
