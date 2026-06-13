---
phase: 12-settings
plan: 03
subsystem: settings-frontend
tags: [settings, profile, avatar, appearance, rhf, zod, react-query]
requires:
  - "12-02: settingsApi (getMe/updateMe/uploadAvatar/deleteAvatar), User type, MSW handlers, ProfilePage+AppearancePage stubs"
provides:
  - "ProfilePage: name/email partial-PATCH form + avatar block (SETT-02)"
  - "AvatarUploader: dedicated single-file multipart uploader, field 'avatar' (SETT-02)"
  - "AppearancePage: light-only presentational theme card + backlog note (SETT-04/SETT-11)"
affects:
  - "frontend2/src/features/settings/ (Profile, Appearance subpages now live, no longer stubs)"
tech-stack:
  added: []
  patterns:
    - "RHF `values` prop for render-loop-safe sync of the ['me'] query into the form"
    - "Partial PATCH from RHF formState.dirtyFields (untouched email never crosses the wire)"
    - "Cache-bust stable avatar_url with `?v=${query.dataUpdatedAt}` (Pitfall 7)"
    - "Multipart field-name assertion via raw `request.text()` wire bytes (jsdom undici re-parser chokes on request.formData())"
key-files:
  created:
    - frontend2/src/features/settings/AvatarUploader.tsx
    - frontend2/src/features/settings/AvatarUploader.test.tsx
    - frontend2/src/features/settings/ProfilePage.test.tsx
    - frontend2/src/features/settings/AppearancePage.test.tsx
  modified:
    - frontend2/src/features/settings/ProfilePage.tsx
    - frontend2/src/features/settings/AppearancePage.tsx
decisions:
  - "AvatarUploader owns the ['me'] query itself (self-contained) rather than taking avatar_url/dataUpdatedAt props — cleaner call site and single cache-bust source."
  - "Appearance is fully presentational (OQ-R3): no PATCH /users/me/preferences fires, no dark option, no switcher."
metrics:
  duration: "~25m"
  completed: 2026-06-13
---

# Phase 12 Plan 03: Profile + AvatarUploader + Appearance (light-only) Summary

Profile management (SETT-02) plus the explicit light-only Appearance note
(SETT-04/SETT-11) for the v3.0 retro-os Settings area. Three component files
(two stubs overwritten in-place, one new) plus three TDD test files, all green.

## What was built

- **AvatarUploader** (`AvatarUploader.tsx`, new): a DEDICATED single-file
  multipart uploader — explicitly NOT `PhotoUpload` (which drags in the item
  queue / dup-check / gallery). Owns the `["me"]` query; renders a 150×150
  `<img src="${avatar_url}?v=${dataUpdatedAt}">` (cache-busted against the
  stable avatar URL, Pitfall 7) when an avatar exists, else a 150×150
  `bg-bg-panel-2 border border-border-ink` placeholder with Silkscreen initials
  (ProviderTile idiom). Upload via `settingsApi.uploadAvatar(file)` (FormData
  field `avatar`); Remove via a pink `RetroConfirmDialog` → `deleteAvatar`.
  Every avatar mutation invalidates `["me"]`. `accept` = jpeg/png/webp,
  `maxSize` = 2 MB mirroring the server cap (T-12-06; server authoritative).

- **ProfilePage** (`ProfilePage.tsx`, stub overwritten in-place; export name
  `ProfilePage` preserved): one blue `Window` "PROFILE", `max-w-[560px]`
  centered. `AvatarUploader` on top, then an RHF+zod name/email form mirroring
  SecurityPage. The PATCH body is built from `formState.dirtyFields` ONLY —
  an untouched email is never sent (CONTEXT constraint 3 / Pitfall 2). Email
  conflict (409/400) → inline danger band "That email is already in use.";
  other errors → danger toast "Couldn't save. Try again."; success → "Saved."
  toast + invalidate `["me"]`. Uses RHF's `values` prop for render-loop-safe
  re-sync from the query (no manual `useEffect(reset)`).

- **AppearancePage** (`AppearancePage.tsx`, stub overwritten in-place; export
  name `AppearancePage` preserved): one blue `Window` "APPEARANCE". A single
  locked "Light" theme card with three non-color cues (a `◉` glyph, a
  `bg-titlebar-blue`/`bevel-pressed` selected treatment, and a `RetroBadge`
  "CURRENT") plus subtext "Retro OS Pastel — the only theme." Below, a butter
  `role="note"` band "Light only — a dark theme is on the backlog." NO dark
  option, NO toggle, NO mutation (presentational — OQ-R3). SETT-11 wins over
  SETT-04's stale prose.

## Tests (TDD: RED → GREEN each task)

- `AvatarUploader.test.tsx` (4): initials placeholder when empty; cache-busted
  `<img>` when present; upload sends multipart field `avatar`; remove confirm →
  DELETE; `["me"]` invalidated (re-fetch flips the preview).
- `ProfilePage.test.tsx` (3): pre-fill + avatar block; partial PATCH (only
  `full_name`, NOT `email`); 409 → inline danger band.
- `AppearancePage.test.tsx` (3): single Light/CURRENT card; butter `role="note"`
  backlog band; no dark option/toggle/control (presentational).

Full settings suite: **6 files, 31 tests passed.**

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Multipart FormData field assertion via raw wire bytes**
- **Found during:** Task 1
- **Issue:** Asserting the multipart field name through MSW's
  `request.formData()` returns an EMPTY form in the jsdom + undici test
  environment (the File body is dropped), so the contract test could never go
  green via that route. This is an environment limitation, not a code bug.
- **Fix:** Switched the test to read `await request.text()` and assert
  `name="avatar"` in the Content-Disposition header — the established project
  idiom (PhotoUpload.test.tsx:69-85 / 07-01 photos.test.ts). Also added
  `{ applyAccept: false }` to `userEvent.upload` so jsdom's accept enforcement
  doesn't drop the synthetic file. Production code path is unchanged.
- **Files modified:** frontend2/src/features/settings/AvatarUploader.test.tsx
- **Commit:** 30b805cb

No production-code deviations: the plan executed as written (interfaces, copy,
and partial-PATCH/cache-bust contracts all honored).

## Authentication gates

None.

## Known Stubs

None. All three pages are fully wired to `settingsApi`/`["me"]`; Appearance is
intentionally presentational per OQ-R3 (documented above, not a data stub).

## Scope compliance

Edited only the 6 files in `files_modified`. `routes/index.tsx`,
`SettingsLayout.tsx`, `settings.ts`, `types.ts`, and all 12-04/12-05/12-06
pages were NOT touched (verified via `git diff --name-only` against the base).

## Verification results

- `bun run lint:tsc` — clean (`tsc -b --noEmit`).
- `bun run test src/features/settings/` — 6 files, 31 tests passed.
- `bun run lint:imports` — OK (no forbidden idb/serwist/sync* imports).

## Self-Check: PASSED
