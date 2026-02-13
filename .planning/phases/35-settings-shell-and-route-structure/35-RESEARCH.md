# Phase 35: Settings Shell and Route Structure - Research

**Researched:** 2026-02-13
**Domain:** Next.js App Router nested layouts, settings hub UI patterns, responsive sidebar navigation, i18n
**Confidence:** HIGH

## Summary

Phase 35 converts the monolithic settings page at `frontend/app/[locale]/(dashboard)/dashboard/settings/page.tsx` (166 lines) into a hub-and-subpage architecture using Next.js App Router nested routes. The current page renders four sections inline (Account, Personalization, Security, Data Management). The restructure replaces this with a shared `layout.tsx` providing desktop sidebar navigation, a landing `page.tsx` with iOS-style grouped rows, and stub subpages for 7 settings categories.

This phase is purely frontend work with zero backend changes. No new npm packages are needed -- every UI component (Card, Separator, Avatar, etc.) already exists in the project's shadcn/ui installation. The only structural addition is the nested layout and routing pattern, which follows standard Next.js App Router conventions already used elsewhere in the codebase (the dashboard itself uses route groups and nested layouts).

The critical insight from codebase analysis is that the current settings page does NOT use the existing `SecuritySettings` and `AccountSettings` composite components -- it hand-assembles its own account display and only uses `ActiveSessions` directly. Phase 36 (the next phase) will adopt these composites. Phase 35 focuses exclusively on the shell, navigation, and hub landing page with stub subpages.

**Primary recommendation:** Create `settings/layout.tsx` with a responsive sidebar (hidden on mobile), rewrite `settings/page.tsx` as a hub with grouped `SettingsRow` links showing live value previews from `useAuth()`, create 7 stub subpage directories with placeholder pages, and add i18n keys for all navigation labels in en/et/ru.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js App Router | 16 | Nested routes and layouts | Already the project's routing framework; `layout.tsx` + `page.tsx` convention |
| next-intl | 4.7.0 | Translation of navigation labels | Already used for all translations; `useTranslations()` pattern |
| lucide-react | (installed) | Icons for settings rows (User, Palette, Globe, Calendar, Shield, Bell, Database) | Already used throughout the dashboard |
| shadcn/ui Card | (installed) | Profile card and section grouping on hub page | Already used by all existing settings components |
| Tailwind CSS 4 | (installed) | Responsive layout (`hidden md:block`, `flex`, grid) | Already the project's CSS framework |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @/i18n/navigation (Link, usePathname) | Custom wrapper over next-intl | Locale-aware links and path matching for sidebar active state | Every navigation link and active state check |
| @/lib/contexts/auth-context (useAuth) | Custom | Reading user preferences for live preview values on hub rows | Hub page to show current theme, date format, language, etc. |
| shadcn/ui Avatar | (installed) | Profile card at top of hub page | Hub page profile card section |
| shadcn/ui Separator | (installed) | Visual separation between settings groups | Hub page group dividers |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom sidebar nav | shadcn/ui NavigationMenu | NavigationMenu is designed for top-level site nav, not settings sub-nav; custom sidebar matches the existing `Sidebar` component pattern in the codebase |
| Route-based subpages | Tabs component | Tabs lack deep linking, browser history, and don't work well on mobile with 7+ sections (explicitly ruled out in REQUIREMENTS.md "Out of Scope") |
| Custom SettingsRow | shadcn/ui Button as link | SettingsRow needs icon + label + description + preview + chevron layout; no existing component covers this; a purpose-built component is cleaner |

**Installation:**
```bash
# No installation needed -- all dependencies already present
```

## Architecture Patterns

### Recommended Route Structure
```
frontend/app/[locale]/(dashboard)/dashboard/settings/
  layout.tsx              # NEW: settings shell with sidebar (desktop) and header
  page.tsx                # MODIFY: replace monolith with hub landing page
  profile/
    page.tsx              # NEW: stub for Phase 36
  appearance/
    page.tsx              # NEW: stub for Phase 37
  language/
    page.tsx              # NEW: stub for Phase 37
  regional-formats/
    page.tsx              # NEW: stub for Phase 36
  security/
    page.tsx              # NEW: stub for Phase 36
  notifications/
    page.tsx              # NEW: stub for Phase 39
  data-storage/
    page.tsx              # NEW: stub for Phase 38
```

### Recommended Component Structure
```
frontend/components/settings/
  settings-nav.tsx        # NEW: sidebar navigation for desktop
  settings-row.tsx        # NEW: reusable hub row (icon, label, description, preview, chevron)
  # Existing components remain untouched in Phase 35
```

### Pattern 1: Settings Layout with Responsive Sidebar
**What:** A `layout.tsx` that wraps all settings routes with a shared header and desktop sidebar navigation. On mobile, no sidebar is shown -- the hub page IS the navigation.
**When to use:** Every settings page benefits from this layout.
**Example:**
```tsx
// Source: Adapted from existing DashboardShell pattern in components/dashboard/dashboard-shell.tsx
"use client";

import { useTranslations } from "next-intl";
import { SettingsNav } from "@/components/settings/settings-nav";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations("settings");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("description")}</p>
      </div>

      <div className="flex gap-8">
        {/* Desktop: persistent sidebar nav */}
        <aside className="hidden md:block w-56 shrink-0">
          <SettingsNav />
        </aside>

        {/* Content area */}
        <div className="flex-1 min-w-0">
          {children}
        </div>
      </div>
    </div>
  );
}
```

### Pattern 2: SettingsRow Component (Hub Landing Page)
**What:** A reusable row component for the hub that shows icon, label, description, current value preview, and a navigation chevron. Wraps an i18n-aware Link.
**When to use:** Every row on the settings hub landing page.
**Example:**
```tsx
// Source: Pattern from existing sidebar NavLink in components/dashboard/sidebar.tsx
"use client";

import { Link } from "@/i18n/navigation";
import { ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface SettingsRowProps {
  icon: LucideIcon;
  label: string;
  description: string;
  href: string;
  preview?: string;
}

export function SettingsRow({ icon: Icon, label, description, href, preview }: SettingsRowProps) {
  return (
    <Link
      href={href}
      className="flex items-center gap-4 p-4 rounded-lg border hover:bg-muted/50 transition-colors"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium">{label}</p>
        <p className="text-sm text-muted-foreground truncate">{description}</p>
      </div>
      {preview && (
        <span className="text-sm text-muted-foreground hidden sm:block">{preview}</span>
      )}
      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
    </Link>
  );
}
```

### Pattern 3: Settings Sidebar Navigation with Active State
**What:** A vertical nav component for desktop that highlights the active settings subpage. Uses the same `usePathname()` + prefix matching pattern as the main dashboard sidebar.
**When to use:** Desktop sidebar inside settings layout.
**Example:**
```tsx
// Source: Pattern from components/dashboard/sidebar.tsx NavLink active state logic
"use client";

import { useTranslations } from "next-intl";
import { usePathname, Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard/settings", labelKey: "nav.overview" },
  { href: "/dashboard/settings/profile", labelKey: "nav.profile" },
  { href: "/dashboard/settings/appearance", labelKey: "nav.appearance" },
  { href: "/dashboard/settings/language", labelKey: "nav.language" },
  { href: "/dashboard/settings/regional-formats", labelKey: "nav.regionalFormats" },
  { href: "/dashboard/settings/security", labelKey: "nav.security" },
  { href: "/dashboard/settings/notifications", labelKey: "nav.notifications" },
  { href: "/dashboard/settings/data-storage", labelKey: "nav.dataStorage" },
];

export function SettingsNav() {
  const t = useTranslations("settings");
  const pathname = usePathname();

  return (
    <nav className="space-y-1">
      {navItems.map((item) => {
        const isActive = item.href === "/dashboard/settings"
          ? pathname === "/dashboard/settings"
          : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "block rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {t(item.labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}
```

### Pattern 4: Hub Profile Card
**What:** A profile display at the top of the hub page showing the user's avatar, name, and email. Links to the profile subpage. NOT an editable form -- just a display card.
**When to use:** Top of settings hub page (HUB-03 requirement).
**Example:**
```tsx
// Source: Adapted from existing profile display in settings/page.tsx lines 53-97
<Link href="/dashboard/settings/profile" className="block">
  <Card className="hover:bg-muted/50 transition-colors">
    <CardContent className="flex items-center gap-4 p-4">
      <Avatar className="h-16 w-16">
        <AvatarImage src={user?.avatar_url || undefined} alt={user?.full_name || "User"} />
        <AvatarFallback className="text-lg">{initials}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-lg">{user?.full_name}</p>
        <p className="text-sm text-muted-foreground">{user?.email}</p>
      </div>
      <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
    </CardContent>
  </Card>
</Link>
```

### Pattern 5: Stub Subpage (Placeholder for Future Phases)
**What:** Minimal page that renders a heading and "coming soon" message. Proves routing works and provides navigation targets for the hub.
**When to use:** Every subpage that will be built in Phases 36-39.
**Example:**
```tsx
"use client";

import { useTranslations } from "next-intl";

export default function AppearancePage() {
  const t = useTranslations("settings");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t("nav.appearance")}</h2>
        <p className="text-muted-foreground">{t("comingSoon")}</p>
      </div>
    </div>
  );
}
```

### Anti-Patterns to Avoid
- **New Settings Context/Provider:** All settings state already lives in auth context (`user` object). Creating a `SettingsProvider` creates duplicate state. Continue using `useAuth()` to read preferences.
- **Client-Side Route Guard in Settings Layout:** The `DashboardShell` already handles auth. Adding another check causes double redirects and flash of content.
- **Server Components for Settings Pages:** Every settings component uses client hooks (`useAuth()`, `useTranslations()`, `usePathname()`). They MUST be `"use client"` components.
- **Shared Form State Across Settings Pages:** Each subpage saves independently. No cross-page form submission flow exists or should be built.
- **Using the main sidebar for settings sub-navigation:** Settings sub-navigation is a SECOND level of navigation within the settings section, separate from the main dashboard sidebar. Do not modify the main sidebar.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Locale-aware navigation links | Custom anchor tags with locale prefix | `Link` from `@/i18n/navigation` | Handles locale prefix, active route detection, and localePrefix: "as-needed" config automatically |
| Active route detection | Custom URL parsing | `usePathname()` from `@/i18n/navigation` | Already strips locale prefix; matches pattern used in existing sidebar.tsx |
| Translation loading | Custom i18n context | `useTranslations("settings")` from `next-intl` | Already configured with 3 locales and namespace splitting |
| Responsive sidebar hide/show | Custom media query logic | Tailwind `hidden md:block` | Already the pattern used in DashboardShell for the main sidebar |
| Profile initials generation | Custom string manipulation | Follow existing pattern from `settings/page.tsx` line 32-36 | Already handles edge cases with optional chaining and fallback |

**Key insight:** This phase is a routing and layout restructure, not a feature build. Every UI primitive already exists. The work is composition and wiring, not creation.

## Common Pitfalls

### Pitfall 1: Duplicating the Page Header in Both Layout and Page
**What goes wrong:** The layout renders the "Settings" title and description, AND each subpage also renders its own section title. Users see double headers.
**Why it happens:** Layout provides global header, subpage provides local header. If both render at the same level, they stack awkwardly.
**How to avoid:** Layout renders the top-level "Settings" h1 and description. Each subpage renders an h2 for its section title. The hub page (landing) should NOT render an additional h1 -- it IS the default content of the layout. Subpages render their own h2-level headers.
**Warning signs:** "Settings" text appearing twice on any page.

### Pitfall 2: Broken Active State on Hub Landing Page
**What goes wrong:** The sidebar shows "Overview" / hub as active when you're on a subpage, because the prefix match catches `/dashboard/settings/anything`.
**Why it happens:** All subpage paths start with `/dashboard/settings/`, which is the hub path.
**How to avoid:** Use exact match for the hub: `pathname === "/dashboard/settings"`. Use prefix match for subpages: `pathname.startsWith(item.href)`. This is the same pattern used in the main sidebar (line 141-143 of sidebar.tsx).
**Warning signs:** Multiple sidebar items highlighted simultaneously.

### Pitfall 3: Missing Locale Prefix in Hardcoded Paths
**What goes wrong:** Navigation links use raw paths like `/dashboard/settings/profile` which break for non-default locales (et, ru).
**Why it happens:** Developer uses native `<a>` or Next.js `<Link>` instead of the i18n-aware `Link` from `@/i18n/navigation`.
**How to avoid:** ALWAYS use `Link` and `usePathname` from `@/i18n/navigation`. Never import from `next/link` directly. The routing config uses `localePrefix: "as-needed"` which means the default locale (en) has no prefix but et/ru do.
**Warning signs:** Navigation works in English but 404s or loses locale when switching to Estonian or Russian.

### Pitfall 4: Mobile Hub Not Serving as Navigation Entry Point
**What goes wrong:** On mobile, users land on a settings page with a sidebar that's hidden, with no way to navigate between subpages.
**Why it happens:** Desktop sidebar is hidden on mobile (`hidden md:block`), but no alternative navigation is provided for mobile users.
**How to avoid:** The hub landing page (`settings/page.tsx`) IS the mobile navigation. It shows the full list of tappable SettingsRow links. On mobile, users navigate: hub -> subpage -> back to hub. The back button or a "Back to Settings" link provides the return path. The hub page must always be accessible.
**Warning signs:** Mobile users cannot navigate between settings subpages.

### Pitfall 5: Live Preview Values Not Updating Reactively
**What goes wrong:** The hub page shows stale values (e.g., old date format) after user changes a preference on a subpage and navigates back.
**Why it happens:** Preview values are computed once on mount and not re-computed when `user` object changes.
**How to avoid:** Derive preview values directly from `useAuth().user` in the render path, not in a `useEffect` or `useMemo` with stale dependencies. Since `refreshUser()` updates the auth context after every preference change, the hub will re-render with fresh values automatically when navigated back to.
**Warning signs:** Preview shows "DD/MM/YYYY" but user just changed to "YYYY-MM-DD" on the regional formats page.

### Pitfall 6: Layout Nesting Interference with DashboardShell
**What goes wrong:** The settings layout creates scroll containers or padding that conflicts with the main dashboard shell's `<main>` padding.
**Why it happens:** DashboardShell's `<main>` has `p-4 pb-20 md:p-6 md:pb-6`. If the settings layout adds its own padding, content gets double-padded.
**How to avoid:** The settings layout should add spacing via `space-y-6` for vertical gaps between header and content, but NOT add outer padding. Outer padding comes from DashboardShell's `<main>` element. Review the rendered page in both mobile and desktop to confirm no double-padding.
**Warning signs:** Excessive whitespace around settings content, especially on mobile.

## Code Examples

### Hub Landing Page with Grouped Rows and Live Previews (HUB-01, HUB-02, HUB-03)
```tsx
// Source: Derived from current settings/page.tsx structure + requirements
"use client";

import { useTranslations } from "next-intl";
import { User, Palette, Globe, Calendar, Shield, Bell, Database } from "lucide-react";
import { ChevronRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/lib/contexts/auth-context";
import { SettingsRow } from "@/components/settings/settings-row";
import { localeNames, type Locale } from "@/i18n/config";

export default function SettingsPage() {
  const t = useTranslations("settings");
  const { user } = useAuth();

  const initials = user?.full_name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() || "?";

  // Live preview values derived from user object
  const themePreview = user?.theme === "dark" ? t("hub.dark")
    : user?.theme === "light" ? t("hub.light")
    : t("hub.system");
  const languagePreview = localeNames[(user?.language || "en") as Locale] || "English";
  const datePreview = user?.date_format || "YYYY-MM-DD";

  return (
    <div className="space-y-6">
      {/* Profile Card (HUB-03: Profile card at top) */}
      <Link href="/dashboard/settings/profile" className="block">
        <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
          <CardContent className="flex items-center gap-4 p-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={user?.avatar_url || undefined} alt={user?.full_name || "User"} />
              <AvatarFallback className="text-lg">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-lg">{user?.full_name}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
          </CardContent>
        </Card>
      </Link>

      {/* Preferences Group (HUB-03) */}
      <div className="space-y-1">
        <h3 className="text-sm font-medium text-muted-foreground px-1 mb-2">{t("hub.preferences")}</h3>
        <div className="space-y-2">
          <SettingsRow icon={Palette} label={t("nav.appearance")} description={t("hub.appearanceDesc")} href="/dashboard/settings/appearance" preview={themePreview} />
          <SettingsRow icon={Globe} label={t("nav.language")} description={t("hub.languageDesc")} href="/dashboard/settings/language" preview={languagePreview} />
          <SettingsRow icon={Calendar} label={t("nav.regionalFormats")} description={t("hub.regionalFormatsDesc")} href="/dashboard/settings/regional-formats" preview={datePreview} />
        </div>
      </div>

      {/* System & Security Group (HUB-03) */}
      <div className="space-y-1">
        <h3 className="text-sm font-medium text-muted-foreground px-1 mb-2">{t("hub.systemSecurity")}</h3>
        <div className="space-y-2">
          <SettingsRow icon={Shield} label={t("nav.security")} description={t("hub.securityDesc")} href="/dashboard/settings/security" />
          <SettingsRow icon={Bell} label={t("nav.notifications")} description={t("hub.notificationsDesc")} href="/dashboard/settings/notifications" />
          <SettingsRow icon={Database} label={t("nav.dataStorage")} description={t("hub.dataStorageDesc")} href="/dashboard/settings/data-storage" />
        </div>
      </div>
    </div>
  );
}
```

### i18n Keys Needed (en.json additions under "settings")
```json
{
  "settings": {
    "nav": {
      "overview": "Overview",
      "profile": "Profile",
      "appearance": "Appearance",
      "language": "Language",
      "regionalFormats": "Regional Formats",
      "security": "Security",
      "notifications": "Notifications",
      "dataStorage": "Data & Storage"
    },
    "hub": {
      "preferences": "Preferences",
      "systemSecurity": "System & Security",
      "appearanceDesc": "Theme and display settings",
      "languageDesc": "App language preference",
      "regionalFormatsDesc": "Date, time, and number formats",
      "securityDesc": "Password, sessions, and account",
      "notificationsDesc": "Notification preferences",
      "dataStorageDesc": "Offline data and storage management",
      "light": "Light",
      "dark": "Dark",
      "system": "System"
    }
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Monolithic settings page with sections | Hub-and-subpage with nested routes | This phase | Code-split per subpage, deep linking, better mobile UX |
| Tabs for settings categories | Route-based subpages | Already decided (REQUIREMENTS.md) | Tabbed layout explicitly out of scope |
| ProfileEditSheet (side panel) for profile editing | Dedicated /settings/profile page | Phase 36 (not this phase) | Better mobile UX, no overlapping sheets |
| Settings link only in user dropdown menu | Settings link in user dropdown + hub as navigation entry point | This phase | More discoverable settings access |

**Deprecated/outdated:**
- The current monolithic `settings/page.tsx` (166 lines) will be replaced with a hub landing page. The old content (inline account display, format settings, sessions, backup/restore) will be distributed across subpages in Phases 36-39.

## Open Questions

1. **Should the hub page "Overview" item appear in the sidebar nav?**
   - What we know: The main dashboard sidebar uses exact match for `/dashboard` and prefix for everything else. An "Overview" item provides a way to return to the hub from any subpage via the sidebar.
   - What's unclear: Whether to label it "Overview", "General", or just "Settings" in the sidebar.
   - Recommendation: Include an "Overview" item at the top of the sidebar nav. Label it with the `settings.nav.overview` translation key. This provides both a hub return path on desktop and consistent navigation.

2. **Should mobile subpages include a "Back to Settings" link or rely on browser back?**
   - What we know: HUB-05 requires "pressing back returns the user to the settings hub." Browser back button works for this naturally. The current codebase does NOT have breadcrumb components.
   - What's unclear: Whether an explicit back arrow in the subpage header improves UX enough to justify the extra component.
   - Recommendation: Add a simple back link/arrow at the top of each subpage on mobile. This is more reliable than browser back (which might navigate away from the app entirely if the user deep-linked). Use a simple `Link` to `/dashboard/settings` with an `ArrowLeft` icon.

3. **Should live preview values on the hub include notification and data/storage info?**
   - What we know: HUB-02 says "show live preview of current value." For theme, language, date format this is straightforward. For notifications and data/storage, the values are more complex (push enabled/disabled, storage bytes).
   - What's unclear: Whether to show these now when the subpages are stubs, or add previews later when the subpages are functional.
   - Recommendation: Show simple text previews where data is readily available from `useAuth()` (theme, language, date format). For notifications and data/storage, omit the preview in Phase 35 stubs and add them in Phases 38/39 when the subpages are functional. The `preview` prop on `SettingsRow` is optional for this reason.

## Sources

### Primary (HIGH confidence)
- **Current settings page:** `frontend/app/[locale]/(dashboard)/dashboard/settings/page.tsx` -- 166-line monolithic page, directly inspected
- **Dashboard sidebar:** `frontend/components/dashboard/sidebar.tsx` -- active state pattern (lines 141-143), NavLink component structure
- **Dashboard shell:** `frontend/components/dashboard/dashboard-shell.tsx` -- layout nesting, padding values (`p-4 pb-20 md:p-6 md:pb-6`)
- **Auth context:** `frontend/lib/contexts/auth-context.tsx` -- User type, refreshUser() pattern, useAuth() hook
- **Auth API types:** `frontend/lib/api/auth.ts` -- User interface with date_format, time_format, theme, language fields
- **i18n config:** `frontend/i18n/config.ts` -- 3 locales (en, et, ru), localeNames map
- **i18n routing:** `frontend/i18n/routing.ts` -- `localePrefix: "as-needed"` config
- **i18n navigation:** `frontend/i18n/navigation.ts` -- `Link`, `usePathname`, `useRouter` exports
- **Existing settings components:** `frontend/components/settings/*.tsx` -- 10 components cataloged, reuse strategy clear
- **Translation files:** `frontend/messages/en.json`, `et.json`, `ru.json` -- existing `settings.*` namespace structure verified
- **Dashboard layout:** `frontend/app/[locale]/(dashboard)/layout.tsx` -- `DashboardShell` wrapper, `setRequestLocale()` pattern
- **User menu:** `frontend/components/dashboard/user-menu.tsx` -- settings link at `/dashboard/settings`
- **v1.7 milestone research:** `.planning/research/ARCHITECTURE.md`, `FEATURES.md`, `STACK.md`, `SUMMARY.md` -- comprehensive codebase analysis from 2026-02-12

### Secondary (HIGH confidence)
- **Next.js App Router layouts:** Standard nested layout pattern documented at nextjs.org/docs/app/building-your-application/routing/layouts-and-templates
- **v1.7 REQUIREMENTS.md:** `.planning/REQUIREMENTS.md` -- HUB-01 through HUB-06 requirements, "Out of Scope" decisions
- **v1.7 ROADMAP.md:** `.planning/ROADMAP.md` -- Phase 35-39 structure, dependency chain

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- zero new dependencies, all verified in package.json and existing code
- Architecture: HIGH -- standard Next.js App Router nested layout pattern, matches existing codebase conventions exactly
- Pitfalls: HIGH -- all pitfalls derived from direct inspection of existing code patterns and their edge cases

**Research date:** 2026-02-13
**Valid until:** 2026-03-15 (stable -- no external dependencies or rapidly moving APIs involved)
