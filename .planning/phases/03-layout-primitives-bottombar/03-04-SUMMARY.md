---
phase: 03-layout-primitives-bottombar
plan: 04
subsystem: frontend2 application chrome
tags: [retro-os, navlink, topbar, pageheader, logout-confirm, rail-mode, tdd, a11y, i18n]
requires:
  - "react-router NavLink isActive render-prop (react-router 7)"
  - "useModalStack(isOpen, onClose) from frontend2/src/components/modal (Plan 03-02)"
  - "Clock leaf with local={false} single-readout mode (Plan 03-03)"
  - "BrandMark (WAREHOUSE.SYS) + retro Window/BevelButton primitives (Phase 2)"
  - "Phase 2 token utilities (bg-titlebar-*, shadow-hard-ink, bevel-raised-ink, sp-*)"
provides:
  - "Sidebar — collapsible grouped Navigator with per-route NavLink active state + rail-mode (.nav-label/.nav-count/.nav-badge-dot) hooks + titlebar collapse chevron"
  - "TopBar — banner with brand + disabled workspace/bell/SSE reserved slots + ONLINE dot + user-menu confirm-before logout (unreachable via bare ESC)"
  - "PageHeader — route breadcrumb + SESSION/LAST SYNC meta line (SESSION reuses Clock; LAST SYNC em-dash placeholder)"
affects:
  - "AppShell (Plan 03-06) composes Sidebar + TopBar + PageHeader; owns the collapsed boolean + onToggleCollapse/onToggleDrawer wiring + onLogout"
  - "Phase 5 auth wires real onLogout + the workspace switcher + user-menu profile/settings items"
  - "Phase 6 SSE binds the ONLINE dot, the SSE slot, and the PageHeader LAST SYNC value"
  - "Phase 13 wires the notifications bell slot"
tech-stack:
  added: []
  patterns:
    - "NavLink isActive render-prop applies the active bevel + aria-current per-route (no hardcoded active flag)"
    - "Rail-mode className hooks (.nav-label/.nav-count/.nav-badge-dot) let Plan 06 [data-collapsed] CSS collapse the sidebar with zero JS measure"
    - "Confirm-before-destructive via useModalStack: the dialog pushes onto the stack so ESC closes it (never triggers the action) — BAR-05"
    - "Reserved-slot pattern: future-phase chrome rendered now as aria-disabled + opacity-50 + title naming the unlocking phase, so Phases 5/6/13 swap in without touching AppShell"
    - "SESSION readout reuses the single Clock leaf (local={false}) instead of spinning a second 1s timer"
key-files:
  created:
    - frontend2/src/components/layout/TopBar.tsx
    - frontend2/src/components/layout/TopBar.test.tsx
    - frontend2/src/components/layout/PageHeader.tsx
    - frontend2/src/components/layout/PageHeader.test.tsx
    - frontend2/src/components/layout/Sidebar.test.tsx
  modified:
    - frontend2/src/components/layout/Sidebar.tsx
decisions:
  - "Sidebar swapped from a hardcoded `active` prop + <Link> to react-router <NavLink> with the isActive render-prop; `end={to === '/'}` keeps Dashboard ('/') from matching every nested route (SHELL-04 per-route active)."
  - "Badge dot + .nav-label/.nav-count are rendered always but hidden in expanded mode via `hidden`/CSS; Plan 06's [data-collapsed] rail CSS flips visibility. This keeps the rail purely a CSS concern (SHELL-02 no-measure)."
  - "Collapse toggle lives in the Window `actions` slot (replacing the decorative CornerBox) with aria-expanded reflecting !collapsed; AppShell owns the boolean (Plan 06)."
  - "Logout confirm dialog uses titlebar-pink (attention/destructive surface per MANIFEST), distinct from the F1 help dialog's blue (informational) — consistent with the UI-SPEC titlebar semantics."
  - "User menu closes on outside pointerdown; the confirm dialog owns its own scrim + modal-stack ESC dismissal, so the menu and dialog do not fight over ESC."
metrics:
  duration: ~12m
  completed: 2026-06-12
  tasks: 3
  files: 6
---

# Phase 3 Plan 04: Sidebar / TopBar / PageHeader Chrome Leaves Summary

The persistent chrome every authenticated route renders: the **Sidebar**
Navigator now marks the current route active via react-router `NavLink` and
carries rail-mode + badge-dot hooks for Plan 06's collapse; the **TopBar** banner
holds the brand, the reserved (disabled) workspace/bell/SSE slots, the ONLINE
dot, and a user menu whose only enabled item is a **confirm-before Log out** that
ESC can never trigger (BAR-05); the **PageHeader** shows a route breadcrumb and a
SESSION · LAST SYNC meta line (SESSION reuses the Plan 03 Clock leaf, LAST SYNC is
the stable em-dash placeholder until Phase 6).

All visual treatment re-anchors to retro-os per the BINDING UI-SPEC: the stale
Premium-Terminal vocabulary (`// OVERVIEW`, amber chips, "HOME WAREHOUSE", glow)
is dropped while the OBSERVABLE truths (group labels read as groups, per-route
active emphasis, breadcrumb shows the route) are preserved through the validated
sketch-006 bevels and tokens.

## What Was Built

### Task 1 — Sidebar: per-route NavLink active + rail-mode (SHELL-04)

Extended (not rewritten) `Sidebar.tsx`: the hardcoded `active` prop + `<Link>`
branch became a single `<NavLink>` using the `isActive` render-prop to apply the
active bevel (`border-border-ink bg-titlebar-blue shadow-hard-ink` +
`aria-current="page"`) vs the default/hover treatment. `end={to === "/"}` stops
Dashboard from matching nested routes. The aria-disabled `<div>` (title "Not
built yet") for routes without a `to` is preserved. Added `.nav-label` /
`.nav-count` className hooks on the label/count spans and a 6px ink-bordered
pastel `.nav-badge-dot` (rendered for counted items, hidden until rail mode) so
Plan 06's `[data-collapsed]` CSS collapses the sidebar to a 60px glyph rail with
zero JS measurement. A collapse chevron (`‹`/`›`) sits in the Navigator Window
`actions` slot, calling `onToggleCollapse` with `aria-expanded={!collapsed}`. Nav
landmark gained `aria-label="Primary"`; focus-visible ink rings throughout. No
raw hex, no Silkscreen on nav text.

### Task 2 — TopBar: brand + reserved slots + ONLINE dot + logout confirm (SHELL-03, BAR-05)

New `TopBar.tsx` exporting `TopBar`. A 40px `<header role="banner">` at the
UI-SPEC chrome (bg-bg-panel, border-b-2, inset bevel, sticky). Left→right:
mobile-only hamburger (`md:hidden`, `onToggleDrawer`), a 30×30 beveled brand
square + `<BrandMark/>` (WAREHOUSE.SYS), a disabled workspace pill (aria-disabled,
title "Switch workspace (Phase 5)"), the ONLINE indicator (mint dot + "ONLINE" /
faint dot + "OFFLINE" via the `online` prop), a `flex-1` spacer, a disabled bell
slot (title "Coming soon"), a static `sse: ● live` placeholder slot, and a user
pill. The pill toggles a `role="menu"` dropdown (aria-haspopup/expanded) whose
profile/settings/switch items are disabled placeholders and whose only enabled
item is "Log out". "Log out" opens a confirm dialog (pink titlebar, copy "End
this session? You will need to sign in again.", confirm **LOG OUT** = danger,
cancel **STAY**) that pushes onto the modal stack via `useModalStack` — so **ESC
closes the dialog and never calls `onLogout`**. User identity renders as escaped
JSX text. Strings via `<Trans>`; tokens only.

### Task 3 — PageHeader: breadcrumb + SESSION/LAST SYNC meta (SHELL-05)

New `PageHeader.tsx` exporting `PageHeader`. Props: `segments: string[]` and an
optional `lastSync` (defaults to the "—" em-dash placeholder per orchestrator
resolution #2). Renders `bg-bg-panel-2 border-b-2 border-border-ink px-sp-3
py-sp-2`, a breadcrumb `<nav aria-label="Breadcrumb">` (11px Plex Sans 700
uppercase `tracking-[0.1em]`; ancestors `text-fg-muted`, leaf `text-fg-ink` +
`aria-current="page"`, joined by an ink `›`), and a right-aligned
`font-mono text-[12px] tabular-nums` meta line. The SESSION readout reuses the
Plan 03 `<Clock local={false}>` leaf (no second timer); LAST SYNC renders the
stable em-dash placeholder slot for Phase 6's live SSE bind.

## Verification

- `bunx vitest run src/components/layout/Sidebar.test.tsx src/components/layout/TopBar.test.tsx src/components/layout/PageHeader.test.tsx` → **22 passed** (8 Sidebar + 8 TopBar + 6 PageHeader).
- BAR-05 binding asserted: "ESC closes the confirm but does NOT call onLogout" is green; STAY and outside-click also close without logout.
- Per-route active asserted: aria-current + active bevel at `/`, neither at `/items`.
- `bun run lint:tsc` → exit 0. `bun run lint:imports` → exit 0 (no offline/PWA/sync/motion specifiers).
- Acceptance greps: `NavLink`/`nav-label`/`nav-count` present in Sidebar; `role="banner"`/`aria-disabled` present in TopBar; `—` present in PageHeader; no raw hex in any of the three components.

## Threat Model Coverage

- **T-03-08 (XSS in identity text):** `user.full_name`/`email` rendered as escaped JSX text expressions in both TopBar and the (preserved) Sidebar footer; no `dangerouslySetInnerHTML`. Mitigated.
- **T-03-09 (accidental logout / self-DoS):** logout is confirm-before (LOG OUT/STAY) via the modal stack; ESC closes the confirm without logging out — the BAR-05 test asserts `onLogout` is not called on ESC. Mitigated.
- **T-03-10 (PII in console):** no `console.log` of user/selection ported; the legacy debug header log (03-RESEARCH V7) was not carried over. Mitigated.
- **T-03-SC (package legitimacy):** zero new packages this plan (`bun install --frozen-lockfile` only). N/A.

## Deviations from Plan

None — plan executed exactly as written. (The Sidebar nav landmark gained
`aria-label="Primary"` per the UI-SPEC §Accessibility landmark row, which the
plan's interface notes already anticipated; not a behavioral deviation.)

## Known Stubs

These are plan-sanctioned reserved slots / placeholders, NOT accidental stubs —
each is explicitly deferred to a named phase and rendered as a stable, disabled
slot so the downstream phase swaps in without touching AppShell:

| Slot | File | Resolves in |
|------|------|-------------|
| Workspace pill (disabled, "Switch workspace (Phase 5)") | TopBar.tsx | Phase 5 (switcher) |
| User-menu profile/settings/switch items (disabled placeholders) | TopBar.tsx | Phase 5 (auth/profile) |
| Notifications bell slot (disabled, "Coming soon") | TopBar.tsx | Phase 13 |
| SSE status slot (`sse: ● live` static) + ONLINE dot (static-live) | TopBar.tsx | Phase 6 (SSE) |
| PageHeader LAST SYNC ("—" em-dash) | PageHeader.tsx | Phase 6 (SSE) |
| `onLogout` callback (wired by AppShell/auth) | TopBar.tsx | Phase 03-06 / Phase 5 |

The plan's goal — render the persistent chrome leaves with stable reserved slots
— is fully achieved; every placeholder above is the explicit, documented contract
for a later phase (Parity §4 slot-reservation pattern), not a gap.

## Self-Check: PASSED
