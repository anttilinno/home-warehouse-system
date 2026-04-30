# Phase 51: App Layout — Discussion Log

**Date:** 2026-04-11
**Phase:** 51 — App Layout
**Areas discussed:** Mobile navigation pattern, Sidebar content & user info, Loading & error visuals, Layout integration with auth

---

## Area 1: Mobile Navigation Pattern

| Question | Options | Selected |
|----------|---------|----------|
| How should the sidebar collapse on mobile viewports? | Hamburger menu (Recommended) / Bottom tab bar / You decide | **Hamburger menu** |
| On mobile, when the drawer is open, should tapping outside the drawer close it? | Yes — tap backdrop to close (Recommended) / No — only hamburger/X button closes it | **Yes — tap backdrop to close** |
| Should the hamburger button follow the retro style? | Retro styled — thick border, cream, retro icon (Recommended) / Minimal utility | **Retro styled** |

---

## Area 2: Sidebar Content & User Info

| Question | Options | Selected |
|----------|---------|----------|
| Which navigation items should appear in the sidebar? | Dashboard + Settings only (Recommended) / Dashboard, Settings, Items, Loans | **Dashboard + Settings only** |
| Where should user info and logout live? | Top bar only (Recommended) / Sidebar footer only / Both | **Top bar only** |
| What should the top bar show besides user info? | App title + user info + logout (Recommended) / Page title + user info + logout / App title only in sidebar | **App title + user info + logout** |
| Should the active nav item have a distinct retro treatment? | Amber highlight with pressed/inset look (Recommended) / Hazard stripe accent / You decide | **Amber highlight with pressed/inset look** |

---

## Area 3: Loading & Error Visuals

| Question | Options | Selected |
|----------|---------|----------|
| What style of loading indicator for route transitions? | Thin retro progress bar at top (Recommended) / Retro hazard-stripe overlay / You decide | **Thin retro progress bar at top** |
| How elaborate should the error boundary page be? | RetroPanel + SYSTEM ERROR + hazard stripe + retry (Recommended) / Full terminal-style / You decide | **RetroPanel + SYSTEM ERROR + hazard stripe + retry** |

---

## Area 4: Layout Integration with Auth

| Question | Options | Selected |
|----------|---------|----------|
| How should route structure separate shell from auth pages? | Nested route layout — AppShell wraps protected routes only (Recommended) / Conditional in AppShell / You decide | **Nested route layout** |
| Should /demo show the app shell? | No shell on /demo — keep it standalone (Recommended) / Yes — demo inside app shell | **No shell — standalone** |
