# v3.0 Carry-Forward Audit

**Date:** 2026-05-01
**Wipe SHA:** verify with `git log --oneline -- frontend2/ | grep -i 'wipe\|abandon\|reset' | head -3`
**v2.1 archive root:** `.planning/milestones/v2.1-phases/`
**v2.2 abandoned phases:** `.planning/milestones/v2.2-phases-abandoned/`

## Purpose

This document is the FOUND-03 deliverable. Downstream phase planners (Phase 2-17) read this audit to avoid re-deciding ported items and to know which v2.1 archive sources are canonical. Every "Port Verbatim" row cites a v2.1 source SHA executable via `git show <SHA>:<path>`.

## Port Verbatim (FOUND-03 — exactly five items)

| # | Item | Source (git show) | Destination | Notes |
|---|------|-------------------|-------------|-------|
| 1 | Auth flow (cookie-JWT, single-flight 401 refresh, FormData multipart) | `git show 3826d24:frontend2/src/lib/api.ts` MERGED with `git show 4d4c233:frontend2/src/lib/api.ts` (FormData edit from Plan 56-01) | `frontend2/src/lib/api.ts` (already ported in Plan 01-01) | Pitfall #10 / AP-2 — do NOT regress to localStorage Bearer; locked invariants: `credentials: "include"` on every fetch; module-level `refreshPromise` singleton; `isFormData` Content-Type bypass |
| 2 | OAuth callback handler | Search `.planning/milestones/v2.1-phases/` for the AuthCallbackPage; v2.1 plan 49-01 lineage. Concrete SHA TBD by Phase 5 planner via `git log --oneline -- frontend2/src/features/auth/AuthCallbackPage.tsx`. | `frontend2/src/features/auth/AuthCallbackPage.tsx` | Phase 5 ports; Plan 01 reserves the path. Carries Google + GitHub OAuth code-exchange flow (one-time Redis exchange per AUTH-03/04). |
| 3 | Format hooks — `useDateFormat`, `useTimeFormat`, `useNumberFormat` | v1.6 Format Personalization milestone shipped these (Phases 30-34). v2.1 ported them; concrete SHAs TBD by Phase 12 planner. | `frontend2/src/hooks/useDateFormat.ts`, `useTimeFormat.ts`, `useNumberFormat.ts` | Phase 12 (Settings hub) ports; Plan 01 reserves the path. CI grep guard in Phase 15 forbids raw `Date.toString()` / `Number.toLocaleString()` in feature code. |
| 4 | Playwright auth helper | CLAUDE.md project-root §E2E Tests (auth contract: `^LOG IN$` exact match + access_token cookie inheritance) + `git show 5e77f98:frontend2/e2e/scan-lookup.spec.ts` (auth seed section as reference for refactoring into a shared helper) | `frontend2/e2e/_helpers/auth.ts` (NEW shared helper, extracted on first E2E spec) | Specs that use this helper drop into `frontend2/e2e/*.spec.ts`. The contract is the helper's API surface; CLAUDE.md is the source of truth. |
| 5 | `scripts/check-forbidden-imports.mjs` | EXISTING at `scripts/check-forbidden-imports.mjs` (verified working 2026-05-01 by reading source) | unchanged path (no move) | Wired into CI by Plan 01-02 (`.github/workflows/lint-frontend2.yml`). Self-tests at `scripts/__tests__/check-forbidden-imports.test.mjs`. Default scan root: `<repo>/frontend2/src`. Forbidden patterns: `^(?:idb|serwist|@serwist/.+)$/i` (exact) + `/(offline|sync)/i` (substr). |

## Rebuild from Scratch (FOUND-03 — exactly four concepts)

| # | Concept | Why Rebuild | Target Phase |
|---|---------|-------------|--------------|
| 1 | Chrome — TopBar / Sidebar / Bottombar / PageHeader | Sketch 005 premium-terminal fidelity is new; v2.1 chrome was partial (no Bottombar; no `// GROUP` sidebar labels; no SESSION/LAST SYNC meta) | Phase 3 |
| 2 | Retro atoms — Panel / Button / Badge / Input / Select / Combobox / Textarea / Checkbox / FileInput / FormField / Table family / Tabs / Dialog / ConfirmDialog / Toast / EmptyState / Pagination / StatusDot / HUD primitives | Visual re-derivation per sketch 005 + new constraints from Phase 3 layout (modal-stack ESC, status pills, tabular-nums, SSE live-dot in panel headers) | Phase 4 |
| 3 | Layout grid + design tokens (palette, typography, scanline body overlay, radius=0 sharp corners, JetBrains Mono Variable) | Token system locked from sketches 001-005; v2.1 used a different (retro-cream) palette | Phase 2 |
| 4 | Provider stack composition (IntlProvider + QueryClientProvider + AuthProvider + SSEProvider + ToastProvider + ShortcutsProvider + BrowserRouter in canonical order per PROV-01) | Some providers are new for v3.0 (ShortcutsProvider, SSEProvider with `useSSEStatus()` selector, ToastProvider mounted as sonner) | Phase 6 |

## Backend Endpoint Specs (D-10 / D-11 — for Phase 13 Dashboard HUD)

Per locked decisions D-09..D-11 (no feature flag — there is no production environment), Phase 13 ships the HUD row directly. The two new backend endpoints are documented here so Phase 13 planning can scope them; the endpoints themselves are built as part of Phase 13 (or an adjacent backend task before Phase 13).

### `GET /api/workspaces/{wsId}/stats/capacity`

**Response shape:**
```json
{ "total_items": 1234, "capacity_target": 5000 }
```
or, when no warehouse-capacity feature exists yet:
```json
{ "total_items": 1234, "capacity_target": null }
```

**Notes:**
- `capacity_target = null` is the empty state until a warehouse-capacity feature ships (deferred to v3.1+).
- Used by HUD capacity gauge (DASH-04, Phase 13).
- Workspace-scoped per existing REST convention; ASVS V4 access control inherits from the rest of `/api/workspaces/{wsId}/*`.

### `GET /api/workspaces/{wsId}/stats/activity?days=14`

**Response shape:**
```json
{ "days": [{ "date": "2026-04-18", "count": 12 }, { "date": "2026-04-19", "count": 7 }] }
```

**Notes:**
- 14 days ending today (UTC).
- Zero-fill missing days (a day with no events still appears with `count: 0`).
- `count` = item-mutation events (create + update + archive). Definition refined by Phase 13 backend task.
- Used by HUD 14-day activity sparkline (DASH-04, Phase 13). Hand-rolled SVG (no charting library — see Out of Scope).

## Out of Scope (Reaffirmed)

- **IndexedDB / Serwist / offline / sync*** — CI grep guard at `scripts/check-forbidden-imports.mjs` enforces. Plan 01-02 wires the merge gate.
- **Lingui v5 macros** — replaced by Plan 01-03 spike winner. See `.planning/research/I18N-DECISION.md` for verdict + evidence.
- **v2.1 retro atom files** — component-by-component re-derivation per Phase 2-4.
- **Mobile FAB on `>=768px` viewports** — locked by D-06 (FAB is mobile-only).
- **Bottombar on `<768px` viewports** — locked by D-05 (Bottombar is desktop-only).
- **Dashboard HUD feature flag** — D-09: ships unflagged (no prod env to gate against).
- **Charting libraries (Recharts, Chart.js, Tremor)** — hand-rolled SVG for HUD per REQUIREMENTS.md Out of Scope.
- **Animation libraries (motion, framer-motion)** — fight the locked 80ms CSS transitions.

## Reserved Env Vars

These exist for downstream phases; Plan 01 reserves the names but does not yet consume them:
- `E2E_USER`, `E2E_PASS` — Playwright seeder credentials per CLAUDE.md
- `E2E_BASE_URL` — Playwright baseURL override
- `TEST_DATABASE_URL` — Go integration test harness override (Phase 17 + future plan-65-11-style regression tests)

## Cross-References

- Plan 01-01 — scaffold + lib/api.ts + lib/queryClient.ts ports (Port Verbatim row 1 + row 5)
- Plan 01-02 — CI workflow wiring (Port Verbatim row 5; FOUND-02)
- Plan 01-03 — i18n spike + decision + winner install (FOUND-04)
- Plan 01-04 — this document (FOUND-03 + FOUND-05 + FOUND-06)

---

*Audit completed: 2026-05-01*
*Next read by: Phase 2 planner (tokens), Phase 3 planner (chrome), Phase 5 planner (auth + OAuth callback port), Phase 12 planner (format hooks port), Phase 13 planner (HUD endpoints).*
