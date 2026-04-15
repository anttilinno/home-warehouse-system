---
phase: 58
plan: 01
subsystem: frontend2/features/taxonomy
tags: [taxonomy, utilities, zod, hooks, test-fixtures]
requirements: [TAX-01, TAX-02, TAX-05, TAX-06, TAX-09, TAX-10]
dependency_graph:
  requires:
    - "@tanstack/react-query (existing)"
    - "zod (existing)"
    - "@lingui/core, @lingui/react (existing)"
    - "frontend2/src/components/retro (ToastProvider)"
    - "frontend2/src/lib/api/{categories,locations,containers}.ts (entity types)"
  provides:
    - "buildTree, collectDescendantIds, TreeNode<T>"
    - "deriveShortCode, useAutoShortCode"
    - "categoryCreateSchema, categoryUpdateSchema, locationCreateSchema, locationUpdateSchema, containerCreateSchema, containerUpdateSchema"
    - "useHashTab<T>"
    - "renderWithProviders, setupDialogMocks, makeCategory, makeLocation, makeContainer"
  affects:
    - "Plans 58-02/03/04 consume these utilities and fixtures directly"
tech_stack:
  added: []
  patterns:
    - "Two-pass tree build (adjacency loop + depth BFS) for order-independent depth"
    - "Math.random 3-digit preview suffix (backend is source of truth for uniqueness)"
    - "useCallback-driven hashchange subscription with allowlist validation"
    - "Factory-with-overrides pattern for entity test fixtures"
key_files:
  created:
    - frontend2/src/features/taxonomy/tree/buildTree.ts
    - frontend2/src/features/taxonomy/actions/shortCode.ts
    - frontend2/src/features/taxonomy/forms/schemas.ts
    - frontend2/src/features/taxonomy/hooks/useHashTab.ts
    - frontend2/src/features/taxonomy/__tests__/buildTree.test.ts
    - frontend2/src/features/taxonomy/__tests__/shortCode.test.ts
    - frontend2/src/features/taxonomy/__tests__/fixtures.tsx
  modified: []
decisions:
  - "fixtures extension is .tsx (not .ts) — wrapper component contains JSX that TS rejects in .ts files"
  - "deriveShortCode 3-digit suffix is preview-only; LocationForm/ContainerForm will strip short_code from the payload when autoLinked=true so backend generates a guaranteed-unique 8-char code"
  - "useHashTab uses history.replaceState (not pushState) so tab navigation doesn't pollute browser history"
metrics:
  tasks_completed: 3
  tests_added: 16
  files_created: 7
  completed_date: 2026-04-16
---

# Phase 58 Plan 01: Taxonomy Foundation Summary

Pure-logic foundation for Phase 58 taxonomy work: tree builder, short_code derivation, zod schemas, URL-hash hook, and shared test fixtures — 16/16 unit tests passing, tsc clean, zero new dependencies.

## Objective Recap

Ship the framework-agnostic utilities consumed by every later Phase 58 plan, with unit tests locking in core invariants (tree correctness, schema validation, hash sync) before any UI work.

## Tasks

| # | Task | Status | Commits |
|---|------|--------|---------|
| 1 | buildTree + collectDescendantIds (TDD) | Done | `ed662ea` test, `0387c34` feat |
| 2 | deriveShortCode + useAutoShortCode (TDD) | Done | `a3ff1c0` test, `90bb1aa` feat |
| 3 | Zod schemas + useHashTab + fixtures | Done | `51eb52c` feat |

## Verification Results

- `cd frontend2 && bun run tsc --noEmit` exits 0
- `cd frontend2 && bun run test -- --run src/features/taxonomy/` reports 2 files / 16 tests passing (8 buildTree + 2 collectDescendantIds + 6 shortCode)
- No runtime dependency added to `frontend2/package.json`

## Artifacts

- `frontend2/src/features/taxonomy/tree/buildTree.ts` — `buildTree(flat, parentOf) -> TreeNode<T>[]` with depth; `collectDescendantIds(root) -> Set<string>` for parent-picker exclusion
- `frontend2/src/features/taxonomy/actions/shortCode.ts` — `deriveShortCode(name) -> "PREFIX-NNN"|""` and `useAutoShortCode(name, setter)` debounced hook with sever-on-manual-edit behavior
- `frontend2/src/features/taxonomy/forms/schemas.ts` — six zod schemas + six inferred TS types; UUID validation on `parent_category_id`, `parent_location`, `location_id`
- `frontend2/src/features/taxonomy/hooks/useHashTab.ts` — SSR-safe tab <-> `window.location.hash` sync with allowlist
- `frontend2/src/features/taxonomy/__tests__/fixtures.tsx` — `renderWithProviders`, `setupDialogMocks`, and `makeCategory/Location/Container` factories

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Renamed fixtures.ts -> fixtures.tsx**
- **Found during:** Task 3 type-check
- **Issue:** Plan specified `fixtures.ts` but the `renderWithProviders` wrapper contains JSX; TypeScript rejects JSX in `.ts` files (compile error).
- **Fix:** Created the file as `fixtures.tsx` instead. All behavior matches the plan; consumers import via path without extension (`from "./fixtures"`), so downstream plans are unaffected. Frontmatter `key_files.created` and this SUMMARY reflect the actual `.tsx` path.
- **Files modified:** `frontend2/src/features/taxonomy/__tests__/fixtures.tsx`
- **Commit:** `51eb52c`

No other deviations — plan executed as written.

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| Two-pass depth assignment in `buildTree` | Input order not guaranteed; depth is only correct after adjacency is fully built, so a second BFS walk from roots assigns depth deterministically |
| `deriveShortCode` preview-only, backend still authoritative | Backend enforces per-workspace uniqueness and can auto-generate an 8-char unique code; 3-digit preview prioritises readability — forms strip `short_code` when `autoLinked` |
| `history.replaceState` in `useHashTab` | Tab switches shouldn't create back-button history entries |
| Allowlist validation on hash read | User-controlled URL fragment must not be trusted; invalid hashes silently fall back to `defaultTab` |

## Threat Mitigations Applied

| Threat ID | Mitigation | Where |
|-----------|-----------|-------|
| T-58-01 Tampering (parent IDs) | `z.string().uuid().optional()` / `z.string().uuid()` | `schemas.ts` — 3 uuid() calls |
| T-58-02 Tampering (long payloads) | `z.string().max(120)` on names, `max(500)` on descriptions, `max(32)` on short_codes | `schemas.ts` |
| T-58-03 Info disclosure (hash injection) | Allowlist check before consuming hash; no eval / innerHTML | `useHashTab.ts` |
| T-58-04 DoS (tree explosion) | Accepted — O(n) build, realistic cap ~100 nodes | `buildTree.ts` |

## Follow-ups for Plans 58-02/03/04

- `renderWithProviders` is ready for form and page tests; import from `@/features/taxonomy/__tests__/fixtures`
- Form submit handlers must import `autoLinked` from `useAutoShortCode` and delete `short_code` from the request payload when it is `true` (per Task 2 note)
- Parent-picker UI should call `collectDescendantIds(nodeBeingEdited)` and exclude those ids from selectable options to prevent cyclic parents

## Self-Check: PASSED

Files verified on disk:
- FOUND: frontend2/src/features/taxonomy/tree/buildTree.ts
- FOUND: frontend2/src/features/taxonomy/actions/shortCode.ts
- FOUND: frontend2/src/features/taxonomy/forms/schemas.ts
- FOUND: frontend2/src/features/taxonomy/hooks/useHashTab.ts
- FOUND: frontend2/src/features/taxonomy/__tests__/buildTree.test.ts
- FOUND: frontend2/src/features/taxonomy/__tests__/shortCode.test.ts
- FOUND: frontend2/src/features/taxonomy/__tests__/fixtures.tsx

Commits verified in git log:
- FOUND: ed662ea (RED: buildTree tests)
- FOUND: 0387c34 (GREEN: buildTree impl)
- FOUND: a3ff1c0 (RED: shortCode tests)
- FOUND: 90bb1aa (GREEN: shortCode impl)
- FOUND: 51eb52c (Task 3: schemas + useHashTab + fixtures)
