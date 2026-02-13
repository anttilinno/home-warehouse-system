# Phase 39: Notification Preferences - Research

**Researched:** 2026-02-13
**Domain:** Full-stack notification preferences (DB migration + Go backend + React frontend)
**Confidence:** HIGH

## Summary

This phase adds user-controllable notification preferences with a master toggle and per-category toggles (Loans, Inventory, Workspace, System). The decision to store preferences as a JSONB column on `auth.users` is locked. The existing codebase has a well-established preferences pattern: `PATCH /users/me/preferences` updates user fields, `useAuth().user` reads them, `refreshUser()` syncs after save. This phase extends that exact pattern to include notification preferences.

The notifications page (`/dashboard/settings/notifications`) already exists as a placeholder with "Coming soon" text. The existing `notification-settings.tsx` component handles push notification subscription only (browser-level push on/off). Phase 39 builds a new component for in-app notification category preferences, which is distinct from push subscription management. The category toggles filter alert surfacing only -- SSE data sync must continue regardless.

There are 7 notification types in the system (`LOAN_DUE_SOON`, `LOAN_OVERDUE`, `LOAN_RETURNED`, `LOW_STOCK`, `WORKSPACE_INVITE`, `MEMBER_JOINED`, `SYSTEM`) plus `REPAIR_REMINDER` in the Go entity. These map to the 4 required UI categories: Loans (3 types), Inventory (1 type), Workspace (2 types), System (1-2 types). The JSONB structure should use category-level keys with a master toggle, not individual type keys, to match the UI requirements exactly.

**Primary recommendation:** Extend the existing `PATCH /users/me/preferences` endpoint with a `notification_preferences` JSONB field, add a new frontend component with Switch toggles that auto-save on change via the same pattern used by `ThemeSettings` and `DateFormatSettings`, and wire it into the existing notifications page replacing the "Coming soon" placeholder.

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| shadcn/ui Switch | latest | Toggle switches for preferences | Standard shadcn component, NOT yet installed |
| next-intl | (in project) | i18n for all labels | Existing pattern across all settings |
| sonner (toast) | (in project) | Success/error feedback on save | Used in ThemeSettings, DateFormatSettings |
| lucide-react | (in project) | Icons (Bell, BellOff, etc.) | Existing icon library |
| dbmate | (in project) | Database migrations | Existing migration tool |
| sqlc | (in project) | Type-safe SQL (not used for this -- repo uses raw queries) | Project standard, but user repo uses pgx directly |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @radix-ui/react-switch | (shadcn dep) | Accessible switch primitive | Underlying primitive for shadcn Switch |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| shadcn Switch | Checkbox | Switch is the standard UX for on/off preferences; checkbox implies form submission |
| JSONB on auth.users | Separate notification_preferences table | Extra join, extra migration, over-engineered for 5 boolean preferences |
| Extending /users/me/preferences | New /users/me/notification-preferences endpoint | Inconsistent with established pattern; more code for same result |

**Installation (Switch component):**
```bash
cd /home/antti/Repos/Misc/home-warehouse-system/frontend && bunx shadcn@latest add switch
```

## Architecture Patterns

### JSONB Schema Design

The JSONB column stores category-level preferences with a master toggle:

```json
{
  "enabled": true,
  "loans": true,
  "inventory": true,
  "workspace": true,
  "system": true
}
```

**Category-to-type mapping:**
| UI Category | Notification Types |
|-------------|-------------------|
| Loans | `LOAN_DUE_SOON`, `LOAN_OVERDUE`, `LOAN_RETURNED` |
| Inventory | `LOW_STOCK`, `REPAIR_REMINDER` |
| Workspace | `WORKSPACE_INVITE`, `MEMBER_JOINED` |
| System | `SYSTEM` |

**Default value:** `'{}'::jsonb` (empty object). When empty, all categories are treated as enabled (opt-out model, not opt-in). This means existing users see all notifications by default without requiring a data migration.

**Why category-level, not type-level keys:** The UI requirements specify 4 category toggles, not 7 individual type toggles. Matching the JSONB structure to the UI categories keeps the mapping 1:1 and avoids a translation layer.

### Full-Stack Change Pattern (Following Existing Conventions)

The project has a consistent pattern for adding user preferences. This was done for `time_format`, `thousand_separator`, `decimal_separator` (migration 010). The pattern is:

1. **DB migration:** `ALTER TABLE auth.users ADD COLUMN notification_preferences JSONB NOT NULL DEFAULT '{}'::jsonb;`
2. **Go entity:** Add `notificationPreferences map[string]bool` field to `User` struct with getter/setter
3. **Go Reconstruct:** Add parameter to `Reconstruct()` function
4. **Go repository:** Update `Save()`, `FindByID()`, `FindByEmail()`, `List()` queries to include new column, update `scanUser()` to read it
5. **Go handler:** Add `NotificationPreferences` to `UserResponse`, `UpdatePrefsRequestBody`, `UpdatePrefsResponse`
6. **Go service:** `UpdatePreferences` already calls `user.UpdatePreferences()` then `repo.Save()` -- extend the method signature
7. **Frontend User type:** Add `notification_preferences` to `User` interface in `lib/api/auth.ts`
8. **Frontend component:** New `NotificationPreferenceSettings` component following ThemeSettings pattern
9. **Frontend page:** Replace "Coming soon" in notifications page with new component + existing push settings

### Recommended File Changes

```
backend/
  db/migrations/011_notification_preferences.sql    # NEW: Add JSONB column
  internal/domain/auth/user/entity.go               # MODIFY: Add field + methods
  internal/domain/auth/user/handler.go              # MODIFY: Add to request/response types
  internal/domain/auth/user/service.go              # MODIFY: Add to UpdatePreferencesInput
  internal/infra/postgres/user_repository.go        # MODIFY: Add to queries + scan

frontend/
  components/ui/switch.tsx                          # NEW: shadcn Switch component
  components/settings/notification-preference-settings.tsx  # NEW: Category toggle UI
  app/[locale]/(dashboard)/dashboard/settings/notifications/page.tsx  # MODIFY: Replace placeholder
  lib/api/auth.ts                                   # MODIFY: Add to User type
  messages/en.json                                  # MODIFY: Add i18n keys
  messages/et.json                                  # MODIFY: Add i18n keys
  messages/ru.json                                  # MODIFY: Add i18n keys
```

### Pattern: Auto-Save Toggle (Following ThemeSettings)

The existing ThemeSettings component demonstrates the exact auto-save pattern needed:

```typescript
// From frontend/components/settings/theme-settings.tsx (actual codebase)
const handleChange = async (value: string) => {
  if (value === currentTheme) return;
  setTheme(value);           // 1. Instant UI change
  setIsUpdating(true);
  try {
    await fetch(             // 2. Persist to backend
      `${process.env.NEXT_PUBLIC_API_URL}/users/me/preferences`,
      { method: "PATCH", headers: { ... }, body: JSON.stringify({ theme: value }) }
    );
    await refreshUser();     // 3. Refresh auth context
    toast.success(t("saved"));
  } catch {
    setTheme(currentTheme);  // 4. Revert on error
    toast.error(t("saveError"));
  } finally {
    setIsUpdating(false);
  }
};
```

For notification preferences, the pattern is identical but sends `notification_preferences` JSONB:

```typescript
const handleToggle = async (category: string, enabled: boolean) => {
  // 1. Optimistic UI update
  const newPrefs = { ...currentPrefs, [category]: enabled };

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
        body: JSON.stringify({ notification_preferences: newPrefs }),
      }
    );
    await refreshUser();
    toast.success(t("saved"));
  } catch {
    // Revert handled by refreshUser re-reading server state
    toast.error(t("saveError"));
  }
};
```

### Pattern: Master Toggle Disabling Children

When the master toggle (`enabled`) is `false`, all category toggles should appear visually disabled and save the master state. Individual category states are preserved so re-enabling master restores previous category selections.

```typescript
// Master toggle off: categories visually disabled but values preserved
<Switch
  checked={prefs.loans}
  disabled={!prefs.enabled || isUpdating}
  onCheckedChange={(checked) => handleToggle("loans", checked)}
/>
```

### Anti-Patterns to Avoid
- **Creating a new API endpoint for notification preferences:** The existing `/users/me/preferences` PATCH endpoint already handles partial updates. Extend it rather than creating `/users/me/notification-preferences`.
- **Using localStorage for preferences:** The requirement explicitly states "sync across devices." localStorage is device-local. Backend persistence is mandatory.
- **Filtering SSE events:** SSE data sync must continue regardless of preferences. Only notification alert surfacing (dropdown display, push notifications) should be filtered.
- **Using react-hook-form for toggles:** The existing toggle-based settings (theme, date format) use direct event handlers, not react-hook-form. Toggles auto-save individually; there is no form to submit.
- **Wrapping in extra Card components:** Per prior decisions, settings subpages import components directly. The component itself contains the Card wrapper.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Toggle switch UI | Custom checkbox styling | shadcn/ui Switch | Accessible, keyboard-navigable, matches design system |
| JSONB merge semantics | Custom deep merge logic | PostgreSQL `||` operator or Go-level merge | Standard JSONB update; Go merge is trivial for flat object |
| Optimistic UI | Custom state management | Existing pattern: optimistic set + refreshUser on success/revert on error | Already proven in ThemeSettings, DateFormatSettings |
| Default preferences | Migration to backfill all users | Empty JSONB `{}` with app-level defaults | Treat missing keys as "enabled" (opt-out model) avoids data migration |

**Key insight:** The entire backend change is an extension of the existing preferences mechanism. No new services, no new endpoints, no new middleware. Just add a JSONB column and thread it through the existing user entity/handler/repository chain.

## Common Pitfalls

### Pitfall 1: sqlc Query Mismatch
**What goes wrong:** The `db/queries/users.sql` file used by sqlc does NOT include `time_format`, `thousand_separator`, or `decimal_separator` columns. The actual repository (`user_repository.go`) uses raw pgx queries, not sqlc-generated code. If you update `users.sql` thinking it drives the queries, nothing happens. If you add the column to sqlc queries but not the raw queries, the repository breaks.
**Why it happens:** The project has two query paths -- sqlc queries and raw pgx queries in the repository. The raw pgx queries are the ones actually used.
**How to avoid:** Modify ONLY `user_repository.go` raw queries. Update `users.sql` for consistency but know the raw queries are authoritative.
**Warning signs:** Tests pass but the preference does not persist.

### Pitfall 2: Forgot to Update All Repository Queries
**What goes wrong:** `Save()`, `FindByID()`, `FindByEmail()`, `List()`, `scanUser()`, `scanUserFromRows()`, `UpdateAvatar()`, `UpdateEmail()` ALL include the full column list. Missing the new column in any of these causes scan errors.
**Why it happens:** The repository scans all columns including the new one. Every SELECT and INSERT/UPDATE that touches auth.users must include `notification_preferences`.
**How to avoid:** Search for all occurrences of `time_format` in `user_repository.go` (the last column added). Every line that mentions it also needs `notification_preferences`.
**Warning signs:** Panic/error on user read: "wrong number of columns" or "can't scan into..."

### Pitfall 3: JSONB Null vs Empty Object
**What goes wrong:** If the column default is `NULL` instead of `'{}'::jsonb`, Go `json.Unmarshal(nil)` produces different behavior than `json.Unmarshal([]byte("{}"))`. Frontend receives `null` instead of `{}`.
**Why it happens:** Default value choice matters for JSONB columns.
**How to avoid:** Use `NOT NULL DEFAULT '{}'::jsonb` in the migration. In Go, handle `nil`/empty bytes by returning an empty map.
**Warning signs:** Frontend sees `null` for `notification_preferences` on existing users.

### Pitfall 4: Preferences Don't Sync Until Page Reload
**What goes wrong:** After toggling a preference, the NotificationsDropdown still shows/hides notifications based on stale data because it reads from a different source.
**Why it happens:** The dropdown reads from the notifications API (which returns all notifications), not from user preferences. Filtering must happen client-side in the dropdown component.
**How to avoid:** The dropdown (or its data hook) must read `user.notification_preferences` from `useAuth()` and filter the displayed notifications. This is a NOTF-05 requirement.
**Warning signs:** Toggling off "Loans" notifications still shows loan notifications in the dropdown.

### Pitfall 5: SSE Data Sync Broken by Preference Filtering
**What goes wrong:** Developer accidentally filters SSE events based on notification preferences, breaking real-time data sync.
**Why it happens:** Conflating "notification alert display" with "SSE event processing." SSE events drive cache invalidation and data updates, not just notifications.
**How to avoid:** Notification preferences filter the UI display layer ONLY (NotificationsDropdown, toast display). SSE event handlers for data invalidation remain untouched.
**Warning signs:** Disabling "Inventory" notifications causes inventory list to stop updating in real-time.

### Pitfall 6: Go Entity Reconstruct Signature Breaking
**What goes wrong:** Adding a parameter to `Reconstruct()` requires updating every call site. Missing one causes compile error.
**Why it happens:** `Reconstruct()` has a long parameter list (currently 15 params). Adding one more requires updating `user_repository.go` scanUser/scanUserFromRows.
**How to avoid:** After modifying `Reconstruct()`, compile the project. All call sites that need updating will produce compile errors.
**Warning signs:** Compile errors in repository or test files.

## Code Examples

### Migration (011_notification_preferences.sql)
```sql
-- migrate:up
ALTER TABLE auth.users
  ADD COLUMN notification_preferences JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN auth.users.notification_preferences IS
'User notification preferences by category. Empty object means all enabled. Keys: enabled, loans, inventory, workspace, system.';

-- migrate:down
ALTER TABLE auth.users
  DROP COLUMN notification_preferences;
```

### Go Entity Extension (user/entity.go)
```go
// Add field to User struct
type User struct {
    // ... existing fields ...
    notificationPreferences map[string]bool
}

// Add getter
func (u *User) NotificationPreferences() map[string]bool {
    return u.notificationPreferences
}

// Extend UpdatePreferences method to accept notification prefs
// OR add a separate method:
func (u *User) UpdateNotificationPreferences(prefs map[string]bool) {
    if prefs != nil {
        // Merge: only update provided keys, preserve others
        if u.notificationPreferences == nil {
            u.notificationPreferences = make(map[string]bool)
        }
        for k, v := range prefs {
            u.notificationPreferences[k] = v
        }
    }
    u.updatedAt = time.Now()
}
```

### Go Repository JSONB Handling (user_repository.go)
```go
import "encoding/json"

// In Save():
prefsJSON, err := json.Marshal(u.NotificationPreferences())
if err != nil {
    return err
}
// Add prefsJSON as parameter to INSERT/UPDATE query

// In scanUser():
var notifPrefsRaw []byte
// Scan into notifPrefsRaw
var notifPrefs map[string]bool
if len(notifPrefsRaw) > 0 {
    json.Unmarshal(notifPrefsRaw, &notifPrefs)
}
// Pass notifPrefs to Reconstruct()
```

### Go Handler Request/Response Types
```go
// Extend UpdatePrefsRequestBody
type UpdatePrefsRequestBody struct {
    // ... existing fields ...
    NotificationPreferences map[string]bool `json:"notification_preferences,omitempty"`
}

// Extend UserResponse
type UserResponse struct {
    // ... existing fields ...
    NotificationPreferences map[string]bool `json:"notification_preferences"`
}
```

### Frontend User Type Extension (lib/api/auth.ts)
```typescript
export interface NotificationPreferences {
  enabled?: boolean;
  loans?: boolean;
  inventory?: boolean;
  workspace?: boolean;
  system?: boolean;
}

export interface User {
  // ... existing fields ...
  notification_preferences: NotificationPreferences;
}
```

### Frontend Component Pattern
```typescript
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Bell, BellOff } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/contexts/auth-context";
import { toast } from "sonner";

const CATEGORIES = ["loans", "inventory", "workspace", "system"] as const;

export function NotificationPreferenceSettings() {
  const t = useTranslations("settings.notificationPreferences");
  const { user, refreshUser } = useAuth();
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  // Default to all enabled if no preferences set
  const prefs = user?.notification_preferences ?? {};
  const isEnabled = prefs.enabled !== false; // default true

  const handleToggle = async (key: string, checked: boolean) => {
    setIsUpdating(key);
    const newPrefs = { ...prefs, [key]: checked };

    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/me/preferences`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
        },
        credentials: "include",
        body: JSON.stringify({ notification_preferences: newPrefs }),
      });
      await refreshUser();
      toast.success(t("saved"));
    } catch {
      toast.error(t("saveError"));
    } finally {
      setIsUpdating(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          {t("title")}
        </CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Master toggle */}
        <div className="flex items-center justify-between">
          <Label htmlFor="notif-master">{t("masterToggle")}</Label>
          <Switch
            id="notif-master"
            checked={isEnabled}
            disabled={isUpdating !== null}
            onCheckedChange={(checked) => handleToggle("enabled", checked)}
          />
        </div>

        {/* Category toggles */}
        {CATEGORIES.map((cat) => (
          <div key={cat} className="flex items-center justify-between">
            <Label htmlFor={`notif-${cat}`}>{t(`categories.${cat}`)}</Label>
            <Switch
              id={`notif-${cat}`}
              checked={prefs[cat] !== false}
              disabled={!isEnabled || isUpdating !== null}
              onCheckedChange={(checked) => handleToggle(cat, checked)}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Flat columns for each preference | JSONB column for grouped preferences | Existing pattern in codebase | notification_preferences uses JSONB for flexibility |
| Separate preferences endpoint | Extend existing PATCH /users/me/preferences | Architecture decision | Single endpoint handles all user preferences |
| Per-type toggles (7 switches) | Category-level toggles (4 switches + master) | Phase 39 requirements | Simpler UI, maps to user mental model |

**Important note on existing notification-settings.tsx:** The existing component handles *push notification subscription* (browser-level PushManager subscribe/unsubscribe). Phase 39 adds *in-app notification category preferences* which is a separate concern. The notifications page should show BOTH: the existing push subscription component AND the new category preference component.

## Open Questions

1. **Should backend notification creation also check preferences?**
   - What we know: NOTF-05 says preferences filter "alert surfacing only." SSE data sync continues regardless.
   - What's unclear: Should notifications still be CREATED in the database but just hidden in the UI? Or should the backend skip creating notifications for disabled categories?
   - Recommendation: For this phase, filter on the frontend display layer only. Backend still creates all notifications. This keeps the implementation simpler and allows users to re-enable categories and see past notifications. Backend filtering can be added later as an optimization.

2. **Should the existing NotificationSettings (push subscription) component be shown on the notifications page?**
   - What we know: The existing component handles push subscription which is a device-level setting. The new preferences are user-level settings that sync across devices.
   - What's unclear: Whether these belong on the same page.
   - Recommendation: Show both on the notifications page. The push subscription is about delivery mechanism, category preferences are about content filtering. Both are "notification settings."

3. **How should the NotificationsDropdown filter notifications?**
   - What we know: The dropdown currently shows all unread notifications fetched from `/notifications/unread`.
   - What's unclear: Whether to filter in the API response or client-side.
   - Recommendation: Filter client-side in the dropdown component. The API returns all notifications; the dropdown filters based on `user.notification_preferences` category mapping. This keeps the backend simple and avoids a new API parameter.

## Sources

### Primary (HIGH confidence)
- **Codebase: `backend/internal/domain/auth/user/entity.go`** - Current User entity structure (15 fields, UpdatePreferences pattern)
- **Codebase: `backend/internal/domain/auth/user/handler.go`** - Existing PATCH /users/me/preferences endpoint and request/response types
- **Codebase: `backend/internal/infra/postgres/user_repository.go`** - Raw pgx query pattern for user persistence (NOT sqlc)
- **Codebase: `frontend/components/settings/theme-settings.tsx`** - Auto-save toggle pattern with optimistic UI
- **Codebase: `frontend/components/settings/notification-settings.tsx`** - Existing push subscription component
- **Codebase: `frontend/lib/contexts/auth-context.tsx`** - useAuth() as source of truth for user preferences
- **Codebase: `frontend/lib/api/notifications.ts`** - Notification types (7 types mapped to 4 categories)
- **Codebase: `backend/internal/domain/auth/notification/entity.go`** - Backend notification types including REPAIR_REMINDER
- **Codebase: `backend/db/migrations/010_format_preferences.sql`** - Migration pattern for adding user preference columns
- **Codebase: `.planning/research/ARCHITECTURE.md`** - Prior architecture decisions on notification_preferences JSONB

### Secondary (MEDIUM confidence)
- **Codebase: `frontend/components/ui/`** - Confirmed Switch component NOT yet installed (needs `bunx shadcn@latest add switch`)
- **Codebase: `frontend/messages/en.json`** - Current i18n structure for settings (placeholder keys for notifications exist)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in project except Switch (standard shadcn add)
- Architecture: HIGH - Extends well-established existing patterns with no new concepts
- Pitfalls: HIGH - Based on direct codebase analysis (sqlc vs raw queries, column list patterns, JSONB handling)

**Research date:** 2026-02-13
**Valid until:** 2026-03-13 (stable -- codebase patterns unlikely to change)
