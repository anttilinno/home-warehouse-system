# Retro Premium-Terminal Theme — 5-Step Rollout Plan

Apply the locked premium-terminal aesthetic (sketches 001–005) to **frontend1**
(legacy Next.js + shadcn) primarily, with a tail step to bring **frontend2**
onto the same token map.

Source of truth for tokens / patterns:
`.claude/skills/sketch-findings-home-warehouse-system/`

Each step is independently shippable — you can stop after any step and the
app still works (with progressively more of the retro feel applied). Steps 1–3
are pure CSS and ship the bulk of the visual change; Step 4 is the new UX
pattern; Step 5 closes fidelity and brings frontend2 onto the same map.

---

## Step 1 — Token Mapping Only (frontend1)

**Goal.** Get ~70% of the visual feel on day one with **zero component changes
and zero new code paths**. Just shadcn token aliasing.

**Scope**

- One file: `frontend/app/globals.css`
- Add `[data-theme="retro-terminal"] { … }` block that re-maps premium-terminal
  CSS variables (`--bg-panel`, `--fg-mid`, `--fg-bright`, `--amber`, …) onto
  shadcn's existing token names (`--background`, `--foreground`, `--card`,
  `--primary`, `--sidebar`, `--ring`, …)
- Override `--radius: 0` inside the block (legacy is `1rem`)
- Override `--font-sans: var(--font-mono)` so all body text becomes monospace
  while the theme is active
- Map shadcn `--destructive` → `--accent-danger`, `--accent` → muted amber,
  etc. (full mapping table below)

**How to test**

Manually flip `<html data-theme="retro-terminal">` in devtools on any frontend1
page. No code changes elsewhere. Walk dashboard / items / loans / settings —
all shadcn surfaces should immediately read amber-on-near-black with monospace
type, AAA contrast, sharp corners.

**What still feels off after Step 1**

- shadcn `Card` / `Popover` / `DropdownMenu` keep their soft drop-shadows; no
  inset bevels yet → reads "modern dark theme" not yet "CRT terminal"
- No scanline overlay
- Topbar still uses pastel-app layout
- No bottombar; quick actions still inside the dashboard tile

**Effort.** ~1 hour. Single PR.

**Rollback.** Delete the block.

---

## Step 2 — Theme Picker + Persistence (frontend1)

**Goal.** Let users opt into retro from the existing settings UI; persist to
backend the same way light/dark already does.

**Scope**

- `frontend/components/providers/theme-provider.tsx` — already uses
  `next-themes`, no changes needed (it accepts arbitrary theme strings)
- `frontend/components/settings/theme-settings.tsx` — add a third option
  ("Retro Terminal") to the picker
- `next-themes` config — add `themes={["light", "dark", "retro-terminal"]}`
  to the provider call
- Verify backend `users/me/preferences` accepts the new string (it should —
  no enum constraint visible from the client side)

**How to test**

Open Settings → Appearance, pick Retro Terminal. Reload the page; theme
persists. Logout/login from another browser; theme follows the user.

**What still feels off after Step 2**

Same as Step 1 — but now reachable through normal UX, not devtools.

**Effort.** ~1 hour. Single PR. Depends on Step 1.

**Rollback.** Remove the third option from the picker; users still on it
fall back to system default via next-themes' resolved-theme handling.

---

## Step 3 — Globals: Scanline + Bevel Tokens + Font (frontend1)

**Goal.** Land the visual signatures that aren't in shadcn token reach:
scanline overlay, sharp corners everywhere, monospace anchored.

**Scope**

- `frontend/app/globals.css` — under `[data-theme="retro-terminal"]`:
  - `body { background-image: repeating-linear-gradient(…) + radial-gradient(…); background-attachment: fixed; }` — the scanline + vignette pattern from the locked theme
  - Override `--radius-sm/md/lg/xl/2xl` all to `0` (shadcn computes these from `--radius`, but explicit sets remove ambiguity)
- Add a top-level CSS variable group for premium-terminal-only tokens that
  shadcn doesn't expose: `--fg-glow`, `--amber-bright`, `--bg-elevated`,
  `--bg-active` — used by Step 3+ components

**How to test**

Visual check: scanlines visible on body bg but not so loud they hurt
readability. Every shadcn surface (cards, popovers, dialogs, dropdowns) is
fully square-cornered. AAA contrast still holds.

**What still feels off after Step 3**

- Cards still have soft drop-shadows instead of inset bevels (Step 5)
- Still no bottombar (Step 4)

**Effort.** ~2 hours. Single PR. Depends on Step 1.

**Rollback.** Remove body background and radius overrides — shadcn defaults
return.

---

## Step 4 — Bottombar Component + `useShortcuts` Hook (frontend1)

**Goal.** The defining UX pattern from sketch 005: context-aware function-key
bar at the bottom of every authenticated screen, replacing the dashboard's
quick-actions tile.

**Scope**

- New `frontend/components/layout/bottombar.tsx` — renders amber `[KEY]`
  chips + label, plus right-aligned `UPTIME` + live local clock. Reads from a
  page-level context.
- New `frontend/lib/hooks/use-shortcuts.ts` — the hook each route uses to
  declare `[{key, label, action, danger?}]`. Single source of truth driving
  both the bar render and `keydown` listener.
- New `frontend/components/layout/shortcuts-context.tsx` — Provider that
  collects current page shortcuts; consumed by Bottombar.
- `frontend/app/(dashboard)/layout.tsx` — mount `<Bottombar />` under the
  main content area; sidebar runs full-height (matches sketch 005 grid).
- Migrate Dashboard quick-actions:
  - **Remove** the `QuickActionCards` block from the dashboard page
  - **Add** `useShortcuts([{ key: "N", label: "Add Item", action: () => router.push("/dashboard/items/new") }, …])` to the dashboard page
- Globals (`F1` HELP, `ESC` LOGOUT) registered by Bottombar itself, not per
  route.

**Theme-conditional rendering.** Bottombar should render even on light/dark
themes — it's a feature, not styling. Style it via tokens so it adopts each
theme's palette correctly. (Premium-terminal gets the amber chips; light/dark
gets shadcn-equivalent button styling.)

**How to test**

Navigate Dashboard → Items → Loans → Settings. Bottombar shortcut set changes
per route. Pressing the keys fires the same actions as clicking the chips.
F1/ESC work everywhere. Clock ticks.

**What still feels off after Step 4**

- Cards/Popovers still soft (Step 5)
- Topbar layout might read awkward — sketch 005 has slim brand + workspace
  pill on right; frontend1 might still have the legacy topbar shape

**Effort.** ~1 day. New component + hook + provider + dashboard refactor +
layout edit. Independent of theme — works on light/dark too.

**Rollback.** Hide `<Bottombar />` behind a feature flag; restore
`QuickActionCards` if needed.

---

## Step 5 — Fidelity Pass + frontend2 Alignment

**Goal.** Close the last 20% of fidelity (bevels, glow, topbar shape) and
extract the token map so frontend2 can consume the same source.

**Scope — frontend1 fidelity**

- `frontend/components/ui/card.tsx`, `popover.tsx`, `dropdown-menu.tsx`,
  `dialog.tsx` — add a `[data-theme="retro-terminal"]` selector branch in
  the component CSS (or wrap with a `theme === "retro-terminal" ? cn(…) : …`)
  to apply:
  - `border: 2px solid var(--fg-dim)`
  - `box-shadow: inset 1px 1px 0 rgba(255,255,255,0.05), inset -1px -1px 0 rgba(0,0,0,0.6), 0 0 16px rgba(255,208,122,0.04)`
  - panel-header treatment for cards with a header
- `frontend/components/dashboard/topbar.tsx` (or equivalent) — under retro
  theme, swap to slim brand + workspace/user pills + ONLINE dot, matching
  sketches 001 and 005. Conditional layout, not a rebuild.
- User menu — already frontend1's pattern; verify the bevels read right
  under retro theme (it's the same component sketches 005 borrowed from)

**Scope — frontend2 alignment**

- Extract the `[data-theme="retro-terminal"]` token block from frontend1
  into a shared file:
  `.planning/shared-tokens/retro-terminal.css` (or a published package if
  monorepo tooling allows)
- `frontend2/src/styles/globals.css` — `@import` the shared block; add a
  small theme switcher (Vite app, no `next-themes`, so it's a
  `useState` + `data-theme` attribute on `<html>`)
- Existing `bg-retro-cream`, `bg-retro-charcoal`, etc. tokens **stay** —
  they're a separate aesthetic. Retro-terminal becomes a third selectable
  theme on frontend2.

**How to test**

Both apps: pick Retro Terminal. Card surfaces have visible inset bevels +
faint amber outer glow. Topbar reads as the locked sketch 001/005 design.
Diff a screenshot of frontend1 dashboard against the sketch HTML —
should be ≥95% match.

**Effort.** ~2 days. Cross-app, multiple touch points. Worth doing as a
single PR per app.

**Rollback.** Each component's retro overrides are isolated to a single
selector — drop them individually if a regression appears.

---

## Out of scope (intentionally)

- **Capacity gauge / activity sparkline.** They depend on backend rollups
  that don't exist (`capacity_target`, `activity-events-by-day`). Land
  them behind feature flags after Step 5 if the hero space wants more.
- **Mobile / responsive.** Sketches were validated at desktop only. Mobile
  layout for the bottombar + collapsed-rail sidebar is a separate phase.
- **Theme-aware screenshots / e2e snapshots.** Existing Playwright + Go
  integration tests don't care about theme. Visual regression is a
  separate concern.

## Decision log

- **Why frontend1 first, not frontend2?** — Token system is more mature
  (next-themes, shadcn, persistence already shipped). Step 1 unlocks ~70%
  of the value with one file edit. frontend2 needs theme-switch
  infrastructure built before it can consume the same map.
- **Why keep retro-cream tokens in frontend2?** — Re-skin, not redesign.
  Per the saved feedback memory (`feedback_reskin_not_redesign.md`),
  don't churn structural choices that aren't visual.
- **Why bottombar as Step 4, not Step 1/2?** — Highest behavioral leverage
  (changes how shortcuts work) but requires real component + hook + layout
  work. Theme alone is feasible without it.

## Stop conditions

If at any step the visual result reads wrong (e.g. shadcn's drop-shadow
defaults make cards feel too soft and Step 5 bevels don't fix it), stop
and reopen the sketch process — don't push more steps to compensate for
a mis-mapped token.
