# Security Audit — Go Backend

Date: 2026-06-11. Scope: `backend/` multi-tenant warehouse API (Go, chi + Huma, sqlc/pgx, Postgres). Findings combine reads of the auth/middleware/config/router/shortlink/webpush layers with deep passes over tenant-isolation queries, file uploads, and import/export. Every finding cites file:line with code evidence.

> **Status (2026-06-16): ALL 20 findings RESOLVED.** F1–F20 were remediated in commit `f49e4b48` ("tenant isolation threading + security hardening (F1-F20)", 2026-06-11), pairing with migrations 002–006. Each mitigation was re-verified present in current source on 2026-06-16. The per-row table below and the prose sections retain the original finding text for audit history; the ✅ tags mark resolution. No open security holes remain in the audited surface.

## Severity summary

| # | Severity | Title | Location |
|---|----------|-------|----------|
| F1 | CRITICAL | ✅ RESOLVED (`f49e4b48`) — Cross-tenant IDOR on `attachment`/`file` (read + destructive delete) | `domain/warehouse/attachment/handler.go`, `attachments.sql.go` |
| F2 | HIGH | ✅ RESOLVED (`f49e4b48`) — Logout does not revoke session / refresh token | `domain/auth/user/handler.go:324` |
| F3 | HIGH | ✅ RESOLVED (`f49e4b48`) — Session revocation bypass via "legacy token" re-creation on refresh | `domain/auth/user/handler.go:264-310` |
| F4 | HIGH | ✅ RESOLVED (`f49e4b48`) — CSV formula/DDE injection on export | `domain/importexport/service.go:391-508` |
| F5 | HIGH | ✅ RESOLVED (`f49e4b48`) — Import/restore not admin-gated; bypasses approval pipeline | `api/router.go:494`, `approval_middleware.go:171-207` |
| F6 | HIGH | ✅ RESOLVED (`f49e4b48`) — Cross-tenant FK injection in workspace restore | `domain/importexport/workspace_restore.go:719-734` |
| F7 | MEDIUM | ✅ RESOLVED (`f49e4b48`) — CORS reflects ANY private-network origin with credentials | `api/middleware/cors.go:29-55` |
| F8 | MEDIUM | ✅ RESOLVED (`f49e4b48`) — Rate-limit bypass via spoofable `X-Forwarded-For` | `api/middleware/ratelimit.go:112-126` |
| F9 | MEDIUM | ✅ RESOLVED (`f49e4b48`) — No security headers / `nosniff` on served upload files | all serve handlers |
| F10 | MEDIUM | ✅ RESOLVED (`f49e4b48`) — No request body size cap (`MaxBytesReader` absent) | upload + import handlers |
| F11 | MEDIUM | ✅ RESOLVED (`f49e4b48`) — XLSX decompression bomb (no `UnzipSizeLimit`) | `workspace_restore.go:101` |
| F12 | MEDIUM | ✅ RESOLVED (`f49e4b48`) — Push subscription SSRF (endpoint URL unvalidated) | `domain/auth/pushsubscription/entity.go:33` |
| F13 | MEDIUM | ✅ RESOLVED (`f49e4b48`) — Cookie `Secure` flag gated on `APP_ENV`, decoupled from JWT/prod gating | `domain/auth/user/handler.go:36` |
| F14 | LOW | ✅ RESOLVED (`f49e4b48`) — Zip-slip via unsanitized photo filename in bulk download | `itemphoto/handler.go:488-497` |
| F15 | LOW | ✅ RESOLVED (`f49e4b48`) — Served `Content-Type` taken from client header, not detected format | `itemphoto/service.go:135` |
| F16 | LOW | ✅ RESOLVED (`f49e4b48`) — Weak default JWT secret `change-me-in-production` | `config/config.go:75` |
| F17 | LOW | ✅ RESOLVED (`f49e4b48`) — No CSRF token defense-in-depth (relies solely on SameSite=Lax) | global |
| F18 | LOW | ✅ RESOLVED (`f49e4b48`) — Internal error strings leaked in JSON responses | `approval_middleware.go:101,120` |
| F19 | LOW | ✅ RESOLVED (`f49e4b48`) — Dead unscoped `GetFavorite`/`FindByID` query (regenerated; all favorites queries now `WHERE user_id=$1 AND workspace_id=$2`) | `favorites.sql.go:95` |
| F20 | LOW | ✅ RESOLVED (`f49e4b48`) — `strings.HasPrefix` path-containment check (sibling-dir bug) | `storage/local_storage.go:128` |

---

## CRITICAL

### F1 — Cross-tenant IDOR on the legacy `attachment`/`file` entity

`warehouse.attachments` has **no `workspace_id` column**, the service takes **no workspaceID**, and the handler **explicitly discards** the workspace from context. Routes are mounted on the workspace-scoped tree (`api/router.go:488`).

Evidence — `domain/warehouse/attachment/handler.go`:

```go
// GET /attachments/{id}
// Note: In production, verify attachment's item belongs to workspace
_ = workspaceID
attachment, err := svc.GetAttachment(ctx, input.ID)
```

```go
// DELETE /attachments/{id}
err := svc.DeleteAttachment(ctx, input.ID)   // no workspace check anywhere
```

Queries are id-only: `attachments.sql.go:104` `DELETE FROM warehouse.attachments WHERE id = $1`, `:113` `DELETE FROM warehouse.files WHERE id = $1`, `:122`/`:143` `SELECT ... WHERE id = $1`.

Impact: an authenticated member of workspace A calls `GET`/`DELETE /workspaces/{A}/attachments/{id}` with an `id` belonging to workspace B → cross-tenant metadata read, attachment enumeration via `ListByItem`, and destructive delete of both the row and the backing file. The `// Note: In production, verify...` comments confirm the check was knowingly skipped.

Fix: add a `workspace_id` column + `WHERE id=$1 AND workspace_id=$2` scoping and thread `workspaceID` through service/handler — mirror the correct sibling `repairattachment` (`repair_attachments.sql.go:17,32`), which is already properly scoped.

> The rest of the warehouse domain (item, inventory, loan, itemphoto, container, location, category, borrower, label, repairlog, movement, company, declutter, repairattachment, repairphoto) was verified **CLEAN** — either DB-level `WHERE id=$1 AND workspace_id=$2` or service-level `GetByID(id, workspaceID)` gate / explicit `WorkspaceID != workspaceID` compare-after-fetch. 15+ queries sampled across entities.

> **RESOLVED** (commit `f49e4b48` — "tenant isolation threading + security hardening (F1-F20)"). The `attachments`/`files` tables now carry a `workspace_id` column; the service signatures take `workspaceID uuid.UUID`; every handler reads `GetWorkspaceID(ctx)` and threads it; SQL scopes `WHERE id=$1 AND workspace_id=$2` (FindByID:138, Delete:110, ListByItem:197, SetPrimary:261). Regression-guarded by `attachment/handler_integration_test.go` (cross-tenant GET/DELETE → 404, `-tags=integration`).

---

## HIGH

### F2 — Logout does not revoke the session or refresh token

`domain/auth/user/handler.go:324`:

```go
func (h *Handler) logout(ctx context.Context, input *struct{}) (*LogoutOutput, error) {
	return &LogoutOutput{
		SetCookie: []http.Cookie{
			*clearAuthCookie(accessTokenCookie),
			*clearAuthCookie(refreshTokenCookie),
		},
	}, nil
}
```

It only clears browser cookies — it never calls `sessionSvc.Revoke`/`RevokeAll` nor deletes the session row. The refresh token is a stateless 7-day JWT (`jwt.go:97`). A stolen/leaked refresh token (or access JWT until expiry) remains fully valid after the user "logs out."

Fix: look up the session by `HashToken(refreshToken)` and delete it on logout; also clear the server session.

> **RESOLVED** (commit `f49e4b48` — "tenant isolation threading + security hardening (F1-F20)").
> `logout` now reads the `refresh_token` cookie, computes `session.HashToken(refresh)`,
> looks up the row via `FindByTokenHash`, and calls `sessionSvc.Revoke(userID, sessionID)`
> before clearing both cookies (`domain/auth/user/handler.go` `logout`). The server is now
> the sole revocation authority — a replayed post-logout refresh token is rejected.
> **Regression guard:** `TestLogout_RevokesSession` in `backend/tests/integration/auth_test.go`
> (Phase 05 Plan 05-01) drives register → login → cookie-bearing logout → refresh-replay and
> asserts `401` with detail "revoked". Closes **AUTH-12**.

### F3 — Session revocation bypass on refresh ("legacy token" re-creation)

`domain/auth/user/handler.go:264-310`: when `FindByTokenHash` returns `ErrSessionNotFound` (which is exactly what happens after a session is revoked/deleted), the code treats it as a pre-session-tracking "legacy token," continues, and **creates a brand-new session**:

```go
if err == session.ErrSessionNotFound {
    currentSession = nil   // "legacy token" -> falls through
}
...
} else { // currentSession == nil
    _, _ = h.sessionSvc.Create(ctx, user.ID(), refreshToken, ...)
}
```

Because the JWT itself stays cryptographically valid for 7 days, `Revoke`/`RevokeAll`/`RevokeAllExcept` (`session/service.go:74-86`) are defeated: the holder of the refresh JWT simply refreshes and a new session is minted.

Fix: on `ErrSessionNotFound`, reject with 401 (drop the legacy-token fallback, or gate it behind a token `iat` cutoff). Add a `jti`/version to refresh tokens and validate against the session store.

> **RESOLVED** (commit `f49e4b48` — "tenant isolation threading + security hardening (F1-F20)").
> The legacy-token resurrection fallback is removed: `refreshToken` now treats any
> `FindByTokenHash` error (including `ErrSessionNotFound` from a revoked/deleted row) as a
> hard `401 "session has been revoked"` and **never** re-`Create`s a session
> (`domain/auth/user/handler.go` `refreshToken` — see the explicit "deliberately NO legacy
> token fallback" comment). `Revoke`/`RevokeAll`/`RevokeAllExcept` are now effective: a holder
> of a revoked refresh JWT cannot mint a fresh session.
> **Regression guard:** `TestRefresh_RevokedSession_NoNewSession` in
> `backend/tests/integration/auth_test.go` (Phase 05 Plan 05-01) asserts that replaying a
> revoked refresh token stays `401` (never `200`) and that the user's session list does not
> regrow (no resurrected row). Closes **AUTH-12**.

### F4 — CSV formula/DDE injection on export

`domain/importexport/service.go:391-508` (`toCSV`) writes attacker-controlled fields (`item.Name`, `Description`, `Brand`, `Notes`, …) straight through `encoding/csv`, which does not neutralize `= + - @ \t \r` leading characters. Export route `GET /export/{entity_type}` (`handler.go:60`) is reachable by any member. A member names an item `=cmd|'/c calc'!A1`; when a workspace admin exports and opens in Excel/LibreOffice the formula executes.

Fix: prefix a `'` (or strip) when a cell begins with `= + - @ \t \r`. (XLSX backup path uses `SetCellValue` and is not formula-injectable today, but apply the same defense.)

### F5 — Import/restore endpoints are not admin-gated and bypass the approval pipeline

The approval middleware only intercepts literal entity path segments (`approval_middleware.go:187-206`); the import paths are `/workspaces/{id}/import/...` whose 3rd segment is `"import"` → `extractEntityType` returns `""` → request proceeds for **any role including member**. So any member can trigger a full workspace restore / bulk entity creation, entirely bypassing approval.

Fix: add explicit owner/admin role enforcement on `/import/*` and `/export/workspace` handlers.

### F6 — Cross-tenant FK injection in workspace restore

`domain/importexport/workspace_restore.go:719-734` inserts containers using the `location_id` taken verbatim from the uploaded file while only setting the row's own `workspace_id`:

```go
locationID := container.LocationID   // from uploaded file, not re-validated
_, err := s.queries.CreateContainer(ctx, queries.CreateContainerParams{
    ID: newID, WorkspaceID: workspaceID, LocationID: locationID, ...})
```

The FK references `warehouse.locations(id)` without a workspace match, so an attacker uploads a backup whose `location_id` points at **another tenant's** location and it inserts successfully (`// TODO: fix this` comment at `:722` confirms).

Fix: resolve referenced IDs through the import mapping tables / by name within the target workspace and reject references that don't resolve same-workspace. (Schema-level fix: composite FKs, see DATABASE-SCHEMA.md B1.)

---

## MEDIUM

### F7 — CORS reflects any private-network origin with credentials

`api/middleware/cors.go:48-71`: `isAllowedOrigin` returns true for any `192.168.*`, `10.*`, `172.16-31.*` origin, and the handler then sets `Access-Control-Allow-Origin: <origin>` + `Access-Control-Allow-Credentials: true`. Any site served from a private IP (or via DNS-rebinding) can make credentialed cross-origin requests and read responses. For a LAN-hosted warehouse this is a real exposure. The `strings.HasPrefix(host, "172.2")` clause (`:42`) is also over-broad (matches 172.20–172.29 and anything starting "172.2").

Fix: drop the private-network auto-allow; use an explicit allowlist only.

### F8 — Rate-limit bypass via spoofable X-Forwarded-For

`api/middleware/ratelimit.go:112-126` keys the limiter on the **first** `X-Forwarded-For` value, which is fully client-controlled. An attacker rotates the header to get unlimited attempts against the 20/min auth limiter (`router.go:291`) and 10/min OAuth callback limiter — defeating brute-force protection.

Fix: derive the client IP from chi's `RealIP`/`RemoteAddr` and trust XFF only from a known proxy hop count.

### F9 — No security headers / `nosniff` on served upload files

No security-header middleware exists anywhere (grep for `nosniff`/CSP/`X-Frame-Options` returns nothing). Serve handlers set only `Content-Type`: `itemphoto/handler.go:808`, `repairphoto/handler.go:371`, `auth/user/handler.go:840` (avatar), zip at `itemphoto/handler.go:471`. Since the served Content-Type is the client-supplied value (F15) and no `X-Content-Type-Options: nosniff` is set, content-sniffing browsers may misinterpret stored files. (The image-only upload allow-list blocks the worst SVG/HTML-XSS case.)

Fix: add `nosniff` + `Content-Disposition: inline; filename=...` + a restrictive CSP on serve routes; ideally serve user content from a cookie-less origin.

### F10 — No request body size cap

Multipart handlers call `r.ParseMultipartForm(MaxFileSize)` treating the in-memory threshold as a size limit, and `http.MaxBytesReader` is used nowhere. `cmd/server/main.go:51` sets only `ReadTimeout: 15s`, no `MaxHeaderBytes` or body limit. The base64 JSON/XLSX import path (`importexport/handler.go:166,244`) has no cap at all. Result: disk/memory-exhaustion DoS.

Fix: wrap upload/import bodies in `http.MaxBytesReader` and add a global body-limit middleware; don't trust `header.Size`.

### F11 — XLSX decompression bomb

`workspace_restore.go:101` calls `excelize.OpenReader(bytes.NewReader(data))` with no `excelize.Options{UnzipSizeLimit: ...}`, then `GetRows` materializes whole sheets. A small malicious xlsx decompresses to gigabytes (memory-exhaustion DoS), reachable by any member via `POST /import/workspace`.

Fix: pass `UnzipSizeLimit`/`UnzipXMLSizeLimit`, cap rows per sheet, and bound the decoded input size. (No `archive/zip` Zip-Slip path-traversal sink exists in the import code.)

### F12 — Push subscription SSRF

`domain/auth/pushsubscription/entity.go:33` only checks the endpoint is non-empty; no scheme/host validation. `webpush.Sender.sendToSubscription` (`infra/webpush/sender.go:128-145`) POSTs the (encrypted) payload to that arbitrary URL whenever a push fires. A user can register `http://169.254.169.254/...` or an internal host → blind SSRF / internal-port probing from the server/worker.

Fix: validate the endpoint is HTTPS, public-resolving, and (optionally) on a known push-provider allowlist; block link-local/RFC-1918 targets.

### F13 — Cookie `Secure` flag gated on a different env var than the rest of prod config

`domain/auth/user/handler.go:36` `isSecureCookie()` returns `os.Getenv("APP_ENV") == "production"`, but the JWT-secret production check uses `DebugMode` (`config.go:118`) and OAuth/Authelia use `strings.HasPrefix(AppURL, "https")`. Three different "are-we-in-prod" signals. If `APP_ENV` is unset in production, auth cookies are issued **without `Secure`**, exposing them over plaintext.

Fix: centralize a single `IsProduction`/secure-cookie decision in config and reuse it everywhere.

---

## LOW

- **F14 Zip-slip in bulk photo download** — `itemphoto/service.go:205` stores `Filename: header.Filename` unsanitized; `handler.go:488-497` passes it to `zipWriter.Create(filename)`. A filename like `../../../.bashrc` yields an escaping zip entry (arbitrary-write on naive extraction). Fix: `filepath.Base` + `SanitizeFilename` before `zipWriter.Create` and at persist time.
- **F15 Served Content-Type from client header** — `itemphoto/service.go:135` / `repairphoto/service.go:83` store `header.Header.Get("Content-Type")` (constrained to image/* allow-list) and echo it at serve time rather than the decoder-detected format. Combine with F9. Fix: derive MIME from the detected image format.
- **F16 Weak default JWT secret** — `config.go:75` defaults to `change-me-in-production`. `Validate()` only rejects it when `!DebugMode` (`:118`), so it's blocked in prod, but the weak literal + DEBUG-coupling is fragile — and `Validate()` is never called (see BACKEND-QUALITY.md §6). Fix: require an explicit non-empty secret with a minimum length, no usable default.
- **F17 No CSRF token** — cookie auth relies entirely on `SameSite=Lax` (state-changing verbs are POST/PUT/DELETE, so Lax blocks cross-site CSRF in practice). CORS advertises an `X-CSRF-Token` header but nothing validates it. Add a double-submit/synchronizer token as defense-in-depth.
- **F18 Error leakage** — `approval_middleware.go:101,120` embed raw `%v` errors in JSON responses; other handlers wrap DB errors into 500s. Avoid reflecting internal error text to clients.
- **F19 Dead unscoped query** — `favorites.sql.go:95` `GetFavorite ... WHERE id=$1` and its `FindByID` wrapper are unused (live delete path is `WHERE id=$1 AND user_id=$2`). Remove before it gets wired up.
- **F20 Path-containment uses HasPrefix** — `storage/local_storage.go:128,160,220` use `strings.HasPrefix(cleanPath, cleanBase)` (sibling-dir prefix bug). Not currently reachable (paths are DB-derived + `..`-filtered). Fix: use `filepath.Rel` and reject `..`.

---

## Areas checked and found CLEAN

- **SQL injection** — No `fmt.Sprintf`-built SQL in `infra/postgres` or `infra/queries`; all access is sqlc-parameterized (`$1…`). Item search uses `plainto_tsquery('english', $3)` (`items.sql.go:50`), fully parameterized. No dynamic `ORDER BY`, no raw `LIKE`/`ILIKE` with user-built patterns.
- **Tenant isolation (warehouse domain except F1)** — all entities properly workspace-scoped (DB clause and/or service gate). Workspace middleware (`middleware/workspace.go:90-124`) correctly verifies membership before setting workspace/role context.
- **Admin endpoints** — `listUsers`/`getUserByID`/`deactivateUser`/`activateUser` each enforce `if !authUser.IsSuperuser { 403 }` in-handler (`user/handler.go:507,564,602,627`).
- **OAuth** — PKCE S256 + 32-byte CSRF state in HttpOnly cookie, state compared to callback param (`oauth/handler.go:99-160`); one-time code via Redis `GetDel` (atomic, 60s TTL); account auto-linking gated on `profile.EmailVerified` (`service.go:67-79`, blocks pre-verified-email takeover); unlink prevents last-auth lockout (`service.go:115`).
- **Authelia trusted-header SSO** — shared-secret trust boundary compared with `crypto/subtle.ConstantTimeCompare` (`authelia/handler.go:87,146`); config refuses to enable without a secret (`config.go:126`).
- **JWT validation** — signing-method type-checked to HMAC (rejects `alg:none`/RSA confusion, `jwt.go:72,111`); expiry enforced; subject parsed to UUID. Minor: not pinned to exact HS256 (HS384/512 also accepted with same key) — negligible.
- **Export tenant scoping** — every export query scoped to context `workspaceID`; never reads workspace_id from the uploaded file (`importexport/service.go:166`, `workspace_backup.go:154+`).
- **CSV upload (importjob)** — multipart path capped at 10MB with extension validation (`importjob/upload_handler.go`). The gap is the base64 JSON/xlsx path (F10/F11).
- **Upload validation core** — image bytes are actually decoded (`imageprocessor.Validate`), SVG/HTML rejected by image-only allow-list, storage path built from `uuid.String()` segments + `SanitizeFilename`, `/uploads` not exposed via any static FileServer (served only through authed Go handlers). Residual items: F9/F14/F15.

## Remediation priority

**F1** (live cross-tenant delete) → **F2/F3** (auth session lifecycle) → **F5/F6** (import authz + tenant FK) → **F4/F7/F8** (export injection, CORS, rate-limit bypass) → mediums → lows.
