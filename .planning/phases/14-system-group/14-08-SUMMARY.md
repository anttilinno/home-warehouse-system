---
phase: 14-system-group
plan: 08
subsystem: ui
tags: [react-router, routing, navigation, sidebar, lingui, retro-os]

# Dependency graph
requires:
  - phase: 14-01
    provides: ApprovalsPage (named export @/features/approvals/ApprovalsPage)
  - phase: 14-02
    provides: MyChangesPage (named export @/features/my-changes/MyChangesPage)
  - phase: 14-03
    provides: WishlistPage (named export @/features/wishlist/WishlistPage)
  - phase: 14-04
    provides: DeclutterPage (named export @/features/declutter/DeclutterPage)
  - phase: 14-05
    provides: ImportsPage (named export @/features/imports/ImportsPage)
  - phase: 14-06
    provides: "SyncHistoryPage (named export @/features/system-history/Page — sync-free path, FOUND-02)"
provides:
  - "Six authenticated routes mounted under the RequireAuth/AppShell branch: /approvals, /my-changes, /sync-history, /imports, /wishlist, /declutter"
  - "Sidebar // SYSTEM group surfaces the six new pages as wired NavItems"
  - "Previously-disabled Settings NavItem now wired to /settings"
  - "Phase 13's PendingApprovalsPanel 'Review' link now resolves to the real /approvals page"
affects: [14-system-group verifier, frontend2 navigation, settings]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Eager static route imports for light pages (tables/forms) — wrong path/name fails at tsc/build, not runtime (T-14-22)"
    - "sync-free import specifier for SyncHistoryPage (@/features/system-history/Page) to clear the FOUND-02 lint:imports substring guard while keeping the /sync-history route URL"

key-files:
  created:
    - .planning/phases/14-system-group/14-08-SUMMARY.md
  modified:
    - frontend2/src/routes/index.tsx
    - frontend2/src/components/layout/Sidebar.tsx
    - frontend2/src/components/layout/Sidebar.test.tsx

key-decisions:
  - "Imported SyncHistoryPage from @/features/system-history/Page (NOT @/features/sync-history/...) — any specifier containing the `sync` substring trips the FOUND-02 lint:imports guard (per 14-06-SUMMARY)"
  - "Wired Settings NavItem to /settings — the /settings index route has existed since Phase 12 (routes/index.tsx line 203); 14-CONTEXT sanctions folding the still-unwired Settings nav here"
  - "All six new pages imported EAGERLY (not React.lazy) — they pull no heavy chart/scanner chunk; only /scan + /analytics stay lazy"
  - "Updated the co-located Sidebar.test.tsx (single-writer pair's own test surface) — its disabled-item exemplar was Settings, whose contract this plan intentionally flips (Rule 1)"

patterns-established:
  - "Single-writer wiring plan: routes/index.tsx + Sidebar.tsx extended with minimal diffs, no rewrite"

requirements-completed: [SYS-01, SYS-02, SYS-03, SYS-04, WISH-01, WISH-02, DECL-01, DECL-02]

# Metrics
duration: 12min
completed: 2026-06-13
---

# Phase 14 Plan 08: Wiring — Routes + Sidebar SYSTEM Group Summary

**Mounted the six Phase-14 System pages in the route table and surfaced them (plus a now-wired Settings nav) in the Sidebar // SYSTEM group — the single-writer wiring plan that makes all eight Phase-14 requirements reachable from router and nav.**

## Performance

- **Duration:** ~12 min
- **Tasks:** 2 completed
- **Files modified:** 3 (routes/index.tsx, Sidebar.tsx, Sidebar.test.tsx)

## Accomplishments

### Task 1 — Routes (`frontend2/src/routes/index.tsx`)
Added six eager top-level imports and six literal routes inside the authenticated
`<Route element={<RequireAuth><AppShell/></RequireAuth>}>` branch, placed after `claim/:code`
and before the settings block:

| Route URL | Element | Import |
|-----------|---------|--------|
| `/approvals` | `<ApprovalsPage/>` | `@/features/approvals/ApprovalsPage` |
| `/my-changes` | `<MyChangesPage/>` | `@/features/my-changes/MyChangesPage` |
| `/sync-history` | `<SyncHistoryPage/>` | `@/features/system-history/Page` (sync-free) |
| `/imports` | `<ImportsPage/>` | `@/features/imports/ImportsPage` |
| `/wishlist` | `<WishlistPage/>` | `@/features/wishlist/WishlistPage` |
| `/declutter` | `<DeclutterPage/>` | `@/features/declutter/DeclutterPage` |

All six are literal segments (no params → no ordering hazard) inside the auth branch, so they inherit
RequireAuth (T-14-21) and precede the `*` wildcard. Eager imports mean a wrong path/name fails at
tsc/build time (T-14-22). `/scan` + `/analytics` left lazy; the settings block untouched.

Commit: `3f81a039`

### Task 2 — Sidebar SYSTEM group (`frontend2/src/components/layout/Sidebar.tsx`)
Added six wired NavItems to the `// SYSTEM` NavGroup with distinct retro glyphs and `<Trans>` labels,
and wired the previously-disabled Settings NavItem:

| Glyph | Label | `to` |
|-------|-------|------|
| ✓ | Approvals | `/approvals` |
| ≣ | My Changes | `/my-changes` |
| ♡ | Wishlist | `/wishlist` |
| ⊘ | Declutter | `/declutter` |
| ↥ | Imports | `/imports` |
| ⇄ | Sync History | `/sync-history` |
| ⚙ | Settings | `/settings` (newly wired) |

Scan (wired) and the DEV-only Demo item retained. No new query/hook added — wiring stays
side-effect-free (no count badge). Overview/Inventory groups and the NavGroup/NavItem components unchanged.

Commit: `761c2b8d`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated co-located Sidebar.test.tsx to match the sanctioned Settings-wiring change**
- **Found during:** Task 2 (`bun run test src/components/layout`)
- **Issue:** `Sidebar.test.tsx` used the disabled Settings NavItem as its "not-built / aria-disabled" exemplar (`expect(settings).toHaveAttribute("aria-disabled","true")`). The plan explicitly mandates wiring Settings to `/settings`, so that assertion necessarily failed (1 of 82 tests). The test file is the single-writer pair's own co-located test (component test for Sidebar.tsx), not a feature file.
- **Fix:** Replaced the stale disabled-Settings assertion with (a) a test asserting Settings is now a `/settings` link with no `aria-disabled`, and (b) a new test asserting all six Phase-14 System NavItems are wired to their routes. After wiring, no disabled NavItems remain in SYSTEM (Demo renders with `to="/demo"` in test/DEV env), so the original disabled-item scenario no longer exists by design.
- **Files modified:** frontend2/src/components/layout/Sidebar.test.tsx
- **Commit:** 761c2b8d

## Verification

- `bun run lint:tsc` — clean (NOT bare tsc).
- `bun run lint:imports` — **OK (green)** — the `sync`-free `@/features/system-history/Page` specifier clears the FOUND-02 substring guard; the `/sync-history` route URL string is a Route path, not an import specifier, so it is unaffected.
- `bun run test` — **1077 passed / 168 files** (layout subset: 83 passed / 11 files).
- `bun run build` — built OK (the >500 kB chunk advisory is pre-existing and out of scope — no heavy chunk added here).
- Grep confirms six `path="…"` routes inside the auth branch and seven `to="/…"` System NavItems including `to="/settings"`.

Live-E2E sanity (route reachability): the eager static imports + passing tsc/build guarantee `/approvals` and `/wishlist` resolve to their real page components (`ApprovalsPage`, `WishlistPage`) inside the RequireAuth/AppShell branch rather than the `*` `PlaceholderShell`; the Sidebar System group renders the six wired NavItems + the wired Settings nav (asserted by the new Sidebar.test.tsx route-wiring test). Phase 13's PendingApprovalsPanel "Review" link (→ `/approvals`) now resolves to the real page.

## Known Stubs

None — this is a pure wiring plan; all six target pages are real Wave-1 components, no placeholders introduced.

## Self-Check: PASSED

- FOUND: frontend2/src/routes/index.tsx (six routes registered)
- FOUND: frontend2/src/components/layout/Sidebar.tsx (System group + wired Settings)
- FOUND: frontend2/src/components/layout/Sidebar.test.tsx (updated)
- FOUND commit 3f81a039 (Task 1)
- FOUND commit 761c2b8d (Task 2)
