---
phase: 63-navigation-and-polish
fixed_at: 2026-04-17T00:00:00Z
review_path: .planning/phases/63-navigation-and-polish/63-REVIEW.md
iteration: 1
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 63: Code Review Fix Report

**Fixed at:** 2026-04-17
**Source review:** .planning/phases/63-navigation-and-polish/63-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 2
- Fixed: 2
- Skipped: 0

## Fixed Issues

### WR-01: `'{nodeName}'` literal quotes prevent variable interpolation in ArchiveDeleteFlow messages

**Files modified:** `frontend2/src/features/taxonomy/actions/ArchiveDeleteFlow.tsx`, `frontend2/locales/en/messages.po`, `frontend2/locales/et/messages.po`
**Commit:** 12663a8
**Applied fix:** Removed the surrounding single quotes from both Lingui template literals in ArchiveDeleteFlow.tsx (lines 93 and 107), changing `'${nodeName}'` to `${nodeName}`. Updated both EN and ET catalog msgids to remove the corresponding `'{nodeName}'` syntax, replacing it with unquoted `{nodeName}`. ET msgstr bodies were already correct (they used unquoted `{nodeName}`) — only the msgids needed updating in both catalogs.

### WR-02: "New Location" button and archived-count checkbox render when `workspaceId` is null

**Files modified:** `frontend2/src/features/taxonomy/tabs/LocationsTab.tsx`
**Commit:** d420484
**Applied fix:** Added `disabled={!workspaceId}` to the `+ NEW LOCATION` RetroButton. This prevents users without a workspace from opening the EntityPanel and triggering an API error on save, while keeping the button visible for context. The "Show archived" checkbox was left as-is since it is harmless to display (it only affects local display state and the archived count will be 0 when there is no workspace data).

---

_Fixed: 2026-04-17_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
