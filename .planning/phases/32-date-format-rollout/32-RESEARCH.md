# Phase 32: Date Format Rollout - Research

**Researched:** 2026-02-08
**Domain:** Date formatting/parsing across entire frontend application
**Confidence:** HIGH

## Summary

Phase 32 requires rolling out the existing `useDateFormat` hook to every location in the application that displays, inputs, or exports dates. The hook already exists and works correctly (from v1.5). The work is primarily a search-and-replace operation across ~20 files, replacing direct `date-fns format()` calls, `toLocaleDateString()` calls, and hardcoded format strings with the hook's `formatDate`/`formatDateTime` functions.

The codebase currently has exactly 2 files using `useDateFormat` (items detail page and loans page table display) while ~18 other files format dates using direct `date-fns`, `toLocaleDateString()`, or `formatDistanceToNow()`. The CSV export system uses inline formatters that need to be updated. Date inputs use native HTML `<input type="date">` which always requires `yyyy-MM-dd` format for the `value` attribute (browser standard) but can have user-friendly placeholders.

**Primary recommendation:** Extend `useDateFormat` with a `parseDate` function for DATE-10, update all display sites to use the hook, update CSV export formatters, and add user-format-aware placeholders to date inputs. Do NOT replace `formatDistanceToNow()` calls as those are relative time displays, not date format displays.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| date-fns | ^4.1.0 | Date formatting and parsing | Already in project, tree-shakeable |
| useDateFormat hook | existing | User preference-aware formatting | Already built in Phase 31, provides formatDate/formatDateTime |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| date-fns/parse | 4.x | Parse user-input dates | For DATE-10 (parsing dates per user format) |
| date-fns/isValid | 4.x | Validate parsed dates | For DATE-08 (validation messages) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| date-fns parse | Custom regex parsing | date-fns parse handles edge cases, custom is fragile |
| Native date picker | shadcn Calendar/DatePicker | Native `<input type="date">` already in use everywhere; adding shadcn Calendar would be a larger change, out of scope |

**Installation:** No new packages needed. `date-fns` v4 already includes `parse`.

## Architecture Patterns

### Pattern 1: Hook-based Date Formatting (existing)
**What:** All date display goes through `useDateFormat()` hook
**When to use:** Every React component that displays a date
**Example:**
```typescript
// Source: existing codebase - frontend/lib/hooks/use-date-format.ts
const { formatDate, formatDateTime } = useDateFormat();

// In JSX:
<span>{formatDate(item.created_at)}</span>        // date only
<span>{formatDateTime(item.created_at)}</span>     // date + time
```

### Pattern 2: CSV Export with Format-Aware Formatters
**What:** Export column definitions use the hook's format function
**When to use:** All CSV export column definitions that include date fields
**Challenge:** Export columns are defined in `useMemo` inside components, so the hook can be called in the same component.
**Example:**
```typescript
const { formatDate } = useDateFormat();

const exportColumns: ColumnDefinition<Item>[] = useMemo(() => [
  // BEFORE:
  // { key: "created_at", label: "Created Date", formatter: (value) => new Date(value).toLocaleDateString() },
  // AFTER:
  { key: "created_at", label: "Created Date", formatter: (value) => formatDate(value) },
], [formatDate]);
```

### Pattern 3: Date Input Placeholders
**What:** Native `<input type="date">` elements show format-aware placeholder text
**When to use:** All date input fields
**Key constraint:** Native `<input type="date">` ALWAYS requires `yyyy-MM-dd` format for the `value` attribute - this is a browser standard. The user's format preference only affects the placeholder/label text, not the actual value binding.
**Example:**
```typescript
const { format } = useDateFormat();
// Placeholder text shows user's preferred format
<div className="space-y-2">
  <Label htmlFor="date">Date ({format})</Label>
  <Input type="date" value={dateValue} onChange={...} />
</div>
```

### Pattern 4: Extending Hook with parseDate
**What:** Add a `parseDate` function to `useDateFormat` for DATE-10
**When to use:** When accepting text date input from users (not native date picker)
**Example:**
```typescript
// Add to useDateFormat hook:
import { parse } from "date-fns";

const parseDate = useCallback(
  (dateString: string): Date | null => {
    if (!dateString) return null;
    try {
      const parsed = parse(dateString, dateFnsFormatStr, new Date());
      return isValid(parsed) ? parsed : null;
    } catch {
      return null;
    }
  },
  [dateFnsFormatStr]
);
```

### Pattern 5: Format-Aware Validation Messages (DATE-08)
**What:** Form validation references user's format in error messages
**When to use:** Date validation errors
**Example:**
```typescript
const { format } = useDateFormat();
// In validation:
const errorMessage = `Please enter a date in ${format} format`;
```

### Anti-Patterns to Avoid
- **Direct date-fns format() in components:** Always use the hook instead of importing format directly for display
- **Changing native date input value format:** `<input type="date">` MUST use `yyyy-MM-dd` for value. Don't try to change this.
- **Replacing formatDistanceToNow:** Relative time displays ("3 hours ago") are NOT date format displays and should NOT be converted
- **Format conversion for API communication:** API always uses ISO 8601. Never send user-formatted dates to the API.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Date parsing per user format | Custom regex parser | date-fns `parse()` | Handles edge cases, locale-aware |
| Date validation | Manual string checking | date-fns `isValid()` + `parse()` | Robust validation |
| Format string conversion | Custom mapping | Existing `FORMAT_MAP` in hook | Already handles preset-to-dateFns mapping |

**Key insight:** The hook already exists and handles the hard parts (format mapping, ISO parsing, error handling). The work is connecting it to all display sites.

## Common Pitfalls

### Pitfall 1: Native Date Input Value Format
**What goes wrong:** Developer sets `<input type="date" value={formatDate(someDate)}>` using user format
**Why it happens:** Confusion between display format and input value format
**How to avoid:** Native `<input type="date">` ALWAYS requires `yyyy-MM-dd` for value. Use user format ONLY in labels/placeholders.
**Warning signs:** Date inputs appear blank or show invalid date

### Pitfall 2: Breaking formatDistanceToNow
**What goes wrong:** Converting relative time displays ("3 hours ago") to absolute date format
**Why it happens:** Treating all date displays the same
**How to avoid:** Only convert absolute date displays. `formatDistanceToNow` and relative time helpers should stay as-is.
**Warning signs:** Activity feed, sync history showing "2026-02-08" instead of "3 hours ago"

### Pitfall 3: Forgetting CSV Export Formatters
**What goes wrong:** Settings page shows correct format but exported CSV still shows old format
**Why it happens:** Export columns defined separately from display, easy to miss
**How to avoid:** Systematic audit of all `exportColumns` definitions. There are 6 pages with export: items, inventory, loans, borrowers, containers, declutter.
**Warning signs:** CSV dates not matching UI dates

### Pitfall 4: Hook Usage in Non-Component Context
**What goes wrong:** Trying to use `useDateFormat()` in utility functions or non-React code
**Why it happens:** Some formatters (like in `csv-export.ts`) are plain functions
**How to avoid:** Pass `formatDate` from the hook as a parameter to utility functions, or call the hook in the component and use it in inline formatters.
**Warning signs:** "Hooks can only be called inside the body of a function component" error

### Pitfall 5: Missing useMemo Dependencies
**What goes wrong:** Export columns not updating when format changes
**Why it happens:** `formatDate` not included in useMemo dependency array
**How to avoid:** Add `formatDate` to the dependency array of any `useMemo` that uses it
**Warning signs:** Format changes in settings don't immediately reflect in exports

### Pitfall 6: PP format token in date-fns
**What goes wrong:** `format(date, "PP")` produces locale-dependent output that ignores user preference
**Why it happens:** Repair history uses `format(parseISO(date), "PP")` which is a locale-aware preset
**How to avoid:** Replace all `"PP"` format usages with `formatDate()` from the hook
**Warning signs:** Repair dates showing in browser locale format instead of user preference

## Code Examples

### Complete Inventory of Date Display Sites to Convert

#### Category 1: Direct `toLocaleDateString()` calls (HIGH priority - clearly wrong format)
Files and lines:
1. `dashboard/page.tsx:50` - `formatRelativeTime` fallback: `date.toLocaleDateString()`
2. `dashboard/notifications-dropdown.tsx:29` - `formatRelativeTime` fallback: `date.toLocaleDateString()`
3. `lib/scanner/scan-history.ts:190` - `date.toLocaleDateString()` with options
4. `lib/hooks/use-filters.ts:81,84,87` - date range filter chip display

#### Category 2: CSV Export formatters using `toLocaleDateString()` (DATE-09)
Files:
1. `dashboard/items/page.tsx:780-781` - created_at, updated_at
2. `dashboard/inventory/page.tsx:915-916` - created_at, updated_at
3. `dashboard/loans/page.tsx:691-695` - loaned_date, due_date, returned_date, created_at
4. `dashboard/borrowers/page.tsx:347-348` - created_at, updated_at
5. `dashboard/containers/page.tsx:585-586` - created_at, updated_at
6. `dashboard/declutter/page.tsx:179` - last_used_at

#### Category 3: Direct `format(parseISO(...), "PP")` calls (display using wrong format)
Files:
1. `components/inventory/repair-history.tsx:434,451,719,732` - reminder_date, repair_date

#### Category 4: Direct `format(new Date(...), "PPpp")` calls (datetime display)
Files:
1. `dashboard/imports/[jobId]/page.tsx:313,318` - started_at, completed_at

#### Category 5: `formatDistanceToNow()` calls (DO NOT CONVERT - relative time)
Files (leave as-is):
1. `components/dashboard/activity-feed.tsx:181` - relative timestamps
2. `components/settings/active-sessions.tsx:121` - session last active
3. `dashboard/sync-history/page.tsx:113,117` - conflict timestamps
4. `dashboard/imports/page.tsx:247` - job timestamps
5. `dashboard/imports/[jobId]/page.tsx:277` - job created_at
6. `components/conflict-resolution-dialog.tsx:97,106,373` - conflict timestamps

#### Category 6: Analytics date formatting (CAREFUL)
1. `dashboard/analytics/page.tsx:200` - `toLocaleDateString("en-US", { month: "short", year: "numeric" })` for chart labels - this is a MONTH label, not a full date. Consider whether user format applies here.

#### Category 7: Date inputs using `type="date"` (DATE-04, DATE-05, DATE-06)
Files with native date inputs:
1. `dashboard/loans/page.tsx:296,302,315,321,1168,1289,1302` - filter dates, extend due date, create loan form
2. `dashboard/sync-history/page.tsx:245,257` - date range filter
3. `components/inventory/repair-history.tsx:540,616` - repair date, reminder date

### Conversion Pattern for Display Sites

```typescript
// BEFORE (items/page.tsx export columns):
{ key: "created_at", label: "Created Date", formatter: (value) => new Date(value).toLocaleDateString() },

// AFTER:
const { formatDate } = useDateFormat();
{ key: "created_at", label: "Created Date", formatter: (value) => formatDate(value) },
```

### Conversion Pattern for Repair History

```typescript
// BEFORE:
{repair.repair_date ? format(parseISO(repair.repair_date), "PP") : "-"}

// AFTER:
const { formatDate } = useDateFormat();
{formatDate(repair.repair_date)}
// (formatDate already handles null/undefined returning "-")
```

### Conversion Pattern for Import Job DateTime

```typescript
// BEFORE:
<span>{format(new Date(job.started_at), "PPpp")}</span>

// AFTER:
const { formatDateTime } = useDateFormat();
<span>{formatDateTime(job.started_at)}</span>
```

### Conversion Pattern for Date Input Labels (DATE-04)

```typescript
// BEFORE:
<Label htmlFor="due_date">Due Date</Label>
<Input type="date" ... />

// AFTER:
const { format: dateFormat } = useDateFormat();
<Label htmlFor="due_date">Due Date <span className="text-xs text-muted-foreground font-normal">({dateFormat})</span></Label>
<Input type="date" ... />
```

### Hook Extension for parseDate (DATE-10)

```typescript
// Add to use-date-format.ts:
import { parse } from "date-fns";

// In UseDateFormatReturn interface:
/** Parse a date string according to user preference */
parseDate: (dateString: string) => Date | null;
/** Get placeholder string for user's format */
placeholder: string;

// Implementation:
const PLACEHOLDER_MAP: Record<PresetDateFormat, string> = {
  "MM/DD/YY": "mm/dd/yy",
  "DD/MM/YYYY": "dd/mm/yyyy",
  "YYYY-MM-DD": "yyyy-mm-dd",
};

const placeholder = PLACEHOLDER_MAP[format as PresetDateFormat] || format.toLowerCase();

const parseDate = useCallback(
  (dateString: string): Date | null => {
    if (!dateString) return null;
    try {
      const parsed = parse(dateString, dateFnsFormatStr, new Date());
      return isValid(parsed) ? parsed : null;
    } catch {
      return null;
    }
  },
  [dateFnsFormatStr]
);
```

### Validation Message Pattern (DATE-08)

```typescript
const { format: dateFormat } = useDateFormat();

// In form validation:
if (!isValidDate) {
  toast.error(`Please enter a date in ${dateFormat} format`);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `toLocaleDateString()` | `useDateFormat().formatDate()` | Phase 31 (v1.5) | User-preference-aware |
| `format(date, "PP")` | `useDateFormat().formatDate()` | Phase 31 (v1.5) | Consistent across app |
| Hardcoded "yyyy-MM-dd" in exports | Hook-based formatDate | Phase 32 (this phase) | CSV matches UI |

**Deprecated/outdated:**
- `toLocaleDateString()` for date display - should use hook instead
- Direct `date-fns format()` for user-facing dates - should use hook instead
- `"PP"` format token for user-facing dates - locale-dependent, should use hook

## Open Questions

1. **Analytics chart month labels**
   - What we know: Currently uses `toLocaleDateString("en-US", { month: "short", year: "numeric" })` producing "Jan 2026"
   - What's unclear: Should month+year labels in charts follow user's date format? E.g., "01/2026" for MM/DD users?
   - Recommendation: Leave as-is for now. Chart axis labels are a different concern from date displays. The user's date format (DD/MM/YYYY vs MM/DD/YY) doesn't naturally map to month+year labels. Note this as a deferred decision.

2. **Filter chip date display**
   - What we know: `use-filters.ts` uses `toLocaleDateString()` for date range filter chips
   - What's unclear: `use-filters.ts` is a plain hook - can it access `useDateFormat`?
   - Recommendation: YES, since `use-filters.ts` is already a hook, it can call `useDateFormat()` internally. However, it's simpler to format the dates in the component that uses the filter chips. Looking at the code, the filter display string is generated inside `useFilters`. Since `useFilters` is a React hook, it CAN call `useDateFormat` inside it.

3. **Native date input limitations (DATE-04, DATE-05, DATE-06)**
   - What we know: The app uses `<input type="date">` everywhere. This native element always shows dates in the browser's locale format and requires `yyyy-MM-dd` for the value. The user cannot type a custom format into it.
   - What's unclear: How much of DATE-04/05/06 can be achieved with native inputs?
   - Recommendation: For native date inputs: add format hint in label (DATE-04 partial). For DATE-05/06 (parsing/output), native inputs already handle this internally. Full DATE-04/05/06 compliance would require replacing native inputs with custom text inputs + date parsing, which is a significant UX change. Recommend partial compliance: add format labels to all date inputs, and add `parseDate` to the hook for any future text-based date inputs. Document this limitation.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `frontend/lib/hooks/use-date-format.ts` - existing hook implementation
- Codebase analysis: `frontend/lib/hooks/use-time-format.ts` - parallel hook pattern
- Codebase analysis: All 34 files importing date-fns - comprehensive audit
- date-fns v4 docs: `parse`, `format`, `isValid`, `parseISO` functions

### Secondary (MEDIUM confidence)
- HTML spec for `<input type="date">`: value MUST be yyyy-MM-dd regardless of display format
- date-fns `parse()` function accepts format string and reference date

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already in project, no new dependencies
- Architecture: HIGH - pattern established by useDateFormat hook, just needs wider adoption
- Pitfalls: HIGH - identified from direct codebase analysis, all concrete with file/line references

**Research date:** 2026-02-08
**Valid until:** 2026-03-08 (stable - no moving targets)
