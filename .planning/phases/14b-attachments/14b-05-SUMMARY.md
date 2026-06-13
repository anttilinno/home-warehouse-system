---
phase: 14b-attachments
plan: 05
subsystem: frontend2 (wiring — mounts Wave-2 Attachments + Paperless exports)
tags: [attachments, paperless, settings, items, wiring, ATT-01, ATT-02, PPL-01, PPL-02, PPL-03]
requires:
  - "14b-03 (ItemAttachmentPanel)"
  - "14b-04 (PaperlessPage, PaperlessLinkDialog)"
provides:
  - "Lazy /settings/paperless route (PaperlessPage under SettingsLayout)"
  - "Real Paperless landing row → /settings/paperless (replaces COMING SOON)"
  - "FILES tab on ItemDetailPage mounting ItemAttachmentPanel"
  - "Link Paperless document overflow-menu action opening PaperlessLinkDialog"
affects: []
tech-stack:
  added: []
  patterns:
    - "Lazy/Suspense settings subpage route (mirror of the Phase-12 settings imports)"
    - "RetroTab array entry for the FILES tab"
    - "useState-driven dialog open/close, mounted under the app-wide ModalStackProvider"
key-files:
  created:
    - .planning/phases/14b-attachments/14b-05-SUMMARY.md
  modified:
    - frontend2/src/routes/index.tsx
    - frontend2/src/features/settings/SettingsLandingPage.tsx
    - frontend2/src/features/settings/SettingsLandingPage.test.tsx
    - frontend2/src/features/items/ItemDetailPage.tsx
    - frontend2/src/features/items/ItemDetailPage.test.tsx
decisions:
  - "Kept the RetroBadge import in SettingsLandingPage — still used by the LINKED/members count badges (only the unused PaperlessRow component was deleted)"
  - "Placed the Link Paperless document menu item between ARCHIVE/RESTORE and DELETE… in the existing overflow Popover; mounted the dialog beside PhotoUpload"
  - "FILES tab appended after HISTORY (4th tab) — photos tab + side rail untouched per plan"
  - "Added an attachments-list MSW handler (default empty {items:[]}) to ItemDetailPage.test.tsx so the real (un-mocked) ItemAttachmentPanel renders its NO FILES state in the FILES-tab test"
metrics:
  duration: ~10m
  completed: 2026-06-13
---

# Phase 14b Plan 05: Wiring (Mount Wave-2 Exports) Summary

Single-writer wiring plan: connected the self-contained Wave-2 Attachments
(14b-03) and Paperless (14b-04) components into the three shared files
(`routes/index.tsx`, `SettingsLandingPage.tsx`, `ItemDetailPage.tsx`),
delivering the user-visible surfaces for ATT-01/02 + PPL-01/02/03.

## What was wired

| Surface | Mount point | Component (Wave-2 origin) |
| ------- | ----------- | ------------------------- |
| `/settings/paperless` route | `routes/index.tsx` settings block (lazy + Suspense) | `PaperlessPage` (14b-04, named export → default) |
| Settings landing Paperless row | `SettingsLandingPage.tsx` WORKSPACE Window | real `<LinkRow to="paperless">` (replaced disabled COMING SOON `PaperlessRow`, now deleted) |
| Item-detail FILES tab | `ItemDetailPage.tsx` `tabs` array (4th tab) | `<ItemAttachmentPanel wsId={wsId} itemId={item.id} />` (14b-03) |
| Item-detail Paperless link action | `ItemDetailPage.tsx` overflow Popover | "Link Paperless document" button → `paperlessLinkOpen` state → `<PaperlessLinkDialog wsId itemId open onClose />` (14b-04) |

## Registered route path

`/settings/paperless` → `PaperlessPage`, lazy-loaded inside a
`<Suspense fallback={null}>` boundary under the Phase-12 `SettingsLayout`
(sibling of `members`, `data`, etc.).

## Files modified

- `frontend2/src/routes/index.tsx` — added a lazy `PaperlessPage` import
  (mirrors the other settings lazy imports) + a `<Route path="paperless">`
  inside the settings block.
- `frontend2/src/features/settings/SettingsLandingPage.tsx` — replaced
  `<PaperlessRow />` (disabled COMING SOON non-link) with
  `<LinkRow to="paperless" label={<Trans>Paperless</Trans>} />` and DELETED the
  now-unused `PaperlessRow` component. `RetroBadge` import retained (still used
  by the LINKED/members count badges).
- `frontend2/src/features/settings/SettingsLandingPage.test.tsx` — replaced the
  "aria-disabled COMING SOON" assertion with one asserting a real link row to
  `/settings/paperless`; added `[/^Paperless$/, "/settings/paperless"]` to the
  href cases.
- `frontend2/src/features/items/ItemDetailPage.tsx` — imported
  `ItemAttachmentPanel` + `PaperlessLinkDialog`; added a `files` tab; added a
  `paperlessLinkOpen` useState + a "Link Paperless document" overflow-menu
  action; mounted `PaperlessLinkDialog`.
- `frontend2/src/features/items/ItemDetailPage.test.tsx` — updated the tabs
  assertion (3 → 4 tabs incl. FILES); added an attachments-list MSW handler;
  added two tests (FILES tab mounts the panel; menu opens the Paperless link
  dialog).

## Deviations from Plan

None — plan executed exactly as written. Test-harness-only additions inside this
plan's own test files (an attachments-list MSW handler so the real
`ItemAttachmentPanel` renders its NO FILES state in jsdom) are standard testing
requirements, not behavior changes.

## Landmine FOUND-02 compliance

No directory, file, or identifier introduced contains the substrings
`sync` / `idb` / `offline`. `bun run lint:imports` (the enforcement) passed clean.

## Known Stubs

None. All four surfaces mount live Wave-2 components bound to real backend
endpoints.

## Gate Results

| Gate | Result |
| ---- | ------ |
| `bun run lint:tsc` | PASS (clean, `tsc -b --noEmit`, exit 0) |
| `bun run test` | PASS — 173 files / 1098 tests (incl. 7 SettingsLandingPage + 12 ItemDetailPage) |
| `bun run build` | PASS (pre-existing >500 kB chunk-size warning only — not an error) |
| `bun run lint:imports` | PASS — `check-forbidden-imports: OK` (FOUND-02 clean) |

## Commits

- `54aac046` — feat(14b-05): lazy /settings/paperless route + real Paperless landing row
- `8b739c67` — feat(14b-05): FILES tab + Link Paperless document action on item detail

## Self-Check: PASSED

All 5 modified files exist on disk; both task commits present in `git log`.
