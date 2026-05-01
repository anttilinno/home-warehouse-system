# i18n Library Decision (FOUND-04, D-01..D-04)

**Date:** 2026-05-01
**Spike branch SHA:** 263ae547f6fb985bb2b4bf3669e7a11162561ee1
**Tag:** `spike/i18n-decision-evidence`
**Spike branch name:** `spike/i18n-decision`

## Verdict

**Lingui v6** wins.

Rationale: BOTH candidates (Lingui v6 + @lingui/swc-plugin AND react-intl + @formatjs/cli) passed all three tests under Vite 8.0.10 + @vitejs/plugin-react-swc 4.3.0 + Vitest 4.1.5 + React 19.2.5. With both passing, the D-03 tiebreaker applies: predecessor `/frontend2` v2.0/v2.1 shipped Lingui v5 with EN/ET catalogs, the SWC pipeline path was the locked technical assumption (A1 in 01-RESEARCH.md), and continuity of the catalog format (.po) carries forward translator workflow. Lingui v6 wins on tiebreaker.

## Evidence

### Candidate A: Lingui v6 + @lingui/swc-plugin

| Test | Result | Evidence |
|------|--------|----------|
| 1. Compile under Vite 8 + SWC | PASS | `vite v8.0.10 building...` → `dist/assets/index-BD9RvfEc.js   256.60 kB │ gzip: 81.07 kB` → `✓ built in 736ms` |
| 2. CLI extraction | PASS | `bun run i18n:extract` produced `src/locales/en/messages.po` containing 3 msgids: `Hello, world` / `Hello {username}` / `{count, plural, =0 {no items} one {1 item} other {# items}}`. Catalog statistics: en=3, et=3 (3 missing). |
| 3. Runtime render in et | PASS | vitest 1/1 passed: `Lingui v6 spike — runtime render in et > shows translated strings when et locale is active` — DOM contained `Tere, maailm` / `Tere Antti` / `3 eset`; source string `Hello, world` did NOT appear. |

Resolved versions:

- `@lingui/swc-plugin`: **6.0.0** (record exact for Pitfall 1 pinning — no caret in main scaffold install)
- `@lingui/core`: 6.0.1
- `@lingui/react`: 6.0.1
- `@lingui/cli`: 6.0.1
- `@lingui/vite-plugin`: 6.0.1
- `@lingui/format-po`: 6.0.1 — **NEW in v6**: format must be a `formatter()` function from a separate package, not a string literal `"po"`. Plan's Task 2 step 5 lingui.config.ts template needs amendment.

Note on macro path: in v6 the JSX macros (`Trans`, `Plural`) live at `@lingui/react/macro`. The plain `Trans` from `@lingui/react` requires explicit `id`/`message` props and does NOT accept template-string children. The SWC plugin transforms `import { Trans, Plural } from "@lingui/react/macro"` into the runtime form with hash IDs (e.g., `5AIpIH`, `Qov6z6`, `MsjnH4`).

### Candidate B: react-intl + @formatjs/cli

| Test | Result | Evidence |
|------|--------|----------|
| 1. Compile under Vite 8 + SWC | PASS | `vite v8.0.10 building...` → `dist/assets/index-6b98dzcs.js   256.71 kB │ gzip: 81.18 kB` → `✓ built in 177ms`. No Babel needed; `vite-plugin-babel` NOT installed (AP-7 honored). |
| 2. CLI extraction | PASS | `bun run i18n:extract` (formatjs extract) produced `src/locales/en/messages.json` with 3 msgids: `greeting` / `helloUser` / `itemCount`, each with `defaultMessage` field. |
| 3. Runtime render in et | PASS | vitest 1/1 passed: `react-intl spike — runtime render in et > shows translated strings when et messages are provided` — DOM contained `Tere, maailm` / `Tere Antti` / `3 eset`; source string `Hello, world` did NOT appear. |

Resolved versions:

- `react-intl`: 6.8.9
- `@formatjs/cli`: 6.14.4 — **note**: plan specified `^7` but no v7 exists yet on npm; latest is 6.14.4. Pin lowered accordingly.

## Bundle Size (winner only)

- Main chunk raw: **256607 bytes** (`dist/assets/index-BD9RvfEc.js`)
- Main chunk gzip: **80129 bytes** (`gzip -c "$1" | wc -c`)

This is the "Lingui-installed-but-fixture-tree-shaken" size — the spike fixture (`spike-i18n.tsx`) is not imported from `App.tsx`, so the i18n runtime cost lands when Phase 5 mounts `<I18nProvider>`. Treat 80129 B as the post-install baseline; Phase 5/15 will measure the as-used cost.

For comparison: react-intl candidate built to 256.71 kB / 81.18 kB gzip — within 1 kB of Lingui at the empty-usage baseline.

## Implications for Future Phases

- **Phase 5 (Auth):** Mounts `<I18nProvider i18n={i18n}>` from `@lingui/react` at the App.tsx provider stack (above AuthProvider, ToastProvider). `useLingui()` becomes available app-wide.
- **Phase 15 (i18n catalog gap-fill):** Populates `en/et/ru` `.po` catalogs; the CI extract→merge→diff manifest guard (Pitfall #9) belongs to Phase 15.
- **Pitfall 1 (Lingui SWC plugin pinning):** Plan 03 Task 2 pins `@lingui/swc-plugin@6.0.0` EXACT (no caret) per Pitfall 1. Revisit on every Vite/SWC bump (4.3.0 → next).
- **Pitfall 2 (catalog conversion from v5):** Phase 15 will need to import legacy v2.0/v2.1 ET catalogs. Run `lingui extract --convert-from=v5` once if the format header differs (predecessor used Lingui v5 PO — likely compatible; verify on import).
- **Pitfall 9 (i18n migration):** Catalog format stays `.po` (Lingui native); no key migration needed because Phase 15 will start from extracted source-of-truth msgids. ET ports forward verbatim where ID matches; new IDs land empty.
- **Format API change (v6 vs v5):** Plan 03's `lingui.config.ts` template uses string `format: "po"` — this is invalid in v6. Replace with `formatter({ lineNumbers: false })` from `@lingui/format-po`. Documented as Rule 3 deviation.
- **Macro import path (v6):** `import { Trans, Plural } from "@lingui/react/macro"` (not `@lingui/macro` which was the v5 path).

## Spike Branch Artifacts (NOT MERGED)

- Branch: `spike/i18n-decision` (HEAD: `263ae547f6fb985bb2b4bf3669e7a11162561ee1`)
- Tag: `spike/i18n-decision-evidence`
- Commits on spike branch:
  - `2d8a0d3 spike(i18n): Lingui v6 candidate evidence` — full Lingui install, fixture, build/extract/test PASS
  - `263ae54 spike(i18n): react-intl candidate evidence` — Lingui removed; react-intl install, fixture, build/extract/test PASS
- Test fixture: `frontend2/src/spike-i18n.tsx` (lives on spike branch only — varies between commits depending on candidate)
- Both candidates' install state captured in branch history; reproducible by `git checkout 2d8a0d3` (Lingui) or `git checkout 263ae54` (react-intl).

## Key Findings That Will Affect Plan 03 Task 2

1. **`@lingui/format-po` must be installed** as a dev dep (separate package in v6). Plan template missing it.
2. **Lingui config `format` field** must be `formatter({ lineNumbers: false })` from `@lingui/format-po`, not the string `"po"`.
3. **Macros import** from `@lingui/react/macro`, not `@lingui/react` directly (the latter exports the runtime `Trans` component which requires explicit `id`/`message`).
4. **Pinned SWC plugin version: `6.0.0`** (the version that worked in the spike).
