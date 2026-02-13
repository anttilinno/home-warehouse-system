---
phase: 35-settings-shell-and-route-structure
plan: 02
subsystem: frontend-settings
tags: [settings, navigation, ui-components, ios-style, routing]
dependency_graph:
  requires:
    - 35-01 (settings layout and SettingsRow component)
    - SettingsRow component for hub rows
    - SettingsNav for active state tracking
    - auth-context for live preview values
    - i18n config for locale names
  provides:
    - Settings hub landing page with grouped rows
    - Profile card navigation
    - Live preview values (theme, language, date format)
    - 7 stub subpages with mobile back navigation
  affects:
    - Settings hub is now navigation entry point
    - All settings routes are structurally complete
    - Phase 36-39 will replace stubs with real content
tech_stack:
  added: []
  patterns:
    - iOS-style grouped rows with section headers
    - Live preview values derived directly from useAuth() user object
    - Mobile-only back navigation using md:hidden
    - Profile card as clickable Link wrapping Card component
  testing: Manual verification via checkpoint
key_files:
  created:
    - frontend/app/[locale]/(dashboard)/dashboard/settings/profile/page.tsx
    - frontend/app/[locale]/(dashboard)/dashboard/settings/appearance/page.tsx
    - frontend/app/[locale]/(dashboard)/dashboard/settings/language/page.tsx
    - frontend/app/[locale]/(dashboard)/dashboard/settings/regional-formats/page.tsx
    - frontend/app/[locale]/(dashboard)/dashboard/settings/security/page.tsx
    - frontend/app/[locale]/(dashboard)/dashboard/settings/notifications/page.tsx
    - frontend/app/[locale]/(dashboard)/dashboard/settings/data-storage/page.tsx
  modified:
    - frontend/app/[locale]/(dashboard)/dashboard/settings/page.tsx (complete rewrite)
decisions:
  - decision: "Live preview values computed inline without useMemo/useEffect"
    rationale: "User object from useAuth rarely changes; direct derivation is simpler and safer than managing state sync"
    alternatives: ["useMemo for preview values", "useState with useEffect sync"]
  - decision: "Profile card links to dedicated /profile subpage instead of rendering inline modal"
    rationale: "Consistent navigation pattern; mobile-friendly; aligns with other settings subpages"
    alternatives: ["ProfileEditSheet modal from old page", "Inline form on hub"]
  - decision: "Notifications and Data Storage rows omit preview values in Phase 35"
    rationale: "No user preferences exist yet for these; previews will be added in Phase 38-39 when implementing forms"
    alternatives: ["Show placeholder text like 'Not configured'"]
  - decision: "Section headers use h3 with text-sm styling instead of div"
    rationale: "Semantic HTML for accessibility; matches iOS Settings grouping pattern"
    alternatives: ["div with aria-label", "h2 with smaller text"]
metrics:
  duration_minutes: ~18
  tasks_completed: 3
  files_created: 7
  files_modified: 1
  commits: 2
  checkpoint_approvals: 1
  completed: 2026-02-13
---

# Phase 35 Plan 02: Settings Hub and Stub Subpages Summary

**One-liner:** iOS-style settings hub with profile card, grouped rows, live previews (theme/language/date), and 7 navigable stub subpages

## What Was Built

Completed the settings hub-and-subpage architecture:

1. **Settings Hub Landing Page** (complete rewrite):
   - Profile card at top: clickable Link to /profile, displays avatar, name, email, chevron
   - **Preferences** group: 3 rows (Appearance, Language, Regional Formats) with live preview values
   - **System & Security** group: 3 rows (Security, Notifications, Data & Storage) without previews
   - No duplicate h1 (layout provides it)
   - All labels and descriptions translated (en/et/ru)

2. **Live Preview Values**:
   - **Theme preview**: Shows "Dark", "Light", or "System" based on `user.theme`
   - **Language preview**: Shows locale display name (e.g., "English", "Eesti keel", "Русский") from localeNames map
   - **Date format preview**: Shows current user's date_format (e.g., "YYYY-MM-DD")
   - Derived directly in render path from `useAuth().user` (no state management)

3. **Seven Stub Subpages**:
   - profile, appearance, language, regional-formats, security, notifications, data-storage
   - Each renders: mobile-only back link (ArrowLeft + "Settings"), h2 heading, "Coming soon" text
   - All use `Link` from `@/i18n/navigation` for i18n routing
   - Ready to be replaced with real content in Phase 36-39

4. **Navigation Architecture**:
   - Desktop: sidebar always visible, active state matches current route
   - Mobile: hub serves as navigation entry point, back links on subpages
   - Profile card provides dedicated route for user profile editing

## Technical Implementation

### Hub Page Structure

```tsx
// frontend/app/[locale]/(dashboard)/dashboard/settings/page.tsx
"use client";

import { useTranslations } from "next-intl";
import { Palette, Globe, Calendar, Shield, Bell, Database, ChevronRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/lib/contexts/auth-context";
import { SettingsRow } from "@/components/settings/settings-row";
import { localeNames, Locale } from "@/i18n/config";

export default function SettingsPage() {
  const t = useTranslations("settings");
  const { user } = useAuth();

  // Compute live previews inline
  const themePreview = user?.theme === "dark" ? t("hub.dark") :
                       user?.theme === "light" ? t("hub.light") : t("hub.system");
  const languagePreview = localeNames[(user?.language || "en") as Locale] || "English";
  const datePreview = user?.date_format || "YYYY-MM-DD";

  return (
    <div className="space-y-6">
      {/* Profile Card */}
      <Link href="/dashboard/settings/profile">
        <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
          <CardContent className="flex items-center gap-4 p-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={user?.avatar_url} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="font-semibold text-lg">{user?.full_name}</div>
              <div className="text-sm text-muted-foreground">{user?.email}</div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </CardContent>
        </Card>
      </Link>

      {/* Preferences Group */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground px-1 mb-2">
          {t("hub.preferences")}
        </h3>
        <SettingsRow icon={Palette} label={t("nav.appearance")}
                     description={t("hub.appearanceDesc")}
                     href="/dashboard/settings/appearance" preview={themePreview} />
        <SettingsRow icon={Globe} label={t("nav.language")}
                     description={t("hub.languageDesc")}
                     href="/dashboard/settings/language" preview={languagePreview} />
        <SettingsRow icon={Calendar} label={t("nav.regionalFormats")}
                     description={t("hub.regionalFormatsDesc")}
                     href="/dashboard/settings/regional-formats" preview={datePreview} />
      </div>

      {/* System & Security Group */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground px-1 mb-2">
          {t("hub.systemSecurity")}
        </h3>
        <SettingsRow icon={Shield} label={t("nav.security")}
                     description={t("hub.securityDesc")}
                     href="/dashboard/settings/security" />
        <SettingsRow icon={Bell} label={t("nav.notifications")}
                     description={t("hub.notificationsDesc")}
                     href="/dashboard/settings/notifications" />
        <SettingsRow icon={Database} label={t("nav.dataStorage")}
                     description={t("hub.dataStorageDesc")}
                     href="/dashboard/settings/data-storage" />
      </div>
    </div>
  );
}
```

### Stub Subpage Pattern

All 7 stub subpages follow identical pattern:

```tsx
"use client";

import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";

export default function AppearancePage() {
  const t = useTranslations("settings");

  return (
    <div className="space-y-6">
      {/* Mobile back link */}
      <Link
        href="/dashboard/settings"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground md:hidden"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("title")}
      </Link>

      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t("nav.appearance")}</h2>
        <p className="text-muted-foreground">{t("comingSoon")}</p>
      </div>
    </div>
  );
}
```

## Deviations from Plan

None - plan executed exactly as written.

All tasks completed successfully:
- Task 1: Hub page rewritten with profile card, grouped rows, live previews
- Task 2: All 7 stub subpages created with back navigation
- Task 3: Human verification checkpoint approved (all 8 verification steps passed)

## Verification Results

**Checkpoint Verification (Task 3):**
- [x] Hub page renders with profile card + 2 groups (6 rows total)
- [x] Settings h1 title from layout (no duplicate)
- [x] Desktop sidebar visible with "Overview" highlighted on hub
- [x] Navigating to stub changes active state in sidebar
- [x] Browser back returns to hub correctly
- [x] Mobile view hides sidebar, rows remain tappable
- [x] Mobile back link appears on subpages and works
- [x] Live previews show actual values (theme, language, date format)

**Type checking:** No errors from `npx tsc --noEmit`

## Integration Points

### Upstream Dependencies
- **35-01**: Settings layout, SettingsRow, SettingsNav components
- **auth-context**: User object for live preview values
- **i18n config**: localeNames map for language preview
- **next-intl**: Translation keys for all labels

### Downstream Impact
- **Phase 36**: Will replace Profile stub with ProfileEditSheet form
- **Phase 37**: Will replace Appearance stub with theme/format settings
- **Phase 38**: Will replace Language/Regional Formats stubs with picker forms
- **Phase 39**: Will replace Security/Notifications/Data Storage stubs with real forms

Hub architecture is complete; all routing works; future phases are drop-in replacements.

## Testing Notes

Manual testing via checkpoint verified:
- Hub renders correctly on desktop (>768px) and mobile (<768px)
- Navigation works in both directions (forward via rows/sidebar, back via browser/link)
- Live previews reflect actual user data
- Active state tracking in sidebar matches current route
- Mobile back links only appear on small screens
- All text properly translated in all 3 locales (en/et/ru)

No automated tests added (UI-focused feature, relies on existing component tests).

## Key Files Modified

### Created (7 stub subpages)
1. `frontend/app/[locale]/(dashboard)/dashboard/settings/profile/page.tsx` - Profile stub
2. `frontend/app/[locale]/(dashboard)/dashboard/settings/appearance/page.tsx` - Appearance stub
3. `frontend/app/[locale]/(dashboard)/dashboard/settings/language/page.tsx` - Language stub
4. `frontend/app/[locale]/(dashboard)/dashboard/settings/regional-formats/page.tsx` - Regional Formats stub
5. `frontend/app/[locale]/(dashboard)/dashboard/settings/security/page.tsx` - Security stub
6. `frontend/app/[locale]/(dashboard)/dashboard/settings/notifications/page.tsx` - Notifications stub
7. `frontend/app/[locale]/(dashboard)/dashboard/settings/data-storage/page.tsx` - Data & Storage stub

### Modified (1 complete rewrite)
- `frontend/app/[locale]/(dashboard)/dashboard/settings/page.tsx` - Hub landing page (167 lines -> 103 lines, complete replacement)

## Success Criteria Met

- [x] HUB-01: iOS-style grouped rows with icons, labels, descriptions, chevrons
- [x] HUB-02: Live preview of current values (theme, language, date format)
- [x] HUB-03: Organized sections (Profile card, Preferences, System & Security)
- [x] HUB-04: Desktop sidebar visible; mobile uses hub as navigation entry
- [x] HUB-05: Back navigation returns to settings hub
- [x] HUB-06: All labels translated in en/et/ru

## Next Steps

**Phase 36 (Profile Subpage):**
- Replace profile stub with ProfileEditSheet form
- Add avatar upload functionality
- Implement profile update API integration

**Phase 37 (Appearance & Regional Formats):**
- Replace appearance stub with theme picker + format settings
- Replace regional-formats stub with date/time/number format selectors

**Phase 38 (Language Subpage):**
- Replace language stub with locale picker
- Add language switching logic with server-side persistence

**Phase 39 (Security, Notifications, Data & Storage):**
- Replace security stub with password change + active sessions
- Replace notifications stub with preference toggles (email/push)
- Replace data-storage stub with backup/restore + storage stats

All routing infrastructure is complete. Future phases are pure content replacement.

## Self-Check: PASSED

**Files exist:**
- [x] frontend/app/[locale]/(dashboard)/dashboard/settings/profile/page.tsx - EXISTS
- [x] frontend/app/[locale]/(dashboard)/dashboard/settings/appearance/page.tsx - EXISTS
- [x] frontend/app/[locale]/(dashboard)/dashboard/settings/language/page.tsx - EXISTS
- [x] frontend/app/[locale]/(dashboard)/dashboard/settings/regional-formats/page.tsx - EXISTS
- [x] frontend/app/[locale]/(dashboard)/dashboard/settings/security/page.tsx - EXISTS
- [x] frontend/app/[locale]/(dashboard)/dashboard/settings/notifications/page.tsx - EXISTS
- [x] frontend/app/[locale]/(dashboard)/dashboard/settings/data-storage/page.tsx - EXISTS
- [x] frontend/app/[locale]/(dashboard)/dashboard/settings/page.tsx - EXISTS (modified)

**Commits exist:**
- [x] b78a232 - feat(35-02): rewrite settings hub page with grouped rows and live previews
- [x] 8e7b132 - feat(35-02): create 7 stub subpages with mobile back navigation
