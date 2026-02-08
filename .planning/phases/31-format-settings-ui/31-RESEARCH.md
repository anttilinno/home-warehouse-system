# Phase 31: Format Settings UI - Research

**Researched:** 2026-02-08
**Domain:** React settings UI, format preferences, live previews
**Confidence:** HIGH

## Summary

Phase 31 adds time format and number format settings sections to the settings page, and enhances the existing date format section with live preview. The codebase already has all the infrastructure: three format hooks (`useDateFormat`, `useTimeFormat`, `useNumberFormat`), a working `DateFormatSettings` component with RadioGroup-based selection and live preview, and a backend `PATCH /users/me/preferences` endpoint that accepts all six preference fields (`date_format`, `time_format`, `thousand_separator`, `decimal_separator`, `language`, `theme`).

The main work is: (1) create `TimeFormatSettings` and `NumberFormatSettings` components following the `DateFormatSettings` pattern, (2) enhance `DateFormatSettings` with a more prominent live preview, (3) add all three format settings cards to the settings page, and (4) add i18n translation keys. The backend has a separator conflict validation (thousand and decimal separators cannot be the same) that the UI must account for.

**Primary recommendation:** Follow the exact pattern of `DateFormatSettings` (Card with RadioGroup, immediate save on selection, toast feedback, live preview). Use `Select` component for number separators since they have fewer options. Add conflict validation client-side before calling the API.

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| RadioGroup (radix) | In project | Time format 12h/24h selection | Already used by DateFormatSettings, 2-option choice |
| Select (radix) | In project | Separator dropdowns | Already available in `components/ui/select.tsx`, good for 3-option choice |
| date-fns `format` | In project | Live time preview rendering | Already used in useDateFormat, useTimeFormat |
| sonner `toast` | In project | Success/error feedback | Already used in all settings components |
| next-intl `useTranslations` | In project | i18n translations | Already used in all components |
| useAuth (auth-context) | In project | Access user preferences + refreshUser | Already used in DateFormatSettings |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | In project | Card header icons (Clock, Hash) | Use `Clock` for time, `Hash` for number settings |
| Card/CardHeader/etc | In project | Settings section layout | Already used by DateFormatSettings, NotificationSettings |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| RadioGroup for time | ToggleGroup or Switch | RadioGroup is consistent with DateFormatSettings pattern and clearer for 2 labeled options |
| Select for separators | RadioGroup | Select is more compact for separator options; RadioGroup would work but take more space |
| Raw fetch for API | apiClient.patch | DateFormatSettings uses raw fetch; could refactor to use apiClient but not required for this phase |

**Installation:** None needed -- all libraries already in project.

## Architecture Patterns

### Recommended Component Structure
```
frontend/components/settings/
  date-format-settings.tsx     # EXISTS - enhance with live preview
  time-format-settings.tsx     # NEW - 12h/24h RadioGroup
  number-format-settings.tsx   # NEW - separator Select dropdowns
```

### Pattern 1: Settings Card with Immediate Save
**What:** Each format section is a Card with RadioGroup/Select, saves immediately on selection via PATCH /users/me/preferences, then calls refreshUser() to update auth context.
**When to use:** All three format settings sections.
**Example (from existing DateFormatSettings):**
```typescript
// Source: frontend/components/settings/date-format-settings.tsx
const handleChange = async (value: string) => {
  if (value === currentFormat) return;
  setIsUpdating(true);
  try {
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/me/preferences`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
      },
      credentials: "include",
      body: JSON.stringify({ date_format: value }),
    });
    await refreshUser();
    toast.success(t("saved"));
  } catch {
    toast.error(t("saveError"));
  } finally {
    setIsUpdating(false);
  }
};
```

### Pattern 2: Live Preview in Settings Card
**What:** Show a live-rendered preview of the current format next to each option. DateFormatSettings already does this by rendering `format(exampleDate, option.dateFns)` next to each radio option.
**When to use:** All three format sections.
**Example for time preview:**
```typescript
const now = new Date();
// Preview: "2:30 PM" or "14:30"
const preview = dateFnsFormat(now, timeFormatString);
```

### Pattern 3: Settings Page Layout
**What:** The settings page uses `<div className="space-y-6">` with Card components stacked vertically.
**When to use:** Adding new cards to the settings page.
**Source:** `frontend/app/[locale]/(dashboard)/dashboard/settings/page.tsx`

### Anti-Patterns to Avoid
- **Wrapping all format settings in a single Card:** Keep them as separate Cards for consistency with existing settings page pattern (Data Management, Active Sessions are separate Cards).
- **Using react-hook-form for format settings:** DateFormatSettings does NOT use react-hook-form; it uses direct state + immediate API calls. Do not introduce form libraries for this phase.
- **Sending all preferences at once:** The backend accepts partial updates (all fields are `omitempty`). Only send the changed field to avoid overwriting other preferences.
- **Forgetting separator conflict validation:** Backend returns 400 if `thousand_separator === decimal_separator`. Must validate client-side before API call to avoid confusing error messages.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Date/time formatting | Custom formatter | date-fns `format()` | Edge cases with AM/PM, padding, locale |
| Number formatting | Custom formatter | `useNumberFormat().formatNumber()` | Already handles thousand/decimal separators correctly |
| Radio button styling | Custom radio inputs | shadcn RadioGroup (radix) | Accessible, keyboard navigable, styled |
| Dropdown styling | Custom dropdown | shadcn Select (radix) | Accessible, portal-based, styled |
| API authentication | Manual header building | Raw fetch pattern from DateFormatSettings | Consistent with existing code (or could migrate to apiClient.patch) |

**Key insight:** Everything needed is already in the project. This phase is pure composition of existing components and patterns.

## Common Pitfalls

### Pitfall 1: Separator Conflict (thousand_separator === decimal_separator)
**What goes wrong:** User selects period for both thousand and decimal separator, backend returns 400 error.
**Why it happens:** Backend entity validates `effectiveThousand == effectiveDecimal` considering the MERGED state of old + new values, not just the two being sent.
**How to avoid:** Client-side validation before API call. When user changes thousand separator, check it against current decimal separator (and vice versa). Show inline error or prevent the selection. Note: the backend checks the EFFECTIVE values after update, so if user sends only `thousand_separator: "."` and their existing `decimal_separator` is already `"."`, the backend will reject it.
**Warning signs:** Users seeing a generic "Failed to update" toast without understanding why.

### Pitfall 2: Stale User State After Save
**What goes wrong:** After saving, the UI still shows old values until refreshUser() completes.
**Why it happens:** The auth context update is async; RadioGroup/Select might flicker.
**How to avoid:** Use `isUpdating` state to disable inputs during save+refresh cycle (exactly as DateFormatSettings does). The existing pattern handles this correctly.

### Pitfall 3: DateFormatSettings is Not Rendered on Settings Page
**What goes wrong:** Assuming DateFormatSettings is already visible on the settings page.
**Why it happens:** `DateFormatSettings` component exists at `frontend/components/settings/date-format-settings.tsx` but is NOT imported anywhere. The settings page (`page.tsx`) only renders Data Management and Active Sessions cards.
**How to avoid:** Explicitly import and render all three format settings cards on the settings page.

### Pitfall 4: Missing i18n Keys in et.json and ru.json
**What goes wrong:** Translation keys cause fallback warnings in non-English locales.
**Why it happens:** `et.json` and `ru.json` are missing many newer settings keys (dateFormat, pushNotifications, sessions, password). This appears to be a known pattern -- only `en.json` has all keys.
**How to avoid:** Add translation keys to `en.json` for new sections. For `et.json` and `ru.json`, either add translations or accept fallback to English. The codebase pattern suggests English-first is acceptable.

### Pitfall 5: Number Preview Needing Both Separators
**What goes wrong:** Number preview looks wrong because it only considers one separator.
**Why it happens:** Number formatting needs BOTH thousand and decimal separator to render correctly.
**How to avoid:** Use `useNumberFormat()` hook directly for the preview, or manually format with both current separators. Show a sample like `1,234.56` using the effective separators.

## Code Examples

Verified patterns from the existing codebase:

### Time Format Settings Component (recommended structure)
```typescript
// Source: Pattern derived from frontend/components/settings/date-format-settings.tsx
// and frontend/lib/hooks/use-time-format.ts

const TIME_FORMAT_OPTIONS = [
  { value: "24h", label: "24-hour", preview: "HH:mm" },   // date-fns: "HH:mm"
  { value: "12h", label: "12-hour", preview: "h:mm a" },  // date-fns: "h:mm a"
];

// Live preview: format(new Date(), option.preview)
// Result: "14:30" or "2:30 PM"
```

### Number Format Settings - Separator Options
```typescript
// Source: Derived from backend entity validation and frontend/lib/hooks/use-number-format.ts

const THOUSAND_SEPARATOR_OPTIONS = [
  { value: ",", label: "Comma (,)", example: "1,000" },
  { value: ".", label: "Period (.)", example: "1.000" },
  { value: " ", label: "Space ( )", example: "1 000" },
];

const DECIMAL_SEPARATOR_OPTIONS = [
  { value: ".", label: "Period (.)", example: "0.99" },
  { value: ",", label: "Comma (,)", example: "0,99" },
];

// Conflict check before save:
if (newThousand === currentDecimal || newDecimal === currentThousand) {
  // Show error, prevent API call
}
```

### API Call Pattern (from existing DateFormatSettings)
```typescript
// Source: frontend/components/settings/date-format-settings.tsx line 69-87
await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/me/preferences`, {
  method: "PATCH",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
  },
  credentials: "include",
  body: JSON.stringify({ time_format: value }),
});
await refreshUser();
```

### Settings Page Card Addition Pattern
```typescript
// Source: frontend/app/[locale]/(dashboard)/dashboard/settings/page.tsx
// Add imports and render inside the flex column:
import { DateFormatSettings } from "@/components/settings/date-format-settings";
import { TimeFormatSettings } from "@/components/settings/time-format-settings";
import { NumberFormatSettings } from "@/components/settings/number-format-settings";

// Inside <div className="flex flex-col gap-6">:
<DateFormatSettings />
<TimeFormatSettings />
<NumberFormatSettings />
```

### Translation Keys Structure
```json
// Source: frontend/messages/en.json settings section
"settings": {
  "dateFormat": {
    "title": "Date Format",
    "description": "Choose how dates are displayed throughout the app",
    "saved": "Date format updated",
    "saveError": "Failed to update date format"
  },
  "timeFormat": {
    "title": "Time Format",
    "description": "Choose how times are displayed",
    "12h": "12-hour (2:30 PM)",
    "24h": "24-hour (14:30)",
    "saved": "Time format updated",
    "saveError": "Failed to update time format",
    "preview": "Current time"
  },
  "numberFormat": {
    "title": "Number Format",
    "description": "Configure how numbers are displayed",
    "thousandSeparator": "Thousand separator",
    "decimalSeparator": "Decimal separator",
    "comma": "Comma (1,000)",
    "period": "Period (1.000)",
    "space": "Space (1 000)",
    "decimalPeriod": "Period (0.99)",
    "decimalComma": "Comma (0,99)",
    "saved": "Number format updated",
    "saveError": "Failed to update number format",
    "conflictError": "Thousand and decimal separators must be different",
    "preview": "Preview"
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Date format only in user-menu dropdown | Full settings page with all format settings | Phase 31 | Users have a dedicated place to configure all formats |
| No live preview for date format | Live preview showing formatted example | Phase 31 | Users see exactly what they'll get before saving |

**Deprecated/outdated:**
- None. All patterns in the codebase are current.

## Open Questions

1. **Should format settings cards go before or after existing cards on the settings page?**
   - What we know: Current page has Data Management, then Active Sessions
   - What's unclear: Whether format settings should come first (more frequently used) or after
   - Recommendation: Place format settings between "Data Management" and "Active Sessions" since they're user preferences that users configure once. Group them together (Date, Time, Number in sequence).

2. **Should we refactor the DateFormatSettings raw fetch to use apiClient?**
   - What we know: DateFormatSettings and user-menu both use raw `fetch` for preferences. `apiClient.patch` exists and is used elsewhere.
   - What's unclear: Whether this cleanup is in scope for Phase 31
   - Recommendation: Use the same raw fetch pattern for consistency within this phase. Refactoring to apiClient is a separate concern.

3. **How should the number format preview look with both separators?**
   - What we know: Need to show a sample number using both thousand and decimal separators
   - What's unclear: What specific number to use
   - Recommendation: Use `1,234.56` formatted with the user's current separators (e.g., `1.234,56` for European style). This is clear and demonstrates both separators simultaneously.

## Sources

### Primary (HIGH confidence)
- Codebase inspection: `frontend/components/settings/date-format-settings.tsx` (230 lines) - existing pattern for format settings with RadioGroup, live preview, immediate save
- Codebase inspection: `frontend/lib/hooks/use-time-format.ts` (70 lines) - TimeFormatOption types, TIME_FORMAT_MAP
- Codebase inspection: `frontend/lib/hooks/use-number-format.ts` (105 lines) - ThousandSeparator, DecimalSeparator types, formatNumber function
- Codebase inspection: `frontend/app/[locale]/(dashboard)/dashboard/settings/page.tsx` (59 lines) - current settings page structure
- Codebase inspection: `backend/internal/domain/auth/user/entity.go` lines 174-210 - separator conflict validation
- Codebase inspection: `backend/internal/domain/auth/user/handler.go` lines 1075-1090 - UpdatePrefsRequestBody with all 6 fields
- Codebase inspection: `frontend/messages/en.json` lines 634-639 - existing dateFormat translation keys

### Secondary (MEDIUM confidence)
- Phase 30 verification report: `.planning/phases/30-format-infrastructure/30-VERIFICATION.md` - confirmed all hooks and API fields are wired

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all components already exist in the project, just composing them
- Architecture: HIGH - exact pattern exists in DateFormatSettings, just replicating for time and number
- Pitfalls: HIGH - separator conflict validation is documented in backend code, stale state is handled by existing pattern

**Research date:** 2026-02-08
**Valid until:** 2026-03-10 (stable, no external dependencies changing)
