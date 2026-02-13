# Phase 36: Profile, Security, and Regional Formats - Research

**Researched:** 2026-02-13
**Domain:** Component relocation into Next.js App Router subpages, existing settings composition patterns
**Confidence:** HIGH

## Summary

Phase 36 replaces three stub subpages (profile, security, regional-formats) with functional pages that compose existing components. Every component needed already exists in `frontend/components/settings/` -- this phase is a wiring and composition exercise with zero new UI components or backend changes.

The existing components were built in v1.5 (Phases 27-29: Account/Security/Deletion) and v1.6 (Phases 30-34: Format Personalization) and are currently orphaned -- they are not imported by any page since Phase 35 replaced the monolithic settings page with the hub. The three stub subpages from Phase 35 each render only a heading and "Coming soon" text. This phase replaces that placeholder content with the real components.

A secondary concern is the hub page's profile card (PROF-03). The hub page already displays the user's avatar, full name, and email in a card that links to `/dashboard/settings/profile`. This requirement is already satisfied by Phase 35-02 and needs only verification, not new work.

A tertiary concern is the `ProfileEditSheet` in `user-menu.tsx`. This side-panel duplicates profile editing functionality (name, email, avatar, password change) that will now live on the dedicated profile and security subpages. The sheet should be considered for removal or replacement with navigation to the profile subpage, but this decision could be deferred if it would introduce scope creep.

**Primary recommendation:** Replace each stub's "Coming soon" content with imports of the existing composite components. Profile page renders `AccountSettings`. Security page renders `SecuritySettings`. Regional Formats page renders `DateFormatSettings`, `TimeFormatSettings`, and `NumberFormatSettings` stacked vertically. No new components needed.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js App Router | 16 | Route-based subpages already created in Phase 35 | Page files exist, just need content replacement |
| next-intl | 4.7.0 | Translation keys for page headings | All translation keys already exist from v1.5/v1.6 |
| react-hook-form + zod | (installed) | Form validation in AccountSettings, PasswordChange | Already used by existing components |
| shadcn/ui Card | (installed) | Card/CardHeader/CardContent wrapping in all settings components | All existing components already use this pattern |
| sonner | (installed) | Toast notifications for save/error feedback | All existing components use `toast()` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | (installed) | Icons in component headers (User, Shield, Calendar, Clock, Hash, etc.) | Already imported by existing components |
| @/lib/contexts/auth-context | Custom | useAuth() for user data and refreshUser() | All existing settings components use this |
| @/lib/api/auth | Custom | API calls (updateProfile, changePassword, getSessions, etc.) | All existing settings components use this |
| date-fns | (installed) | Date formatting in DateFormatSettings preview | Already imported by existing component |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Composing existing components directly | Rewriting components for the new page context | Unnecessary work -- existing components are self-contained with their own Card wrappers, forms, API calls, and translations |
| Keeping Card wrappers on existing components | Stripping Card wrappers, using bare forms | Would require modifying 6+ existing components for no user-visible benefit; cards provide visual grouping that matches iOS Settings style |

**Installation:**
```bash
# No installation needed -- all dependencies already present
```

## Architecture Patterns

### Target Route Structure (After Phase 36)
```
frontend/app/[locale]/(dashboard)/dashboard/settings/
  layout.tsx              # Unchanged (from Phase 35)
  page.tsx                # Unchanged (hub, already has profile card - PROF-03)
  profile/
    page.tsx              # MODIFY: Replace stub with AccountSettings composition
  security/
    page.tsx              # MODIFY: Replace stub with SecuritySettings composition
  regional-formats/
    page.tsx              # MODIFY: Replace stub with format settings composition
  appearance/page.tsx     # Unchanged (stub for Phase 37)
  language/page.tsx       # Unchanged (stub for Phase 37)
  notifications/page.tsx  # Unchanged (stub for Phase 39)
  data-storage/page.tsx   # Unchanged (stub for Phase 38)
```

### Existing Components to Relocate

| Component | File | Currently Used By | Target Subpage |
|-----------|------|-------------------|----------------|
| `AccountSettings` | `components/settings/account-settings.tsx` | Nothing (orphaned) | Profile page |
| `AvatarUpload` | `components/settings/avatar-upload.tsx` | `AccountSettings` (internal), `ProfileEditSheet` | Profile page (via AccountSettings) |
| `SecuritySettings` | `components/settings/security-settings.tsx` | Nothing (orphaned) | Security page |
| `PasswordChange` | `components/settings/password-change.tsx` | `SecuritySettings` (internal) | Security page (via SecuritySettings) |
| `ActiveSessions` | `components/settings/active-sessions.tsx` | `SecuritySettings` (internal) | Security page (via SecuritySettings) |
| `DeleteAccountDialog` | `components/settings/delete-account-dialog.tsx` | `SecuritySettings` (internal) | Security page (via SecuritySettings) |
| `DateFormatSettings` | `components/settings/date-format-settings.tsx` | Nothing (orphaned) | Regional Formats page |
| `TimeFormatSettings` | `components/settings/time-format-settings.tsx` | Nothing (orphaned) | Regional Formats page |
| `NumberFormatSettings` | `components/settings/number-format-settings.tsx` | Nothing (orphaned) | Regional Formats page |

### Pattern 1: Subpage with Single Composite Component (Profile, Security)
**What:** A subpage that imports and renders one top-level composite component. The composite already includes its own Card wrapper, header, form, and API calls.
**When to use:** When an existing composite component already handles the full section (AccountSettings, SecuritySettings).
**Example:**
```tsx
// Source: Derived from existing stub pattern + existing component composition
"use client";

import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { AccountSettings } from "@/components/settings/account-settings";

export default function ProfilePage() {
  const t = useTranslations("settings");

  return (
    <div className="space-y-6">
      {/* Mobile back link (from Phase 35 stub pattern) */}
      <Link
        href="/dashboard/settings"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground md:hidden"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("title")}
      </Link>

      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          {t("nav.profile")}
        </h2>
        <p className="text-muted-foreground">{t("account.description")}</p>
      </div>

      <AccountSettings />
    </div>
  );
}
```

### Pattern 2: Subpage with Multiple Stacked Components (Regional Formats)
**What:** A subpage that imports and stacks multiple independent settings components vertically. Each component is a self-contained Card with its own form and save logic.
**When to use:** When a subpage groups multiple related-but-independent settings sections (date, time, number formats).
**Example:**
```tsx
// Source: Derived from existing stub pattern + existing component composition
"use client";

import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { DateFormatSettings } from "@/components/settings/date-format-settings";
import { TimeFormatSettings } from "@/components/settings/time-format-settings";
import { NumberFormatSettings } from "@/components/settings/number-format-settings";

export default function RegionalFormatsPage() {
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
        <h2 className="text-2xl font-bold tracking-tight">
          {t("nav.regionalFormats")}
        </h2>
        <p className="text-muted-foreground">
          {t("hub.regionalFormatsDesc")}
        </p>
      </div>

      <DateFormatSettings />
      <TimeFormatSettings />
      <NumberFormatSettings />
    </div>
  );
}
```

### Pattern 3: Hub Profile Card (Already Implemented)
**What:** The settings hub page already renders a profile card with avatar, name, email, and chevron linking to `/dashboard/settings/profile`. This satisfies PROF-03.
**Where:** `frontend/app/[locale]/(dashboard)/dashboard/settings/page.tsx` lines 46-63.
**Action needed:** Verify only -- no code changes needed for PROF-03.

### Anti-Patterns to Avoid
- **Restructuring existing components:** The existing `AccountSettings`, `SecuritySettings`, and format settings components are self-contained. Do NOT extract their internals or change their Card wrappers. Import them as-is.
- **Adding page-level form state:** Each component manages its own form state, submission, and error handling. The subpage is a layout container, not a form controller.
- **Creating wrapper components:** There is no need for a `ProfilePageContent` or `SecurityPageContent` wrapper. The page file itself is the wrapper.
- **Removing the ProfileEditSheet prematurely:** The `ProfileEditSheet` in `user-menu.tsx` provides quick-access profile editing from the user menu. While it duplicates functionality that now lives on the profile subpage, removing it changes the user menu UX which is out of scope for Phase 36. Flag for Phase 37+ cleanup if desired.
- **Changing the existing component's translation namespaces:** `AccountSettings` uses `settings.account`, `SecuritySettings` uses `settings.security` and `settings.dangerZone`, format components use `settings.dateFormat` / `settings.timeFormat` / `settings.numberFormat`. These namespaces already exist in all 3 locale files. Do NOT rename or restructure them.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Profile editing form | New form with name/email/avatar fields | `AccountSettings` component | Already has form validation, API calls, error handling, avatar upload integration |
| Password change form | New password change form | `PasswordChange` component (via `SecuritySettings`) | Already has zod validation, current/new/confirm fields, API integration |
| Session management | New session list with revoke buttons | `ActiveSessions` component (via `SecuritySettings`) | Already handles loading, error states, sort/limit, revoke single/all |
| Account deletion | New delete flow with confirmation | `DeleteAccountDialog` component (via `SecuritySettings`) | Already checks workspace ownership blocking, type-to-confirm, logout-on-delete |
| Date format picker | New radio group for date formats | `DateFormatSettings` component | Already has preset options, custom format with validation, live preview |
| Time format picker | New time format selector | `TimeFormatSettings` component | Already has 12h/24h options with live preview |
| Number format picker | New separator selectors | `NumberFormatSettings` component | Already has thousand/decimal selectors, conflict detection, live preview |

**Key insight:** This phase has zero component creation work. Every piece of UI exists and is tested. The work is exclusively page-level composition: import component, render component, done.

## Common Pitfalls

### Pitfall 1: Forgetting the Mobile Back Link
**What goes wrong:** Subpage renders the settings content but mobile users cannot navigate back to the hub.
**Why it happens:** Developer replaces the entire stub content including the mobile back link.
**How to avoid:** Keep the mobile back link from the stub pattern. Every subpage must include the `<Link href="/dashboard/settings" className="... md:hidden">` with ArrowLeft icon. The existing stubs already have this -- preserve it when adding content.
**Warning signs:** Mobile users stuck on a subpage with no way to return to hub.

### Pitfall 2: Duplicate Page Heading vs Component Heading
**What goes wrong:** The page renders an h2 "Profile" heading, and `AccountSettings` renders its own CardTitle "Account" heading inside the Card. The result looks awkward with two headings.
**Why it happens:** The existing components were designed for the old monolithic settings page where CardTitle was the only heading.
**How to avoid:** This is actually acceptable. The page h2 is the page-level heading visible in the layout. The Card's CardTitle is a section heading within the card. The visual hierarchy (h2 > CardTitle) is clear and matches the hub's grouped-row pattern. However, if the visual redundancy is undesirable, the page-level h2 description can use the component's description text to avoid duplication. Do NOT remove the CardTitle from the existing components as that would break their standalone appearance.
**Warning signs:** "Profile" and "Account" appearing right next to each other. Inspect visually and decide if acceptable.

### Pitfall 3: Card-in-Card Nesting on Security Page
**What goes wrong:** SecuritySettings renders a single Card wrapping all three sections (password, sessions, danger zone). If the page also wraps content in a Card, you get nested cards.
**How to avoid:** Do NOT add an outer Card wrapper in the page. The page uses `<div className="space-y-6">` as its container, and SecuritySettings provides its own Card. Same for AccountSettings and format settings components.
**Warning signs:** Double borders or inset appearance on settings sections.

### Pitfall 4: Stale Preview Values on Hub After Changes
**What goes wrong:** User changes their date format on the Regional Formats subpage, navigates back to the hub, and the hub still shows the old format preview.
**Why it happens:** The settings components call `refreshUser()` after save, which updates the auth context. React re-renders should pick up the new value. However, if Next.js client-side navigation caches the hub page render, the preview might be stale.
**How to avoid:** The hub page derives previews directly from `useAuth().user` in the render path (no useMemo, no stale closures). Since `refreshUser()` triggers a context update, navigating back to the hub will re-render with fresh data. This is already the established pattern from Phase 35. Verify by testing the full flow: change a format preference, navigate back, check hub preview.
**Warning signs:** Hub preview values not updating after preference changes on subpages.

### Pitfall 5: ProfileEditSheet Conflicts
**What goes wrong:** User edits profile via the dedicated subpage, then opens the ProfileEditSheet from the user menu -- the sheet shows stale data or creates confusion about which is the "real" profile editor.
**Why it happens:** ProfileEditSheet and AccountSettings both call the same API but maintain separate form state. They both call `refreshUser()` on save, so data stays in sync. But having two UIs for the same operation is confusing.
**How to avoid:** For Phase 36, accept the duplication. Both work correctly because they share the same auth context and API. Consider replacing the ProfileEditSheet with a link to `/dashboard/settings/profile` in a future cleanup phase. Do NOT modify user-menu.tsx in this phase unless explicitly scoped.
**Warning signs:** Users confused about where to edit their profile.

## Code Examples

### Profile Subpage (Complete Implementation)
```tsx
// Source: Composition of existing stub (Phase 35) + AccountSettings (Phase 27)
"use client";

import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { AccountSettings } from "@/components/settings/account-settings";

export default function ProfilePage() {
  const t = useTranslations("settings");

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/settings"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground md:hidden"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("title")}
      </Link>

      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          {t("nav.profile")}
        </h2>
        <p className="text-muted-foreground">{t("account.description")}</p>
      </div>

      <AccountSettings />
    </div>
  );
}
```

### Security Subpage (Complete Implementation)
```tsx
// Source: Composition of existing stub (Phase 35) + SecuritySettings (Phase 28-29)
"use client";

import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { SecuritySettings } from "@/components/settings/security-settings";

export default function SecurityPage() {
  const t = useTranslations("settings");

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/settings"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground md:hidden"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("title")}
      </Link>

      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          {t("nav.security")}
        </h2>
        <p className="text-muted-foreground">{t("security.description")}</p>
      </div>

      <SecuritySettings />
    </div>
  );
}
```

### Regional Formats Subpage (Complete Implementation)
```tsx
// Source: Composition of existing stub (Phase 35) + format settings (Phases 30-34)
"use client";

import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { DateFormatSettings } from "@/components/settings/date-format-settings";
import { TimeFormatSettings } from "@/components/settings/time-format-settings";
import { NumberFormatSettings } from "@/components/settings/number-format-settings";

export default function RegionalFormatsPage() {
  const t = useTranslations("settings");

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/settings"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground md:hidden"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("title")}
      </Link>

      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          {t("nav.regionalFormats")}
        </h2>
        <p className="text-muted-foreground">
          {t("hub.regionalFormatsDesc")}
        </p>
      </div>

      <DateFormatSettings />
      <TimeFormatSettings />
      <NumberFormatSettings />
    </div>
  );
}
```

### Hub Page Profile Card (Already Exists -- PROF-03)
```tsx
// Source: frontend/app/[locale]/(dashboard)/dashboard/settings/page.tsx lines 46-63
// This already satisfies PROF-03. No changes needed.
<Link href="/dashboard/settings/profile">
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
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </CardContent>
  </Card>
</Link>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Monolithic settings page with inline sections | Hub page (Phase 35) with stub subpages | Phase 35 (2026-02-13) | Components orphaned, need relocation |
| ProfileEditSheet (side panel) for quick profile editing | Dedicated /settings/profile subpage | Phase 36 (this phase) | Better mobile UX, more space for content |
| Settings components used on old monolithic page | Components unused (orphaned by Phase 35 rewrite) | Phase 35 (2026-02-13) | This phase wires them back in |

**Deprecated/outdated:**
- The old monolithic `settings/page.tsx` (166 lines) that inlined all settings sections was replaced in Phase 35. Components built for it are now orphaned.
- `ProfileEditSheet` duplicates profile editing that now has a dedicated subpage. Consider replacing the sheet's "Edit Profile" action with navigation to `/dashboard/settings/profile` in a future cleanup pass.

## Scope Analysis

### What This Phase IS
- Replace 3 stub subpage files with component compositions
- Verify hub profile card already satisfies PROF-03
- Total estimated file changes: 3 files modified (profile/page.tsx, security/page.tsx, regional-formats/page.tsx)

### What This Phase IS NOT
- No new components to build
- No new translation keys to add (all exist from v1.5/v1.6)
- No backend changes
- No API changes
- No new npm packages
- No modifications to existing settings components
- No modifications to the hub page or layout

### Estimated Complexity
This is one of the simplest phases in the project. Each subpage modification is ~25-35 lines: keep the mobile back link, add a page heading, import and render 1-3 existing components. Total new code: approximately 90 lines across 3 files.

## Open Questions

1. **Should the page-level description text match or complement the Card's CardDescription?**
   - What we know: `AccountSettings` has CardTitle "Account" and CardDescription "Manage your profile information". The page heading will be "Profile" with a description.
   - What's unclear: Whether to use the same description text at both levels, or use a shorter page description.
   - Recommendation: Use the existing translation key for the component's description as the page description (e.g., `t("account.description")` for profile, `t("security.description")` for security). This avoids adding new translation keys. The slight visual repetition between page description and card description is acceptable since the card description is inside the card, visually separated. If the duplication is distracting, the page description can be omitted entirely (just render the h2 without a `<p>` description).

2. **Should the ProfileEditSheet be replaced with navigation to the profile subpage?**
   - What we know: `ProfileEditSheet` in `user-menu.tsx` provides quick profile+password editing from the user dropdown menu. The new profile subpage provides the same profile editing, and the security subpage provides password changing.
   - What's unclear: Whether removing the sheet improves or degrades UX. Some users might prefer the quick-access sheet.
   - Recommendation: Leave the ProfileEditSheet as-is in Phase 36. Flag for potential cleanup in Phase 37 or later. Both code paths work correctly because they share the same auth context and API. Changing user-menu.tsx is out of scope for the 3 subpage requirements.

## Sources

### Primary (HIGH confidence)
- **Existing components (direct inspection):**
  - `frontend/components/settings/account-settings.tsx` -- 122 lines, AccountSettings with AvatarUpload + name/email form
  - `frontend/components/settings/avatar-upload.tsx` -- 206 lines, drag-drop avatar upload with delete
  - `frontend/components/settings/security-settings.tsx` -- 62 lines, composite wrapping PasswordChange + ActiveSessions + DeleteAccountDialog
  - `frontend/components/settings/password-change.tsx` -- 140 lines, password change form with zod validation
  - `frontend/components/settings/active-sessions.tsx` -- 168 lines, session list with revoke
  - `frontend/components/settings/delete-account-dialog.tsx` -- 147 lines, AlertDialog with workspace ownership check
  - `frontend/components/settings/date-format-settings.tsx` -- 230 lines, radio group with custom format option
  - `frontend/components/settings/time-format-settings.tsx` -- 99 lines, radio group for 12h/24h
  - `frontend/components/settings/number-format-settings.tsx` -- 194 lines, selects for thousand/decimal separators
- **Stub subpages (direct inspection):**
  - `frontend/app/[locale]/(dashboard)/dashboard/settings/profile/page.tsx` -- 29 lines, stub with mobile back link
  - `frontend/app/[locale]/(dashboard)/dashboard/settings/security/page.tsx` -- 29 lines, stub with mobile back link
  - `frontend/app/[locale]/(dashboard)/dashboard/settings/regional-formats/page.tsx` -- 29 lines, stub with mobile back link
- **Hub page (direct inspection):**
  - `frontend/app/[locale]/(dashboard)/dashboard/settings/page.tsx` -- 124 lines, profile card already satisfies PROF-03
- **Auth context and API (direct inspection):**
  - `frontend/lib/contexts/auth-context.tsx` -- useAuth() with refreshUser()
  - `frontend/lib/api/auth.ts` -- User type, API methods
- **i18n messages (direct inspection):**
  - `frontend/messages/en.json` -- settings.account.*, settings.security.*, settings.dateFormat.*, settings.timeFormat.*, settings.numberFormat.* all exist
- **Phase 35 research and plans:**
  - `.planning/phases/35-settings-shell-and-route-structure/35-RESEARCH.md` -- layout and routing patterns
  - `.planning/phases/35-settings-shell-and-route-structure/35-02-PLAN.md` -- stub subpage template
  - `.planning/phases/35-settings-shell-and-route-structure/35-VERIFICATION.md` -- all Phase 35 requirements verified
- **Project state:**
  - `.planning/STATE.md` -- accumulated decisions about settings patterns

### Secondary (HIGH confidence)
- **User menu with ProfileEditSheet:**
  - `frontend/components/dashboard/user-menu.tsx` -- imports ProfileEditSheet, opens on "Edit Profile" click
  - `frontend/components/dashboard/profile-edit-sheet.tsx` -- 271 lines, profile+password editing in side panel

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- zero new dependencies, all verified in existing code
- Architecture: HIGH -- composition of existing components into existing stub pages, following established Phase 35 patterns exactly
- Pitfalls: HIGH -- all pitfalls derived from direct inspection of existing code; primary risk is visual heading duplication which is cosmetic

**Research date:** 2026-02-13
**Valid until:** 2026-03-15 (stable -- no external dependencies, no rapidly moving APIs, all components already built and tested)
