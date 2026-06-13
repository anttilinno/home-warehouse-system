---
phase: 07-items-photos
plan: 07
subsystem: items
tags: [e2e, playwright, items, lifecycle, requirements, traceability]
requires:
  - "frontend2 items feature (Plans 07-01..07-06): /items list, /items/:id detail, archive/restore"
  - "live dev stack (backend :8080 + Postgres warehouse_dev + Vite :5173) per CLAUDE.md §E2E runbook"
provides:
  - "live-stack item-lifecycle Playwright spec (ITEM-01/05 phase gate)"
  - "auditable ITEM-07 HEIC + ITEM-01 location-chip requirement corrections"
affects:
  - ".planning/REQUIREMENTS.md (ITEM-01, ITEM-07 prose)"
  - "frontend2/e2e (new lifecycle spec)"
tech-stack:
  added: []
  patterns:
    - "cookie-authed page.request seeding (access_token inherited by page.request)"
    - "URL-param-driven facet assertion (archived=true) for locale-agnostic E2E"
    - "ORIGINAL/REVISED dated annotation pair (Phase-65 audit-history style)"
key-files:
  created:
    - "frontend2/e2e/items.spec.ts"
    - ".planning/phases/07-items-photos/deferred-items.md"
  modified:
    - ".planning/REQUIREMENTS.md"
decisions:
  - "Seed the lifecycle item via cookie-authed page.request (not /items/new) because the create form omits the backend-required sku (422); the plan sanctions page.request seeding as the alternative create path."
  - "Did NOT edit ROADMAP.md despite the plan frontmatter listing it: the spawning orchestrator owns ROADMAP/STATE writes. The location-chip/HEIC mirror is fully captured in REQUIREMENTS.md + flagged for the orchestrator."
metrics:
  duration: ~25m
  completed: 2026-06-13
  tasks: 2
  files: 3
---

# Phase 7 Plan 07: Live E2E Lifecycle + HEIC/Location-Chip Doc Corrections Summary

A live-stack Playwright spec proving the real item lifecycle (create → list → detail → archive → hidden → archived-facet reveal → unarchive) against the running backend + Postgres, plus the two auditable requirement corrections (ITEM-07 HEIC→JPEG/PNG/WebP and the deliberately-dropped ITEM-01 location filter chip) using the dated ORIGINAL/REVISED annotation pattern.

## What Was Built

### Task 1 — `frontend2/e2e/items.spec.ts` (commit 3b531c1)
A single lifecycle test, discovered by both the `chromium` and `firefox` projects, that runs against the live dev stack per the CLAUDE.md runbook:
1. Logs in via the real `/login` (exact-match `/^log in$/i` submit; OAuth buttons present).
2. Seeds an item with a unique per-run name (`E2E-${Date.now()}`) + sku via cookie-authed `page.request.post` (cookie inherited — no token plumbing).
3. Opens the detail route by id and asserts the name renders.
4. Asserts the row appears in the default `/items` list; row-click navigates to detail.
5. Archives via the detail titlebar overflow (↧ → ARCHIVE).
6. Asserts the row is filtered out of the default list (ITEM-05).
7. Reveals it via `?archived=true` (the facet the FilterPopover writes), asserts it reappears flagged ARCHIVED.
8. Unarchives via RESTORE; asserts it returns to the default list, no longer ARCHIVED.
9. Best-effort `finally` cleanup (archive→delete; failures swallowed; unique name = no cross-run collision, T-07-20).

Verified two ways: the in-plan gate `npx playwright test --list e2e/items.spec.ts` (exit 0, 2 tests) AND a live run (`2 passed (5.1s)` across chromium + firefox).

### Task 2 — REQUIREMENTS.md corrections (commit f946c6c)
- **ITEM-07:** dated ORIGINAL/REVISED pair — original "JPEG/PNG/HEIC" preserved verbatim; REVISED states JPEG/PNG/WebP only, HEIC rejected server-side (`AllowedMimeTypes`), client accept-list excludes it. Reason cited: 07-RESEARCH Pitfall 2.
- **ITEM-01:** dated ORIGINAL/REVISED pair — original "(category, location, archived)" preserved; REVISED records the location filter chip as DROPPED (no backend `location_id` param), category + archived chips only, Location stays a display column. Reason cited: 07-RESEARCH Open Question 1.

## Deviations from Plan

### 1. [Orchestrator-precedence] ROADMAP.md NOT edited
- **Plan frontmatter** listed `.planning/ROADMAP.md` in `files_modified` and Task 2 asked to mirror the deviations into ROADMAP Phase 7 Success Criteria 1 + 4.
- **Spawning orchestrator instruction** explicitly overrode this: "Do NOT update STATE.md or ROADMAP.md — the orchestrator owns those writes." Orchestrator instructions take precedence.
- **Resolution:** Both corrections are fully captured in REQUIREMENTS.md (the auditable SSOT). The ITEM-01 REVISED note explicitly flags that the ROADMAP Phase-7 mirror is the orchestrator's to apply. No information is lost; the orchestrator should mirror the HEIC→WebP (criterion 4) and dropped-location-chip (criterion 1) notes into ROADMAP.md.
- **Impact:** The plan's Task-2 verify grep `grep -iq "location" .planning/ROADMAP.md` still passes (ROADMAP already contains "location" in unrelated lines), so no gate breaks.

### 2. [Rule discovery — deferred, out of scope] /items/new form omits required `sku`
- **Found during:** Task 1, first live run (the form-driven create attempt 422'd).
- **Issue:** Backend `POST /items` requires `sku` (`422 "expected required property sku to be present"`); the create form (`ItemFormPage`/`useItemFormMutations`) does not collect or synthesize one.
- **Why not fixed here:** Out of this plan's scope (a Plan-05/06 form-contract gap); the plan explicitly sanctions cookie-authed `page.request` seeding as the create path, so the lifecycle gate is proven without coupling to the form bug.
- **Logged to:** `.planning/phases/07-items-photos/deferred-items.md` (D-07-07-A) with the suggested owner + evidence.

## Threat Mitigations Applied
- **T-07-20** (shared dev DB pollution): unique per-run name + best-effort cleanup; no fixed ids reused.
- **T-07-21** (hidden scope deviation): both deviations recorded with dated ORIGINAL/REVISED annotations (never silently omitted).
- **T-07-22** (backend test regression): zero backend files changed (`git diff --name-only base HEAD` → only REQUIREMENTS.md, deferred-items.md, items.spec.ts). G-65-01 integration test green by construction.

## Verification
- `npx playwright test --list e2e/items.spec.ts` → exit 0, 2 tests (chromium + firefox).
- Live run: `E2E_USER=seeder@test.local E2E_PASS=password123 npx playwright test e2e/items.spec.ts` → 2 passed (5.1s).
- `grep -c REVISED .planning/REQUIREMENTS.md` → 7 (includes the 2 new annotations); `webp` present; "location filter chip is DROPPED" present.
- Backend untouched: `git diff --name-only 98ab3c45 HEAD | grep -c '^backend/'` → 0.

## Self-Check: PASSED

All created files exist on disk; both per-task commits (3b531c1, f946c6c) are reachable in git history.
