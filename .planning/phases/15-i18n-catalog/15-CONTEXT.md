# Phase 15 — i18n catalog gap-fill (et + ru) — CONTEXT

**Orchestrator-verified ground truth, 2026-06-13.** Surface scanned live; all
shapes below confirmed against the working tree at HEAD `47c2f1c1`.

## Goal (ROADMAP)
All user-facing strings ship in en/et/ru, no inline literals; CI extract→merge→diff
manifest guard catches missing/orphaned msgids; locale switcher persists + applies
instantly; format hooks (`useDateFormat`/`useTimeFormat`/`useNumberFormat`) used
everywhere date/time/number values render.

Requirements: **I18N-01** (catalogs + manifest guard), **I18N-02** (switcher),
**I18N-03** (format hooks + grep guard).

## Verified current state

### i18n runtime (DONE, do not rebuild)
- `src/lib/i18n.ts` — singleton `i18n` from `@lingui/core`; `loadCatalog(locale)`
  dynamic-imports `../locales/{locale}/messages.po` (Vite lingui plugin transforms
  .po→JS at build), `i18n.load` + `i18n.activate`. Locales: `["en","et","ru"]`,
  source `en`.
- `lingui.config.ts` — `@lingui/format-po` formatter, `catalogs:
  src/locales/{locale}/messages`, `include:["src"]`. Scripts: `i18n:extract`
  (`lingui extract`), `i18n:compile` (`lingui compile`).

### Catalogs (THE GAP)
- `src/locales/{en,et,ru}/messages.po`. At HEAD each has **744** msgids, but the
  catalogs are STALE: running `bun run i18n:extract` refreshes en to **1010**
  source messages (266 new from phases 7b/10b/13b/14/14b — attachments, paperless,
  analytics, system group, wishlist, declutter, imports, etc.).
- **et = 100% empty, ru = 100% empty** (every `msgstr ""`). This is the bulk of
  the phase: ~1010 strings × 2 locales = ~2020 translations.
- No inline-literal gap detected — the new pages were built with `<Trans>`/`` t` ``
  discipline (extract found all 1010; heuristic JSX-text scan came back clean).
  The "no inline literals" clause is satisfied by code; the manifest guard is the
  enforcement mechanism going forward.

### I18N-02 switcher (ALREADY DONE in Phase 12 — verify only)
- `src/features/settings/LanguagePage.tsx` — SETT-05. Select (en/et/ru endonyms) →
  `mutation.mutate(locale)` → `settingsApi.updatePreferences({language})` PATCH →
  **onSuccess event handler** calls `await loadCatalog(language)` (Pitfall-4
  render-loop-safe: activation in handler, never render/effect) → invalidate
  `["me"]` → toast. **No page reload** — `i18n.activate` re-renders the tree live.
- Test `LanguagePage.test.tsx` already asserts: PATCH-then-loadCatalog-once-ordered,
  and no-loadCatalog-on-PATCH-fail. I18N-02 is functionally complete; Phase 15 only
  needs a confirming assertion that activation is reload-free (the existing test
  already covers the contract — likely zero code change, just mark verified).

### I18N-03 format hooks (DO NOT EXIST — must build)
- `useDateFormat`/`useTimeFormat`/`useNumberFormat` are **absent**. No `src/lib/format`.
- Preference tokens (persisted by `RegionalFormatsPage`, source of truth — bind
  hooks to these EXACT strings, per 12-04-SUMMARY):
  - `date_format` ∈ `YYYY-MM-DD` | `DD/MM/YYYY` | `MM/DD/YYYY` | `DD.MM.YYYY` (default `YYYY-MM-DD`)
  - `time_format` ∈ `HH:mm` | `h:mm A` (default `HH:mm`)
  - `thousand_separator` ∈ `" "` | `,` | `.` | `""` (default `" "`)
  - `decimal_separator` ∈ `.` | `,` (default `,`)
- Tokens live on the shared `["me"]` query (`settingsApi.getMe()` → `User`, fields
  `date_format?`/`time_format?`/`thousand_separator?`/`decimal_separator?` all
  optional — `types.ts:28-31`). Hooks read `["me"]` and fall back to defaults when
  pending/absent. `RegionalFormatsPage` already has reference `formatDate`/
  `formatTime`/`formatNumber` token→string logic to mirror.

### Raw date/number RENDER sites to route through the hooks (non-test feature code)
Confirmed live (grep). These RENDER a value to the user → must use a hook:
- `src/features/dashboard/relativeTime.ts:37` — `date.toLocaleString(i18n.locale,…)` absolute branch
- `src/features/notifications/components/NotificationsDropdown.tsx:99` — `new Date(...).toLocaleString()`
- `src/features/analytics/components/MonthlyLoanActivityChart.tsx:25` — `d.toLocaleDateString(undefined,…)` axis label
- `src/features/items/components/LoanPanels.tsx` `formatDate` — `toISOString().slice(0,10)` hardcoded
- `src/features/loans/components/BorrowerLoanPanels.tsx` `formatDate` — same
- `src/features/inventory/components/MovementsPanel.tsx` `formatTimestamp` — hand-rolled `YYYY-MM-DD HH:mm`
- `src/features/settings/SecurityPage.tsx:145` — `new Date(s.last_active_at).toISOString()` (title attr; low priority)
- (math-only `new Date(...)` for day-diffs in LoansListPage/InventoryPanel/schema etc. are NOT render sites — leave them.)

DECORATIVE CLOCK CHROME (sketch-006 wall clock, intentionally locale-fixed — NOT
user data): `src/components/layout/Clock.tsx:42` (`toLocaleTimeString("et-EE")`),
`src/components/layout/AppShell.tsx:48` (`toLocaleTimeString(undefined,{hour12:false})`).
→ allowlist these via an inline `// i18n-format-ignore` comment the grep guard
honors (document rationale); do NOT force user `time_format` onto decorative chrome.

### money.ts (currency — leave as-is)
`src/lib/utils/money.ts` `formatCents` uses `Intl.NumberFormat(undefined,{style:"currency"})`
— a dedicated currency util, NOT a raw `Number.toLocaleString()`. Out of I18N-03
scope (the req names `Date.toString()`/`Number.toLocaleString()`). Guard must not
flag `Intl.NumberFormat`. Leave formatCents unchanged.

### CI
- `.github/workflows/lint-frontend2.yml` — jobs: forbidden-imports (runs
  `scripts/check-forbidden-imports.mjs` + its `--test`), typecheck (`lint:tsc`),
  test. Phase-15 guards plug in here as new jobs + `paths` entries.
- Existing guard pattern to mirror: `scripts/check-forbidden-imports.mjs` (+
  `scripts/__tests__/*.test.mjs` self-tests run via `node --test`).

## Translation reference (lift, don't invent)
- `frontend/messages/{en,et,ru}.json` (legacy next-intl) — **1472 keys each, real
  human et + ru translations** (user is Estonian; et is native-quality). Keyed by
  nested key (e.g. `nav.features`), NOT by English source. Strategy: build
  English-value→{et,ru} map from en.json↔et.json/ru.json, apply to Lingui po by
  msgid (msgid = English source). Overlap is partial (UI context differs) — lift
  exact-English matches, translate the remainder natively. Russian must be correct
  technical-UI Russian.

## Locked decisions
- **D-1** I18N-02 already shipped (Phase 12). Verify-only; no rebuild.
- **D-2** Format hooks → new `src/lib/format/` dir (NOT i18n.ts). Names exactly
  `useDateFormat`/`useTimeFormat`/`useNumberFormat`, each returns a memoized
  `(iso:string)=>string` or `(n:number)=>string`. Read `["me"]` query; default
  tokens when pending/absent. Pure token→string helpers exported + unit-tested
  (mirror RegionalFormatsPage logic). "format" substring is safe vs lint:imports.
- **D-3** Route the RENDER sites above through hooks. Decorative clocks allowlisted
  via `// i18n-format-ignore`. money.ts untouched.
- **D-4** Grep guard `scripts/check-i18n-format.mjs`: fail on
  `.toLocaleDateString(` / `.toLocaleTimeString(` / `.toLocaleString(` / Date
  `.toString()` in `frontend2/src/features` + `frontend2/src/components`, EXCEPT
  lines tagged `// i18n-format-ignore`, the `src/lib/format/` dir, and `*.test.*`.
  Ships with `scripts/__tests__/check-i18n-format.test.mjs` self-tests.
- **D-5** Manifest guard `scripts/check-i18n-catalog.mjs`: parse the 3 po files;
  FAIL if msgid sets differ across en/et/ru (orphaned/missing) OR any et/ru msgstr
  is empty. Clear diff report. Self-tested. (extract→merge→diff = the live
  enforcement of I18N-01.)
- **D-6** package.json is SINGLE-WRITER. ONE plan owns BOTH guard scripts + the
  `lint:i18n` / `lint:i18n:format` script entries + the CI workflow wiring. The
  format-hooks plan touches NO package.json / scripts / locales.
- **D-7** Re-extract is orchestrator-owned BETWEEN waves: after Wave-1 merge, run
  `bun run i18n:extract`, commit refreshed catalogs (en→1010, et/ru empty shells→
  1010). Wave-2 translation executors branch off that and fill et/ru only.
- **D-8** Translation = single-writer per locale (et plan ≠ ru plan; disjoint files
  `locales/et/messages.po` vs `locales/ru/messages.po`).

## Recommended wave/plan structure (planner may refine)
- **Wave 1** (parallel, disjoint):
  - **15-01** format hooks (`src/lib/format/*` new) + route the render sites +
    unit tests. NO package.json/scripts/locales.
  - **15-02** both CI guard scripts (`check-i18n-format.mjs` + `check-i18n-catalog.mjs`)
    + their `__tests__` self-tests + package.json `lint:i18n*` entries + CI workflow
    jobs/paths. NO feature/locale edits. (Guards verified GREEN post-merge by
    orchestrator, since format-route lands in 15-01.)
- **Orchestrator** between waves: `bun run i18n:extract`; commit refreshed catalogs.
- **Wave 2** (parallel, disjoint):
  - **15-03** fill `locales/et/messages.po` (~1010) — lift from legacy + native et.
  - **15-04** fill `locales/ru/messages.po` (~1010) — lift from legacy + native ru.
- **Wave 3** (optional, small): I18N-02 verification test touch-up if the existing
  LanguagePage test doesn't already assert reload-free activation (it likely does —
  may be zero-code).

## Landmines
- `lint:imports` (FOUND-02) substring-matches `sync`/`idb`/`offline` — `format`/
  `i18n`/`catalog`/`locale` are all SAFE.
- bare `tsc --noEmit` silent-passes — gate with `bun run lint:tsc`.
- Render-loop: format hooks must memoize the returned formatter; never create a
  fresh object/fn in a render-deps array (the recurring 4× bug). Read `["me"]` via
  useQuery (already cached), derive tokens, `useMemo` the formatter.
- Lingui `.po` with msgstr containing `%` or `{var}` ICU placeholders: preserve
  placeholders EXACTLY in et/ru (e.g. `{workspaceName}`, `{ok}`, `{fail}`) — a
  dropped/renamed placeholder breaks runtime interpolation. Manifest guard should
  ideally also assert placeholder parity (stretch; at minimum translators must keep
  them verbatim).
- Post-merge SEMANTIC conflict watch (14b lesson): run the FULL gate on the MERGED
  tree, not just per-worktree.
