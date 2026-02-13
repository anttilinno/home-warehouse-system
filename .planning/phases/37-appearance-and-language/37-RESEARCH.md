# Phase 37: Appearance and Language - Research

**Researched:** 2026-02-13
**Domain:** Theme switching (next-themes + Tailwind v4 dark mode) and i18n locale selection (next-intl)
**Confidence:** HIGH

## Summary

This phase replaces two stub settings subpages (Appearance, Language) with functional implementations. The heavy lifting is already done: next-themes 0.4.6 is installed and configured with a `ThemeProvider`, the backend has a fully working `PATCH /users/me/preferences` endpoint that accepts `theme` and `language` fields, and the `User` type in the frontend already includes both fields. The existing settings component pattern (RadioGroup in a Card, raw `fetch()` to the preferences endpoint, then `refreshUser()`) provides an exact template to follow.

There are two specific technical issues to address. First, the CSS dark mode variant in `globals.css` currently uses `@custom-variant dark (&:is(.dark *))` which has two problems: `:is()` has higher specificity than the recommended `:where()`, and the selector only matches descendants of `.dark` (via `*`), not the `.dark` element itself -- meaning `dark:` utilities on `<html>` and `<body>` elements won't apply. The fix per official Tailwind v4 docs is `@custom-variant dark (&:where(.dark, .dark *))`. Second, the theme preference needs a two-layer sync: next-themes handles instant client-side switching (via localStorage and `setTheme()`), while the backend persists the preference for cross-device sync. On login, the user's backend theme value must be applied to next-themes without causing a flash.

For language, the existing `LanguageSwitcher` component and `next-intl` routing infrastructure already handle locale switching via `router.replace(pathname, { locale })`. The language subpage simply needs to present the 3 languages with RadioGroup-style selection, call the preferences API, then trigger the locale route change.

**Primary recommendation:** Build two new settings components (`ThemeSettings`, `LanguageSettings`) following the exact pattern of `TimeFormatSettings` -- Card with RadioGroup, raw fetch to preferences API, `refreshUser()` -- then wire them into the stub subpages. Fix the CSS variant on line 4 of `globals.css`.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next-themes | 0.4.6 | Theme management (light/dark/system) | Already installed; handles SSR flash prevention, localStorage, system preference detection |
| next-intl | 4.7.0 | i18n routing and translations | Already installed; handles locale-prefixed routing and message bundles |
| Tailwind CSS | 4.x | Utility CSS with dark mode variant | Already installed; `@custom-variant dark` for class-based dark mode |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @radix-ui/react-radio-group | 1.3.8 | Accessible radio selection UI | Theme and language selector options (via shadcn RadioGroup) |
| sonner | 2.0.7 | Toast notifications | Success/error feedback on preference save |
| lucide-react | 0.562.0 | Icons | Sun/Moon/Monitor icons for theme options, Globe for language |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| RadioGroup for theme | Toggle/SegmentedControl | RadioGroup matches existing settings pattern and handles 3 options well |
| Raw fetch() for API | Add authApi.updatePreferences() | Raw fetch matches existing pattern in all other settings components; adding apiClient method is a refactor for a separate phase |

**Installation:**
No new packages needed. All dependencies are already installed.

## Architecture Patterns

### Established Settings Component Pattern
The codebase has a clear, consistent pattern for settings components established in Phase 36. All new components MUST follow this exact pattern.

```
frontend/
  components/settings/
    theme-settings.tsx         # NEW - ThemeSettings component
    language-settings.tsx      # NEW - LanguageSettings component
    date-format-settings.tsx   # EXISTING - pattern to follow
    time-format-settings.tsx   # EXISTING - pattern to follow
  app/[locale]/(dashboard)/dashboard/settings/
    appearance/page.tsx        # MODIFY - replace stub with ThemeSettings
    language/page.tsx          # MODIFY - replace stub with LanguageSettings
```

### Pattern 1: Settings Component (established pattern)
**What:** A self-contained Card component that reads current value from `useAuth()`, sends PATCH to preferences API, and calls `refreshUser()`.
**When to use:** Every settings preference component.
**Example:**
```typescript
// Source: frontend/components/settings/time-format-settings.tsx (existing pattern)
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAuth } from "@/lib/contexts/auth-context";
import { toast } from "sonner";

export function SomeFormatSettings() {
  const t = useTranslations("settings.someFormat");
  const { user, refreshUser } = useAuth();
  const [isUpdating, setIsUpdating] = useState(false);

  const currentValue = user?.some_field || "default";

  const handleChange = async (value: string) => {
    if (value === currentValue) return;
    setIsUpdating(true);
    try {
      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/users/me/preferences`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
          },
          credentials: "include",
          body: JSON.stringify({ some_field: value }),
        }
      );
      await refreshUser();
      toast.success(t("saved"));
    } catch {
      toast.error(t("saveError"));
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="h-5 w-5" />
          {t("title")}
        </CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <RadioGroup value={currentValue} onValueChange={handleChange} disabled={isUpdating} className="space-y-3">
          {/* options */}
        </RadioGroup>
      </CardContent>
    </Card>
  );
}
```

### Pattern 2: Subpage Composition (established pattern)
**What:** Settings subpage page.tsx imports component(s) directly -- no extra Card wrappers (per 36-01 decision).
**When to use:** Every settings subpage.
**Example:**
```typescript
// Source: frontend/app/[locale]/(dashboard)/dashboard/settings/regional-formats/page.tsx
"use client";

import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { ThemeSettings } from "@/components/settings/theme-settings";

export default function AppearancePage() {
  const t = useTranslations("settings");
  return (
    <div className="space-y-6">
      <Link href="/dashboard/settings" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground md:hidden">
        <ArrowLeft className="h-4 w-4" />
        {t("title")}
      </Link>
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t("nav.appearance")}</h2>
        <p className="text-muted-foreground">{t("hub.appearanceDesc")}</p>
      </div>
      <ThemeSettings />
    </div>
  );
}
```

### Pattern 3: Two-Layer Theme Sync
**What:** next-themes provides instant client-side theme switching. Backend persists for cross-device. On preference change: (1) call `setTheme()` from next-themes for instant visual change, (2) PATCH backend for persistence, (3) `refreshUser()` to sync auth context.
**When to use:** Theme settings component.
**Key detail:** next-themes already handles flash prevention via its injected script that runs before React hydration. The ThemeProvider is configured with `attribute="class"`, `defaultTheme="system"`, and `enableSystem`. On initial page load after login, the user's backend theme should be applied to next-themes via `setTheme(user.theme)` in an effect, but ONLY after confirming the user is loaded and the backend value differs from next-themes' current value.

### Pattern 4: Language Preference with Route Change
**What:** Language change requires both a backend persistence call AND a next-intl locale route change.
**When to use:** Language settings component.
**Key detail:** After PATCH to backend, use `router.replace(pathname, { locale: newLocale })` from `@/i18n/navigation` to trigger the route change. The route change will cause a full re-render with new translations. Order: (1) PATCH backend, (2) refreshUser(), (3) router.replace with new locale.

### Anti-Patterns to Avoid
- **Creating a SettingsContext:** Per prior decision, `useAuth()` is the single source of truth. Do NOT create a new context for settings/preferences.
- **Using apiClient for preferences:** The existing settings components all use raw `fetch()`. Follow the established pattern for consistency. Refactoring to `apiClient` is a separate concern.
- **Wrapping components in extra Cards:** Per 36-01 decision, page.tsx imports components directly. The component itself contains its Card.
- **Syncing theme on every render:** Only sync backend theme to next-themes once after login/user load, not on every render cycle. Use a ref or check to prevent loops.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Theme flash prevention | Custom script/cookie/SSR injection | next-themes (already installed) | Handles SSR script injection, localStorage persistence, system preference detection, hydration mismatch prevention |
| Dark mode CSS variant | Manual `.dark` class selectors | Tailwind v4 `@custom-variant dark` | Single line CSS config gives all `dark:` utilities |
| Locale routing | Manual path manipulation | next-intl `router.replace(pathname, { locale })` | Handles URL rewriting, cookie setting, message bundle loading |
| System theme detection | `window.matchMedia` listener | next-themes `enableSystem` + `resolvedTheme` | Handles listener setup/cleanup, real-time detection, SSR safety |

**Key insight:** Both next-themes and next-intl are already fully integrated into the app. This phase is about wiring their APIs into settings UI, not about setting them up from scratch.

## Common Pitfalls

### Pitfall 1: Dark mode variant specificity with `:is()` vs `:where()`
**What goes wrong:** The current `@custom-variant dark (&:is(.dark *))` uses `:is()` which preserves specificity of its most specific argument. Also, `.dark *` only matches descendants, not the `.dark` element itself. This means `dark:bg-background` on `<html class="dark">` won't work, and `body` styles may have specificity issues.
**Why it happens:** `:is()` takes the specificity of the most specific selector inside it. `:where()` has zero specificity, which is what Tailwind v4 expects.
**How to avoid:** Change to `@custom-variant dark (&:where(.dark, .dark *))` per official Tailwind v4 docs. This adds zero specificity AND matches both the `.dark` element and its descendants.
**Warning signs:** Dark mode styles not applying to `<html>` or `<body>` elements; inconsistent dark mode behavior.

### Pitfall 2: Hydration mismatch with theme-dependent UI
**What goes wrong:** Rendering theme-dependent content (e.g., "Light mode" text, sun/moon icons) on server causes hydration mismatch because `useTheme()` returns `undefined` until client mount.
**Why it happens:** next-themes cannot know the theme on the server. `theme` and `resolvedTheme` are `undefined` during SSR.
**How to avoid:** Use a `mounted` state check (same pattern as existing `ThemeToggle` component). Render a skeleton or neutral state until mounted.
**Warning signs:** React hydration warnings in console; theme-dependent UI flickering on page load.

### Pitfall 3: Theme sync loop between next-themes and backend
**What goes wrong:** Setting theme from backend triggers next-themes change, which triggers save to backend, creating an infinite loop.
**Why it happens:** Both sources (next-themes localStorage, backend user.theme) try to be authoritative.
**How to avoid:** Clear separation: (1) next-themes is the runtime source of truth (instant UI), (2) backend is the persistence source (cross-device). Only sync backend->next-themes on initial load/login. Only sync next-themes->backend on explicit user action in the settings UI.
**Warning signs:** Multiple rapid API calls after login; theme flickering.

### Pitfall 4: Language change causes full page reload
**What goes wrong:** Changing locale via `router.replace(pathname, { locale })` triggers a full navigation since the URL changes (locale prefix in URL). Developer expects instant swap like theme change.
**Why it happens:** next-intl uses URL-based locale routing. Changing locale changes the URL path, which triggers a navigation.
**How to avoid:** This is expected behavior, not a bug. Set the loading state before calling `router.replace()`. Toast success message should appear after the navigation completes (but it will be lost in the re-render). Consider showing toast on the new page or simply accepting that the UI feedback is the language changing.
**Warning signs:** Toast message disappearing on language change (expected behavior).

### Pitfall 5: Initial theme sync on login
**What goes wrong:** User logs in on a new device. next-themes defaults to "system" but user's backend preference is "dark". There's a flash of wrong theme.
**Why it happens:** next-themes loads from localStorage first (empty on new device = falls back to defaultTheme="system"). Backend user data loads asynchronously after.
**How to avoid:** After `refreshUser()` on login, check if `user.theme` differs from current next-themes value and call `setTheme(user.theme)` once. The flash is minimal because next-themes' script handles the initial render, and the correction happens quickly. For a truly flash-free experience on new devices, the backend theme could be returned in the login response and stored to localStorage before the page renders -- but this is an optimization, not a requirement for this phase.
**Warning signs:** Brief flash of light theme when user prefers dark on first login.

## Code Examples

Verified patterns from the existing codebase:

### ThemeSettings Component Structure
```typescript
// NEW component: frontend/components/settings/theme-settings.tsx
// Based on: frontend/components/settings/time-format-settings.tsx (existing pattern)
"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { Sun, Moon, Monitor } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAuth } from "@/lib/contexts/auth-context";
import { toast } from "sonner";

const THEME_OPTIONS = [
  { value: "light", icon: Sun },
  { value: "dark", icon: Moon },
  { value: "system", icon: Monitor },
] as const;

export function ThemeSettings() {
  const t = useTranslations("settings.appearance");
  const { user, refreshUser } = useAuth();
  const { theme, setTheme } = useTheme();
  const [isUpdating, setIsUpdating] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Current theme from user preferences (backend source of truth for persistence)
  const currentTheme = user?.theme || "system";

  const handleChange = async (value: string) => {
    if (value === currentTheme) return;

    // 1. Instant visual change via next-themes
    setTheme(value);

    // 2. Persist to backend
    setIsUpdating(true);
    try {
      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/users/me/preferences`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
          },
          credentials: "include",
          body: JSON.stringify({ theme: value }),
        }
      );
      await refreshUser();
      toast.success(t("saved"));
    } catch {
      // Revert next-themes on error
      setTheme(currentTheme);
      toast.error(t("saveError"));
    } finally {
      setIsUpdating(false);
    }
  };

  if (!mounted) return null; // Prevent hydration mismatch

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <RadioGroup value={currentTheme} onValueChange={handleChange} disabled={isUpdating} className="space-y-3">
          {THEME_OPTIONS.map(({ value, icon: Icon }) => (
            <div key={value} className="flex items-center space-x-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors">
              <RadioGroupItem value={value} id={`theme-${value}`} />
              <Label htmlFor={`theme-${value}`} className="flex-1 flex items-center gap-2 cursor-pointer">
                <Icon className="h-4 w-4" />
                <span className="font-medium">{t(value)}</span>
              </Label>
            </div>
          ))}
        </RadioGroup>
      </CardContent>
    </Card>
  );
}
```

### LanguageSettings Component Structure
```typescript
// NEW component: frontend/components/settings/language-settings.tsx
// Based on: frontend/components/settings/time-format-settings.tsx + LanguageSwitcher
"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Globe } from "lucide-react";
import { useRouter, usePathname } from "@/i18n/navigation";
import { locales, localeNames, localeFlags, type Locale } from "@/i18n/config";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAuth } from "@/lib/contexts/auth-context";
import { toast } from "sonner";

export function LanguageSettings() {
  const t = useTranslations("settings.language");
  const { user, refreshUser } = useAuth();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isUpdating, setIsUpdating] = useState(false);

  const currentLanguage = (user?.language || locale) as Locale;

  const handleChange = async (value: string) => {
    if (value === currentLanguage) return;
    setIsUpdating(true);
    try {
      // 1. Persist to backend
      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/users/me/preferences`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
          },
          credentials: "include",
          body: JSON.stringify({ language: value }),
        }
      );
      await refreshUser();
      // 2. Switch locale route (causes navigation/re-render)
      router.replace(pathname, { locale: value as Locale });
    } catch {
      toast.error(t("saveError"));
      setIsUpdating(false);
    }
    // Note: setIsUpdating(false) not needed in success path - page re-renders
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          {t("title")}
        </CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <RadioGroup value={currentLanguage} onValueChange={handleChange} disabled={isUpdating} className="space-y-3">
          {locales.map((loc) => (
            <div key={loc} className="flex items-center space-x-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors">
              <RadioGroupItem value={loc} id={`lang-${loc}`} />
              <Label htmlFor={`lang-${loc}`} className="flex-1 flex items-center gap-2 cursor-pointer">
                <span>{localeFlags[loc]}</span>
                <span className="font-medium">{localeNames[loc]}</span>
              </Label>
            </div>
          ))}
        </RadioGroup>
      </CardContent>
    </Card>
  );
}
```

### CSS Dark Mode Fix
```css
/* frontend/app/globals.css - Line 4 */
/* BEFORE (current - broken for html/body, higher specificity): */
@custom-variant dark (&:is(.dark *));

/* AFTER (correct - per Tailwind v4 official docs): */
@custom-variant dark (&:where(.dark, .dark *));
```

### Backend Theme Sync on Login (in auth-context or a useEffect)
```typescript
// In a component or hook that runs after login:
const { user } = useAuth();
const { theme, setTheme } = useTheme();

useEffect(() => {
  if (user?.theme && user.theme !== theme) {
    setTheme(user.theme);
  }
}, [user?.theme]); // Only when user.theme changes (login, refreshUser)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `darkMode: "class"` in tailwind.config.js | `@custom-variant dark (...)` in CSS | Tailwind v4 (Jan 2025) | Config file removed; dark mode handled purely in CSS |
| `:is()` selector for dark variant | `:where()` selector for zero specificity | Tailwind v4 official docs | `:where()` prevents specificity conflicts with utility classes |
| Custom theme scripts | next-themes 0.4.x | Stable since late 2024 | Handles SSR, system detection, flash prevention out of the box |

**Deprecated/outdated:**
- `tailwind.config.js darkMode: "class"`: Removed in Tailwind v4. Use `@custom-variant dark` in CSS instead.
- `@custom-variant dark (&:is(.dark *))`: While functional for descendants, incorrect for the `.dark` element itself and has higher specificity. Use `:where(.dark, .dark *)` instead.

## Open Questions

1. **Backend theme sync on initial load from new device**
   - What we know: next-themes falls back to `defaultTheme="system"` when localStorage is empty. Backend theme loads asynchronously via `getMe()`. There may be a brief flash.
   - What's unclear: Whether the flash is noticeable enough to warrant a more complex solution (e.g., storing theme in a cookie during login).
   - Recommendation: Accept the minimal flash for now. The next-themes script handles the initial render gracefully, and the correction after `getMe()` is fast. If users report issues, add cookie-based theme hint as a follow-up optimization.

2. **Should toast show after language change?**
   - What we know: Language change triggers `router.replace()` which causes a navigation. Toast state is lost during navigation.
   - What's unclear: Whether the user needs explicit "saved" feedback or if the language actually changing is sufficient feedback.
   - Recommendation: Do NOT show toast on language change success. The language changing IS the feedback. Show toast only on error (which doesn't navigate).

## Sources

### Primary (HIGH confidence)
- **Codebase inspection** - Verified: ThemeProvider config, globals.css dark variant, User type with theme/language fields, PATCH /users/me/preferences endpoint, existing settings component pattern (time-format-settings.tsx, date-format-settings.tsx), i18n config and routing, LanguageSwitcher component
- **Tailwind CSS v4 official docs** (https://tailwindcss.com/docs/dark-mode) - `@custom-variant dark (&:where(.dark, .dark *))` syntax
- **next-themes GitHub** (https://github.com/pacocoursey/next-themes) - API: ThemeProvider props, useTheme() hook, SSR behavior

### Secondary (MEDIUM confidence)
- **WebSearch: Tailwind v4 dark mode fix articles** - Multiple sources confirm `:where()` over `:is()` for zero specificity. Verified against official Tailwind docs.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already installed and in use; versions verified from package.json
- Architecture: HIGH - established pattern exists in codebase (time-format-settings, date-format-settings); subpage composition pattern documented in phase 36
- Pitfalls: HIGH - CSS variant issue confirmed by comparing current code against official docs; hydration mismatch pattern already handled in existing ThemeToggle component
- Backend API: HIGH - verified PATCH /users/me/preferences handler accepts theme and language fields; entity.go UpdatePreferences method confirmed

**Research date:** 2026-02-13
**Valid until:** 2026-03-13 (stable libraries, well-established patterns)
