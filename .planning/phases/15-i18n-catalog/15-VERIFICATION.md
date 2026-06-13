---
phase: 15-i18n-catalog
verified: 2026-06-13T23:05:00Z
status: human_needed
score: 3/3 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Live locale switch: switch en → et in /settings/language and confirm the UI re-renders in Estonian without a page reload"
    expected: "Visible strings change to Estonian live (e.g. the window title becomes 'Keel', the label becomes 'Liidese keel', the toast reads 'Keel uuendatud.'). The browser does NOT perform a full reload."
    why_human: "The unit test (LanguagePage.test.tsx) proves the PATCH-then-loadCatalog ordering and confirms no reload is called programmatically. The E2E spec (settings.spec.ts test 3) covers the live persistence + reload-read-back contract. Visual confirmation that the UI re-renders live in Estonian during the session (instant activation) requires a running stack and browser observation."
---

# Phase 15: i18n catalog gap-fill (et + ru) — Verification Report

**Phase Goal:** All user-facing strings ship in en / et / ru with no inline literals; CI extract-merge-diff manifest guard catches missing/orphaned msgids; locale switcher persists choice and applies instantly; format hooks are used everywhere date/time/number values render
**Verified:** 2026-06-13T23:05:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Every user-facing string ships in en + et + ru — 1010 msgids, no empty msgstr (except header), CI guard fails on divergence | VERIFIED | `node scripts/check-i18n-catalog.mjs` exits 0: "OK (1010 msgids, parity + full coverage across en + et + ru)". Self-test 11/11 green. Both et/ru have exactly 1 `msgstr ""` — the PO header (preceding `msgid ""`). |
| 2 | User picking a locale persists to `users/me/preferences` and activates instantly without page reload | VERIFIED (automated) / human-needed (visual activation) | `LanguagePage.tsx` calls `settingsApi.updatePreferences({language})` then `loadCatalog(language)` in `onSuccess` — no `window.location.reload`. `LanguagePage.test.tsx` asserts PATCH-before-loadCatalog ordering and no-activate-on-failure. `settings.spec.ts` test "language: switch en → et" proves end-to-end persistence via reload. Visual instant-activation proof requires a running stack (see Human Verification). |
| 3 | Every date/time/number render site uses format hooks — no raw `toLocale*` in feature code; CI grep guard enforces | VERIFIED | `node scripts/check-i18n-format.mjs` exits 0. Grep of `frontend2/src/features` + `frontend2/src/components` for `.toLocaleString(/toLocaleDateString(/toLocaleTimeString(` returns exactly 2 hits, both tagged `// i18n-format-ignore` (decorative clocks: `Clock.tsx:46`, `AppShell.tsx:51`). All 7 render sites from the context list now call `useDateFormat`/`useTimeFormat`/`useNumberFormat` or the pure `formatDateToken`/`formatTimeToken` helpers where hooks are not available (pure function `relativeTime.ts`, Recharts tick formatter `MonthlyLoanActivityChart.tsx`). |

**Score:** 3/3 truths verified (1 truth has a human-only sub-check)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `frontend2/src/lib/format/hooks.ts` | `useDateFormat` / `useTimeFormat` / `useNumberFormat` reading `["me"]` query and memoizing | VERIFIED | Exists. Each hook calls `useQuery({queryKey:["me"],...})`, derives token primitive, returns `useMemo`-stable formatter. Deps are token strings only — render-loop guard correct. |
| `frontend2/src/lib/format/tokens.ts` | Pure token→string helpers, no React, unit-tested for all token values | VERIFIED | Exists. `formatDateToken` (4 date tokens + invalid passthrough), `formatTimeToken` (24h/12h + invalid), `formatNumberToken` (separator combos + NaN), `formatMonthYearToken`. All tested in `tokens.test.ts` (covered by the 1120-test vitest suite, all green). |
| `frontend2/src/lib/format/index.ts` | Barrel exporting all hooks + helpers | VERIFIED | Exists. Exports `formatDateToken`, `formatTimeToken`, `formatNumberToken`, `formatMonthYearToken`, `DEFAULT_FORMAT_TOKENS`, `useDateFormat`, `useTimeFormat`, `useNumberFormat`. |
| `frontend2/src/locales/et/messages.po` | 1010 msgstr, 0 empty (excluding header) | VERIFIED | 1011 total msgids (1010 translations + 1 header). Only 1 `msgstr ""` present — the PO header entry (`msgid ""`). ICU placeholders preserved verbatim: `{workspaceName}`, `{ok}`, `{fail}`, `{page}`, `{pageCount}`, `{perPage}` all appear identically in msgstr. |
| `frontend2/src/locales/ru/messages.po` | 1010 msgstr, 0 empty (excluding header) | VERIFIED | 1011 total msgids (1010 translations + 1 header). Only 1 `msgstr ""` — PO header. ICU placeholders preserved: `{workspaceName}`, `{ok}`, `{fail}`, `{page}`, `{pageCount}`, `{perPage}` all appear identically in msgstr. |
| `scripts/check-i18n-catalog.mjs` | Exits 0 on complete tree; exits 1 on divergence or empty msgstr | VERIFIED | Exits 0 on current tree. Self-tests: "empty msgstr in et fails (exit 1)", "missing msgid in ru fails (exit 1)", "header entry is never a failure", "--only et" modes — all 11 self-tests pass. |
| `scripts/check-i18n-format.mjs` | Exits 0 on clean tree; exits 1 on unignored raw `toLocale*` | VERIFIED | Exits 0 on current tree. Self-tests: "flags raw toLocale* offender", "does NOT flag Intl.NumberFormat", "does NOT flag `// i18n-format-ignore` line" — all pass. |
| `scripts/__tests__/check-i18n-catalog.test.mjs` | `node --test` green | VERIFIED | 6 tests pass. |
| `scripts/__tests__/check-i18n-format.test.mjs` | `node --test` green | VERIFIED | 5 tests pass. |
| `.github/workflows/lint-frontend2.yml` | CI jobs for both i18n guards with correct `paths:` triggers | VERIFIED | File exists. Jobs: `i18n-format-guard` (runs `check-i18n-format.mjs` + self-test) and `i18n-catalog-guard` (runs self-test + `check-i18n-catalog.mjs`). `paths:` includes both script files, both test files, `frontend2/**`, and the workflow itself. |
| `frontend2/src/features/settings/LanguagePage.tsx` | PATCH preferences then `loadCatalog` in `onSuccess`; no reload | VERIFIED | Confirmed by code read. `mutation.mutationFn` calls `settingsApi.updatePreferences({language})`. `onSuccess` calls `await loadCatalog(language)` then `queryClient.invalidateQueries`. No `window.location.reload` anywhere in the file. |
| `frontend2/src/features/settings/LanguagePage.test.tsx` | Unit test asserts PATCH-then-activate ordering + no-activate-on-failure | VERIFIED | Two tests: "PATCHes {language} then calls loadCatalog once...after the PATCH resolves" (asserts `order === ["patch","loadCatalog"]`) and "does not call loadCatalog if the PATCH fails". Both included in the 1120-test green suite. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `NotificationsDropdown.tsx` | `useDateFormat` / `useTimeFormat` | `import { useDateFormat, useTimeFormat } from "@/lib/format"` | WIRED | Line 5; formatDate/formatTime called at lines 32-33 and used in JSX |
| `MovementsPanel.tsx` | `useDateFormat` / `useTimeFormat` | `import { useDateFormat, useTimeFormat } from "@/lib/format"` | WIRED | Lines 3, 32-33 |
| `LoanPanels.tsx` | `useDateFormat` | `import { useDateFormat } from "@/lib/format"` | WIRED | Line 12; two component functions each call `useDateFormat()` at lines 55 and 136 |
| `BorrowerLoanPanels.tsx` | `useDateFormat` | `import { useDateFormat } from "@/lib/format"` | WIRED | Line 11; line 145 |
| `MonthlyLoanActivityChart.tsx` | `formatMonthYearToken` | `import { formatMonthYearToken } from "@/lib/format"` | WIRED | Line 10; used as Recharts `tickFormatter` (pure fn context, cannot use hook — correct) |
| `relativeTime.ts` | `formatDateToken` / `formatTimeToken` | `import { formatDateToken, formatTimeToken, DEFAULT_FORMAT_TOKENS }` | WIRED | Absolute branch uses pure token helpers — correct for a non-component pure function |
| `SecurityPage.tsx` | `useDateFormat` / `useTimeFormat` | `import { useDateFormat, useTimeFormat } from "@/lib/format"` | WIRED | Lines 9, 68-69 |
| `check-i18n-catalog.mjs` | CI workflow | `scripts/check-i18n-catalog.mjs` in `lint-frontend2.yml` | WIRED | `i18n-catalog-guard` job, step "Run i18n-catalog parity guard" |
| `check-i18n-format.mjs` | CI workflow | `scripts/check-i18n-format.mjs` in `lint-frontend2.yml` | WIRED | `i18n-format-guard` job, step "Run i18n-format grep guard" |
| `package.json` `lint:i18n` | `scripts/check-i18n-catalog.mjs` | `"lint:i18n": "node ../scripts/check-i18n-catalog.mjs"` | WIRED | Confirmed in package.json |
| `package.json` `lint:i18n:format` | `scripts/check-i18n-format.mjs` | `"lint:i18n:format": "node ../scripts/check-i18n-format.mjs"` | WIRED | Confirmed in package.json |

### ICU Placeholder Spot-Checks

| Msgid | et msgstr | ru msgstr | Status |
|-------|-----------|-----------|--------|
| `APPROVALS — {workspaceName}` | `KINNITUSED — {workspaceName}` | `СОГЛАСОВАНИЯ — {workspaceName}` | VERIFIED |
| `Approved {ok}, {fail} failed.` | `Kinnitatud {ok}, {fail} ebaõnnestus.` | `Одобрено: {ok}, не удалось: {fail}.` | VERIFIED |
| `page {page} of {pageCount} · {perPage} / page` | `leht {page} / {pageCount} · {perPage} / leht` | `страница {page} из {pageCount} · {perPage} / стр.` | VERIFIED |

### Behavioral Spot-Checks (Guard Scripts)

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Catalog guard exits 0 on complete tree | `node scripts/check-i18n-catalog.mjs` | "OK (1010 msgids, parity + full coverage across en + et + ru)" exit 0 | PASS |
| Format guard exits 0 on clean tree | `node scripts/check-i18n-format.mjs` | "OK (scanned .../features, .../components)" exit 0 | PASS |
| Guard self-tests pass | `node --test scripts/__tests__/check-i18n-format.test.mjs scripts/__tests__/check-i18n-catalog.test.mjs` | 11/11 pass, exit 0 | PASS |

### Full Gate Commands

| Command | Result | Status |
|---------|--------|--------|
| `cd frontend2 && bun run lint:tsc` | `tsc -b --noEmit` exit 0 | PASS |
| `cd frontend2 && bun run test` | 174 test files, 1120 tests, 0 failures | PASS |
| `cd frontend2 && bun run build` | Vite build exit 0, all chunks emitted | PASS |
| `cd frontend2 && bun run lint:imports` | `check-forbidden-imports: OK` exit 0 | PASS |

### Anti-Patterns Found

None. Grep for `TBD|FIXME|XXX` in the phase-modified files returned no hits outside comments that are part of lingui PO boilerplate. `money.ts` left unchanged as required.

### Human Verification Required

#### 1. Live Instant Locale Activation (I18N-02 visual proof)

**Test:** Navigate to `/settings/language` in a running dev stack (backend :8080 + Vite :5173). Change the language select from English to "Eesti".
**Expected:** Without a browser reload, visible UI strings change to Estonian immediately — the window title bar becomes "Keel", the select label becomes "Liidese keel", and the success toast reads "Keel uuendatud." (or the equivalent Estonian string). Switching back to "English" similarly re-localizes live.
**Why human:** The unit test (`LanguagePage.test.tsx`) proves PATCH-before-loadCatalog ordering and that `loadCatalog` is never called on failure. The E2E spec (`settings.spec.ts`, test "language: switch en → et") proves the backend persistence round-trip. Visual real-time locale activation — that `i18n.activate` triggers a live React re-render rather than a stale/unchanged UI — can only be confirmed by observing the running browser.

---

### Gaps Summary

No blocking gaps identified. All three requirements (I18N-01, I18N-02, I18N-03) are satisfied in the codebase with full automated evidence. The single human verification item is a visual confirmation of I18N-02's instant-activation behavior — the mechanism (loadCatalog in event handler, no reload) is proven by code and unit tests; only the observable browser re-render needs human eyes.

---

_Verified: 2026-06-13T23:05:00Z_
_Verifier: Claude (gsd-verifier)_
