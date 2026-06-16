# SonarQube Analysis Report — HW Frontend

SonarQube Community v26.6 · project key `hw-frontend` · sources `frontend/src` · generated 2026-06-16 · ephemeral local server.

**Quality Gate: OK ✅**

## 1. Summary Metrics

| Metric | Value |
| --- | --- |
| Bugs | 15 |
| Vulnerabilities | 0 |
| Code Smells | 305 |
| Security Hotspots | 3 |
| Coverage | 0.0% (none imported) |
| Duplicated Lines Density | 3.0% |
| Duplicated Blocks | 63 |
| Lines of Code (ncloc) | 28,377 |
| Total Lines | 36,617 |
| Files | 310 |
| Functions | 2,413 |
| Cyclomatic Complexity | 4,425 |
| Cognitive Complexity | 1,547 |
| Comment Lines Density | 15.7% |
| Technical Debt (sqale_index) | 1,618 min ≈ 27 h (~3.4 dev-days @ 8h) |
| Reliability Rating | B (2.0) |
| Security Rating | A (1.0) |
| Security Review Rating | E (5.0) |
| Maintainability Rating (sqale) | A (1.0) |

Rating scale: 1.0=A, 2.0=B, 3.0=C, 4.0=D, 5.0=E.

## 2. Issues Overview

Total issues: **320**

### By Severity

| Severity | Count |
| --- | --- |
| BLOCKER | 0 |
| CRITICAL | 3 |
| MAJOR | 80 |
| MINOR | 237 |
| INFO | 0 |

### By Type

| Type | Count |
| --- | --- |
| CODE_SMELL | 305 |
| BUG | 15 |
| VULNERABILITY | 0 |

## 3. Top 15 Rules by Count

| Rule | Count | Description (inferred) |
| --- | --- | --- |
| `typescript:S6759` | 127 | Mark React component props as read-only. |
| `typescript:S3358` | 36 | Extract nested ternary operations into independent statements. |
| `typescript:S7764` | 33 | Prefer `globalThis` over `window`. |
| `typescript:S1874` | 19 | Avoid deprecated APIs (e.g. deprecated `FormEvent`). |
| `typescript:S1082` | 15 | Non-interactive elements with click handlers need a keyboard listener (a11y). |
| `typescript:S6819` | 12 | Use the `<dialog>` element instead of `role="dialog"` (a11y). |
| `typescript:S4325` | 12 | Remove unnecessary type assertion (does not change the type). |
| `typescript:S6848` | 10 | Avoid non-native interactive elements; add proper role + keyboard/mouse/touch support. |
| `typescript:S7735` | 8 | Avoid unexpected negated conditions. |
| `typescript:S6847` | 6 | Non-interactive elements should not have mouse/keyboard event listeners (a11y). |
| `typescript:S6582` | 6 | Prefer optional chaining (`?.`) over manual null checks. |
| `typescript:S7776` | 5 | Use a `Set` + `.has()` instead of array membership checks. |
| `typescript:S6551` | 5 | Object may stringify to `[object Object]`; provide explicit string. |
| `typescript:S7762` | 3 | Prefer `childNode.remove()` over `parentNode.removeChild()`. |
| `typescript:S1444` | 3 | Make public static property `readonly`. |

## 4. Top 15 Files by Issue Count

| File | Issues |
| --- | --- |
| `src/test/setup.ts` | 10 |
| `src/features/command-palette/CommandPalette.tsx` | 7 |
| `src/components/layout/Bottombar.tsx` | 7 |
| `src/features/sse/SSEProvider.tsx` | 6 |
| `src/components/retro/overlay/RetroDialog.tsx` | 6 |
| `src/components/layout/LogoutConfirm.tsx` | 6 |
| `src/lib/scanner/scan-history.ts` | 5 |
| `src/lib/api.ts` | 5 |
| `src/features/loans/components/BorrowerLoanPanels.tsx` | 5 |
| `src/features/items/components/PhotoLightbox.tsx` | 5 |
| `src/features/inventory/components/InlineEditCell.tsx` | 5 |
| `src/components/retro/overlay/Popover.tsx` | 5 |
| `src/components/retro/form/RetroFileInput.tsx` | 5 |
| `src/components/layout/Sidebar.tsx` | 5 |
| `src/features/imports/ImportsPage.tsx` | 4 |

## 5. BLOCKER and CRITICAL Issues

No BLOCKER issues.

3 CRITICAL issues:

| File:Line | Rule | Message |
| --- | --- | --- |
| `src/components/retro/data/RetroTree.tsx:120` | `typescript:S3776` | Refactor this function to reduce its Cognitive Complexity from 18 to the 15 allowed. |
| `src/features/command-palette/CommandPalette.tsx:123` | `typescript:S2004` | Refactor this code to not nest functions more than 4 levels deep. |
| `src/features/inventory/components/InlineEditCell.tsx:46` | `typescript:S3776` | Refactor this function to reduce its Cognitive Complexity from 16 to the 15 allowed. |

## 6. Security Hotspots

Total: **3** (all status `TO_REVIEW`). These drive the Security Review Rating of E.

| File:Line | Category | Probability | Message |
| --- | --- | --- | --- |
| `src/features/settings/RegionalFormatsPage.tsx:96` | dos | MEDIUM | Make sure the regex used here, which is vulnerable to super-linear runtime due to backtracking, cannot lead to denial of service. (`typescript:S5852`) |
| `src/lib/format/tokens.ts:76` | dos | MEDIUM | Make sure the regex used here, which is vulnerable to super-linear runtime due to backtracking, cannot lead to denial of service. (`typescript:S5852`) |
| `src/components/retro/filters/useSavedFilters.ts:88` | weak-cryptography | MEDIUM | Make sure that using this pseudorandom number generator is safe here. (`typescript:S2245`) |

## 7. Notes

- **Sources scope:** only `frontend/src` was scanned. Tests, locales, and `dist`/build output were excluded from `sonar.sources`.
- **Coverage is 0%** because no coverage report (LCOV) was imported, not because tests are absent. The 0.0% figure reflects "no data," not measured uncoverage.
- This was a **fresh scan against the default Sonar Way quality profile** on an ephemeral local SonarQube Community v26.6 server. No custom rules, baselines, or new-code-period were configured.
- The Security Review Rating (E) is driven entirely by the 3 unreviewed hotspots; the Security Rating itself is A (zero vulnerabilities). The vast majority of issues are maintainability code smells, dominated by `S6759` (read-only props), accounting for ~40% of all issues.
