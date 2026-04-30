---
phase: 58
plan: 02
subsystem: taxonomy/data-hooks
tags: [taxonomy, data-hooks, tanstack-query, mutations, react-query]
requires:
  - frontend2/src/lib/api/categories.ts
  - frontend2/src/lib/api/locations.ts
  - frontend2/src/lib/api/containers.ts
  - frontend2/src/features/auth/AuthContext.tsx
  - frontend2/src/components/retro (useToast, ToastProvider)
  - frontend2/src/features/taxonomy/tree/buildTree.ts (owned by Plan 58-01)
provides:
  - useCategoriesTree
  - useLocationsTree
  - useContainersByLocation
  - useCreateCategory / useUpdateCategory / useArchiveCategory / useRestoreCategory / useDeleteCategory
  - useCreateLocation / useUpdateLocation / useArchiveLocation / useRestoreLocation / useDeleteLocation
  - useCreateContainer / useUpdateContainer / useArchiveContainer / useRestoreContainer / useDeleteContainer
affects:
  - Plans 58-03 / 58-04 (tab bodies + forms) will consume these hooks as pure consumers
tech-stack:
  added: []
  patterns:
    - "Paging-loop queryFn (limit=100) for fetch-all trees"
    - "HttpError 409 branch for cascade-aware delete"
    - "Lingui t`` toast copy per 58-UI-SPEC"
key-files:
  created:
    - frontend2/src/features/taxonomy/hooks/useCategoriesTree.ts
    - frontend2/src/features/taxonomy/hooks/useLocationsTree.ts
    - frontend2/src/features/taxonomy/hooks/useContainersByLocation.ts
    - frontend2/src/features/taxonomy/hooks/useCategoryMutations.ts
    - frontend2/src/features/taxonomy/hooks/useLocationMutations.ts
    - frontend2/src/features/taxonomy/hooks/useContainerMutations.ts
    - frontend2/src/features/taxonomy/hooks/__tests__/useCategoryMutations.test.ts
    - frontend2/src/features/taxonomy/tree/buildTree.ts (stub; Plan 58-01 owns canonically)
  modified: []
decisions:
  - "Archive onError uses generic copy unconditionally — {Name} interpolation deferred to caller (per plan action)"
  - "Location/Container delete has no 409 branch — cascade semantics only apply to categories (per RESEARCH §TAX-08)"
  - "buildTree.ts created in this worktree as Rule 3 blocking-dep stub — Plan 58-01 (wave 1 parallel) owns canonical file; merge will resolve"
metrics:
  duration: ~15m
  completed: 2026-04-16
  tasks: 3
  files: 8
---

# Phase 58 Plan 02: TanStack Query data layer (read + mutation hooks) Summary

One-liner: Six hook files plus a companion test wire `categoriesApi`/`locationsApi`/`containersApi` to a workspace-guarded React Query layer with uniform `*Keys.all` invalidation, Lingui-wrapped success/error toasts, and a dedicated HttpError-409 branch on `useDeleteCategory`.

## Deliverables

| File | Purpose |
| ---- | ------- |
| `useCategoriesTree.ts` | Flat list + memoized `buildTree` output, archived filter |
| `useLocationsTree.ts` | Paging loop (limit=100) until `page >= total_pages`, `buildTree` |
| `useContainersByLocation.ts` | Paging loop (limit=100), `groupedByLocation` Map<location_id, Container[]> |
| `useCategoryMutations.ts` | 5 hooks — delete branches on HttpError 409 -> "Move or delete child nodes first." |
| `useLocationMutations.ts` | 5 hooks — all delete errors are generic (no cascade) |
| `useContainerMutations.ts` | 5 hooks — all delete errors are generic |
| `__tests__/useCategoryMutations.test.ts` | 4 behavioral tests (create success, 409 delete, non-409 delete, archive success) |

## Commits

| Task | Hash | Message |
| ---- | ---- | ------- |
| 1 | f6817fd | feat(58-02): add three read hooks — categories/locations trees + containers grouped |
| 2 | 353e0e3 | feat(58-02): add three mutation bundles — categories/locations/containers |
| 3 | 26b7441 | test(58-02): add behavioral tests for useCategoryMutations |

## Verification

- `bunx tsc --noEmit` — exits 0 (clean)
- `bun run test -- --run src/features/taxonomy/hooks/__tests__/useCategoryMutations.test.ts` — 4 / 4 pass (1.68s)
- Acceptance greps: all export regexes match; `status === 409` present in useCategoryMutations.ts; absent in useLocationMutations.ts/useContainerMutations.ts; `invalidateQueries` + `addToast` counts meet thresholds.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking dep] Added `tree/buildTree.ts` stub**
- **Found during:** Task 1 (tsc --noEmit would fail without the import target)
- **Issue:** `useCategoriesTree.ts` and `useLocationsTree.ts` import `{ buildTree, TreeNode }` from `../tree/buildTree`, which is owned by Plan 58-01 (also wave 1, parallel worktree). That file does not exist in this worktree.
- **Fix:** Created `frontend2/src/features/taxonomy/tree/buildTree.ts` using the verbatim spec from `58-RESEARCH §Pattern 1`. When Plan 58-01 merges, its canonical version will replace this stub (content identical by spec).
- **Commit:** f6817fd

**2. [Rule 1 — Spec mismatch] Dropped 409 branch from archive onError**
- **Found during:** Task 2 (plan acceptance criteria conflict with action pseudocode)
- **Issue:** Task 2 pseudocode shows an `err instanceof HttpError && status === 409` branch in `useArchiveCategory.onError`, but the acceptance criteria state "No string matches `HttpError` check in Location / Container delete hooks" and the critical-detail paragraph concludes "use generic copy here".
- **Fix:** Archive onError in all three mutation files simply toasts `t\`Could not archive. Try again.\`` unconditionally. Only `useDeleteCategory` keeps the 409 branch (as explicitly required by the "Move or delete child nodes first." acceptance criterion).
- **Files:** `useCategoryMutations.ts`, `useLocationMutations.ts`, `useContainerMutations.ts`
- **Commit:** 353e0e3

### Parity with Plan
All other task actions executed as specified. Toast copy, invalidation keys, workspaceId guards, and paging loops match plan verbatim.

## Threat Flags

None — hooks are pure consumers of existing Phase 56 API surface; no new network endpoints, auth paths, or trust boundaries introduced beyond what the plan's threat model already enumerates.

## Notes for Plans 58-03 / 58-04

- Tab bodies and forms should import mutations directly; do not wrap them in additional useMutation layers.
- Archive-failure `{Name}` interpolation (per UI-SPEC) must be handled in callers by passing an `onError` override to `mutate()` — the hook-level onError is intentionally generic.
- `useLocationsTree` / `useContainersByLocation` safety cap is 50 pages × 100 = 5000 rows; flag if taxonomy cardinality approaches this.

## Self-Check: PASSED

**Files verified:**
- FOUND: frontend2/src/features/taxonomy/hooks/useCategoriesTree.ts
- FOUND: frontend2/src/features/taxonomy/hooks/useLocationsTree.ts
- FOUND: frontend2/src/features/taxonomy/hooks/useContainersByLocation.ts
- FOUND: frontend2/src/features/taxonomy/hooks/useCategoryMutations.ts
- FOUND: frontend2/src/features/taxonomy/hooks/useLocationMutations.ts
- FOUND: frontend2/src/features/taxonomy/hooks/useContainerMutations.ts
- FOUND: frontend2/src/features/taxonomy/hooks/__tests__/useCategoryMutations.test.ts
- FOUND: frontend2/src/features/taxonomy/tree/buildTree.ts (stub)

**Commits verified:**
- FOUND: f6817fd
- FOUND: 353e0e3
- FOUND: 26b7441
