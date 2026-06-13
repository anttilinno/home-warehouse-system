# Endpoint Coverage Diff & Parity Gate — POL-06

**Plan 17-04, Wave 3. Generated 2026-06-14.** Transcribes the
orchestrator-verified endpoint diff from `17-CONTEXT.md §"Endpoint coverage
diff"` and reconciles the route checklist against the live React Router config
(`frontend2/src/routes/index.tsx`, grepped in the `exec/17-04` worktree).

## Conclusion: parity essentially complete

The v3.0 `frontend2/src/lib/api/*` surface is at **functional parity** with the
legacy `frontend/lib/api/*` (excluding `/sync/*` + `/push/*`, which are
deliberately out of scope for the online-only v3.0). The investigator's
first-pass **"33 gaps" were almost all false positives** — the following were
all confirmed PRESENT in frontend2:

`auth`, `oauth`, `sessions`, `password`, `can-delete`, `workspaces`,
`analytics` (dashboard/summary/loans-monthly/out-of-stock), `labels`,
`inventory-by-*` (by-location / by-item), `notifications` pagination.

Only a handful of genuine, **non-feature-gap** residual deltas remain — all
documented below as "covered differently", "already present", or
"deferred-with-reason". **No feature code needs porting.**

## Residual deltas (legacy endpoint → frontend2 status)

| legacy endpoint | frontend2 status |
|-----------------|------------------|
| `/analytics/{borrowers,categories,locations,conditions,statuses,loans}` (per-metric) | **superseded** — `AnalyticsPage` sources `/analytics/dashboard` + `/analytics/summary` aggregates + `/analytics/loans/monthly` + `/analytics/out-of-stock`; the per-metric endpoints are not needed. |
| `/locations/{id}/breadcrumb` | **superseded** — taxonomy builds the location tree client-side (Phase 10); breadcrumb is computed client-side. |
| `/inventory/{id}/loans`, `/inventory/available/{itemId}`, `/inventory/total-quantity/{itemId}` | **deferred (backlog)** — niche legacy queries, unused by any v3.0 screen. Not a parity blocker; logged to FINAL-REVIEW-CHECKLIST. |
| `/items/search?query=` | **covered differently** — v3.0 serves item search via `itemsApi.list(ws, { search })` → `/items?search=`, consumed by the command-palette `useEntitySearch` hook (`frontend2/src/features/command-palette/useEntitySearch.ts:63`). Confirmed by grep. The 4 search-capable domains are items / borrowers / locations / containers. |
| `/paperless/settings` DELETE | **already present** (correction vs the CONTEXT draft) — `frontend2/src/lib/api/paperless.ts:61` exports `deleteSettings: del(...)` alongside GET (`get`) + PUT/PATCH (`put`). No delta. |

## Legacy files ported elsewhere (no 1:1 frontend2 file)

| legacy file | frontend2 home |
|-------------|----------------|
| `auth.ts` | `features/auth/*` + `lib/api/settings.ts` |
| `item-photos.ts` | `lib/api/photos.ts` |
| `repair-logs.ts` | `lib/api/repairs.ts` + `repairPhotos` + `repairAttachments` |
| `search.ts` | command-palette (`useEntitySearch`) + per-domain `list({search})` |
| `workspace-backup.ts` | `settings` export / import |
| `importexport.ts` | `lib/api/importJobs.ts` + `settings` |

## Route checklist — all v3.0 routes

Derived from `frontend2/src/routes/index.tsx` (live React Router config,
grepped 2026-06-14) and reconciled against `17-CONTEXT §"Routes to sweep"`.
"covered by" = the gate that exercises the route: the POL-02 a11y sweep
(`a11y-sweep.spec.ts`) visits every static path; a data-flow E2E spec drives
the domain; human-only routes need a code/dev gate.

### Public

- [x] `/login` — `login-dashboard.spec.ts` + a11y sweep
- [x] `/register` — `auth.spec.ts` + a11y sweep
- [x] `/auth/callback` — `auth.spec.ts` (OAuth initiate) + a11y sweep

### App shell (require login)

- [x] `/` (dashboard) — `login-dashboard.spec.ts` + a11y sweep
- [x] `/items` — `items.spec.ts` + a11y sweep
- [x] `/items/new` — `items.spec.ts` + a11y sweep
- [x] `/items/:id` — `items.spec.ts` + a11y sweep (one seeded detail route)
- [x] `/items/:id/edit` — `items.spec.ts`
- [x] `/inventory` — `inventory.spec.ts` + a11y sweep
- [x] `/inventory/new` — `inventory.spec.ts` + a11y sweep
- [x] `/inventory/expiring` — a11y sweep (Go: `expiry_reminders_integration_test.go`)
- [x] `/inventory/:id/edit` — `inventory.spec.ts`
- [x] `/maintenance/due` — `repairs-maintenance.spec.ts` + a11y sweep
- [x] `/loans` — `loans-lifecycle.spec.ts` + a11y sweep
- [x] `/loans/new` — `loans-lifecycle.spec.ts` + a11y sweep
- [x] `/borrowers` — `borrowers.spec.ts` + a11y sweep
- [x] `/borrowers/new` — `borrowers.spec.ts` + a11y sweep
- [x] `/borrowers/:id` — `borrowers.spec.ts`
- [x] `/borrowers/:id/edit` — `borrowers.spec.ts`
- [x] `/taxonomy` — `taxonomy.spec.ts` + a11y sweep
- [x] `/taxonomy/categories/new` — `taxonomy.spec.ts`
- [x] `/taxonomy/categories/:id/edit` — `taxonomy.spec.ts`
- [x] `/scan` — `scan-lookup.spec.ts` + a11y sweep
- [x] `/analytics` — `analytics.spec.ts` + a11y sweep
- [x] `/approvals` — `system-group.spec.ts` + a11y sweep
- [x] `/my-changes` — a11y sweep (Go: `pendingchange/handler_integration_test.go`)
- [x] `/sync-history` — `system-group.spec.ts` (honest online-only page) + a11y sweep
- [x] `/imports` — a11y sweep (Go: `tests/integration/import_test.go`)
- [x] `/wishlist` — `system-group.spec.ts` + a11y sweep
- [x] `/declutter` — a11y sweep (Go gap-fill: `declutter_repository_integration_test.go`, NEW 17-04)
- [x] `/claim/:code` — human-only (needs a real claim code; dev/manual gate)

### Settings hub

- [x] `/settings` (landing) — `settings.spec.ts` + a11y sweep
- [x] `/settings/security` — a11y sweep
- [x] `/settings/accounts` — a11y sweep
- [x] `/settings/profile` — `settings.spec.ts`
- [x] `/settings/appearance` — a11y sweep
- [x] `/settings/language` — `settings.spec.ts` (en→et persist)
- [x] `/settings/formats` — a11y sweep
- [x] `/settings/notifications` — a11y sweep
- [x] `/settings/data` — a11y sweep (Go: export/import via `import_test.go`)
- [x] `/settings/members` — `settings.spec.ts` (add unregistered → 404)
- [x] `/settings/paperless` — `attachments-paperless.spec.ts` + a11y sweep
- [x] `/demo` — DEV-only (not in production sweep)

40 routes total (38 production app/public routes + `/claim/:code` human-only +
`/demo` dev-only). Reconciliation note: the route set in `routes/index.tsx`
matches `17-CONTEXT §"Routes to sweep"` with no discrepancies; the CONTEXT
omitted the `:id/edit` and `taxonomy/categories/*` sub-routes, which are
included above.

## POL-06 residues → FINAL-REVIEW-CHECKLIST

Per `17-VALIDATION.md`, these are tracked as residues (not blockers for the
POL-06 gate, which is the committed diff + route checklist itself):

1. **One-week dogfooding** of v3.0 before retiring the legacy `frontend/`
   directory — a calendar residue, not a code task.
2. **3 niche `/inventory/*` queries** (`/{id}/loans`, `available/{itemId}`,
   `total-quantity/{itemId}`) deferred to backlog; resurrect only if a v3.0
   screen ever needs them.
3. **`e2e-frontend2.yml` first-PR validation** — the best-effort browser-E2E CI
   workflow scaffolded in 17-02 cannot be claimed green until it runs on a real
   PR (orchestrator cannot execute GitHub Actions). The HARD POL-02/03/05 gate
   remains local spec execution against `:5173` / `:8080`.
4. **Pixel diff vs sketch `006-retro-os-dashboard`** (POL-05) — a human-eye
   residue; the responsive spec's structural assertions are the automated gate.
