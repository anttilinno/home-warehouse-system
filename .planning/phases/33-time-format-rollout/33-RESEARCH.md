# Phase 33: Time Format Rollout - Research

**Researched:** 2026-02-08
**Domain:** Time formatting across entire frontend application
**Confidence:** HIGH

## Summary

Phase 33 requires rolling out the existing `useTimeFormat` hook to every location in the application that displays timestamps with a time component (TIME-03), and ensuring any time input fields adapt to the user's 12h/24h preference (TIME-04). The `useTimeFormat` hook already exists (from Phase 30) and provides `formatTime`, `timeFormatString`, and `format` values. The work is structurally parallel to Phase 32 (date format rollout) but smaller in scope.

There are two distinct categories of work:

1. **Fix `formatDateTime` in `useDateFormat`** -- The existing `formatDateTime` function hardcodes `HH:mm` (24-hour format) in the date-time format string. This must be updated to use the user's time format preference. This is the single highest-impact change because `formatDateTime` is already used in the import job detail page and will be the primary vehicle for datetime displays.

2. **Convert remaining `toLocaleString()` calls** -- Several pages (approvals, my-changes, pending-changes-drawer) use `new Date(...).toLocaleString()` which renders datetime using the browser's locale, not the user's preference. These must be converted to use the corrected `formatDateTime` from `useDateFormat`.

There are currently **zero** time-only input fields (`<input type="time">` or `datetime-local`) in the application. The loan form uses `<input type="date">` only. TIME-04 (time input adaptation) has no existing inputs to convert, but the hook infrastructure should be ready for future use.

**Primary recommendation:** Fix `formatDateTime` in `useDateFormat` to compose date format + time format from both hooks, convert all `toLocaleString()` datetime displays to use `formatDateTime`, and leave relative time displays (`formatDistanceToNow`, custom `formatRelativeTime`) untouched. For TIME-04, document that no time inputs currently exist and verify the hook provides the `timeFormatString` needed for future inputs.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| date-fns | ^4.1.0 | Date/time formatting | Already in project, tree-shakeable |
| useTimeFormat hook | existing | User time preference (12h/24h) | Built in Phase 30, provides formatTime/timeFormatString |
| useDateFormat hook | existing | User date preference + formatDateTime | Built in Phase 30, needs time-awareness fix |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| date-fns/format | 4.x | Format composition | For building combined date+time format strings |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Fixing formatDateTime in useDateFormat | Creating separate formatDateTime in useTimeFormat | Would duplicate date formatting logic; better to fix the existing function |
| Composing format strings | Intl.DateTimeFormat | date-fns already used everywhere; Intl would be inconsistent |

**Installation:** No new packages needed.

## Architecture Patterns

### Pattern 1: Fix formatDateTime to Use Both Hooks' Format Strings
**What:** The `formatDateTime` function in `useDateFormat` currently hardcodes `HH:mm`. It must compose the user's date format string with their time format string.
**When to use:** This is the core change -- affects all datetime displays.
**Challenge:** `useDateFormat` and `useTimeFormat` are separate hooks. The cleanest approach is to have `useDateFormat` read `user?.time_format` directly (same as `useTimeFormat` does) rather than calling one hook from inside another (hooks can't be conditionally called, but they can read from the same auth context).
**Example:**
```typescript
// In use-date-format.ts, import the time format map:
const TIME_FORMAT_MAP: Record<string, string> = {
  "12h": "h:mm a",
  "24h": "HH:mm",
};

const formatDateTime = useCallback(
  (date: Date | string | null | undefined): string => {
    if (!date) return "-";
    try {
      const dateObj = typeof date === "string" ? parseISO(date) : date;
      if (!isValid(dateObj)) return "-";
      const timeFormat = TIME_FORMAT_MAP[user?.time_format as string] || "HH:mm";
      return dateFnsFormat(dateObj, `${dateFnsFormatStr} ${timeFormat}`);
    } catch {
      return "-";
    }
  },
  [dateFnsFormatStr, user?.time_format]
);
```

### Pattern 2: Replace toLocaleString() with formatDateTime
**What:** Convert all `new Date(x).toLocaleString()` calls to use `formatDateTime` from the `useDateFormat` hook.
**When to use:** Every place that displays a full datetime (date + time together).
**Example:**
```typescript
// BEFORE (approvals/page.tsx):
{new Date(change.created_at).toLocaleString()}

// AFTER:
const { formatDateTime } = useDateFormat();
{formatDateTime(change.created_at)}
```

### Pattern 3: Replace pending-changes-drawer formatTimestamp
**What:** The `pending-changes-drawer.tsx` has a local `formatTimestamp(timestamp: number)` function using `toLocaleString` with options. This should use the hooks instead.
**Challenge:** The function receives a `number` (Unix timestamp), not an ISO string. `formatDateTime` handles `Date | string`, so pass `new Date(timestamp)`.
**Example:**
```typescript
// BEFORE:
function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

// AFTER (using hook in component):
const { formatDateTime } = useDateFormat();
// In JSX: {formatDateTime(new Date(mutation.timestamp))}
```
**Note:** `pending-changes-drawer.tsx` defines `formatTimestamp` as a module-level function (outside the component). To use the hook, either move the formatting inline or pass `formatDateTime` as a parameter.

### Pattern 4: Leave Relative Time Displays Alone
**What:** `formatDistanceToNow()` calls and custom `formatRelativeTime()` functions produce relative strings like "3 hours ago" or "just now". These are NOT time-format-sensitive.
**When to apply:** Activity feed, sync history, import list, active sessions, conflict resolution dialog, dashboard recent activity, notifications dropdown (for recent items).
**Example of what NOT to change:**
```typescript
// KEEP AS-IS:
formatDistanceToNow(event.timestamp, { addSuffix: true })
// This outputs "3 hours ago" -- not affected by 12h/24h preference
```

### Pattern 5: scan-history formatScanTime Fallback
**What:** `formatScanTime()` in `lib/scanner/scan-history.ts` uses relative time for recent entries but falls back to `toLocaleDateString` with time options for older entries. The fallback shows time and should respect the user's format.
**Challenge:** This is a utility function outside React, not a hook. It cannot call `useTimeFormat` directly.
**Approach:** Either (a) pass the format functions as parameters from the component, or (b) accept browser locale for this edge case (scan history entries older than 24 hours).
**Recommendation:** Option (a) -- refactor `ScanHistoryList` to format timestamps in the component using the hook, rather than calling `formatScanTime` utility.

### Anti-Patterns to Avoid
- **Calling useTimeFormat inside useDateFormat:** Hooks can't call other hooks dynamically. Instead, read `user?.time_format` directly from auth context in both hooks.
- **Replacing formatDistanceToNow with absolute times:** Relative time ("3 hours ago") should stay relative.
- **Changing toLocaleString calls that format NUMBERS:** `value.toLocaleString()` in `conflict-resolution-dialog.tsx:93` and `export-dialog.tsx:180,190` and `dashboard/page.tsx:264` format numbers, not dates. Leave these alone.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| DateTime formatting | Custom string concatenation | `formatDateTime` with composed format string | Handles null, invalid dates, ISO parsing |
| 12h/24h conversion | Manual hour math | date-fns format with `h:mm a` vs `HH:mm` tokens | Handles edge cases (midnight, noon) |
| Time format detection | Parse user string | `TIME_FORMAT_MAP` lookup | Only two options (12h/24h), map is simplest |

**Key insight:** The hooks already handle all hard parts. This phase is connecting them to display sites and fixing the `formatDateTime` composition.

## Common Pitfalls

### Pitfall 1: formatDateTime Hardcodes HH:mm
**What goes wrong:** A user selects 12-hour format but `formatDateTime` still shows "14:30" instead of "2:30 PM".
**Why it happens:** `useDateFormat.formatDateTime` concatenates `${dateFnsFormatStr} HH:mm` -- the time portion is hardcoded to 24-hour format.
**How to avoid:** Read `user?.time_format` from auth context inside `useDateFormat` and compose the format string dynamically.
**Warning signs:** Import job detail page shows 24-hour time even when user has 12h selected.
**File:** `frontend/lib/hooks/use-date-format.ts:110`

### Pitfall 2: Confusing Number toLocaleString with Date toLocaleString
**What goes wrong:** Developer converts `value.toLocaleString()` on a number to `formatDateTime`, breaking number display.
**Why it happens:** `toLocaleString()` works on both Number and Date. Search results for `toLocaleString` include number formatting.
**How to avoid:** Only convert calls where the value is clearly a Date or ISO string. Numeric `.toLocaleString()` calls (stats, counts, prices) are out of scope for this phase.
**Warning signs:** Numbers showing as "-" or garbled text.
**Files to leave alone:**
- `conflict-resolution-dialog.tsx:93` -- number formatting
- `export-dialog.tsx:180,190` -- number formatting
- `dashboard/page.tsx:264` -- number formatting

### Pitfall 3: Module-level formatTimestamp in pending-changes-drawer
**What goes wrong:** Can't use hooks in module-level functions.
**Why it happens:** `formatTimestamp` is defined outside any React component.
**How to avoid:** Move formatting inline inside the component using the hook's `formatDateTime`, or pass `formatDateTime` as a parameter.
**Warning signs:** "Hooks can only be called inside the body of a function component" error.
**File:** `frontend/components/pending-changes-drawer.tsx:67-75`

### Pitfall 4: formatScanTime is a Non-React Utility
**What goes wrong:** Can't use `useTimeFormat` in `lib/scanner/scan-history.ts`.
**Why it happens:** It's a plain utility function, not a React hook.
**How to avoid:** Format timestamps in the `ScanHistoryList` component instead of in the utility function. The component can use hooks.
**Warning signs:** "Hooks can only be called inside the body of a function component" error.
**File:** `frontend/lib/scanner/scan-history.ts:169-196`

### Pitfall 5: Missing useMemo Dependencies
**What goes wrong:** DateTime displays don't update when user changes time format.
**Why it happens:** `formatDateTime` not included in useMemo dependency arrays.
**How to avoid:** When `formatDateTime` changes (due to time_format dependency), all useMemo consumers must re-evaluate. Ensure `formatDateTime` is in dependency arrays of any useMemo that uses it.
**Warning signs:** Changing time format in settings doesn't immediately reflect in pages until navigation.

### Pitfall 6: Forgetting to Add user?.time_format as Dependency
**What goes wrong:** `formatDateTime` in `useDateFormat` doesn't re-create when time preference changes.
**Why it happens:** Only `dateFnsFormatStr` is in the useCallback dependency array, not the time format.
**How to avoid:** Add `user?.time_format` to the dependency array of `formatDateTime`'s useCallback.
**Warning signs:** Time format changes require page refresh to take effect.

## Code Examples

### Complete Inventory of Time-Related Display Sites

#### Category 1: formatDateTime in useDateFormat (FIX - hardcodes HH:mm)
1. `frontend/lib/hooks/use-date-format.ts:110` -- `dateFnsFormat(dateObj, \`${dateFnsFormatStr} HH:mm\`)` -- **Must compose with user's time format**

#### Category 2: toLocaleString() calls displaying datetime (CONVERT to formatDateTime)
1. `frontend/app/[locale]/(dashboard)/dashboard/approvals/page.tsx:199` -- `new Date(change.created_at).toLocaleString()`
2. `frontend/app/[locale]/(dashboard)/dashboard/approvals/page.tsx:207` -- `new Date(change.reviewed_at).toLocaleString()`
3. `frontend/app/[locale]/(dashboard)/dashboard/approvals/[id]/page.tsx:410` -- `new Date(change.created_at).toLocaleString()`
4. `frontend/app/[locale]/(dashboard)/dashboard/approvals/[id]/page.tsx:454` -- `new Date(change.reviewed_at).toLocaleString()`
5. `frontend/app/[locale]/(dashboard)/dashboard/my-changes/page.tsx:135` -- `new Date(change.created_at).toLocaleString()`
6. `frontend/app/[locale]/(dashboard)/dashboard/my-changes/page.tsx:143` -- `new Date(change.reviewed_at).toLocaleString()`

#### Category 3: Custom formatTimestamp using toLocaleString with time options (CONVERT)
1. `frontend/components/pending-changes-drawer.tsx:67-75` -- `date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })` -- Module-level function, needs refactoring

#### Category 4: formatScanTime utility with time fallback (CONVERT)
1. `frontend/lib/scanner/scan-history.ts:190` -- `date.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })` -- Non-React utility, needs approach change

#### Category 5: formatDateTime already in use (BENEFITS FROM FIX automatically)
1. `frontend/app/[locale]/(dashboard)/dashboard/imports/[jobId]/page.tsx:315` -- `formatDateTime(job.started_at)` -- Already uses hook, will be fixed by Category 1
2. `frontend/app/[locale]/(dashboard)/dashboard/imports/[jobId]/page.tsx:320` -- `formatDateTime(job.completed_at)` -- Same

#### Category 6: Custom date format examples with hardcoded HH:mm (UPDATE examples)
1. `frontend/components/dashboard/user-menu.tsx:383` -- placeholder `yyyy-MM-dd HH:mm`
2. `frontend/components/dashboard/user-menu.tsx:409` -- example `dd/MM/yyyy HH:mm`
3. `frontend/components/settings/date-format-settings.tsx:190` -- placeholder `yyyy-MM-dd HH:mm`
4. `frontend/components/settings/date-format-settings.tsx:213` -- help text mentions `HH:mm`

#### Category 7: Relative time displays (DO NOT CONVERT)
Leave these as-is -- they show "3 hours ago" style text, not absolute times:
1. `components/dashboard/activity-feed.tsx:181` -- `formatDistanceToNow`
2. `components/settings/active-sessions.tsx:121` -- `formatDistanceToNow`
3. `dashboard/sync-history/page.tsx:114,118` -- `formatDistanceToNow`
4. `dashboard/imports/page.tsx:247` -- `formatDistanceToNow`
5. `dashboard/imports/[jobId]/page.tsx:279` -- `formatDistanceToNow`
6. `components/conflict-resolution-dialog.tsx:97,106,373` -- `formatDistanceToNow`
7. `components/sync-status-indicator.tsx:13` -- custom relative time (outputs "2m ago" style)
8. `dashboard/page.tsx:148` -- custom `formatRelativeTime` (falls back to formatDate for old items, no time)
9. `components/dashboard/notifications-dropdown.tsx:46` -- custom `formatRelativeTime` (falls back to formatDate)

#### Category 8: Number toLocaleString (NOT datetime -- DO NOT TOUCH)
1. `conflict-resolution-dialog.tsx:93` -- `value.toLocaleString()` on number
2. `export-dialog.tsx:180,190` -- `currentCount.toLocaleString()`, `allCount.toLocaleString()`
3. `dashboard/page.tsx:264` -- `stats.total_items.toLocaleString()`

#### Category 9: Time inputs (TIME-04)
**No time inputs currently exist in the application.** All date fields use `<input type="date">`, not `<input type="time">` or `<input type="datetime-local">`. TIME-04 requires readiness, not conversion of existing inputs.

### Core Fix: formatDateTime in useDateFormat

```typescript
// BEFORE (use-date-format.ts):
const formatDateTime = useCallback(
  (date: Date | string | null | undefined): string => {
    if (!date) return "-";
    try {
      const dateObj = typeof date === "string" ? parseISO(date) : date;
      if (!isValid(dateObj)) return "-";
      return dateFnsFormat(dateObj, `${dateFnsFormatStr} HH:mm`);
    } catch {
      return "-";
    }
  },
  [dateFnsFormatStr]
);

// AFTER:
const TIME_FORMAT_MAP: Record<string, string> = {
  "12h": "h:mm a",
  "24h": "HH:mm",
};

// Inside useDateFormat:
const timeFormatStr = useMemo(() => {
  const tf = user?.time_format;
  return TIME_FORMAT_MAP[tf as string] || "HH:mm";
}, [user?.time_format]);

const formatDateTime = useCallback(
  (date: Date | string | null | undefined): string => {
    if (!date) return "-";
    try {
      const dateObj = typeof date === "string" ? parseISO(date) : date;
      if (!isValid(dateObj)) return "-";
      return dateFnsFormat(dateObj, `${dateFnsFormatStr} ${timeFormatStr}`);
    } catch {
      return "-";
    }
  },
  [dateFnsFormatStr, timeFormatStr]
);
```

### Conversion Pattern: toLocaleString to formatDateTime

```typescript
// BEFORE (approvals/page.tsx):
import { useDateFormat } from "@/lib/hooks/use-date-format";
// ... (may or may not already import useDateFormat)
{new Date(change.created_at).toLocaleString()}

// AFTER:
const { formatDateTime } = useDateFormat();
{formatDateTime(change.created_at)}
// Note: formatDateTime already handles ISO string parsing, no need for new Date()
```

### Conversion Pattern: pending-changes-drawer Module-level Function

```typescript
// BEFORE: module-level function
function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString(undefined, { ... });
}

// AFTER: use hook inside component, inline the formatting
// In PendingChangesDrawer component:
const { formatDateTime } = useDateFormat();
// In JSX, replace:
//   {formatTimestamp(mutation.timestamp)}
// With:
//   {formatDateTime(new Date(mutation.timestamp))}
// Then remove the module-level formatTimestamp function
```

### Conversion Pattern: ScanHistoryList

```typescript
// BEFORE: uses formatScanTime utility
import { formatScanTime } from "@/lib/scanner";
// ...
<span>{formatScanTime(entry.timestamp)}</span>

// AFTER: format in component, keep relative time logic
const { formatDateTime } = useDateFormat();

function formatScanTimestamp(timestamp: number): string {
  const now = Date.now();
  const diffSec = Math.floor((now - timestamp) / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHour < 24) return `${diffHour} hr ago`;
  return formatDateTime(new Date(timestamp));
}

<span>{formatScanTimestamp(entry.timestamp)}</span>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `new Date().toLocaleString()` for datetime | `useDateFormat().formatDateTime()` | Phase 32 | Consistent user-preference-aware datetime |
| Hardcoded `HH:mm` in formatDateTime | Composed `${dateFormat} ${timeFormat}` | Phase 33 (this phase) | Respects 12h/24h preference |
| No time format preference | `useTimeFormat().formatTime()` for time-only | Phase 30 | Time displays respect user choice |

**Deprecated/outdated after this phase:**
- `new Date(x).toLocaleString()` for datetime display -- should use `formatDateTime` hook
- `toLocaleString(undefined, { hour: "2-digit", ... })` -- should use hook-based formatting
- Hardcoded `HH:mm` in format strings -- should use `timeFormatStr` from time format preference

## Open Questions

1. **Custom date format examples referencing HH:mm**
   - What we know: The user-menu custom format dialog and date-format-settings show `HH:mm` in placeholders and examples (e.g., `dd/MM/yyyy HH:mm`). These are examples for the custom date format feature, not actual time displays.
   - What's unclear: Should these examples adapt to show `h:mm a` when user has 12h selected? Or are they showing date-fns token examples which should stay as-is?
   - Recommendation: Leave as-is. These are date-fns format token examples for the custom date format feature. The tokens themselves (`HH:mm` vs `h:mm a`) are what the user types, not formatted output. Changing them would be confusing since users need to know the actual token syntax.

2. **formatScanTime refactoring scope**
   - What we know: `formatScanTime` is exported from `lib/scanner/scan-history.ts` and used by `ScanHistoryList`. It's also re-exported through `lib/scanner/index.ts`.
   - What's unclear: Is it used elsewhere? Is it tested?
   - Recommendation: Check exports and tests. If only used by `ScanHistoryList`, move formatting to component. If used elsewhere, add a `formatFallback` parameter.

3. **CSV export datetime columns**
   - What we know: Phase 32 converted date columns in CSV exports to use `formatDate`. No CSV export columns currently include time components (they export `created_at` and `updated_at` as date-only).
   - What's unclear: Should CSV exports include time? Currently they use `formatDate` (date-only).
   - Recommendation: Out of scope. CSV export date columns were intentionally set to date-only in Phase 32. Adding time to CSV exports would be a separate decision.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `frontend/lib/hooks/use-date-format.ts` -- formatDateTime implementation with hardcoded HH:mm (line 110)
- Codebase analysis: `frontend/lib/hooks/use-time-format.ts` -- useTimeFormat hook with TIME_FORMAT_MAP
- Codebase analysis: Full grep of all `toLocaleString`, `toLocaleDateString`, `toLocaleTimeString`, `formatDistanceToNow`, `formatTimestamp`, `formatScanTime` calls across frontend
- Phase 32 research: `.planning/phases/32-date-format-rollout/32-RESEARCH.md` -- established patterns and anti-patterns

### Secondary (MEDIUM confidence)
- date-fns v4 format tokens: `h` for 12-hour, `HH` for 24-hour, `a` for AM/PM
- HTML spec: `<input type="time">` uses 24-hour `HH:mm` value format regardless of display

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in project, no new dependencies
- Architecture: HIGH -- pattern established by Phase 32, formatDateTime fix is straightforward
- Pitfalls: HIGH -- all identified from direct codebase analysis with specific file/line references

**Research date:** 2026-02-08
**Valid until:** 2026-03-08 (stable -- no moving targets, all changes are internal formatting)
