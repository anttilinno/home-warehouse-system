# Phase 63 — Deferred Items

Pre-existing issues discovered during Phase 63 execution that are OUT OF SCOPE
per the deviation rules' SCOPE BOUNDARY clause (only auto-fix issues DIRECTLY
caused by current task's changes).

## Pre-existing lint errors (unchanged by Phase 63 edits)

Captured against clean `master` (HEAD = e2e9efd, WIP commit) before any Phase 63 file edits.
`bun run lint` exited with 19 problems (11 errors, 8 warnings) unrelated to Phase 63 files.
After Phase 63 edits the count drops to 18 (10 errors, 8 warnings) — Phase 63 did not
introduce any new lint violations; it actually removed one.

### Errors (pre-existing, out of scope)

- `frontend2/src/features/taxonomy/panel/SlideOverPanel.tsx:94` — `react-hooks/refs` (Cannot access ref value during render) — Phase 58 artifact
- `frontend2/src/features/taxonomy/tree/TreeNode.tsx:31` — `@typescript-eslint/no-unused-vars` (`_expandedIds` defined but never used) — Phase 58 artifact
- `frontend2/src/lib/api.ts:89` — `no-useless-catch` (unnecessary try/catch wrapper) — Phase 56 artifact

### Warnings (pre-existing, out of scope)

- `frontend2/src/features/items/photos/useItemPhotoGallery.ts:55` — `react-hooks/exhaustive-deps` (ref cleanup warning) — Phase 61 artifact
- `frontend2/src/features/taxonomy/hooks/useCategoriesTree.ts:19` — `react-hooks/exhaustive-deps` (logical expression in deps)
- `frontend2/src/features/taxonomy/hooks/useContainersByLocation.ts:40` — same
- `frontend2/src/features/taxonomy/hooks/useLocationsTree.ts:34` — same
- `frontend2/src/features/taxonomy/tabs/ContainersTab.tsx:63` — `Unused eslint-disable directive`

These should be cleaned up in a dedicated tech-debt phase, not in Phase 63 which
is a pure wiring/polish/i18n pass.

## Impact on Phase 63 acceptance criteria

The plan's acceptance criteria include `bun run lint` exits 0, but the pre-existing
errors in unrelated files (SlideOverPanel.tsx, TreeNode.tsx, lib/api.ts) prevent
this. Phase 63 files themselves (Sidebar.tsx, LocationsTab.tsx, messages.po) pass
lint. Documented here and in 63-01-SUMMARY.md under "Deferred Issues".
