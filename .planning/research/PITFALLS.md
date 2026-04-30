# Pitfalls Research — v3.0 Premium-Terminal Frontend (`/frontend2` rebuild)

**Domain:** Greenfield rebuild of a feature-rich PWA SPA with two simultaneous goals — sketch-005 premium-terminal aesthetic fidelity (TUI chrome, monospace, scanlines, sharp corners, function-key bottombar) AND parity with the legacy `/frontend` (auth/items/loans/borrowers/taxonomy/scan/quick-capture/settings/i18n).
**Researched:** 2026-04-30
**Confidence:** HIGH (grounded in v1.4/v2.0/v2.1 audits + v1.9/v2.2 retrospectives + sketch-005 anti-pattern call-outs + the user's saved `feedback_reskin_not_redesign.md` constraint)

---

## Reading Guide

Pitfalls are grouped by category, but many cross-cut multiple categories. Each pitfall has:

- **What goes wrong** — the failure mode
- **Why it happens** — root cause (training-data bias, schedule pressure, aesthetic dogma, etc.)
- **Warning sign** — how to recognise it early, *concrete signal*
- **Prevention** — actionable test, lint rule, code-review check, or named pattern
- **Phase** — `early` (scaffolding), `mid` (execution), `late` (polish), or `cross-cutting`

The TOP 7 list at the top is not an exhaustive ranking — it is the set most likely to bite us based on this project's shipping history. Predecessor lessons cited inline.

---

## TOP 7 Most-Likely-to-Bite Pitfalls

1. **#1 — "Aesthetic theatre" overrides parity.** Spending two phases polishing scanlines and bevels while real flows (offline create, photo upload, OAuth callback) regress. The `/frontend2` predecessor v2.0 shipped 33/33 requirements but `LAY-01` was satisfied with a 2-item sidebar (ITEMS + LOANS missing) — the aesthetic was right, the navigation wasn't. Prevention: every aesthetic phase has a parity gate.
2. **#2 — Function-key bottombar swallows input keystrokes.** User typing "n" in the search field navigates to `/items/new`. Global `keydown` listeners that don't check `event.target` against editable elements break every form. This is the single biggest TUI-on-web anti-pattern. Prevention: shortcut dispatcher checks `isEditableTarget(e.target)` before firing; CI test simulates typing into every form field.
3. **#3 — Mock-based tests hide contract drift.** Predecessor's G-65-01 (`/frontend2` list-search wrap) hid a backend regression for weeks because every test mocked `itemsApi.list`. The v2.2 fix was a real-backend Playwright spec + a tagged Go integration test (see CLAUDE.md). v3.0 must adopt this from day one for any flow that touches the backend, not as gap-closure later.
4. **#4 — Retroactive VERIFICATION.md fiction.** v2.0 shipped with phases 49/50/52/53 having `nyquist_compliant: false` because Wave 0 sign-offs were never updated. v2.1 shipped with phases 58/59/60 missing VERIFICATION.md and Phase 57's 8 `/demo` checkpoints unsigned. The seductive shortcut at milestone end: write plausible-sounding files from memory. Prevention: every VERIFICATION.md cites commit SHA + test path + UAT screenshot — empty cell = fail.
5. **#5 — Workspace-scoping regression on barcode/lookup endpoints.** Predecessor shipped Plan 65-09 specifically to add `WHERE barcode = $2 AND workspace_id = $1` (Pitfall #5 in v2.2 archive). UPCs are globally unique, so cross-tenant collisions are *guaranteed*, not hypothetical. v3.0 reuses `/api/workspaces/{wsId}/items/by-barcode/{code}`; any new lookup helper that strips the `wsId` is a data leak.
6. **#6 — i18n migration loses message IDs silently.** Lingui (predecessor) used compile-time catalogs. If v3.0 swaps libraries (`react-intl`, `i18next`, native `Intl`) without a key-by-key migration script, missing-msgid errors only appear at runtime in et/ru locales — English passes all tests, Estonian users see English fallback (or `[object Object]`). v2.0 already shipped translation gaps (NotFoundPage in v2.0 had 3 hardcoded strings). Prevention: extract→merge→diff script run in CI on every PR, blocks if et/ru catalogs lose keys.
7. **#7 — Mobile collapse breaks the bottombar.** The function-key bar is desktop/tablet ergonomics. On 360-px iPhone SE width, eight `[KEY] LABEL` shortcuts overflow horizontally. The "obvious" fix (horizontal scroll, hide overflow) breaks discoverability — F1 HELP and ESC LOGOUT must always be reachable. Prevention: explicit mobile fallback contract — collapse to icon-only with action sheet for overflow; don't just clip.

---

## Critical Pitfalls

### Pitfall 1: Aesthetic theatre overrides parity

**What goes wrong:** Two phases burn on scanline polish, bevel tuning, monospace ligatures, while loans CRUD ships with a half-working borrower picker, OAuth callback regresses, and import/export silently uses a wrong endpoint. The milestone hits its aesthetic Definition of Done but users can't actually use the app. v2.0 shipped exactly this pattern — sidebar had 2 of 4 nav items, but every retro token was correct. The predecessor `/frontend2` reached parity in v2.1 but never matched sketch-005 fidelity, the inverse of this pitfall.

**Why it happens:** Aesthetic phases produce visible artefacts (screenshots, demo pages) that feel like progress. Parity phases produce invisible plumbing (typed API clients, query invalidation, pagination contracts) that feel like overhead. Schedule pressure + visual progress bias = aesthetic wins the time budget.

**Warning sign:** Demo screenshots get 10 thumbs-up in chat; nobody has clicked through a real loan-create flow on the deployed instance in a week. Phase reports say "polish complete" but no E2E test of the parity feature was added in that phase.

**Prevention:**
- **Every aesthetic phase has a paired parity gate.** "Phase X: bottombar polish" must include a real-user test of one downstream flow that uses the bottombar (e.g., scan-from-bottombar end-to-end).
- **Parity-first phase ordering.** Build the boring CRUD scaffolding under default Tailwind tokens FIRST, then theme. Counter-intuitive but proven by `/frontend2` v2.0 → v2.1: the v2.0 "retro foundation" produced a theme with a broken sidebar; v2.1 had to fix nav AND add features. A parity-first approach builds nav once, themes it once.
- **Definition of Done = parity + aesthetic, not aesthetic OR parity.** Each requirement maps to (a) an E2E test that exercises real backend, (b) a visual snapshot that asserts the premium-terminal token usage. Both green = ship.
- **Banned phrase in milestone retros: "the aesthetic was right but..."** Treat it as a milestone-level failure signal.

**Phase:** Cross-cutting. Set the rule before Phase 1 begins; enforce at every phase transition.

---

### Pitfall 2: Function-key bottombar swallows input keystrokes

**What goes wrong:** User in the items list focuses the search box, types "n new screwdriver". The global keyboard dispatcher (`useShortcuts`) hears `keydown: 'n'`, fires the dashboard's `Add Item` shortcut, navigates to `/items/new`. Search query is lost; user re-orients in confusion. Every form field is a landmine.

**Why it happens:** TUI shortcut dispatchers are taught as "global window keydown listener" in every demo. The check that distinguishes "user is in the chrome" vs "user is in an input" is often added later, after the bug is reported. Sketch-005 documents the dispatcher as `useShortcuts(page) + <Bottombar />` (see `layout.md` line 152) — the abstraction makes it trivial to forget the input-focus guard.

**Warning sign:** Anyone typing in *any* text input triggers a navigation. The bug is often filed first by a power user typing into the borrower-search combobox.

**Prevention:**
- **Shortcut dispatcher checks `isEditableTarget(e.target)` before firing.** Editable = `input`, `textarea`, `[contenteditable=true]`, `select`, OR any ancestor with `[role=combobox]`/`[role=listbox]` open.
  ```ts
  function isEditableTarget(t: EventTarget | null): boolean {
    if (!(t instanceof HTMLElement)) return false;
    const tag = t.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (t.isContentEditable) return true;
    return false;
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return; // never hijack browser shortcuts
      const hit = shortcuts.find(s => s.key.toLowerCase() === e.key.toLowerCase());
      hit?.action();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shortcuts]);
  ```
- **Function keys (F1, F2, ...) and Escape are universal exceptions** — they fire even from inputs, but ONLY F-keys and Escape, never letter keys.
- **CI keystroke test:** Playwright spec types "nslq" (= every dashboard shortcut) into every form field on every page; assertion = no navigation occurred.
- **Visual contract:** when an input is focused, the bottombar shortcut chips dim to 40% opacity to communicate "shortcuts paused while typing." Reduces user confusion when shortcut doesn't fire.

**Phase:** Early — bottombar must ship with input-focus guard from Day 1, never bolt-on.

---

### Pitfall 3: Global Escape handler conflicts with dialogs/sheets

**What goes wrong:** Bottombar shows `[ESC] LOGOUT` as a global shortcut. User opens a confirmation dialog ("Delete this item?"), presses Escape to cancel — gets logged out instead. Or: user is mid-form on `/items/new`, hits Escape to cancel an autocomplete suggestion list, gets logged out.

**Why it happens:** The TUI metaphor wants Escape = "leave/back". Dialogs follow web convention where Escape = "close this dialog". The two collide unless the listener is carefully scoped.

**Prevention:**
- **Escape never logs out without confirmation.** The `[ESC] LOGOUT` chip opens a confirm dialog; the user has to confirm. Removes the foot-gun entirely.
- **Dialog/sheet components capture Escape and `stopPropagation()`** so the global listener doesn't see it. Use a headless library (Radix `Dialog`, `react-aria` `useOverlay`) — don't hand-roll.
- **Layered listener priority:** topmost overlay handles Escape first; only if no overlay is open does the global handler fire.
- **Test:** Open dialog, press Escape, assert dialog closes and route is unchanged.

**Phase:** Early — alongside Pitfall 2's dispatcher.

---

### Pitfall 4: Bottombar accessibility — screen readers, keyboard-only users, focus management

**What goes wrong:** Bottombar shortcut chips look clickable but are decorative `<span>` elements wrapped in keyboard-only handlers — screen reader announces nothing. Or they ARE buttons but have no accessible name (just `[N]` and `Add Item` rendered in two separate spans, no `aria-label` joining them). Or focus order is wrong: Tab from main content jumps to bottombar before getting to the user menu.

**Why it happens:** TUI aesthetics emphasise visual density; ARIA semantics get bolted on at "polish phase." Sketch-005's bottombar code (see `layout.md` lines 113-127) uses `<button class="bb-shortcut">` (good) but the HTML shown wraps two spans — without `aria-label`, the SR announces "N Add Item" or worse.

**Prevention:**
- **Each shortcut chip is a `<button>` with `aria-label` that combines the key and label.** Visually the spans split; semantically one label.
  ```tsx
  <button
    type="button"
    className="bb-shortcut"
    aria-label={`${labelText} (shortcut: ${keyText})`}
    aria-keyshortcuts={keyText}
  >
    <span aria-hidden="true" className="bb-key">{keyText}</span>
    <span aria-hidden="true" className="bb-label">{labelText}</span>
  </button>
  ```
- **`aria-keyshortcuts` exposes the key** so screen readers and AT can voice "press N to Add Item."
- **Focus order: main content → bottombar → topbar/sidebar.** Use `tabindex` only if the natural DOM order doesn't produce this; better to structure DOM correctly.
- **Reduced-motion support:** the live dot's `step-end blink` (see `components.md` line 88-91) ignores `prefers-reduced-motion`. Honor it: blink → solid when user prefers reduced motion.
- **CI a11y check:** `axe-playwright` run against bottombar in isolation; fail on any violation.

**Phase:** Early — alongside the bottombar component itself. A11y added at polish becomes a 3-week refactor.

---

### Pitfall 5: Monospace tables with international character widths (et/ru)

**What goes wrong:** Activity table column "Actor" assumes 8-char monospace width. Estonian name "Õ. Pärnamäe" renders correctly but Russian Cyrillic ("Ы. Прохоров") in many monospace fonts (JetBrains Mono, IBM Plex Mono, Fira Code) is *wider* per glyph than Latin. Table columns drift; either content overflows or columns break to next line. Worst case: monospace font lacks Cyrillic glyphs entirely → fallback to proportional font → table alignment shatters.

**Why it happens:** "Monospace" is a Latin-script promise. Many programmer fonts have full Cyrillic support but glyph metrics differ. Some fonts (IBM Plex Mono) handle this well; others (Fira Code, certain weights) have known Cyrillic spacing inconsistencies.

**Prevention:**
- **Pick a monospace family with verified Cyrillic + Estonian extended-Latin coverage.** JetBrains Mono and IBM Plex Mono are both good. Verify glyphs render at 14px/16px — render a string `Õ Š Ž Ä Ö Ü Õ Ы Ж Щ Я` in dev and screenshot.
- **Don't rely on character-count widths.** Use CSS `ch` carefully — the `ch` unit is the width of `0` in the current font; non-Latin glyphs are wider. Use `min-width: NNpx` for column reservations, or CSS Grid with `minmax()`.
- **Test with real i18n data, not Lorem Ipsum.** Seed dev DB with Russian + Estonian items; visual regression test the activity table in all three locales.
- **Truncation policy:** when content exceeds column width, truncate with ellipsis (`text-overflow: ellipsis`); show full value in tooltip (`title` attribute or accessible tooltip).
- **Numeric columns (counts, timestamps) MUST be tabular-nums:** add `font-variant-numeric: tabular-nums` so digits align across rows even if the rest of the font is proportional-ish for non-Latin.

**Phase:** Early — typography decision before any list/table is built.

---

### Pitfall 6: Sharp corners + dense layouts break mobile/touch usability

**What goes wrong:** Sketch-005's aesthetic is sharp corners, 1px borders, 32-36px row heights, 11-12px font on bottombar. On a 56-px finger touch target (iOS HIG), users tap the wrong row constantly. Adjacent buttons with no rounded corners and no spacing read as one wide button — touches register on whichever element wins the hit-test. Loan-list with row-tap-to-open and per-row "Mark Returned" inline button = constant misfires.

**Why it happens:** Premium-terminal aesthetic enforces visual density (good for desktop operators) at the cost of touch ergonomics. The sketch was designed at desktop dimensions; mobile collapse wasn't part of the canonical reference.

**Prevention:**
- **Mobile breakpoint (`< 768px`) elevates row heights to 44px minimum** (WCAG 2.5.5 AA) and adds 4-px gaps between adjacent buttons. The aesthetic survives — sharp corners stay, density relaxes.
- **Inline row actions become a swipe-action sheet on mobile** (long-press shows action menu) instead of inline buttons. Predecessor v1.3 already established this pattern.
- **Touch-target audit script:** `axe-playwright` rule `target-size`; CI fails if any tap target < 44×44 on mobile breakpoint.
- **Visual regression at 360px (iPhone SE), 390px (iPhone 14), 768px (tablet portrait), 1024px (desktop).** Pin the matrix.
- **The brand commitment:** sharp corners + dense layout is a *desktop* property. Mobile is the same palette + same monospace + same scanlines, but with relaxed touch ergonomics. Document this explicitly in the design system so junior contributors don't "fix" the mobile padding back to desktop density.

**Phase:** Early — establish the mobile contract during Layout phase, not at polish.

---

### Pitfall 7: Scanlines + low contrast cause eye strain, fail WCAG

**What goes wrong:** Premium terminal aesthetic = green-on-near-black + amber accents + scanline overlay. In sketch-005, body text `--fg-base` on `--bg-app` is approximately 11:1 ratio (good) but `--fg-mid` (group labels, meta text) on `--bg-panel-2` is ~3.5:1 — fails WCAG AA for body text. The scanline `repeating-linear-gradient` overlay knocks effective contrast down further by 5-15% depending on opacity. Users on extended sessions report headaches.

**Why it happens:** Aesthetic dogma — "the dim values are the *aesthetic*, pumping them up loses the look." Designers test at full-brightness in a dark room; users sit in mixed lighting on aging laptop screens.

**Prevention:**
- **Run a contrast audit on the design tokens before any component is built.** Tools: Stark plugin, axe DevTools, manual `chroma-js` script. Document each `--fg-X` / `--bg-Y` pairing's contrast ratio. Anything below 4.5:1 for body text is blocked.
- **Scanline opacity is capped at 5%** (`rgba(0,0,0,0.05)` overlay max). Below 5%, scanlines are visible but don't degrade contrast; above, they do.
- **`prefers-contrast: more` media query** disables scanlines and bumps `--fg-mid` to `--fg-base` automatically. Users with high-contrast OS setting get a flat, no-scanline variant.
- **`prefers-reduced-motion: reduce`** disables the live-dot blink (see Pitfall 4) AND disables any scanline animation if we're tempted to add one.
- **Settings → Appearance toggle: "Reduce visual effects"** — disables scanlines + glows + dim text levels. Power users who feel strain can opt out.
- **Real-user test:** ask three contributors to use `/frontend2` for 30 minutes; ask if eyes feel tired. Anecdotal but cheap.

**Phase:** Early — token audit in Phase 1; reduced-effects toggle by mid-milestone.

---

### Pitfall 8: Mock-based tests hide contract drift between rebuild and existing backend

**What goes wrong:** Predecessor's exact failure mode (G-65-01): frontend list-search wrapped backend response shape silently. Every Vitest mock returned the wrapped shape. Every Playwright test hit `page.route('/api/items', ...)` with a fixture. Real backend response had drifted. Production failed. Bug undetected for weeks.

**Why it happens:** Mock-based tests are fast and parallel-safe, so they're the default. Real-backend tests are slow and require a running Postgres, so they're "flaky" and skipped in CI. Once the team standardises on mocks, every new feature ships with mocks-only coverage and the contract drifts.

**Warning sign:** PR adds a feature; PR's tests are 100% Vitest with `vi.mock('@/lib/api/items')`. No Playwright spec. No backend integration test. CI green. Production broken.

**Prevention:**
- **Adopt the v2.2 gap-closure pattern from Day 1:** every flow that crosses the HTTP boundary has at least one real-backend test. Either:
  - **Frontend Playwright spec** (`E2E_USER` + real backend on `localhost:8080`) — see `frontend2/e2e/*.spec.ts` pattern in CLAUDE.md
  - **Backend Go integration test** (`-tags=integration`, real Postgres via `tests/testdb`) — see `backend/internal/domain/.../handler_integration_test.go`
- **CI matrix:** unit + integration + e2e jobs. Integration + e2e require Postgres + running server. Slow but catches contract drift.
- **PR checklist:** "Have you added a real-backend test for new endpoints/flows?" If "no, mocked only" → reviewer challenges or accepts the gap explicitly.
- **Generated client from OpenAPI/server schema:** if backend exposes Huma's OpenAPI doc (it does), generate the TS client with `openapi-typescript` or similar. Type drift caught at build time, not runtime.
- **Don't delete the existing Playwright spec from CLAUDE.md.** It's the regression guard for Plan 65-09/10; carries forward into v3.0.

**Phase:** Early — testing strategy established in Phase 1; integration test added with the first cross-HTTP flow.

---

### Pitfall 9: i18n migration loses message IDs silently (Lingui → ?)

**What goes wrong:** Predecessor used Lingui v5 with compile-time `.po` catalogs. v3.0's open decision is whether to keep Lingui, switch to native `Intl` + ICU, switch to `react-intl`, or `i18next`. Whatever the choice, the key migration is the danger:
- Old: `t\`Welcome\`` macro → key `Welcome`
- New: `<FormattedMessage id="welcome" defaultMessage="Welcome" />` → key `welcome`
- Russian translation existed for `Welcome`. After migration, `welcome` is missing in ru.json. English: works. Estonian: works (because it has its own catalog with `welcome`). Russian: shows `welcome` as raw string OR shows English fallback OR throws a runtime error depending on library config.

**Why it happens:** Migration scripts written for English keys; non-English keys are dropped because the script only iterates the English catalog. v2.0 already shipped translation gaps (NotFoundPage 3 hardcoded strings, `entity_name` type mismatch). Predecessor v1.8 shipped 3 orphaned translation keys. The pattern recurs.

**Warning sign:** Estonian or Russian smoke test reveals raw message IDs ("welcome" instead of "Tere tulemast"); English passes everything. CI doesn't fail because no test asserts the rendered text in et/ru.

**Prevention:**
- **Migration script writes a manifest:** `[{old_key, new_key, en, et, ru}]` for every key. Diff manifest against old + new catalogs. Any key with empty `et` or `ru` is a fail.
- **CI test:** locale switch test. Render every page in en/et/ru; assert no raw message IDs leak. Use a regex like `/\b[a-z]+(\.[a-z]+)+\b/` on rendered text and reject if matched outside known patterns.
- **`@lingui/cli extract` (or equivalent for new lib) + `lingui compile` in pre-commit hook.** Catalogs always in sync with source.
- **Decision criterion for the i18n library:** does it support extraction-time validation that all locales have all keys? Lingui yes; `react-intl` yes; native `Intl` no (have to roll your own). If choosing native `Intl`, build the validation script first.
- **Gradual migration is safer than big-bang.** Migrate one page at a time; ship et/ru in lockstep with en for that page; lint blocks PRs that add English-only new keys. Predecessor v1.9 retro lesson explicitly: "every key added to en.json must be simultaneously added to et.json and ru.json in the same commit."

**Phase:** Early — i18n library decision in Phase 1; migration script in Phase 2.

---

### Pitfall 10: Auth flow regression — cookie/storage drift between rebuild and existing backend

**What goes wrong:** Predecessor `/frontend2` v2.0 used HttpOnly cookie-based JWT (per `feedback_reskin_not_redesign.md` and CLAUDE.md auth contract). Backend issues `access_token` cookie on `/login`. Rebuilding from scratch, contributor reads "we use JWT" and stores token in localStorage on login. First request with `Authorization: Bearer ...` works. But: backend session-tracking, OAuth refresh flow, CSRF protection (PKCE), and the v2.0 `ThemeSyncer`/`refreshUser()` pattern all assume cookie auth. Mid-milestone, a refresh fails; user is logged out unexpectedly. AuthContext's `setRefreshToken(null)` on any error (v2.0 tech debt #2) gets ported and amplifies the issue.

**Why it happens:** Auth is a place where "rebuild from scratch" is misread as "redecide everything." The auth contract is backend-shaped; frontend choice is constrained.

**Prevention:**
- **Auth is NOT redesigned, only the chrome around it.** Cookie-based auth, `credentials: 'include'`, AuthContext shape, OAuth callback URL, post-login redirect — all carry forward unchanged. Document this explicitly in v3.0 milestone scope.
- **Reuse the existing Playwright auth helper from CLAUDE.md** ("auth contract: useful for future specs" section) — it's a tested contract, do not re-invent.
- **OAuth callback URL stability:** the backend redirects to `/auth/callback` with a one-time code; frontend MUST handle this route. Any rewrite must preserve the exact route + handshake.
- **Session-tracking endpoint compatibility:** v1.5 active sessions feature relies on the `Sec-Session-Id` (or equivalent) header set by backend; rebuild must not strip it via custom fetch wrapper.
- **The AuthContext spurious-logout bug from v2.0 (tech debt #2) MUST be fixed during port:** `setRefreshToken(null)` only on 401/403, NOT on network errors. Concrete check: PR reviewer asserts the catch block discriminates error type.
- **Real-backend Playwright auth test in Phase 1:** login → navigate to authenticated route → reload → still authenticated. Trivially catches storage-shape drift.

**Phase:** Early — auth foundation in Phase 1; treat as port, not redesign.

---

## TUI-Aesthetic Anti-Patterns

### Pitfall 11: Over-using uppercase + tracking destroys readability

**What goes wrong:** Sketch-005 uses uppercase + 0.12-0.18em letter-spacing on group labels, panel headers, button text, badge text, table headers. The pattern leaks into body text, tooltip text, error messages, form-field labels. Long uppercase strings ("FAILED TO UPDATE INVENTORY: WORKSPACE NOT FOUND") are 30% slower to read than mixed-case (well-documented typography research) and Estonian/Russian uppercase is even harder.

**Why it happens:** Uppercase reads as "TUI/terminal" — designers reach for it everywhere. The aesthetic spreads from chrome (where it's correct) to content (where it isn't).

**Warning sign:** Error toasts, validation messages, body paragraphs, item descriptions are uppercase. User complains "feels shouty."

**Prevention:**
- **Uppercase + tracking is a CHROME treatment, not a content treatment.** Document in design system: panel headers, group labels, button text, badge text, status pills, table column headers, key chips. NOT: error messages, body text, form labels (sentence case), item names, descriptions, anything user-supplied.
- **Lint rule:** any new component using `text-transform: uppercase` must be tagged `chrome` in a comment OR be an existing approved component. PR reviewer checks.
- **Russian + Estonian audit:** render error messages and body content in both locales; verify no all-caps Cyrillic or Estonian (which has even longer words and is harder to read uppercased).
- **The brand commitment:** "we are a terminal for inventory, not a terminal user interface." Content respects natural language; chrome is TUI.

**Phase:** Early — design system documentation, before component builds; mid — lint rule + audit.

---

### Pitfall 12: Animating bevels/borders looks glitchy

**What goes wrong:** Sketch-001 + 005 use inset bevel `box-shadow` on panels (`inset 1px 1px 0 rgba(255,255,255,0.05), inset -1px -1px 0 rgba(0,0,0,0.6)`). Tempting to animate the bevel on hover ("subtle 100ms transition feels premium"). Result: the hairline shifts by sub-pixel during the transition, browser anti-aliasing flickers, looks like a render bug. Same for animated `border-color` on keyboard-focused elements — the outline jitters.

**Why it happens:** Web designers are trained that "transition: all 200ms ease" is good. In a hairline-bevel aesthetic it's actively bad. The sketch's `components.md` (line 347) explicitly calls this out: "Don't add motion to the panel borders."

**Prevention:**
- **Hover/focus state changes happen on CONTENT, not chrome.** Color shift on text is fine; bevel/border opacity shifts are not.
- **Transitions allowed:** `background`, `color`, `text-shadow` (glow) — 80ms ease, per `components.md` button spec.
- **Transitions banned:** `box-shadow` on bevels, `border-width`, `border-color` on hairlines.
- **Code review check:** any component with `transition` or `animation` involving `box-shadow` or `border-*` gets challenged. Exception: full-color borders (e.g., danger-red border on form error) can transition.
- **Reduced-motion compliance:** all chrome transitions are 80ms or less; under `prefers-reduced-motion: reduce`, drop to 0ms (instant).

**Phase:** Mid — once first hover states ship, audit them.

---

### Pitfall 13: Adding chart libs that fight the aesthetic

**What goes wrong:** Dashboard requires a capacity gauge + activity sparkline. Default reach: `recharts`, `chart.js`, `apexcharts`. All ship with rounded corners, smooth curves, opinionated tooltips, default fonts — the exact opposite of premium terminal. Designer "themes" the chart to match (override 30 CSS variables, swap tooltip components, override fontFamily) — bundle grows by 80-150 KB and the chart still looks slightly off.

**Why it happens:** Chart libraries are the assumed default for "we need a chart." Hand-rolling SVG feels like premature optimisation.

**Warning sign:** PR adds `recharts` (or similar) to `package.json` for "just one gauge."

**Prevention:**
- **Hand-rolled SVG is the default for this project.** Sketch-005's gauge and sparkline are explicitly hand-rolled (see `components.md` lines 213-232). Path arc + linear gradient = ~40 lines of JSX, 0 KB bundle, on-aesthetic.
- **The bar for adopting a chart library:** more than 3 distinct chart types AND interactive tooltips AND axis-formatting needs that justify the cost. As of v3.0 scope: gauge + sparkline + maybe stacked-bar — well below threshold.
- **If a chart library is needed, it's `visx` (low-level d3 React)** — it gives primitives, not styled charts; you keep aesthetic control. NOT `recharts` (opinionated styling), NOT `chart.js` (canvas-based, hard to theme).
- **Bundle-size CI guard:** `size-limit` or `bundlewatch` blocks PRs that grow main bundle by > 50KB unexpectedly. Library-import sneak attempts caught at PR time.

**Phase:** Mid — when first chart-needing feature lands.

---

### Pitfall 14: Decorative scanlines obscure data

**What goes wrong:** Scanline overlay applied as a global `::after { background: repeating-linear-gradient(...) }` over the whole viewport (sketch-005 default). On dense data tables — small text, narrow row heights — scanlines visually merge with row borders, making row separation harder to see. Worse: when overlaid on photos in item-detail or quick-capture, scanlines create moiré patterns with photo content.

**Why it happens:** Scanlines are an aesthetic signature; team applies them at the highest level for consistency. Niche cases (photo gallery, dense table) suffer.

**Warning sign:** Users squint at item-list rows; QC item photos look wavy.

**Prevention:**
- **Scanlines are global at low opacity** (max 5%, see Pitfall 7) — visible but non-disruptive on typical content.
- **Per-element scanline opt-out:** any component that renders user content (item photos, document attachments, large image areas) gets `.no-scanlines` class that uses `position: relative; z-index: 1; isolation: isolate;` to prevent the global overlay from compositing on top.
- **Photos: explicit no-scanline area.** The image itself is rendered without overlay; the photo *frame* keeps the chrome aesthetic (border, label).
- **Scanline component is a single source of truth** — not duplicated in 5 places — so changing opacity globally is one CSS variable swap.
- **Visual regression test:** photo gallery, items list, scan result preview — all checked at desktop + mobile breakpoints.

**Phase:** Mid — when the first photo/image-heavy feature ships (item photos, scan result).

---

### Pitfall 15: Glow effects fight focus-visible outlines

**What goes wrong:** Sketch-005 components use `box-shadow: 0 0 8px rgba(255,208,122,0.25)` glow on hover (e.g., `.qa:hover` in `components.md`). Browser default focus-visible outline is also `box-shadow` (in modern resets). Hovering AND focusing an element produces two stacked shadows; one wins, often the glow, and the focus indicator becomes invisible. Keyboard-only users lose focus.

**Why it happens:** Glow is part of the aesthetic; focus rings are an OS/browser concern that designers don't always think about.

**Prevention:**
- **Focus-visible has its own visual treatment** — a 2px solid outline in `--fg-bright`, NOT a `box-shadow`. Survives hover glow.
  ```css
  .btn:focus-visible {
    outline: 2px solid var(--fg-bright);
    outline-offset: 2px;
  }
  ```
- **Test:** keyboard-only walkthrough of every interactive element on every page. Each element shows clear focus state. CI: `axe` rule `focus-visible`.
- **Hover and focus stack additively, not exclusively:** an element can be hovered AND focused; both states' visuals must coexist.

**Phase:** Mid — focus audit after first batch of interactive components.

---

## Migration / Parity Pitfalls

### Pitfall 16: Feature parity gaps invisible until users test

**What goes wrong:** Predecessor v2.1 hit parity in 3 days but the v2.1 audit shows `LAY-01 ⚠️` — sidebar had 2 of 4 nav items. Phase 60 had no VERIFICATION.md. Feature counts said "37/37 satisfied" but real-user testing would have caught the missing nav. v3.0 starts with even more features (parity + scanning + quick capture + offline-aware in-progress), so the parity matrix is huge — gaps will hide in it.

**Why it happens:** Feature lists are easy to write, easy to check off. "Item CRUD: ✓" looks complete but doesn't reveal that bulk-archive isn't wired, or pagination breaks at page 5, or HEIC photos fail upload silently.

**Prevention:**
- **Maintain a parity matrix as a living artefact:** every feature from `/frontend` listed; every cell is `not-started | in-progress | smoke-tested | E2E-passing`. Smoke-tested = manual click-through; E2E-passing = automated test against real backend.
- **At each phase transition, count the matrix.** If smoke-tested ≠ E2E-passing, that's the work, not the next phase.
- **User-facing test plan per feature:** 3-5 click steps; pass/fail. Run by a non-implementing contributor.
- **The 8 unsigned `/demo` checkpoints from v2.1 Phase 57 are a precedent — DON'T repeat.** Every demo / showcase page gets signed by a real visit + screenshot, not a memory backfill.

**Phase:** Cross-cutting — parity matrix from Phase 1, audited at every transition.

---

### Pitfall 17: "Online-only" constraint regresses to offline coupling by accident

**What goes wrong:** Predecessor `/frontend2` had a CI grep guard against `idb`, `serwist`, `offline`, `sync` imports (v2.1 Phase 56). The constraint is online-only because offline is `/frontend`'s concern. Mid-milestone, contributor adds `react-query`'s `persistQueryClient` for "better UX during nav" — uses IndexedDB under the hood, gets through the guard if guard checks string literals not transitive deps. Now `/frontend2` quietly stores cached queries to IndexedDB; v3.0 has accidentally re-acquired offline. Test surface explodes.

**Why it happens:** Online-only is a discipline; the easy reach for "let's persist query cache for snappier reload" undoes it.

**Prevention:**
- **Carry forward the v2.1 CI grep guard** (`scripts/check-forbidden-imports.mjs`) and extend it: `idb`, `idb-keyval`, `serwist`, `workbox`, `localforage`, `dexie`, `persist-query-client`, `offline-first*`. Block transitive too — check `bun pm ls` output for these packages.
- **Document the "no offline state" rule in CLAUDE.md** under v3.0 scope. Contributors hitting it during planning know to push back.
- **"Online-only" is a v3.0 feature** — say so explicitly in milestone scope. Frontend1 owns offline; frontend2 owns aesthetic + speed for online users. If the team wants offline in `/frontend2` later, that's a future milestone, not Pitfall 17 territory.

**Phase:** Early — guard exists in scaffolding; cross-cutting enforcement.

---

### Pitfall 18: SSE / real-time integration looks broken in TUI aesthetic

**What goes wrong:** Backend SSE delivers item-updated events. UI shows a live-dot blink (`step-end` per `components.md`) on the Recent Activity panel header — good. But the dot blinks even when no events arrive (it's a connection indicator, not an event indicator). User watches: dot blinks, table doesn't update. User reports "SSE is broken." Or: SSE reconnect storm during network blip (server restart, mobile cell handover) — dot flickers wildly, table flashes "live", "lost", "live", "lost" — looks like a fault.

**Why it happens:** The TUI live-dot pattern conflates "connection" and "activity"; users read it as "events flowing." Reconnect logic without backoff and without UI smoothing creates flicker.

**Prevention:**
- **Two distinct indicators:** `CONN: live` (steady when connected, blinks during reconnect, red when disconnected) and `EVENTS: 12` (counter that increments per event received). Sketch-005's "last 10 // sse: live" is the model.
- **Reconnect with exponential backoff:** 1s, 2s, 4s, 8s, max 30s. During reconnect, UI shows `CONN: reconnecting` (amber pill, blinking). Don't flip to disconnected immediately — give it 5 seconds.
- **Status pill colour discrimination:** OK = base green, reconnecting = amber, disconnected = danger red. Three distinct colours, three distinct labels. No relying on blink-rate to communicate state.
- **Visibility-aware:** when tab backgrounded, drop SSE connection; reconnect on `visibilitychange: visible`. Saves backend resources, prevents stale-tab reconnect storms.
- **Real-backend Playwright SSE test:** trigger event server-side; assert UI updates within 2s. Catches SSE pipeline regressions.

**Phase:** Mid — when first SSE-driven feature ships (dashboard activity feed, notifications).

---

### Pitfall 19: Activity feed flicker / status thrashing under TUI styling

**What goes wrong:** SSE delivers a burst of 5 events in 200ms (e.g., bulk import). Each event triggers a re-render of the Recent Activity table. With monospace font + scanline overlay + glow on new rows + brief highlight transition, the table flickers like a strobe. Eye-strain, looks broken, accessibility regression.

**Why it happens:** "New row" highlighting is an SSE polish cue; in dense TUI styling it amplifies. Reduced-motion users especially affected.

**Prevention:**
- **Batch SSE events: collect for 250ms, render once.** Loses 250ms of "real-time"; gains stable rendering.
- **New-row highlight is a single brief flash** (200ms `--fg-glow` background fade-out); doesn't loop, doesn't stagger.
- **`prefers-reduced-motion: reduce`** disables the highlight entirely; new rows just appear.
- **Cap displayed activity rows** (last 10-20); old rows drop off the bottom without animation.
- **Test:** simulate 50 events in 1 second; assert UI doesn't drop frames (Lighthouse performance check).

**Phase:** Mid — alongside SSE integration.

---

### Pitfall 20: Scan-route SSE dropped on camera permission re-prompt

**What goes wrong:** Scanner needs the existing `/api/workspaces/{wsId}/items/by-barcode/{code}` endpoint AND SSE for live notifications (e.g., "another user scanned this item"). On `/scan`, both run. iOS re-prompts camera permission (Pitfall #1 in v2.2 archive) → component re-mounts → SSE connection drops and reconnects. If the reconnect logic is naive, the scan history list (last 10 scans, in localStorage) and the SSE-driven UI go out of sync.

**Why it happens:** Combining real-time feeds with permission-volatile peripherals (camera) on a single route is a known integration pattern that's easy to break.

**Prevention:**
- **SSE connection is owned by the AppShell, not the page.** ScanPage subscribes; doesn't manage. Camera re-mount doesn't drop SSE.
- **Scan history is durable** (localStorage); UI re-derives from it on remount.
- **Real-device E2E:** scan, deny then re-allow camera, assert SSE-driven UI didn't break.

**Phase:** Mid — alongside scanning feature.

---

## Velocity / Tradeoff Pitfalls

### Pitfall 21: Aesthetic fidelity slows execution on table-stakes features

**What goes wrong:** Building a paginated items list is 30 minutes of code with default Tailwind primitives. Building it with premium-terminal panels (beveled borders + group label header + monospace tabular-nums + sharp corners + scanline-aware z-index + uppercase column headers + per-row hover glow) is 4 hours. Multiply by 8 list views, 12 forms, 6 dialogs — the aesthetic tax is 60-80 hours per milestone.

**Why it happens:** Every component re-decides aesthetic details from scratch unless a strong primitives library exists.

**Warning sign:** PR for "items list" touches 12 files, includes new CSS for the table chrome that another PR just added.

**Prevention:**
- **Build the primitives library FIRST, before the first list view.** Phase 2-3 should be a `<Panel>`, `<Table>`, `<Form>`, `<Dialog>`, `<Pill>`, `<Bottombar>`, `<KeyChip>` library that bakes in aesthetic. Subsequent feature work uses primitives; aesthetic is "free."
- **Parity-first ordering revisited:** see Pitfall 1 — primitive library is an aesthetic concern but a foundational concern; build it once, well, before scaling features.
- **Defer aesthetic differentiation between similar contexts.** All tables look the same. All forms look the same. Specialised treatments (like the Quick-Action tile) are deprecated (see `components.md` line 350) — bottombar replaces them.
- **The fidelity-velocity tradeoff:** sketch fidelity is essential on chrome (topbar, sidebar, bottombar, page-header, panels) and foundational components (button, input, table, dialog, badge, pill). For specific page layouts, 80% fidelity is fine — the chrome carries the brand.

**What's worth deferring (saves velocity, low aesthetic cost):**
- Hand-rolled chart components beyond gauge + sparkline. If a feature needs a stacked bar, defer to "later" or use simple SVG.
- Animated transitions on non-critical paths (page transitions, route changes). Keep static for v3.0; layer in later.
- Custom scrollbars (a tempting WebKit detail). Default scrollbars work; skin them in v3.1.
- Decorative ASCII art on empty states. Cute but expensive; placeholder text + retro-styled icon suffices.
- Detailed loading skeleton animations matched to each panel's bevel. Use a single shared `<RetroSkeleton>` everywhere.

**What's essential (DO NOT skip):**
- Topbar + sidebar + bottombar chrome — these are the "I am in /frontend2" identity.
- Page-header pattern with `// ROUTE` breadcrumb — every authenticated page has this.
- Live-dot + status pills — the connection-status story.
- Scanline overlay — global aesthetic signature.
- Function-key shortcuts — table-stakes for the TUI metaphor.
- Group labels in sidebar (`// OVERVIEW`) — distinguishes from any generic dark UI.

**Phase:** Cross-cutting — primitive-first ordering decided in Phase 1 plan.

---

### Pitfall 22: Single-PR phases mask gradual quality decay

**What goes wrong:** v2.0 shipped phases 49/50/52/53 with `nyquist_compliant: false` — Wave 0 sign-offs were never updated. Phase 57 had 8 unsigned `/demo` checkpoints. Phases 58/59/60 had no VERIFICATION.md. Each phase looked clean at the time; the audit revealed cumulative gaps.

**Why it happens:** Phase-end ritual ("write VERIFICATION.md, sign /demo") is the lowest-priority task at the end of a phase that's already running long. Skipping it has zero immediate consequence; the cost emerges 2 milestones later when audit reveals the gap.

**Prevention:**
- **Phase transition is a hard gate, not a ritual.** A phase isn't done until VERIFICATION.md is written + UAT screenshots captured + Nyquist compliance flag set. CI check at phase boundary: required files exist, frontmatter has `nyquist_compliant: true`.
- **`/gsd-validate-phase` runs in CI on phase-tagged PRs** — same predecessor pattern, just earlier.
- **Pair-review at phase boundaries:** another contributor (or Claude Code subagent) reviews the phase's exit artefacts. Two-person sign-off on Definition of Done.
- **Track the cumulative gap count weekly:** each Friday, count phases without VERIFICATION.md, demos without sign-off, requirements without traceability. Trend → up = stop new phases until backfill.

**Phase:** Cross-cutting — process discipline, not technical.

---

### Pitfall 23: Fixing "tech debt" by writing tests that pass without exercising

**What goes wrong:** Predecessor v1.4 + v2.2 archive both flag this: pendingchange handler.go covered by tests that hit `status === 200` and don't assert state. Coverage hits 80%; bugs unchanged. Adopted into `/frontend2` v3.0 if the team starts with the same target ("hit 80% coverage on item form") instead of behavior ("user can save item with HEIC photo and reload page").

**Why it happens:** Coverage is a number; tests that touch lines count. Behaviors are harder to enumerate.

**Prevention:**
- **Test names describe behaviors, not methods.** `TestItemSaveWithHEICPhotoSurvivesReload` not `TestSaveItem`.
- **Every new unit test asserts state** (DB row, response body content, emitted event, derived UI state) — not just `toBeOk()`.
- **Coverage is a floor + behaviour list, not a number alone.** PR description for any test PR must list the behaviors protected.
- **Inherits directly from v2.2 PITFALLS #10:** apply the same gate to v3.0 from Day 1.

**Phase:** Cross-cutting.

---

### Pitfall 24: "Wipe and rebuild" psychology produces regression to v1 mistakes

**What goes wrong:** Wiping `/frontend2` and starting fresh gives a clean slate — and a clean memory. Lessons from v2.0 audit (sidebar 2-item gap, AuthContext spurious logout, NotFoundPage hardcoded strings) and v2.1 audit (missing VERIFICATIONs, unsigned demos) and v2.2 archive (G-65-01) are in `.planning/` but contributors building "fresh" may not read them.

**Why it happens:** "Fresh start" feels like license to ignore prior context. Reading old audits is unrewarding compared to writing new code.

**Prevention:**
- **Mandatory reading at milestone kickoff:** v2.0 audit, v2.1 audit, v2.2 archive PITFALLS, RETROSPECTIVE.md. Document this in v3.0 ROADMAP.md as Phase 0.
- **Pitfall checklist embedded in phase plan templates:** each phase plan answers "which pitfalls from research apply here?" Forces re-engagement with the lessons.
- **The wipe is a CODE wipe, not a KNOWLEDGE wipe.** Predecessor work archived under `.planning/milestones/v2.1-phases/`; reference in plan docs.
- **First phase of v3.0 is "carry-forward audit":** explicitly enumerate which v2.0/v2.1 patterns we keep (cookie auth, ThemeSyncer, OAuth callback URL, Playwright auth helper) and which we replace (component library, layout chrome). Document in DECISIONS.md.

**Phase:** Phase 0 — kickoff reading + carry-forward decisions documented.

---

## Mobile Fallback Pitfalls

### Pitfall 25: Bottombar overflow on small viewports

**What goes wrong:** 8 shortcut chips at desktop = ~720px wide. iPhone SE = 320-375px viewport. Chips overflow horizontally. Default fix (`overflow-x: auto`) hides F1 HELP and ESC LOGOUT until user scrolls — they're "global" but become invisible. Worse: scroll-snap-disabled means user fingers accidentally activate adjacent chips while scrolling.

**Prevention:**
- **Mobile bottombar contract: F1 HELP + ESC LOGOUT always visible (right-anchored), context shortcuts in a "more" overflow.**
  ```
  Desktop: [N] Add Item  [S] Scan  [L] Loans  [Q] Capture  [F1] Help  [ESC] Logout    UPTIME ... LOCAL ...
  Mobile:  [N] [S] [L] [...]                                          [F1]   [ESC]
  ```
  Or:
  ```
  Mobile: [⋮ ACTIONS]                                                  [F1] [ESC]
  ```
  Tapping ACTIONS opens a bottom sheet with all context shortcuts.
- **Status row (UPTIME / LOCAL clock) hides on mobile** to free space.
- **Test at 320px (iPhone SE 1st gen — narrowest realistic).** All globally-promised shortcuts visible.
- **Keyboard shortcuts still work even when chip is in overflow** — the dispatcher (Pitfall 2) doesn't care if chip is rendered.

**Phase:** Early — mobile bottombar designed in same phase as desktop.

---

### Pitfall 26: Sidebar collapse vs mobile drawer — two patterns conflated

**What goes wrong:** Sketch-005 has sidebar collapse (`data-collapsed="true"`, 248px → 60px rail). Mobile typically uses a drawer (off-canvas). Implementing both patterns naively: at desktop, button toggles collapsed; at mobile, sidebar disappears entirely. User on tablet (768px) sees neither pattern fits — sidebar takes 30% of screen width, and the rail mode reads as an icon strip without affordance.

**Prevention:**
- **Three breakpoints: desktop (≥1024px) — full sidebar with collapse-to-rail toggle; tablet (768-1023px) — collapsed by default, expand via toggle; mobile (<768px) — drawer hidden by default, hamburger in topbar opens it.**
- **State persistence:** `data-collapsed` for desktop survives reload; mobile drawer state is per-session.
- **The rail (60px) is reachable at all 3 breakpoints** as the default for tablet — but at mobile, even 60px is too much; drawer is correct.
- **Test matrix:** sidebar interaction at 360 / 768 / 1024 / 1440. Each: open, navigate, collapse, drawer open/close.

**Phase:** Early — Layout phase.

---

### Pitfall 27: Mobile FAB collides with bottombar

**What goes wrong:** Predecessor `/frontend` ships FAB at `bottom: 16px + safe-area-inset-bottom`, mobile-only. v3.0 adds a bottombar that's ALSO at the bottom of the viewport. FAB lands on top of the bottombar; bottombar hides FAB. Or both visible but overlapping; tap registers ambiguous.

**Prevention:**
- **On mobile, bottombar is positioned ABOVE the safe-area-inset; FAB is positioned ABOVE the bottombar with a gap.**
  ```css
  .bottombar {
    bottom: env(safe-area-inset-bottom, 0);
  }
  .fab {
    bottom: calc(var(--bottombar-h) + env(safe-area-inset-bottom, 0) + 16px);
  }
  ```
- **OR — and this is the cleaner option — the FAB is a desktop pattern that's deprecated on mobile in favour of the bottombar.** The bottombar IS the mobile primary-action surface. Predecessor `/frontend`'s FAB was needed because `/frontend` had no bottombar; v3.0 has one. Reconsider whether mobile FAB is still required.
- **Decision:** if FAB stays, gap above bottombar. If FAB drops, document the change in v3.0 scope and ensure each FAB action has a bottombar shortcut equivalent.

**Phase:** Early — decision in scope; mid — implementation if kept.

---

### Pitfall 28: Mobile keyboard hides bottombar (iOS Visual Viewport)

**What goes wrong:** User on iOS opens a form, taps an input — software keyboard slides up. Bottombar (`position: fixed; bottom: 0`) is now BEHIND the keyboard. F1 HELP and ESC LOGOUT inaccessible while typing. Worse: layout shift confuses user.

**Why it happens:** iOS Safari's keyboard doesn't resize the viewport (until iOS 16.4+ with Visual Viewport API). Fixed-positioned bottom elements stay glued to the bottom of the document, behind the keyboard.

**Prevention:**
- **Use Visual Viewport API to track keyboard:**
  ```ts
  useEffect(() => {
    const onResize = () => {
      const vv = window.visualViewport;
      if (!vv) return;
      const offset = window.innerHeight - vv.height;
      document.documentElement.style.setProperty('--keyboard-offset', `${offset}px`);
    };
    window.visualViewport?.addEventListener('resize', onResize);
    return () => window.visualViewport?.removeEventListener('resize', onResize);
  }, []);
  ```
- **Bottombar uses the offset:** `bottom: calc(var(--keyboard-offset, 0px) + env(safe-area-inset-bottom, 0))` — slides up with keyboard.
- **Predecessor `/frontend` already solves this for v1.3 mobile UX (Visual Viewport API decision in PROJECT.md Key Decisions).** Carry forward the pattern.
- **Test on real iOS device** (simulator doesn't replicate the keyboard reliably).

**Phase:** Mid — when first form ships on mobile.

---

### Pitfall 29: Tab order chaos on mobile (drawer + bottombar + form)

**What goes wrong:** User opens mobile drawer (hamburger), Tab cycles drawer items, BUT tab also leaks into the (hidden behind drawer) main content. Then closes drawer, opens form, Tab leaks into the bottombar before the form's submit button — bad order.

**Prevention:**
- **`inert` attribute on hidden content:** when drawer open, main content gets `inert`; when modal open, both drawer and main get `inert`. Tab cycle is constrained automatically.
- **Drawer uses `<dialog>` element** (modal=true) for native focus-trap support; or headless library (`@radix-ui/react-dialog`).
- **Bottombar tabindex order: AFTER main content's natural order, so user reaches it last.** Use `tabindex="0"` only if needed.
- **CI a11y check:** keyboard-only walkthrough on mobile breakpoint.

**Phase:** Mid — when drawer + form interact.

---

## SSE / Real-Time Pitfalls (TUI-specific)

### Pitfall 30: Live-dot blink ignored under reduced-motion

**What goes wrong:** Sketch-005 live-dot uses `animation: blink 1.4s step-end infinite` (`components.md` line 88-89). User has `prefers-reduced-motion: reduce` set. Blink continues. Vestibular-impaired user gets motion-sickness from the indicator; OS-level setting ignored.

**Prevention:**
- **Wrap blink in media query:**
  ```css
  @media (prefers-reduced-motion: no-preference) {
    .dot--blink { animation: blink 1.4s step-end infinite; }
  }
  /* fallback: solid dot when reduced-motion */
  ```
- **Solid dot communicates "connected" — no animation needed for state, only for liveness emphasis.**
- **Audit all sketched animations:** scanlines (none currently), live-dot blink, hover transitions, focus transitions. All gated on `no-preference` OR set to 0ms.

**Phase:** Mid — when first animated component ships.

---

### Pitfall 31: SSE-driven activity feed thrashes when viewport hidden

**What goes wrong:** User has tab open in background. SSE keeps streaming. Each event triggers a React re-render, even though nobody's looking. Battery drain on laptop, mobile data, server load. When user returns, the stale render history causes a paint storm.

**Prevention:**
- **`document.visibilityState === 'hidden'` → close SSE connection.** Reconnect on visible. Saves backend resources, prevents stale-tab thrash.
- **TanStack Query's `refetchOnWindowFocus`** complements this for non-SSE queries.
- **Test:** open tab, switch away for 1 minute, return — assert SSE reconnected and UI updated.

**Phase:** Mid — alongside SSE integration.

---

### Pitfall 32: Reconnect storm during backend deploy

**What goes wrong:** Backend deploys (5-10s downtime). All connected `/frontend2` clients lose SSE simultaneously. Naive reconnect: every client retries every 1s. Backend comes back up, gets hammered by N clients reconnecting at the same instant. Backend slows; connections fail; clients retry harder; cascade failure.

**Prevention:**
- **Exponential backoff with jitter:** 1s ± 30% random, 2s ± 30%, 4s ± 30%, ..., max 30s. Jitter prevents thundering-herd alignment.
- **Server health-check before reconnecting:** ping `/api/health` before opening SSE; only retry SSE if health-check OK.
- **Display "RECONNECTING" pill (amber) during backoff** — user sees the system handling it.
- **Visible to user:** a counter or estimated retry time helps reduce confusion.

**Phase:** Mid — alongside SSE integration.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Build aesthetic primitives ad-hoc per page | First page ships fast | Each page reinvents `<Panel>` + `<Table>`; aesthetic drift; PR conflicts on shared CSS | **Never** — primitives library before page #2 |
| Skip mobile breakpoints in early phases | Ships desktop-clean | Mobile becomes 2-week refactor at end | **Never** — mobile is part of every layout phase |
| Mock all backend calls in tests | Fast green CI | Contract drift undetected (G-65-01 pattern) | Only for unit-level component tests; flows MUST have one real-backend test |
| "We'll backfill VERIFICATION.md at milestone end" | Phase ships on time | Pile of unsigned demos + missing files; archive untrustworthy (v2.0/v2.1 pattern) | **Never** — phase isn't done without it |
| Inline `style={{}}` for one-off retro tweaks | Ships quickly | Aesthetic decisions scatter; no single source of truth; theme update requires grep | Only for true one-off — and even then, document in component comment |
| Global keydown handler without input-focus check | Bottombar shortcuts feel snappy | Every form a landmine; users' typing hijacked | **Never** — guard from the first commit |
| Skip et/ru translations "until catalog stabilizes" | English ships fast | Locale gaps surface at audit; v1.8 + v2.0 precedent | **Never** — same-commit i18n parity |
| Use `position: fixed` bottombar without Visual Viewport API | Works on desktop | Hidden behind iOS keyboard | Only if mobile is explicitly out of scope |
| Disable scanlines on photos by `display: none`-ing the overlay | Quick fix | Other hidden side effects on z-index/stacking | Only if scoped to a specific component class with documented intent |
| Hand-roll focus trap for mobile drawer | No new dependency | Subtle a11y bugs; keyboard users stuck | **Never** — use `<dialog>` or Radix |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Backend auth (cookie-based JWT) | Switching to localStorage Bearer in fresh rebuild | Cookie auth carries forward; `credentials: 'include'` |
| OAuth callback (Google, GitHub) | Changing `/auth/callback` route | Route is part of backend contract; preserve |
| `/api/workspaces/{wsId}/items/by-barcode/{code}` | Stripping `wsId` "for simplicity" | Cross-tenant leak; never strip workspace scope |
| SSE notifications | Per-page subscribe + unsubscribe | AppShell-level subscription; pages subscribe to events from a context |
| Photo upload (multipart, HEIC, 10MB) | Shrinking client-side then uploading | Backend handles HEIC; client only resizes for preview |
| Lingui catalogs | Editing `messages.po` by hand | Run `lingui extract`; let tooling generate |
| TanStack Query | Per-component `useQuery` with default `staleTime` | Centralised query keys + factory; sensible per-domain `staleTime` |
| Bottombar shortcut dispatcher | Subscribing per page | One global dispatcher; per-page declares config |
| Mobile drawer | `<aside hidden>` toggle | Native `<dialog>` or Radix Dialog with focus trap |
| Live-dot SSE indicator | Conflating "connection" + "events received" | Two distinct indicators; document the difference |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Scanline overlay re-rendering on every state change | CPU spike on event-heavy pages | Scanlines are CSS pseudo-element on a layout-stable parent; never inside React-rendered subtree | Dashboard with 30+ events/sec |
| Monospace font subset includes all glyphs | Slow first paint on slow connections | Subset font: Latin + Latin-Ext + Cyrillic for Estonian/Russian; not the kitchen sink | Mobile cold-start on 4G |
| Bottombar re-renders on every route change | Minor jank on navigation | Memoize shortcut config by route path | Heavy navigation patterns |
| SSE event triggers React re-render of entire activity table | Frame drops on burst | Batch events (250ms); use virtualised list if >50 rows | Bulk-import scenario |
| FAB radial menu uses `motion`/`framer-motion` | +60KB bundle | CSS keyframes for staggered open | Mobile cold-start |
| Hand-rolled SVG sparkline re-renders on every prop change | Tiny but constant re-render | `React.memo` + stable props | Updated every second from SSE |
| Activity feed table without virtualisation | Layout calc on long lists | Virtualise if >100 rows visible | Power users with long history |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Barcode-lookup endpoint un-scoped to workspace | Cross-tenant data leak (G-65-01 precedent) | `WHERE workspace_id = $1 AND barcode = $2`; integration test with two workspaces |
| Trust client-supplied `workspaceId` | Forgery → read another tenant | Derive from session; never accept from query/body |
| Auth token in localStorage (rebuild misstep) | XSS-readable; CSRF protection lost | Use HttpOnly cookie auth (existing contract) |
| OAuth state CSRF removed during rewrite | Authorization code interception | Preserve PKCE + state cookie pattern |
| Exposing item barcode in URL | Minor; barcodes are GS1-public | Acceptable, but consider hash for analytics URLs |
| Scan history persists across users on shared device | Privacy in shared-laptop scenario | Clear on logout; scope localStorage key by user ID |
| SSE connection without auth check on resume | Reconnect after token expiry sends old token | Re-validate auth on reconnect; force re-login if 401 |
| CSP relaxed during redesign for "design freedom" | XSS surface increased | Maintain existing CSP; if scanline overlay needs `unsafe-inline`, scope precisely |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| All-uppercase error messages | Reads as shouting; non-Latin locales unreadable | Sentence case for content; uppercase only for chrome |
| Bottombar shortcut chip looks decorative (no `<button>`) | Mouse users don't realise they're clickable | Real `<button>` with hover state |
| `[N] Add Item` shortcut fires while user is typing in search | User loses input | Input-focus guard on dispatcher (Pitfall 2) |
| Live-dot blinks even when nothing's happening | "Is this thing working?" | Two indicators: connection (steady/blink) and event-counter |
| SSE reconnect cycles flash UI rapidly | Looks broken | 5-second grace period before showing "disconnected"; backoff with jitter |
| Mobile sidebar drawer loses focus trap | Keyboard users get lost in hidden content | `<dialog>` or `inert` |
| Form submit buttons hidden behind iOS keyboard | User can't see/tap submit | Visual Viewport API; bottombar slides with keyboard |
| Bottombar shortcuts overflow on mobile, F1 hidden in scroll | Help inaccessible exactly when most needed | F1 + ESC always anchored right; context shortcuts collapse |
| Scanlines on item photos | Photos look broken/wavy | Per-element scanline opt-out via `.no-scanlines` + `isolation: isolate` |
| Item-list row tap target < 44px on mobile | Misfires; tap wrong item | Mobile breakpoint elevates to 44px minimum |
| User menu dropdown opens downward, hidden by bottombar | Inaccessible items | Always open upward (sketch's user-menu pattern) |
| Settings → Language change requires reload | Disorienting | Live locale switch; predecessor v1.7 already does this |

---

## "Looks Done But Isn't" Checklist

### Cross-cutting
- [ ] **Bottombar:** Often missing input-focus guard → typing in any input fires shortcuts (Pitfall 2 test)
- [ ] **Bottombar:** Often missing `aria-label` and `aria-keyshortcuts` → screen reader silent (Pitfall 4)
- [ ] **Bottombar:** Often missing mobile overflow plan → F1/ESC scroll-hidden (Pitfall 25)
- [ ] **Sidebar:** Often missing collapse-to-rail testing on tablet (Pitfall 26)
- [ ] **Scanline overlay:** Often missing per-element opt-out → photos look broken (Pitfall 14)
- [ ] **Live dot:** Often missing reduced-motion guard (Pitfall 30)
- [ ] **SSE indicator:** Often conflates connection + events (Pitfall 18)
- [ ] **Focus-visible:** Often invisible behind glow `box-shadow` (Pitfall 15)
- [ ] **Reduced-motion:** Often only honored on bottombar live-dot, not on hover transitions (Pitfall 30)
- [ ] **Touch targets:** Often <44px on mobile (Pitfall 6)

### Auth & API
- [ ] **AuthContext:** Often regresses to spurious-logout-on-network-error (v2.0 tech debt #2)
- [ ] **OAuth callback:** Often broken in fresh rebuild — verify `/auth/callback` route exists with handshake
- [ ] **Cookie auth:** Often replaced with localStorage Bearer in fresh rebuild (Pitfall 10)
- [ ] **Workspace scoping on lookups:** Often missing on new helpers (Pitfall 5 / G-65-01 precedent)
- [ ] **NotFoundPage:** Often hardcoded English (v2.0 tech debt #4)

### i18n
- [ ] **et/ru parity:** Often lags English by N keys → CI catalog diff
- [ ] **i18n migration manifest:** Often missing → silent key drops (Pitfall 9)
- [ ] **Settings → Language:** Often requires reload (regression vs v1.7 pattern)

### Mobile
- [ ] **Mobile keyboard:** Often hides bottombar (Pitfall 28)
- [ ] **Drawer focus trap:** Often hand-rolled and broken (Pitfall 29)
- [ ] **FAB vs bottombar:** Often overlap (Pitfall 27)
- [ ] **Touch-target audit:** Often skipped → axe-playwright fails

### Tests & Process
- [ ] **Mock-only tests:** Often hide contract drift (Pitfall 8 / G-65-01)
- [ ] **VERIFICATION.md:** Often missing for late-milestone phases (v2.0/v2.1 precedent)
- [ ] **`/demo` checkpoints:** Often unsigned (v2.1 Phase 57 precedent)
- [ ] **Nyquist compliance flag:** Often left `false` (v2.0 phases 49/50/52/53 precedent)
- [ ] **Coverage tests:** Often shallow (status-only assertions; v1.4 precedent)
- [ ] **CI grep guard:** Often bypassed by transitive deps (Pitfall 17)
- [ ] **Bundle-size CI:** Often missing → chart libs sneak in (Pitfall 13)

### Aesthetic
- [ ] **Uppercase tracking:** Often spreads to body content (Pitfall 11)
- [ ] **Bevel animations:** Often added on hover (Pitfall 12)
- [ ] **Chart libraries:** Often added when SVG would suffice (Pitfall 13)
- [ ] **Contrast audit:** Often skipped on `--fg-mid` text (Pitfall 7)

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Aesthetic theatre over parity (#1) | HIGH | Pause feature work; build parity matrix; close gaps before continuing aesthetic polish |
| Bottombar swallows keystrokes (#2) | LOW | Add `isEditableTarget` guard to dispatcher; backfill Playwright keystroke test |
| Mock-based contract drift (#8) | MEDIUM | Audit all flows touching backend; add real-backend test for each; fix discovered drift |
| Retroactive VERIFICATION.md fiction (#4 in TOP 7) | HIGH | Delete unverified backfills; re-run real verification; rebuild trust in archive |
| Workspace-scoping regression (#5) | HIGH | Add `wsId` filter; deploy patch; audit query logs for cross-tenant hits; notify if breached |
| i18n key migration loss (#9) | MEDIUM | Run extract→merge→diff script; recover keys from old catalogs; notify et/ru users |
| Auth flow regression (#10) | MEDIUM | Restore cookie-based pattern; force re-login users in broken state |
| Aesthetic spreads to body content (#11) | LOW | Sweep + lint rule; design-system update |
| Scanlines obscure photos (#14) | LOW | Add `.no-scanlines` opt-out class; apply to photo components |
| Mobile bottombar overflow (#25) | LOW | Implement F1+ESC anchoring + overflow sheet |
| SSE reconnect storm (#32) | MEDIUM | Add backoff + jitter; hot-fix deploy; add health-check gate |
| Online-only constraint regression (#17) | MEDIUM | Tighten CI grep guard (transitive); remove offending dep; refactor consumer |

---

## Pitfall-to-Phase Mapping

How v3.0 roadmap phases should address these pitfalls. Phase categories:
- **Phase 0 — Kickoff:** carry-forward audit, mandatory reading, scope decisions
- **Phase 1-2 — Scaffolding:** Vite scaffold, design tokens, primitives library, layout chrome (topbar, sidebar, bottombar), auth port, i18n decision
- **Phase 3-N — Feature parity:** Items, Loans, Borrowers, Taxonomy, Dashboard, Settings, Scan, Quick Capture
- **Phase Final — Polish + Audit:** mobile breakpoint sweep, a11y audit, bundle-size review, VERIFICATION backfills (with evidence)

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| #1 Aesthetic theatre | Phase 0 + cross-cutting | Parity matrix updated at every transition |
| #2 Bottombar swallows keystrokes | Phase 1-2 (bottombar build) | Playwright keystroke test on every form |
| #3 Escape conflicts with dialogs | Phase 1-2 (dialog primitive) | Unit + E2E: dialog open + Escape closes dialog, not logs out |
| #4 Bottombar a11y | Phase 1-2 | axe-playwright on bottombar in isolation |
| #5 Monospace + i18n widths | Phase 1 (typography decision) | Visual regression et/ru data |
| #6 Sharp corners + dense layouts on mobile | Phase 1-2 (Layout) | 360/390/768/1024 viewport tests |
| #7 Scanline + low contrast WCAG | Phase 1 (token audit) | Stark/axe contrast audit; reduced-effects toggle |
| #8 Mock-based contract drift | Phase 1 + cross-cutting | Real-backend test for every flow; carry forward Playwright spec |
| #9 i18n migration | Phase 1 (i18n decision) + Phase 2 (migration script) | extract→merge→diff CI gate |
| #10 Auth regression | Phase 1 (auth port) | Real-backend login + reload Playwright test |
| #11 Uppercase spreads to content | Phase 1 (design system docs) + lint mid | Code review + grep audit |
| #12 Animated bevels | Phase 2 (component library) | Code review check on `transition` + `box-shadow` |
| #13 Chart libs | Phase 2-N (when first chart needed) | Bundle-size CI gate; SVG-first standard |
| #14 Scanlines obscure data | Phase 2 (when first photo/image-heavy feature) | Visual regression photo gallery |
| #15 Glow vs focus-visible | Phase 2 (after first hover states) | Keyboard-only walkthrough |
| #16 Feature parity gaps invisible | Cross-cutting (parity matrix) | Phase-transition audit |
| #17 Online-only regression | Phase 1 (CI grep guard) | Transitive dep check |
| #18 SSE indicator confusion | Phase 3-N (when SSE feature ships) | Two-indicator pattern verified |
| #19 SSE event flicker | Phase 3-N | 50-events-per-sec test |
| #20 Scan SSE drop on permission re-prompt | Phase 5+ (Scanning) | Real-device E2E |
| #21 Aesthetic fidelity slows execution | Phase 1-2 (primitives-first) | Per-phase velocity reasonable |
| #22 Phase-end ritual decay | Cross-cutting | CI gate on phase-transition PRs |
| #23 Coverage gaming | Cross-cutting | Test-name behavior check; assertion-on-state |
| #24 Wipe psychology regression | Phase 0 (mandatory reading) | DECISIONS.md carry-forward audit |
| #25 Bottombar mobile overflow | Phase 1-2 (mobile bottombar) | 320px viewport test |
| #26 Sidebar collapse vs drawer | Phase 1-2 (Layout) | Three-breakpoint matrix |
| #27 FAB vs bottombar collision | Phase 1-2 (Layout decision) | Visual + interaction test mobile |
| #28 Mobile keyboard hides bottombar | Mid (when first form ships mobile) | Real-iOS device test |
| #29 Tab order chaos | Mid (when drawer + form interact) | Keyboard-only walkthrough mobile |
| #30 Reduced-motion ignored | Mid (animation audit) | OS reduced-motion test on Mac/Windows |
| #31 SSE thrashes when hidden | Phase 3-N | visibilityState test |
| #32 Reconnect storm | Phase 3-N | Backoff + jitter + health-check |

---

## Sources

### Project ground truth (HIGH confidence)
- `.planning/PROJECT.md` — v3.0 milestone scope, predecessor v2.0/v2.1 validated requirements + tech debt, Key Decisions
- `.planning/MILESTONES.md` — predecessor shipping history (v1.3 mobile UX, v1.7 settings, v1.8 OAuth, v1.9 quick capture, v2.0 retro, v2.1 parity)
- `.planning/v2.0-MILESTONE-AUDIT.md` — sidebar gap (LAY-01), AuthContext spurious logout, NotFoundPage hardcoded strings, Nyquist compliance gaps, requirements-doc traceability gaps
- `.planning/v1.4-MILESTONE-AUDIT.md` — coverage-gaming risk pattern (`pendingchange`, `jobs`), orphaned factories, waitForTimeout debt
- `.planning/RETROSPECTIVE.md` — v1.9 lessons (single-route iOS camera, photo retry pre-write, zero-new-deps discipline, i18n parity rule)
- `.planning/research/v2.2-archive/PITFALLS.md` — direct precedent for scanning + camera + workspace-scoping pitfalls (G-65-01); 35 pitfalls covering stabilization theatre, coverage gaming, retroactive VERIFICATION fiction
- `.planning/research/v2.2-archive/SUMMARY.md` — backend endpoint contract (`/api/workspaces/{wsId}/items/by-barcode/{code}`), CI grep guard pattern, online-only constraint
- `CLAUDE.md` — Playwright auth contract, real-backend test pattern (Plan 65-09/10/11), e2e + integration test infrastructure
- `.claude/skills/sketch-findings-home-warehouse-system/references/components.md` — explicit anti-pattern call-outs: don't animate panel borders, don't add chart libs, don't drop table-header background, deprecated Quick-Action tile
- `.claude/skills/sketch-findings-home-warehouse-system/references/layout.md` — bottombar source of truth, sidebar grouping pattern, sketch anti-patterns: don't use flat nav, don't put body content in topbar, don't make sidebar non-collapsible

### Secondary (MEDIUM confidence)
- `~/.claude/projects/.../memory/MEMORY.md` — `feedback_reskin_not_redesign.md` user constraint (frontend1 = re-skin, frontend2 = redesign explicitly authorized)
- v2.2 archive references: WebKit bugs #243075, #215884, #185448 (camera permission resets, getUserMedia in PWA standalone)
- MDN: Visual Viewport API (Pitfall 28)
- WCAG 2.1: target-size (2.5.5) AA contrast guidance
- TanStack Query v5 docs (`refetchOnWindowFocus`, `staleTime`, invalidation patterns)

### Tertiary (LOW confidence — verify at implementation)
- Browser-compat-data: `prefers-contrast: more`, `prefers-reduced-motion: reduce` — well-supported on modern browsers, but verify
- Cyrillic + Estonian extended-Latin coverage in JetBrains Mono / IBM Plex Mono — verify with actual rendering at chosen size

---

*Pitfalls research for: v3.0 Premium-Terminal Frontend rebuild of `/frontend2`*
*Researched: 2026-04-30*
*Predecessor lessons cited: v1.4 (coverage debt), v1.8 (i18n drift), v1.9 (single-route iOS camera), v2.0 (sidebar gap, AuthContext bug, Nyquist gaps), v2.1 (VERIFICATION/UAT debt, mock-vs-real-backend), v2.2 archive (G-65-01, retrofit fiction, coverage gaming, workspace-scoping)*
