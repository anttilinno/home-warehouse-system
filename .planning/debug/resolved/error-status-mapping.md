---
slug: error-status-mapping
status: resolved
trigger: "Error-to-HTTP-status mapping inconsistent; typed apierror path dead. NewFieldError returns *DomainError wrapping sentinels, but ErrorTransformer only maps *apierror.APIError (0 producers) -> falls to 500; handlers hardcode huma.Error400BadRequest at ~70 sites, flattening not-found/field info to 400. Fix: teach the boundary to map *shared.DomainError sentinels to correct status + surface Field, and sweep the ~70 hardcoded-400 sites through the typed mapping."
created: 2026-05-31
updated: 2026-05-31
resolved: 2026-05-31
---

# Debug Session: error-status-mapping

## Symptoms

- **Expected behavior:** A domain error built by `NewFieldError` (`*shared.DomainError` wrapping `ErrNotFound`/`ErrInvalidInput`/etc.) should surface at the HTTP boundary with the correct status (404/400/409/401/403) and its `Field` as the error location.
- **Actual behavior:** `ErrorTransformer` (`backend/internal/api/middleware/errors.go`) only recognized `*apierror.APIError` via `errors.As`; everything else fell back to HTTP 500. ZERO domain packages produce an `apierror.APIError`, so that machinery was dead for domain errors. Handlers instead mapped manually and inconsistently: ~70 sites hardcoded `huma.Error400BadRequest(err.Error())`. Result: `Field` and the not-found-vs-invalid distinction were dropped; a not-found could surface as 400 instead of 404.
- **Error messages:** None — wrong status codes / lost error detail, not a crash.
- **Timeline:** Pre-existing; surfaced via graphify trace.

## Known root cause (pre-diagnosed)

Diagnosis complete via code trace. Reference:
`graphify-out/memory/query_20260531_190102_what_is_newfielderror___and_why_is_it_a_top_cross.md`

## Fix scope (user-approved)

1. Teach the boundary to map domain errors (`*shared.DomainError` -> status + Field as Location).
2. Sweep the ~70 hardcoded-400 sites through the typed mapping; leave genuine non-domain 400s.
3. Verify status codes; adjust assertions where a previously-400 not-found now correctly returns 404.

## Current Focus

- hypothesis: A single boundary-level `DomainError` mapping plus a mechanical sweep of the hardcoded-400 sites restores correct, uniform status codes and field locations with no domain-layer changes. (CONFIRMED)
- next_action: none — resolved.

## Evidence

- timestamp: 2026-05-31 — Path correction: domain `shared` package lives at `backend/internal/shared/` (NOT `internal/domain/shared/`). Sentinels + `DomainError` + `NewFieldError` all in `backend/internal/shared/errors.go`.
- timestamp: 2026-05-31 — Confirmed `ErrorTransformer` recognized only `*apierror.APIError` then fell to 500. Verified it is NEVER registered with huma (only referenced by its own test) — huma uses the default `huma.NewError` global, so handlers control status entirely via which `huma.ErrorNNN` they return. Effective lever = the per-handler call sites, not the transformer alone.
- timestamp: 2026-05-31 — Enumerated exactly 70 `huma.Error400BadRequest(err...)` sites: 69 in form `return nil, huma.Error400BadRequest(err.Error())` (all wrap an `err` returned from a `svc.*` call = domain/service errors; huma decodes request input before the handler body runs, so none are raw-parse failures), and 1 in form `return huma.Error400BadRequest(err.Error())` at `inventory/handler.go:395` INSIDE the already-correct `mapInventoryError` helper (legitimate invalid-condition/status 400 — left untouched).
- timestamp: 2026-05-31 — Domain not-found sentinels are mixed: company/label/location/container/category wrap `shared.ErrNotFound` (so MapDomainError -> 404); loan/attachment/item/itemphoto/borrower use bare `errors.New` BUT their handlers already special-case `if err == ErrXxxNotFound { return huma.Error404NotFound }` before the swept fallback, so their not-found paths were already 404. The sweep preserves those explicit branches.
- timestamp: 2026-05-31 — Verified `loan` package failure `TestService_Return_InventoryDeleted` is PRE-EXISTING (mock-expectation panic in `service.go:153`, a file I never touched). Reproduced identically with all session changes stashed. Out of scope per constraint (prior uncommitted fixes must not be disturbed).

## Eliminated

- Upgrading `ErrorTransformer` alone would NOT fix behavior — it is unregistered/dead. The behavior-restoring change is the call-site sweep via `MapDomainError`. (Transformer was still upgraded for defense-in-depth and because it was named in scope.)
- Not every `huma.Error400BadRequest` is a bug: short-code/name-taken and cyclic-parent cases sit behind explicit `if err == ErrXxx` branches that intentionally keep 400; the `inventory/handler.go:395` site is correct. These were left as-is.

## Resolution

- root_cause: The HTTP error boundary never mapped domain errors. `ErrorTransformer` recognized only `*apierror.APIError` (zero producers) and was never even registered with huma; handlers hardcoded `huma.Error400BadRequest(err.Error())` at 69 service-error sites, flattening not-found/conflict/forbidden/field distinctions to 400.
- fix: (1) Added `MapDomainError(err)` and upgraded `ErrorTransformer` in `backend/internal/api/middleware/errors.go` to recognize `*shared.DomainError` via `errors.As`, mapping wrapped sentinels (ErrNotFound->404, ErrInvalidInput->400, ErrAlreadyExists/ErrConflict->409, ErrUnauthorized->401, ErrForbidden->403, ErrInternal->500), surfacing `Field` as Location, preserving the message, with a 400 default for unknown/non-domain errors and a 500 fallback in the transformer. (2) Swept all 69 `return nil, huma.Error400BadRequest(err.Error())` service-error sites across 17 handler files to `return nil, appMiddleware.MapDomainError(err)`, preserving pre-existing explicit `if err == ErrXxx` branches. Left the legitimate `inventory/handler.go:395` 400 untouched. (3) Updated handler test assertions for the intended behavior change (location/container/label Archive/Restore/Delete not-found 400->404; has-containers/has-inventory 400->409) and added DomainError-mapping tests for `ErrorTransformer` + `MapDomainError`.
- verification: `go build ./...` OK; `go vet ./internal/api/middleware/... ./internal/domain/...` OK; middleware, apierror, and all domain handler tests PASS (incl. new mapping tests). Only failure is the unrelated pre-existing `loan.TestService_Return_InventoryDeleted` (reproduced with changes stashed; out of scope).
- files_changed:
  - backend/internal/api/middleware/errors.go (MapDomainError + ErrorTransformer DomainError recognition)
  - backend/internal/api/middleware/errors_test.go (new mapping tests)
  - 17 handler files: auth/{workspace,notification,member,user,pushsubscription}, warehouse/{loan,company,label,attachment,item,repairlog,location,borrower,repairattachment,container,category} (69 call-site swaps)
  - backend/internal/domain/warehouse/{location,container,label}/handler_test.go (assertion updates for intended 404/409 behavior)
