---
phase: quick-260607-uzt
plan: 01
subsystem: shortlink-qr-redirect
tags: [backend, go, chi, angie, nextjs, qr, redirect]
requires: [jwt.Service, workspace.Service, pgxpool, chi-router, next-intl]
provides:
  - "GET /r/{code} backend redirect handler (cookie auth, workspace-scoped UNION lookup, 302 routing)"
  - "Angie s.go virtual host rewriting /{code} -> backend /r/{code}"
  - "Next.js /{locale}/dashboard/claim/{code} wizard + multi-match picker"
affects:
  - backend/internal/api/router.go
  - docker/angie/angie.conf
key-files:
  created:
    - backend/internal/domain/shortlink/handler.go
    - backend/internal/domain/shortlink/handler_test.go
    - backend/internal/infra/postgres/shortlink_repository.go
    - frontend/app/[locale]/(dashboard)/dashboard/claim/[code]/page.tsx
  modified:
    - backend/internal/api/router.go
    - docker/angie/angie.conf
    - frontend/messages/en.json
decisions:
  - "Multi-match encoding: comma-joined `type:id` triples, url.QueryEscaped — decoded identically on both backend and claim page"
  - "Locale resolution: NEXT_LOCALE cookie -> first Accept-Language tag -> en, sanitized to lowercase alpha"
  - "Route registered at top-level chi (off /api workspace tree), reads access_token cookie inline (NOT behind JWTAuth JSON-401 middleware)"
metrics:
  duration: ~30 min
  completed: 2026-06-07
---

# Phase quick-260607-uzt: s.go QR Shortlink Redirect Summary

End-to-end `s.go/<short_code>` QR redirect: a public Go `GET /r/{code}` handler that
authenticates via the `access_token` cookie, scopes a UNION lookup
(items→containers→locations, item-first) to all of the authed user's workspaces and
302-redirects to the matching dashboard page (or a claim wizard on no-match / a picker on
multi-match); an Angie `s.go` virtual host that rewrites `/{code}` → `/r/{code}`; and a
Next.js claim wizard page with prefilled create actions plus a multi-match picker.

## Tasks Completed

| Task | Name | Commit | Key files |
| ---- | ---- | ------ | --------- |
| 1 | Backend handler + repo + route + Go test | `238b5f3` | shortlink/handler.go, handler_test.go, postgres/shortlink_repository.go, api/router.go |
| 2 | Angie s.go virtual host | `0077d70` | docker/angie/angie.conf |
| 3 | Next.js claim wizard page | `5bf3fb5` | claim/[code]/page.tsx, messages/en.json |

## What Was Built

### Task 1 — Backend `GET /r/{code}`
- `shortlink.Handler.Redirect` (raw chi handler, mirrors `oauth.Handler.Initiate`):
  reads the `access_token` cookie INLINE and validates via `jwt.Service.ValidateToken`
  (the handler depends on a `JWTValidator` interface satisfied by `*jwt.Service`). On
  missing/invalid/expired token → 302 to `/{locale}/login?next=/r/{code}` (next is a
  fixed server-built internal path → closes open-redirect T-uzt-04).
- On success: `claims.UserID` → `workspace.Service.GetUserWorkspaces` (via `WorkspaceLister`
  interface) → collect `[]uuid.UUID` → `Resolver.Resolve`.
  - 1 match: item → `/{locale}/dashboard/items/{id}`; container →
    `containers?focus={id}`; location → `locations?focus={id}`.
  - 0 matches → `/{locale}/dashboard/claim/{code}`.
  - >1 match → `claim/{code}?matches=<encoded>`.
- Locale resolver: `NEXT_LOCALE` cookie → first `Accept-Language` tag → `en`, sanitized.
- `postgres.ShortlinkRepository.Resolve`: single `UNION ALL` across `warehouse.items`,
  `warehouse.containers`, `warehouse.locations` with a literal `sort_key` (0 item / 1
  container / 2 location) so item rows sort first; `WHERE short_code = $1 AND
  workspace_id = ANY($2)`, `$2` bound as a native pgx `[]uuid.UUID` (parameterized —
  mitigates T-uzt-02 cross-tenant leak + T-uzt-03 injection). Empty workspace set
  short-circuits to no matches.
- Route registered with `r.Get("/r/{code}", shortlinkHandler.Redirect)` at the TOP-LEVEL
  chi router (next to the public `/auth/oauth/{provider}` route), OFF the
  `/workspaces/{workspace_id}` tree and NOT behind `appMiddleware.JWTAuth`.
- 10 handler tests (fake `Resolver` + fake `WorkspaceLister` + real `jwt.Service`):
  no-cookie login redirect, invalid-token login redirect, single item/container/location
  Location values, not-found → claim, multi-match picker (with matches blob round-trip
  assertion), locale-from-cookie, locale-from-Accept-Language, workspace-lookup-error
  fallback.

### Task 2 — Angie `s.go` virtual host
- Two new `server_name s.go;` blocks (`:80` and `:443 ssl`, TLS certs reused) each with
  `location / { rewrite ^/(.+)$ /r/$1 break; proxy_pass http://backend; }` and
  `include /etc/angie/proxy_params.conf`. Reuses the existing `upstream backend`.
- Existing `server_name _` blocks untouched. The `s.go` block does not proxy `/api` or
  `/workspaces` — only the bare-code rewrite. DNS for `s.go` noted out of scope.

### Task 3 — Next.js claim wizard page
- `"use client"` page using `useParams` / `useSearchParams` / `useRouter` / `useTranslations`.
- Default (no `matches`): three create actions (Item / Location / Container) with the code
  shown prominently in a mono Badge.
- Multi-match (`?matches` present): decodes the comma-joined `type:id` triples (in sync
  with `shortlink.encodeMatches`) into a picker; each row links to the same dashboard
  target the backend would have used (item detail / `containers?focus=` / `locations?focus=`).
- Added `claim` i18n namespace to `messages/en.json` (English sufficient per quick-task scope).

## Build-Time Verification (Task 3 constraint)

Per the explicit constraint, the locations/containers create mechanism was verified at
build time before choosing prefill targets:
- `locations/page.tsx` and `containers/page.tsx`: creation is triggered by a LOCAL
  `dialogOpen` React state via `openCreateDialog()` from an "Add" button. There is **no**
  `/new` route and **no** `?create` / `?short_code` search param that auto-opens the
  dialog or prefills the Short Code field.
- `items/new` route exists and renders `CreateItemWizard`, whose schema/form has a
  `short_code` field, but the wizard does **not** read a `short_code` (or `barcode`)
  search param from the URL.

Targets chosen accordingly:
- Item → `/dashboard/items/new?short_code={code}` (real route).
- Location → `/dashboard/locations?create=1&short_code={code}` (list page; no /new route).
- Container → `/dashboard/containers?create=1&short_code={code}` (list page; no /new route).

The code is always displayed prominently so the user can paste it into the dialog's Short
Code field; a hint string explains this for locations/containers.

## Known Stubs / Wiring Gaps

These are intentional and documented (not silent stubs):
1. **Item create prefill not auto-applied.** `CreateItemWizard` does not yet read the
   `short_code` search param, so `?short_code={code}` is carried on the URL but the field
   is not auto-filled. Per the plan ("pass it on the URL anyway and note the wiring gap
   rather than editing the wizard"), the wizard was left untouched. A follow-up could add
   `useSearchParams` → `createItemDefaults.short_code` in `create-item-wizard/index.tsx`.
2. **Location/Container dialog auto-open not wired.** `?create=1&short_code={code}` is
   carried to the list pages, but neither list page reads these params today, so the
   dialog does not auto-open and the field is not prefilled. The claim page surfaces the
   code prominently + a hint so the flow still completes manually. Wiring would require a
   `useSearchParams`-driven `openCreateDialog` + `setFormShortCode` on each list page.

These gaps do not block the plan's core goal (a scan lands the user on the right entity, or
on a claim surface that shows the code) — they only affect zero-click prefill convenience.

## Deviations from Plan

None requiring auto-fix rules. The plan anticipated the items/locations/containers prefill
wiring gaps and explicitly instructed to leave the wizards/list pages untouched and document
the gaps — done above. No Rule 1/2/3 auto-fixes; no Rule 4 checkpoint.

## SQL Coverage Note

Per the plan's allowance, the repository `UNION ALL` SQL is **not** covered by an
automated integration test (the existing `tests/testdb` harness would require seeding three
tables across two workspaces and was out of the quick-task budget). The handler branches are
fully covered with a fake `Resolver`. The SQL is straightforward parameterized pgx and
should be verified manually against the dev DB (scan an owned item/container/location code).

## Threat Surface

All threat-register mitigations (T-uzt-01..04) are implemented as designed: cookie-validated
auth (no anonymous resolution), workspace-scoped parameterized lookup, parameterized `{code}`,
and server-built fixed redirect targets. No new package installs (T-uzt-SC: accept). No new
threat surface beyond the plan's `<threat_model>`.

## Verification

- `cd backend && go build ./...` — clean.
- `go test ./internal/domain/shortlink/... -count=1` — `ok` (10 tests pass).
- `grep -A6 'server_name s.go' docker/angie/angie.conf` — confirms rewrite to `/r/` +
  `proxy_pass http://backend`.
- `npx tsc --noEmit` — 0 errors project-wide; none reference the claim page.
- `npx eslint <claim page>` — clean.

## Self-Check: PASSED

- backend/internal/domain/shortlink/handler.go — FOUND
- backend/internal/domain/shortlink/handler_test.go — FOUND
- backend/internal/infra/postgres/shortlink_repository.go — FOUND
- frontend/app/[locale]/(dashboard)/dashboard/claim/[code]/page.tsx — FOUND
- docker/angie/angie.conf (s.go block) — FOUND
- Commits 238b5f3, 0077d70, 5bf3fb5 — all present in git log.
