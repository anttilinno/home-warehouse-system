# Phase 15 — VALIDATION

Goal-backward acceptance for I18N-01/02/03. Each must be GREEN before flipping.

## I18N-01 — catalogs en/et/ru complete + manifest guard
- [ ] `bun run i18n:extract` shows en/et/ru identical totals, **0 missing** for et + ru.
- [ ] No `msgstr ""` in `locales/et/messages.po` or `locales/ru/messages.po`
      (excluding the po header).
- [ ] ICU placeholders (`{var}`, `%`) preserved verbatim in every et/ru msgstr.
- [ ] `node scripts/check-i18n-catalog.mjs` exits 0 on the complete tree; exits
      non-zero when a msgstr is emptied or a msgid set diverges (self-test proves it).
- [ ] `scripts/__tests__/check-i18n-catalog.test.mjs` passes via `node --test`.
- [ ] CI `lint-frontend2.yml` runs the catalog guard as a job (+ `paths` includes it).

## I18N-02 — locale switcher persists + instant (verify-only)
- [ ] Settings → Language select → PATCH `users/me/preferences {language}` then
      `loadCatalog` (activate) in onSuccess; NO `window.location.reload`.
- [ ] `LanguagePage.test.tsx` green and asserts PATCH-then-activate-once ordering +
      no-activate-on-failure (already present; confirm still green post-phase).
- [ ] Live: switching locale re-renders visible strings without a full reload.

## I18N-03 — format hooks used everywhere + grep guard
- [ ] `src/lib/format/` exports `useDateFormat`/`useTimeFormat`/`useNumberFormat`,
      bound to the `["me"]` preference tokens (date_format/time_format/
      thousand_separator/decimal_separator) with correct defaults when pending.
- [ ] Pure token→string helpers unit-tested for every token value (4 date, 2 time,
      separator combos) incl. invalid-ISO passthrough.
- [ ] Every render site in 15-CONTEXT "render sites" list now calls a hook
      (relativeTime absolute branch, NotificationsDropdown, MonthlyLoanActivityChart
      axis, LoanPanels/BorrowerLoanPanels formatDate, MovementsPanel formatTimestamp).
- [ ] Decorative clocks (Clock.tsx, AppShell) carry `// i18n-format-ignore` with a
      documented rationale; money.ts unchanged.
- [ ] `node scripts/check-i18n-format.mjs` exits 0; non-zero on an un-ignored raw
      `toLocale*`/Date.toString (self-test proves it).
- [ ] `scripts/__tests__/check-i18n-format.test.mjs` passes via `node --test`.
- [ ] CI runs the format guard as a job.

## Phase gate (orchestrator, on MERGED tree)
- [ ] `cd frontend2 && bun run lint:tsc && bun run test && bun run build && bun run lint:imports` all green.
- [ ] `node scripts/check-i18n-format.mjs` + `node scripts/check-i18n-catalog.mjs` green.
- [ ] Live E2E: existing specs still pass (locale switch path covered by
      login-dashboard + settings render; no new spec strictly required, but a
      language-switch assertion is a nice residue if cheap).
- [ ] `gsd-verifier` PASS (goal-backward).
- No backend changes this phase → no Go gate.
