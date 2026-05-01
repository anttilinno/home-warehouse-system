---
phase: 01-foundation-conflict-spikes
plan: 03
subsystem: i18n
tags: [i18n, lingui, scaffold, spike, FOUND-04]
provides:
  - .planning/research/I18N-DECISION.md
  - frontend2 i18n runtime (Lingui v6 + @lingui/swc-plugin@6.0.0 EXACT pin)
  - frontend2/src/lib/i18n.ts singleton
  - en/et/ru empty .po catalog scaffolds
requires:
  - Plan 01-01 (frontend2/ scaffold + Vite 8 + plugin-react-swc 4.3.0)
affects:
  - Phase 5 (Auth) — mounts <I18nProvider> at App.tsx provider stack
  - Phase 15 (i18n catalog gap-fill) — fills en/et/ru .po with real strings
tech_stack_added:
  - "@lingui/core@^6.0.1"
  - "@lingui/react@^6.0.1"
  - "@lingui/cli@^6.0.1"
  - "@lingui/vite-plugin@^6.0.1"
  - "@lingui/format-po@^6.0.1"
  - "@lingui/swc-plugin@6.0.0 (EXACT pin)"
patterns_added:
  - "Pattern C parity — vite.config.ts and vitest.config.ts share the @lingui/swc-plugin SWC inner-plugins slot"
  - "Pitfall 1 — @lingui/swc-plugin pinned exact (no caret), revisit on every Vite/SWC bump"
key_files:
  created:
    - .planning/research/I18N-DECISION.md
    - frontend2/lingui.config.ts
    - frontend2/src/lib/i18n.ts
    - frontend2/src/locales/en/messages.po
    - frontend2/src/locales/et/messages.po
    - frontend2/src/locales/ru/messages.po
  modified:
    - frontend2/package.json
    - frontend2/bun.lock
    - frontend2/vite.config.ts
    - frontend2/vitest.config.ts
decisions:
  - "Lingui v6 wins on D-03 tiebreaker (both candidates passed all 3 D-01 tests; predecessor v2.0/v2.1 shipped Lingui v5 + .po; SWC pipeline was locked technical assumption A1)"
  - "Pin @lingui/swc-plugin@6.0.0 EXACT (no caret) per Pitfall 1"
  - "Use @lingui/format-po formatter() function (v6 dropped string format='po')"
  - "Macro imports from @lingui/react/macro (v6 path), not @lingui/react"
metrics:
  duration_iso: "PT~25M"
  completed_at: "2026-05-01"
  tasks_completed: 2
  files_changed: 10
requirements: [FOUND-04]
---

# Phase 01 Plan 03: i18n Spike + Winner Install — Summary

i18n library decision empirically locked via three-part D-01 spike on a throwaway branch (`spike/i18n-decision`, tag `spike/i18n-decision-evidence`); Lingui v6 + @lingui/swc-plugin@6.0.0 installed in main scaffold with en/et/ru .po catalogs and a runtime singleton ready for Phase 5 to mount.

## Spike Winner

**Lingui v6** (D-03 tiebreaker — both candidates passed all three tests).

| Candidate | Test 1 (compile) | Test 2 (extract) | Test 3 (runtime et) |
|-----------|------------------|------------------|---------------------|
| Lingui v6 + @lingui/swc-plugin@6.0.0 | PASS — 256.60 kB / 81.07 kB gzip, 736ms | PASS — 3 msgids in en/messages.po | PASS — vitest 1/1, jsdom |
| react-intl@6.8.9 + @formatjs/cli@6.14.4 | PASS — 256.71 kB / 81.18 kB gzip, 177ms | PASS — 3 msgids in en/messages.json | PASS — vitest 1/1, jsdom |

Verdict: Lingui v6 wins per D-03 (predecessor v2.0/v2.1 shipped Lingui v5 + .po; SWC pipeline was locked technical assumption A1; catalog format continuity preserves translator workflow).

## Spike Branch Artifacts

- Branch: `spike/i18n-decision` (HEAD `263ae547f6fb985bb2b4bf3669e7a11162561ee1`)
- Tag: `spike/i18n-decision-evidence`
- Commits:
  - `2d8a0d3 spike(i18n): Lingui v6 candidate evidence`
  - `263ae54 spike(i18n): react-intl candidate evidence`
- **Status: NOT MERGED** (per D-04). Retained for archaeology.

## Pinned Version (Pitfall 1)

`@lingui/swc-plugin@6.0.0` — EXACT pin, no caret. Verified in `frontend2/package.json`:

```json
"@lingui/swc-plugin": "6.0.0"
```

**Pitfall 1 reminder:** Revisit this pin on every Vite or `@vitejs/plugin-react-swc` bump. The SWC plugin's WASM artifact is platform-dependent and tightly coupled to the SWC runtime version embedded in `plugin-react-swc`.

**Pitfall 2 reminder:** When Phase 15 imports legacy v2.0/v2.1 `et` catalogs, run `lingui extract --convert-from=v5` once if the format header differs. Predecessor v5 PO is likely format-compatible — verify on import.

## Bundle Size Delta vs Plan 01 Baseline

Plan 01 baseline (no i18n installed): main chunk approximately 250 kB / ~78 kB gzip (from 01-01-SUMMARY.md). Plan 03 post-install (Lingui plugins active, fixture tree-shaken because nothing imports it yet): **256607 raw / 80129 gzip (`dist/assets/index-BD9RvfEc.js`)**. Delta: **+~6 kB raw / +~2 kB gzip** for plugin glue not yet stripped (the as-used cost lands when Phase 5 mounts `<I18nProvider>`).

`du -sh frontend2/dist/` post-install: **268K**.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Run i18n spike on throwaway branch and write I18N-DECISION.md | `863cada` | `.planning/research/I18N-DECISION.md` (+ spike branch retained off-tree) |
| 2 | Install winner (Lingui v6) into main scaffold | `5dbdf58` | `frontend2/{package.json,bun.lock,vite.config.ts,vitest.config.ts,lingui.config.ts,src/lib/i18n.ts,src/locales/{en,et,ru}/messages.po}` |

## Verification

- `bun run lint:tsc` — PASS (no errors)
- `bun run lint:imports` — PASS (no forbidden specifiers introduced; Lingui transitive deps clean)
- `bun run build` — PASS (✓ 210ms; 256.60 kB / 81.07 kB gzip)

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 3 — Blocking] Lingui v6 requires `@lingui/format-po` as a separate package**

- **Found during:** Task 1 (spike, Lingui Test 1 compile)
- **Issue:** Plan 03 Task 1 step 2c and Task 2 step 5 both specify `lingui.config.ts` with `format: "po"` (string). Lingui v6 deprecated string formats in favor of formatter functions imported from separate packages. The first `bun run build` failed with: *"String formats like `{format: po}` are no longer supported. Formatters must now be installed as separate packages and provided via format in lingui config: `import { formatter } from "@lingui/format-po"`"*.
- **Fix:** Added `@lingui/format-po@^6.0.1` to dev deps (both spike and main scaffold installs); replaced `format: "po"` with `format: formatter({ lineNumbers: false })` in `lingui.config.ts` (both spike and main scaffold).
- **Files modified:** `frontend2/package.json`, `frontend2/lingui.config.ts`
- **Documented in:** I18N-DECISION.md "Key Findings That Will Affect Plan 03 Task 2"
- **Commit:** `5dbdf58` (carried into Task 2)

**2. [Rule 3 — Blocking] Lingui v6 macros live at `@lingui/react/macro`, not `@lingui/react`**

- **Found during:** Task 1 (spike, Lingui Test 1 compile — initial fixture)
- **Issue:** Plan 03 Task 1 step 2d specifies `<Trans>Hello, world</Trans>` and `<Plural>` from `@lingui/react`. In v6, `@lingui/react` exports the runtime `Trans` component (which requires explicit `id`/`message` props). The JSX-template-literal macros (`Trans`, `Plural`, `Select`) live at `@lingui/react/macro` and are transformed by `@lingui/swc-plugin` at compile time into the runtime form with hash IDs.
- **Fix:** Spike fixture imports `Trans, Plural` from `@lingui/react/macro`; documented in I18N-DECISION.md so Phase 5 / Phase 15 contributors don't repeat the mistake.
- **Files affected:** spike branch only (`frontend2/src/spike-i18n.tsx` lives off-tree)
- **No commit on master** — fixture stays on spike branch.

**3. [Rule 3 — Blocking] `@formatjs/cli@^7` does not exist on npm**

- **Found during:** Task 1 (spike, react-intl Test 2 prep)
- **Issue:** Plan 03 Task 1 step 3b and Task 2 (react-intl branch) step 1 both specify `@formatjs/cli@^7`. npm registry has only up to `@formatjs/cli@6.14.4`; no v7 published yet.
- **Fix:** Used `@formatjs/cli@^6.14.4` (latest available). Documented in I18N-DECISION.md Candidate B section.
- **Impact:** None — Lingui won, react-intl path not taken in main scaffold; the version mismatch only affected the throwaway spike.

### Skipped checks (out of scope)

**A. `bash scripts/verify-phase-01-scaffold.sh` — script does not exist in this worktree**

- **Why:** That script is Plan 02's deliverable. Plan 02 is running in a parallel worktree (Wave 2) and its commits are not yet on this worktree's branch.
- **Action taken:** Skipped the invocation. Wave-2 orchestrator merge will integrate both Plan 02 and Plan 03 outputs; the integrated health check happens then.
- **Per execution context:** the parallel-execution note in the prompt confirms parallel worktree mode and orchestrator-owned shared-file updates.

## Auth Gates

None — empirical spike work used local Vite/Vitest only; no external auth needed.

## Implications for Future Phases

- **Phase 5 (Auth):** Mount `<I18nProvider i18n={i18n}>` from `@lingui/react` at the App.tsx provider stack (above AuthProvider, ToastProvider). Use `loadCatalog(locale)` from `frontend2/src/lib/i18n.ts` at mount time. `useLingui()` then becomes available app-wide.
- **Phase 15 (i18n catalog gap-fill):** Populate `en/et/ru/messages.po` with real strings. Add CI extract→merge→diff manifest guard (Pitfall #9) at this phase.
- **Pitfall 1 — pinning:** `@lingui/swc-plugin@6.0.0` is exact-pinned. Any Vite or `@vitejs/plugin-react-swc` bump must validate against this plugin version; if incompatible, treat as a separate spike (mini-D-01) before bumping.
- **Pitfall 2 — v5→v6 catalog conversion:** Phase 15 imports of legacy v2.0/v2.1 ET catalogs may need `lingui extract --convert-from=v5` if the .po format header differs. Verify on import.
- **Macro path:** All future code uses `import { Trans, Plural, Select } from "@lingui/react/macro"` — never bare `@lingui/react` for the macro components (the bare path's `Trans` is the runtime component requiring explicit `id`/`message`).

## Self-Check: PASSED

Created files exist:

- `.planning/research/I18N-DECISION.md` — FOUND
- `frontend2/lingui.config.ts` — FOUND
- `frontend2/src/lib/i18n.ts` — FOUND
- `frontend2/src/locales/en/messages.po` — FOUND
- `frontend2/src/locales/et/messages.po` — FOUND
- `frontend2/src/locales/ru/messages.po` — FOUND

Commits exist:

- `863cada docs(01-03): lock i18n decision — Lingui v6 wins (D-04)` — FOUND
- `5dbdf58 feat(01-03): install Lingui v6 winner into main scaffold` — FOUND

Spike artifacts exist:

- branch `spike/i18n-decision` HEAD `263ae547f6fb985bb2b4bf3669e7a11162561ee1` — FOUND
- tag `spike/i18n-decision-evidence` — FOUND

Acceptance criteria (Plan §verification automated grep block, Lingui branch):

- `@lingui/core` in package.json — FOUND
- `lingui()` in vite.config.ts — FOUND
- `@lingui/swc-plugin` in vite.config.ts AND vitest.config.ts — FOUND
- `i18n:extract: lingui extract` script — FOUND
- `lingui.config.ts` with `"en", "et", "ru"` — FOUND
- en/et/ru `messages.po` files — FOUND
- `@lingui/swc-plugin: "X.Y.Z"` (exact, no caret) — FOUND (`6.0.0`)
- `defaultLocale = "en"` in `src/lib/i18n.ts` — FOUND
