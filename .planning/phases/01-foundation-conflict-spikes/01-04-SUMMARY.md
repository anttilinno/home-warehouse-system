---
phase: 01-foundation-conflict-spikes
plan: 04
subsystem: planning
tags: [carry-forward, audit, decisions, dashboard-endpoints, mobile-fab]

requires:
  - phase: 01-foundation-conflict-spikes
    provides: roadmap-defined v3.0 milestone (planned in master commit d719737)
provides:
  - Canonical FOUND-03 carry-forward audit (.planning/research/CARRY-FORWARD.md)
  - Five port-verbatim items with v2.1 source SHAs cited
  - Four rebuild-from-scratch concepts mapped to target phases (P2/P3/P4/P6)
  - Two backend endpoint specs (D-10/D-11) for Phase 13 dashboard HUD
  - Reserved env-var name list for downstream phases (E2E_USER/E2E_PASS/E2E_BASE_URL/TEST_DATABASE_URL)
  - Out-of-scope reaffirmation (IndexedDB/Serwist/Lingui v5/charting libs/animation libs)
  - Specification of seven v3.0 decisions (D-05..D-11) for STATE.md (orchestrator-applied — see "Deferred to Orchestrator" below)
affects:
  - Phase 2 (tokens) — reads layout/tokens rebuild row
  - Phase 3 (chrome + bottombar) — reads chrome rebuild row + D-05/D-06/D-08 (FAB scope)
  - Phase 4 (atoms) — reads retro-atoms rebuild row
  - Phase 5 (auth) — reads OAuth callback row + reserves AuthCallbackPage path
  - Phase 6 (providers) — reads provider-stack rebuild row
  - Phase 12 (settings + format hooks) — reads format-hooks row + reserves hook paths
  - Phase 13 (dashboard) — reads HUD endpoint specs (D-10/D-11) + D-09 (no feature flag)

tech-stack:
  added: []
  patterns:
    - "Carry-forward audit pattern: every port-verbatim row cites a v2.1 source SHA executable via `git show <SHA>:<path>` for tamper-evident traceability"
    - "Rebuild-from-scratch table pattern: each concept names a target phase number for downstream-planner navigation"
    - "Reserved-paths pattern: Phase 1 reserves destination paths (AuthCallbackPage.tsx, useDateFormat.ts, etc.) so downstream phases inherit them without re-deciding location"

key-files:
  created:
    - .planning/research/CARRY-FORWARD.md
  modified: []

key-decisions:
  - "v3.0: Mobile (<768px) renders FAB only, no Bottombar (D-05) -- locks Phase 3 BAR scope"
  - "v3.0: Desktop (>=768px) renders Bottombar only, no FAB (D-06) -- locks Phase 3 BAR scope"
  - "v3.0: FAB exposes context-aware radial menu -- actions adapt per route (D-07)"
  - "v3.0: Bottombar and FAB both consume useShortcuts context as single source of truth (D-08)"
  - "v3.0: Dashboard HUD row ships in Phase 13 WITHOUT feature flag -- no prod env to gate against (D-09)"
  - "v3.0: HUD backend endpoint specs documented in CARRY-FORWARD.md; endpoints built in Phase 13 (D-10)"
  - "v3.0: HUD endpoints -- GET /api/workspaces/{wsId}/stats/capacity + GET /api/workspaces/{wsId}/stats/activity?days=14 (D-11)"

patterns-established:
  - "Carry-forward audit: SHA-cited port table + phase-mapped rebuild table is the SSOT for porting decisions"
  - "Backend endpoint specs documented one milestone ahead of implementation (Phase 1 documents Phase 13 endpoints)"

requirements-completed: [FOUND-03, FOUND-05, FOUND-06]

duration: ~10min
completed: 2026-05-01
---

# Phase 01 Plan 04: Carry-Forward Audit + v3.0 Decisions Lock Summary

**Canonical FOUND-03 carry-forward audit shipped: 5 SHA-cited port-verbatim items + 4 phase-mapped rebuild concepts + Phase 13 HUD endpoint specs (D-10/D-11) — closes FOUND-03/05/06.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-05-01T14:04:00Z
- **Completed:** 2026-05-01T14:14:39Z
- **Tasks:** 1 of 2 executed in worktree (Task 2 deferred to orchestrator — see "Deferred to Orchestrator")
- **Files modified:** 1 created (.planning/research/CARRY-FORWARD.md)

## Accomplishments

- `.planning/research/CARRY-FORWARD.md` created (92 lines) with all five FOUND-03 port-verbatim items numbered 1-5 in a single table:
  1. Auth flow (cookie-JWT, single-flight 401 refresh, FormData multipart) cited at `git show 3826d24:frontend2/src/lib/api.ts` MERGED with `git show 4d4c233:frontend2/src/lib/api.ts`
  2. OAuth callback handler — destination path reserved at `frontend2/src/features/auth/AuthCallbackPage.tsx`; concrete v2.1 SHA deferred to Phase 5 planner per FOUND-03 contract
  3. Format hooks (`useDateFormat`/`useTimeFormat`/`useNumberFormat`) — destination paths reserved under `frontend2/src/hooks/`; concrete v2.1 SHAs deferred to Phase 12 planner
  4. Playwright auth helper — cited via CLAUDE.md project-root §E2E Tests (auth contract: `^LOG IN$` exact match + access_token cookie inheritance) + `git show 5e77f98:frontend2/e2e/scan-lookup.spec.ts`; destination `frontend2/e2e/_helpers/auth.ts`
  5. `scripts/check-forbidden-imports.mjs` — verified existing at unchanged path; CI wiring is Plan 01-02
- All four rebuild-from-scratch concepts numbered 1-4 in a single table mapped to target phases:
  1. Chrome (TopBar / Sidebar / Bottombar / PageHeader) → Phase 3
  2. Retro atoms (Panel / Button / Badge / etc.) → Phase 4
  3. Layout grid + design tokens → Phase 2
  4. Provider stack composition → Phase 6
- Both Phase 13 HUD backend endpoint specs (D-10/D-11) documented with response shapes:
  - `GET /api/workspaces/{wsId}/stats/capacity` → `{ total_items, capacity_target | null }`
  - `GET /api/workspaces/{wsId}/stats/activity?days=14` → `{ days: [{ date, count }] }` with zero-fill UTC convention
- Out-of-scope section reaffirmed (IndexedDB/Serwist offline imports caught by `scripts/check-forbidden-imports.mjs`; Lingui v5 macros replaced by Plan 01-03 spike winner; v2.1 retro atoms re-derived per Phase 2-4; charting/animation libs forbidden)
- Reserved env vars listed (E2E_USER, E2E_PASS, E2E_BASE_URL, TEST_DATABASE_URL)
- Cross-references back to Plans 01-01..01-04

## Task Commits

1. **Task 1: Write CARRY-FORWARD.md** — `95c512f` (docs)
2. **Task 2: Update STATE.md Decisions section with v3.0 D-05..D-11 entries** — DEFERRED to orchestrator (see "Deferred to Orchestrator" section below — full append spec preserved in this SUMMARY for verbatim application)

## Files Created/Modified

- `.planning/research/CARRY-FORWARD.md` — NEW; canonical FOUND-03 carry-forward audit (port-verbatim + rebuild + HUD endpoints + out-of-scope + reserved env vars + cross-refs); 92 lines, 9 numbered table rows (5 port + 4 rebuild)

## Decisions Made

The seven decisions D-05..D-11 are restated in `key-decisions:` frontmatter above and ALSO embedded verbatim in CARRY-FORWARD.md (D-05/D-06 in Out of Scope; D-09/D-10/D-11 in Backend Endpoint Specs). The defense-in-depth across CARRY-FORWARD.md AND STATE.md is the T-04-03 mitigation per the threat model — losing one document does not lose the decision.

## Deviations from Plan

### Task 2 deferred to orchestrator (parallel-execution conflict resolution)

**1. [Rule 4 - Orchestrator-Authority] STATE.md edits deferred from worktree to orchestrator**
- **Found during:** Task 2 start
- **Issue:** Plan Task 2 modifies `.planning/STATE.md` (append seven D-05..D-11 decision lines + frontmatter status update + Session Continuity update). The orchestrator's parallel-execution contract explicitly states: "Do NOT modify STATE.md or ROADMAP.md — the orchestrator owns those writes after all worktree agents in the wave complete." Plan 01-04 was authored before the worktree-mode execution decision; the plan assumed serial execution.
- **Resolution:** Skip the in-worktree STATE.md write to avoid concurrent-write merge conflicts with Wave 1's other parallel plans (Plan 01-01 and possibly others). Preserve the exact append spec in this SUMMARY so the orchestrator (or a follow-up plan) can apply it verbatim post-merge. The decision content itself is NOT lost — it lives in (a) this SUMMARY's `key-decisions:` frontmatter, (b) the `Decisions Made` section, (c) the verbatim spec in "Deferred to Orchestrator" below, and (d) CARRY-FORWARD.md (D-05/D-06 in Out of Scope; D-09/D-10/D-11 in the endpoint specs section).
- **Threat-model impact:** T-04-03 (Tampering on STATE.md to drop D-05..D-08) was already classified `accept` in the plan's threat register because D-05..D-11 are also recorded in CARRY-FORWARD.md (defense in depth). The deferral preserves this mitigation — the decisions exist in two documents.
- **Verification:** `git status --short` confirms STATE.md unmodified in this worktree.
- **Committed in:** N/A — no commit required for a non-write.

---

**Total deviations:** 1 (Rule 4 orchestrator-authority deferral — no scope creep, no content loss)
**Impact on plan:** Plan content fully delivered; only the venue of one append (STATE.md) is moved from worktree to post-merge orchestrator step. FOUND-03/05/06 remain closeable from a verification standpoint (the artifact CARRY-FORWARD.md exists; the decisions are recorded in two places).

## Deferred to Orchestrator

**Action required after Wave 1 worktree merge:** Apply the following append to `.planning/STATE.md` exactly as specified by Plan 01-04 Task 2.

### A. Append seven v3.0 decision lines

In the `### Decisions` section (under `## Accumulated Context`), find the line:
```
- v2.2: Quick Capture included in v2.2 scope -- INT-QC-01..04 in Phase 69
```
and append immediately after it:
```
- v3.0: Mobile (<768px) renders FAB only, no Bottombar (D-05) -- locks Phase 3 BAR scope
- v3.0: Desktop (>=768px) renders Bottombar only, no FAB (D-06) -- locks Phase 3 BAR scope
- v3.0: FAB exposes context-aware radial menu -- actions adapt per route (D-07)
- v3.0: Bottombar and FAB both consume useShortcuts context as single source of truth (D-08)
- v3.0: Dashboard HUD row ships in Phase 13 WITHOUT feature flag -- no prod env to gate against (D-09)
- v3.0: HUD backend endpoint specs documented in CARRY-FORWARD.md; endpoints built in Phase 13 (D-10)
- v3.0: HUD endpoints -- GET /api/workspaces/{wsId}/stats/capacity + GET /api/workspaces/{wsId}/stats/activity?days=14 (D-11)
```

### B. Update frontmatter

- `status:` change from `Roadmap defined; Phase 1 unblocked` to `Phase 1 plans created; ready for execution`
- `stopped_at:` change to `Phase 1 plans created`
- `last_updated:` change to `2026-05-01T14:14:39Z` (or the actual orchestrator-merge timestamp)
- `last_activity:` change to `2026-05-01 -- Phase 1 plans created (4 plans across 2 waves; FOUND-01..06 covered)`

Mirror the same values in the `## Current Position` section.

### C. Append a Session Continuity update line at the end of STATE.md (do NOT replace existing italic update lines — append a new one)

```
*Updated: 2026-05-01 -- Phase 1 planning complete. 4 plans cover FOUND-01 (scaffold), FOUND-02 (CI guard wiring), FOUND-03+05+06 (CARRY-FORWARD.md + STATE.md decisions), FOUND-04 (i18n spike + winner install). Wave 1: plans 01 + 04 parallel. Wave 2: plans 02 + 03 parallel (no file overlap). Spike for D-04 runs on throwaway branch never merged.*
```

### D. Reminder

The spike branch from Plan 01-03 is preserved as `spike/i18n-decision` + tag `spike/i18n-decision-evidence` (referenced in I18N-DECISION.md, not in CARRY-FORWARD.md per FOUND-04 contract).

## Issues Encountered

- Phase context files (01-CONTEXT.md, 01-RESEARCH.md, 01-PATTERNS.md) were not committed to master before Wave 1 worktree spawn — they exist in the master tree as untracked files. This worktree was reset to base `d719737` per the worktree base-check protocol, so those untracked files are NOT visible here. The plan was self-contained (all required content embedded as verbatim text inside Task 1's `<action>` block), so this did not block execution.
- The plan's verification grep `grep -c '^| [1-5] |' .planning/research/CARRY-FORWARD.md | grep -qE '^9$|^[1-9][0-9]+$'` passes: numbered rows = 9 (5 port + 4 rebuild), file lines = 92 (>60 minimum).

## Next Phase Readiness

- Phase 2 (Tokens) can read CARRY-FORWARD.md "Rebuild from Scratch" row 3 to know layout grid + design tokens are its scope.
- Phase 3 (Chrome + Bottombar) needs D-05/D-06/D-08 from STATE.md — currently they live in CARRY-FORWARD.md only until orchestrator applies the deferred append. The defense-in-depth means Phase 3 planning is NOT blocked by the deferral; it just reads from a different document until the orchestrator merges Wave 1.
- Phase 5 (Auth) has the OAuth callback destination path reserved.
- Phase 12 (Settings) has the format-hooks destination paths reserved.
- Phase 13 (Dashboard) has the HUD endpoint contract documented; backend can scope the endpoints from this doc when Phase 13 starts.
- FOUND-03 + FOUND-05 + FOUND-06 are now closeable from a verification standpoint:
  - FOUND-03: CARRY-FORWARD.md exists with 5 port + 4 rebuild rows ✓
  - FOUND-05: D-05..D-08 mobile-FAB scope documented (in CARRY-FORWARD.md Out of Scope and pending STATE.md append) ✓
  - FOUND-06: D-09..D-11 dashboard HUD endpoints documented (in CARRY-FORWARD.md Backend Endpoint Specs and pending STATE.md append) ✓

## Self-Check: PASSED

- File exists: `.planning/research/CARRY-FORWARD.md` ✓ (92 lines)
- Commit `95c512f` exists in this worktree branch ✓
- All required substrings greppable in CARRY-FORWARD.md: `Port Verbatim`, `Rebuild from Scratch`, `Auth flow`, `OAuth callback`, `Format hooks`, `Playwright auth helper`, `check-forbidden-imports.mjs`, `Chrome`/`TopBar`, `Retro atoms`, `Layout grid`/`design tokens`, `Provider stack`, `/stats/capacity`, `/stats/activity` ✓
- Required v2.1 SHAs cited: `3826d24`, `4d4c233`, `5e77f98` ✓
- Numbered table rows (`^| [1-5] |`): 9 ≥ 9 minimum ✓
- File line count: 92 ≥ 60 minimum ✓

---
*Phase: 01-foundation-conflict-spikes*
*Completed: 2026-05-01*
