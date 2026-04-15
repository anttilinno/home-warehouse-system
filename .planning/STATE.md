---
gsd_state_version: 1.0
milestone: v2.1
milestone_name: Feature Parity — Items, Loans & Scanning
status: idle
stopped_at: Phase 57 complete — human checkpoint approved
last_updated: "2026-04-15"
last_activity: 2026-04-15 -- Phase 57 complete (9 retro form primitives, 118 tests, Lingui catalogs)
progress:
  total_phases: 7
  completed_phases: 7
  total_plans: 19
  completed_plans: 19
  percent: 100
---

# Project State: Home Warehouse System

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-04-14)

**Core value:** Reliable inventory access anywhere -- online or offline -- with seamless sync
**Current focus:** Phase 56 — foundation-api-client-and-react-query (next)

## Current Position

Phase: 57 (retro-form-primitives) — COMPLETE
Plan: 3 of 3
Status: Phase 57 complete — ready for Phase 56
Last activity: 2026-04-15 -- Phase 57 complete (9 retro form primitives, 118 tests, Lingui catalogs)

## Performance Metrics

**Velocity:**

- Total plans completed: 148
- Average duration: ~15 min per plan
- Total execution time: ~37 hours

**By Milestone:**

| Milestone | Phases | Plans | Status |
|-----------|--------|-------|--------|
| v1 | 5 | 14 | Complete |
| v1.1 | 6 | 12 | Complete |
| v1.2 | 6 | 19 | Complete |
| v1.3 | 4 | 22 | Complete |
| v1.4 | 5 | 20 | Complete |
| v1.5 | 3 | 9 | Complete |
| v1.6 | 5 | 9 | Complete |
| v1.7 | 5 | 7 | Complete |
| v1.8 | 3 | 7 | Complete |
| v1.9 | 5 | 9 | Complete |
| v2.0 | 8 | 18 | Complete |
| v2.1 | 8 | TBD | Planning |

## Accumulated Context

### Decisions

- v2.0: React Router v7 library mode (not framework mode) -- SPA sufficient, no SSR needed
- v2.0: Lingui v5 for i18n -- compile-time catalogs, EN + ET to start
- v2.0: Fully custom component library -- shadcn/ui fights retro aesthetic
- v2.0: Online-only for this milestone -- reduces 30-40% complexity
- v2.0: HttpError class in api.ts -- callers distinguish HTTP status codes from network failures
- v2.0: AuthContext guards on HttpError 401/403 only -- transient network errors don't clear session
- v2.0: All retro component imports consolidated to @/components/retro barrel
- v2.1: Online-only, lean implementation -- match v2.0 approach, no offline/PWA
- v2.1: TanStack Query for server state -- centralised cache, per-entity mutation hooks with invalidation
- v2.1: react-hook-form + zod via RetroFormField -- standard form substrate before any CRUD
- v2.1: Photos via native FormData + fetch multipart -- no extra upload library
- v2.1: Barcode scanning deferred to v2.2 -- out of scope for this milestone
- v2.1: CI grep guard in frontend2 -- fail on idb/serwist/offline/sync imports

### Pending Todos

- [ ] Plan Phase 56 (Foundation — API Client & React Query)
- [ ] Resolve pagination envelope per endpoint (cursor vs page/pageSize)
- [ ] Confirm backend itemphoto max size limit
- [ ] Confirm canonical barcode lookup path (v2.2 prep)
- [ ] Confirm @yudiel/react-qr-scanner@2.5.1 React 19 peerDep (v2.2 prep)
- [ ] Confirm cascade policy for category/location delete (block vs cascade vs un-set)

### Blockers/Concerns

- None for v2.1 start — backend endpoints all exist

## Session Continuity

Last session: 2026-04-15T14:22:02.857Z
Stopped at: Phase 57 UI-SPEC approved
Next step: `/gsd-plan-phase 56`

---
*Updated: 2026-04-14 after v2.1 roadmap definition*
