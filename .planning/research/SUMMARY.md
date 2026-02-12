# Project Research Summary

**Project:** Home Warehouse System -- v1.7 Modular Settings
**Domain:** Settings restructure for multi-tenant home inventory PWA (Next.js 16 + Go backend)
**Researched:** 2026-02-12
**Confidence:** HIGH

## Executive Summary

The v1.7 milestone restructures the monolithic settings page into a route-based hub-and-subpage architecture with three new capabilities: three-way theme selection with backend persistence, per-type notification preference toggles, and client-side storage visibility and management. The existing codebase is remarkably well-prepared -- the theme provider (next-themes), offline storage (idb + OfflineContext), SSE notification infrastructure, and backend preferences endpoint already exist. The entire milestone requires zero new npm packages (only one shadcn/ui CLI-installed component: Switch) and a single CSS bug fix.

The recommended approach is to build the settings shell and route structure first, then progressively fill in subpages by adopting existing but unused composite components (AccountSettings, SecuritySettings). Four of five subpages require zero backend work. Only notification per-type preferences need a backend migration (JSONB column on auth.users) and endpoint extension -- this should be sequenced last. The Appearance, Security, Regional Formats, and Data/Storage subpages are pure frontend assembly of existing building blocks.

The primary risk is scope creep -- the feature landscape includes 7+ differentiator features that should be firmly deferred. The secondary risk is Safari's incomplete support for `navigator.storage.estimate()`, which requires graceful degradation in the Data/Storage subpage. There are no architectural risks: the route restructure follows standard Next.js App Router patterns, and all data flows use the established `useAuth()` + `refreshUser()` pattern with no new contexts or providers needed.

## Key Findings

### Recommended Stack

No new dependencies. The existing stack covers every capability needed. See `.planning/research/STACK.md` for full details.

**Stack actions (exhaustive list):**
- **shadcn/ui Switch** (CLI install): toggle controls for notification preferences -- the only component not yet in the project
- **CSS fix in globals.css**: change `@custom-variant dark (&:is(.dark *))` to `@custom-variant dark (&:where(.dark, .dark *))` -- fixes dark mode self-matching and specificity per Tailwind v4 docs
- **No new npm packages, state managers, theme libraries, or storage libraries** -- next-themes, idb, react-hook-form, zod, sonner, and all Radix primitives are already installed

### Expected Features

See `.planning/research/FEATURES.md` for full feature landscape with complexity ratings.

**Must have (table stakes):**
- Settings hub landing page with grouped rows, icons, summaries, and chevron navigation
- Route-based subpages (not tabs/accordion) for each settings category
- Three-way theme selector (Light/Dark/System) with instant application and backend persistence
- Server-persisted theme and language preferences for cross-device sync
- Per-category notification toggles (loans, inventory, workspace, system) with master toggle
- Push notification toggle relocated into notifications subpage
- Storage usage display with progress bar (IndexedDB + cache)
- Clear offline cache with confirmation dialog
- Persistent storage status indicator and request button
- Manual sync trigger and last-sync timestamp display
- Relocation of existing Security components (password, sessions, delete account) into dedicated subpage

**Should have (differentiators, implement if time permits):**
- Visual theme preview cards showing light/dark/system appearance
- Per-store record counts (Items: 847, Inventory: 1,203, etc.)
- Notification history page (backend API already exists)
- Storage quota warning banner (>80% usage)

**Defer to post-v1.7:**
- Animated theme transitions
- Notification sound preferences
- Settings search / cmd+k integration
- Per-workspace notification preferences
- Custom CSS / theme injection
- Email notification preferences
- Auto-delete old offline data

**Anti-features (never build):**
- Granular SSE event filtering (breaks data sync -- preferences control alert surfacing only, not data flow)
- Per-store selective cache clear (leaves inconsistent state)
- Export/import user settings JSON (server sync makes this pointless)
- Tabbed settings layout (poor mobile UX, no deep linking)

### Architecture Approach

The architecture is a Next.js App Router nested route structure under `/dashboard/settings/`. A shared `layout.tsx` provides a desktop sidebar and responsive shell. The landing `page.tsx` renders grouped `SettingsRow` links. Each subpage is a thin page file composing existing or new settings components. All state flows through the existing `useAuth()` context -- no new providers or contexts are needed. See `.planning/research/ARCHITECTURE.md` for full component boundaries, data flows, and code patterns.

**Major components:**
1. **SettingsLayout** (`settings/layout.tsx`) -- desktop sidebar + responsive content shell, wraps all subpages
2. **SettingsLandingPage** (`settings/page.tsx`) -- hub with grouped SettingsRow links showing live previews of current values
3. **SettingsNavSidebar** (`components/settings/settings-nav.tsx`) -- desktop sidebar with active state highlighting
4. **SettingsRow** (`components/settings/settings-row.tsx`) -- reusable row component (icon, label, description, preview, chevron)
5. **ThemeSelector** (`components/settings/theme-selector.tsx`) -- visual 3-way theme picker with backend persistence
6. **useThemeSync** (`lib/hooks/use-theme-sync.ts`) -- syncs backend theme to next-themes on login/device change
7. **StorageStats** (`components/settings/storage-stats.tsx`) -- IndexedDB + cache size display with progress bars
8. **useStorageEstimate** (`lib/hooks/use-storage-estimate.ts`) -- browser storage API wrapper with feature detection

**Key architectural decisions:**
- All settings pages are `"use client"` (they all use hooks)
- No new SettingsContext -- useAuth() is the single source of truth
- Theme has two-layer source of truth: next-themes (instant client), backend (persistence) -- never a third
- Notification preferences stored as JSONB on auth.users (not a separate table) for consistency with existing flat preferences
- Language URL locale remains source of truth for current session; backend stores preference for new sessions (no auto-redirect)

### Critical Pitfalls

PITFALLS.md was not updated for v1.7 (agent timed out). The following pitfalls are synthesized from findings across the other three research files:

1. **Dark mode CSS variant bug** -- the current `@custom-variant dark (&:is(.dark *))` selector does not match the `.dark` element itself, only its descendants. Fix to `(&:where(.dark, .dark *))` before building theme UI, or dark utilities on `<html>`/`<body>` will silently fail
2. **Safari Storage API limitations** -- `navigator.storage.estimate()` may return approximate values or be unavailable on older Safari. The StorageStats component must feature-detect and show "unavailable" fallback text
3. **Theme triple-storage conflict** -- if next-themes localStorage, a separate settings localStorage key, and the backend all store theme independently, they will desync. Enforce two-layer only: next-themes (client) + backend (server). Never create a third storage location
4. **SSE filtering vs. SSE disabling confusion** -- notification preferences must filter what gets *surfaced as alerts*, not disable SSE event reception. Disabling SSE events would break real-time data sync across the app
5. **Shipping notification toggles without backend persistence** -- toggles that only use localStorage will lose state on device switch. Either build the backend migration or do not ship per-type toggles

## Implications for Roadmap

Based on combined research, the milestone breaks into 5 phases (A through E) with a clear dependency chain. Phases B-D are parallelizable after Phase A completes.

### Phase A: Settings Shell and Route Structure
**Rationale:** Everything depends on the route restructure. The layout, navigation sidebar, landing page, and stub subpages must exist before any feature work.
**Delivers:** Working settings hub with 7 stub subpages, desktop sidebar nav, mobile landing page navigation, back navigation, i18n keys for navigation labels.
**Addresses:** Settings hub (table stakes), route-based subpages, mobile-first touch targets, back navigation.
**New files:** layout.tsx, settings-nav.tsx, settings-row.tsx, 7 stub page.tsx files.
**Modified files:** settings/page.tsx (replace monolith with landing page).
**Backend work:** None.
**Estimated scope:** Small -- routing and layout components only.

### Phase B: Profile, Security, and Regional Formats (Adopt Existing Components)
**Rationale:** These three subpages are pure relocation of existing components with zero new logic. Highest impact-to-effort ratio after the shell. Proves the architecture works.
**Delivers:** Functional profile editing (avatar, name, email), password change, session management, account deletion, date/time/number format preferences -- all on dedicated subpages.
**Addresses:** Security subpage relocation, format preferences relocation, profile editing.
**Reuses as-is:** AccountSettings, SecuritySettings, AvatarUpload, PasswordChange, ActiveSessions, DeleteAccountDialog, DateFormatSettings, TimeFormatSettings, NumberFormatSettings.
**Backend work:** None.
**Estimated scope:** Small -- thin page wrappers composing existing components.

### Phase C: Appearance and Language (Theme + Language with Backend Sync)
**Rationale:** Depends on Phase A for routes. Builds two new components (ThemeSelector, useThemeSync) but uses existing backend endpoint. CSS bug fix is a prerequisite.
**Delivers:** Three-way theme selection with instant application and cross-device persistence, language selection with backend persistence.
**Addresses:** Three-way theme selector, server-persisted theme, no-flash theme loading, language selector.
**Avoids:** Theme triple-storage conflict (enforces two-layer source of truth).
**Prerequisites:** Fix CSS dark mode variant bug in globals.css before building theme UI.
**New files:** theme-selector.tsx, use-theme-sync.ts, appearance/page.tsx, language/page.tsx.
**Backend work:** None (theme and language fields already exist on User entity, PATCH endpoint already accepts them).
**Estimated scope:** Medium -- new ThemeSelector component with visual cards, useThemeSync hook.

### Phase D: Data and Storage Management
**Rationale:** Depends on Phase A for routes. All building blocks exist (OfflineContext, deleteDB, BackupRestoreDialog). Pure frontend assembly using browser APIs.
**Delivers:** Storage usage visualization, per-store record counts, cache clear with confirmation, persistent storage status, manual sync trigger, backup/restore inline.
**Addresses:** Storage usage display, clear offline cache, persistent storage indicator, import/export section, last sync timestamp, manual sync trigger.
**Avoids:** Safari Storage API limitations (progressive enhancement with fallback).
**New files:** storage-stats.tsx, use-storage-estimate.ts, data-storage/page.tsx.
**Backend work:** None.
**Estimated scope:** Medium -- storage estimation hook, stats display component, cache clear confirmation flow.

### Phase E: Notification Preferences (Backend + Frontend)
**Rationale:** Deliberately sequenced last because it is the only phase requiring backend work (migration + endpoint extension). All other phases are pure frontend. This sequencing means the milestone delivers value incrementally -- if Phase E slips, 80% of the milestone is already shipped.
**Delivers:** Per-type notification toggles grouped by domain (loans, inventory, workspace, system), master toggle, push notification toggle relocated.
**Addresses:** Master notification toggle, per-category toggles, push toggle relocation, auto-save on toggle change.
**Avoids:** Shipping toggles without backend persistence, SSE disabling confusion.
**New files:** migration SQL, notifications/page.tsx.
**Modified files:** user/entity.go, user/handler.go, auth.ts (User type), notification-settings.tsx.
**Backend work:** YES -- JSONB column migration, extend preferences endpoint.
**Estimated scope:** Medium -- backend migration + endpoint extension + frontend toggle UI.

### Phase Ordering Rationale

- **Phase A first** because every subpage depends on the layout and route structure.
- **Phases B, C, D are parallelizable** after Phase A -- they have no interdependencies and can be built by separate developers or in any order.
- **Phase B before C/D** is recommended (not required) because it validates the architecture with zero-risk component relocation before building new features.
- **Phase E last** because it is the only phase with backend work, and deferring it de-risks the milestone. The shell, navigation, theme, storage, and all relocations ship independently of notification preferences.
- **The CSS dark mode fix should ship in Phase A or as a standalone pre-commit** to avoid theme-related bugs during Phase C development.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase E (Notifications):** Backend JSONB schema design needs validation -- should notification preferences be a flat map on auth.users or a separate table? Also needs decision on whether backend should filter notifications before sending (server-side) or frontend should filter after receiving (client-side).

Phases with standard patterns (skip research-phase):
- **Phase A (Shell):** Standard Next.js App Router nested layout pattern. Well-documented.
- **Phase B (Relocations):** Pure component composition. No research needed.
- **Phase C (Theme):** next-themes is well-documented with official shadcn/ui integration guide.
- **Phase D (Storage):** Native browser APIs with MDN documentation. Progressive enhancement pattern is standard.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Zero new dependencies. Every capability verified against installed packages and existing code. Only addition is one shadcn CLI component. |
| Features | HIGH | Feature landscape derived from direct codebase analysis of existing components, backend entities, and API endpoints. Table stakes vs differentiators clearly separated. |
| Architecture | HIGH | Route structure, component boundaries, and data flows based entirely on existing codebase patterns. No speculative architecture. |
| Pitfalls | MEDIUM | PITFALLS.md agent timed out. Pitfalls synthesized from cross-references in other research files. May be missing domain-specific risks around PWA storage edge cases or notification delivery reliability. |

**Overall confidence:** HIGH

The high confidence comes from this being a restructure of an existing system, not a greenfield build. Nearly every building block already exists. The research is grounded in verified codebase analysis, not external speculation.

### Gaps to Address

- **PITFALLS.md not researched:** The pitfalls agent timed out. The five pitfalls listed above were extracted from the other research files, but a dedicated pitfalls analysis might surface additional risks around: PWA lifecycle events during cache clearing, service worker update conflicts, IndexedDB version migration if stores change, or edge cases in next-themes hydration with React 19.
- **Notification preference backend schema:** JSONB on auth.users is recommended but the exact merge semantics (deep merge vs. replace) and default values for new notification types need definition during Phase E planning.
- **Safari storage estimate accuracy:** Research notes Safari's `estimate()` returns approximate values. Need to decide during Phase D whether to show raw numbers or add a disclaimer ("approximate" label) on Safari.
- **Theme sync race condition:** If a user changes theme on device A and quickly opens device B, the `useThemeSync` hook reads the backend value on mount. Last-write-wins is acceptable for theme preferences but should be documented.
- **Existing ThemeToggle in header:** After building the three-way ThemeSelector in settings, the header's binary ThemeToggle should either cycle through all three options (light -> dark -> system) or remain as a light/dark shortcut. This UX decision is not resolved by research.

## Sources

### Primary (HIGH confidence -- codebase verification)
- `frontend/package.json` -- all dependency versions confirmed
- `frontend/app/globals.css` -- CSS dark mode variant bug identified
- `frontend/components/providers/theme-provider.tsx` -- next-themes configuration verified
- `frontend/components/settings/*.tsx` -- 10 existing components cataloged, reuse strategy defined
- `frontend/app/[locale]/(dashboard)/dashboard/settings/page.tsx` -- current monolithic page (166 lines)
- `frontend/lib/contexts/sse-context.tsx` -- 30+ SSE event types verified
- `frontend/lib/db/offline-db.ts` -- IndexedDB v4, 10 stores, deleteDB/clearStore confirmed
- `frontend/lib/contexts/offline-context.tsx` -- OfflineProvider state surface confirmed
- `backend/internal/domain/auth/user/entity.go` -- User entity fields verified
- `backend/internal/domain/auth/user/handler.go` -- PATCH /users/me/preferences accepts 6 fields
- `backend/internal/domain/auth/notification/entity.go` -- 7 notification types confirmed

### Secondary (HIGH confidence -- official documentation)
- [Tailwind CSS v4 Dark Mode docs](https://tailwindcss.com/docs/dark-mode) -- `:where(.dark, .dark *)` variant syntax
- [shadcn/ui Switch component](https://ui.shadcn.com/docs/components/radix/switch) -- installation and API
- [next-themes GitHub](https://github.com/pacocoursey/next-themes) -- useTheme() API, system preference support
- [MDN StorageManager.estimate()](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/estimate) -- browser compatibility

### Tertiary (MEDIUM confidence -- needs runtime validation)
- Safari `navigator.storage.estimate()` accuracy -- documented in WebKit blog but behavior varies by version
- JSONB merge semantics for notification_preferences -- pattern is standard PostgreSQL but merge logic needs implementation decision

---
*Research completed: 2026-02-12*
*PITFALLS.md: not available (agent timed out)*
*Ready for roadmap: yes*
