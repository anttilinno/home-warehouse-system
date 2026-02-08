# Phase 34: Number Format Rollout - Research

**Researched:** 2026-02-08
**Domain:** Number formatting/parsing across entire frontend application
**Confidence:** HIGH

## Summary

Phase 34 requires rolling out the existing `useNumberFormat` hook to every location in the application that displays, inputs, or exports numbers. The hook already exists (from Phase 30) with `formatNumber` and `parseNumber` functions, plus exposed `thousandSeparator` and `decimalSeparator` values. The hook is currently NOT used anywhere in the app -- all number displays use raw values, `.toLocaleString()`, `.toFixed()`, or `Intl.NumberFormat` with hardcoded `"en-US"` locale.

The codebase has five distinct categories of number display that need conversion:

1. **Statistics/counts** (dashboard, analytics, import job detail) -- integers displayed via `.toLocaleString()` or raw interpolation
2. **Prices/currency** (analytics location values, declutter, repair history, inventory CSV export) -- cents-to-dollars with `Intl.NumberFormat("en-US")` or `.toFixed(2)` with hardcoded `$` prefix
3. **Quantities** (inventory table, loans table, analytics tables, item detail, out-of-stock) -- raw integer display
4. **Number inputs** (inventory quantity, loans quantity, items min_stock_level, containers capacity, repair cost) -- HTML `type="number"` inputs that need format-aware parsing
5. **CSV export formatters** (inventory unit_price/total_value, declutter purchase_price) -- need formatted output

The number input conversion (NUM-08) is the most complex requirement because HTML `<input type="number">` natively only accepts period as decimal separator. European users who type `1.234,56` into a `type="number"` input will get validation errors. The solution is to use `type="text"` with `inputMode="decimal"` and the hook's `parseNumber` for validation, or to keep `type="number"` for integer-only fields (where thousand separators are rarely needed in user input).

**Primary recommendation:** Use `useNumberFormat().formatNumber` for all display sites, `parseNumber` for text-based number inputs (prices/costs with decimals), keep `type="number"` for integer-only inputs (quantities, stock levels) since users rarely type thousand separators for small integers. Add `formatNumber` to CSV export formatters. Create a `FormattedNumber` convenience component for common display patterns.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| useNumberFormat hook | existing | User preference-aware number formatting | Already built in Phase 30 |
| React | 19 | Component framework | Already in project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| No new libraries needed | - | - | - |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom `useNumberFormat` | `Intl.NumberFormat` with user locale | Our hook gives direct separator control per user preference; Intl ties to entire locale |
| `type="text"` + `inputMode="decimal"` | Keep `type="number"` for all inputs | `type="number"` rejects comma decimals; `type="text"` with inputMode gives numeric keyboard on mobile while accepting any separator |
| `FormattedNumber` component | Inline `formatNumber()` calls everywhere | Component approach is DRY but adds indirection; inline is simpler for one-off uses |

**Installation:** No new packages needed.

## Architecture Patterns

### Pattern 1: Hook-based Number Display (core pattern)
**What:** All number display goes through `useNumberFormat()` hook
**When to use:** Every React component that displays a numeric value
**Example:**
```typescript
// Source: existing codebase - frontend/lib/hooks/use-number-format.ts
const { formatNumber } = useNumberFormat();

// Integer display (no decimals):
<span>{formatNumber(stats.total_items)}</span>           // "1,234" or "1.234"

// Price display (2 decimals):
<span>${formatNumber(amount / 100, 2)}</span>            // "$1,234.56" or "$1.234,56"

// Quantity display (no decimals for integers):
<span>{formatNumber(inventory.quantity)}</span>           // "42"
```

### Pattern 2: CSV Export with Format-Aware Formatters
**What:** Export column definitions use the hook's formatNumber function
**When to use:** All CSV export column definitions that include numeric fields
**Challenge:** Export columns are defined in `useMemo` inside components, so the hook can be called in the same component. Must add `formatNumber` to `useMemo` dependencies.
**Example:**
```typescript
const { formatNumber } = useNumberFormat();

const exportColumns: ColumnDefinition<Inventory>[] = useMemo(() => [
  // BEFORE:
  // { key: "unit_price", label: "Unit Price", formatter: (value) => value ? `$${value}` : "-" },
  // AFTER:
  { key: "unit_price", label: "Unit Price", formatter: (value) => value ? formatNumber(value / 100, 2) : "-" },
  { key: "quantity", label: "Quantity" }, // raw integers are fine as-is in CSV
], [formatNumber]);
```

### Pattern 3: Number Input with User Format Parsing (for decimal values)
**What:** Replace `type="number"` with `type="text"` + `inputMode="decimal"` for price/cost inputs, use `parseNumber` on save
**When to use:** Input fields where users enter decimal numbers (prices, costs)
**Key insight:** HTML `<input type="number">` only accepts `.` as decimal separator. A European user with `,` as decimal separator cannot type `12,50` into a number input. The fix is `type="text"` with `inputMode="decimal"` (shows numeric keyboard on mobile).
**Example:**
```typescript
const { parseNumber, decimalSeparator } = useNumberFormat();

// For price inputs:
<Input
  type="text"
  inputMode="decimal"
  value={formCost}
  onChange={(e) => setFormCost(e.target.value)}
  placeholder={`0${decimalSeparator}00`}
/>

// On save:
const parsed = parseNumber(formCost);
if (parsed === null) {
  toast.error("Invalid number format");
  return;
}
const costInCents = Math.round(parsed * 100);
```

### Pattern 4: Integer-Only Inputs (keep type="number")
**What:** Keep `type="number"` for fields that only accept whole numbers
**When to use:** Quantity fields, stock levels, capacity -- integer-only inputs where thousand separators are not needed for typical values (< 10,000)
**Rationale:** For small integers like quantities (1-999), users don't type thousand separators. The native `type="number"` provides built-in validation (min/max, step), increment/decrement arrows, and prevents non-numeric input. The cost of switching to `type="text"` outweighs the benefit for these fields.
**Example:**
```typescript
// Keep as-is for integer-only fields:
<Input type="number" min="1" value={formQuantity}
  onChange={(e) => setFormQuantity(parseInt(e.target.value) || 1)} />
```

### Pattern 5: Replace Hardcoded Currency Formatting
**What:** Replace `Intl.NumberFormat("en-US", { style: "currency" })` and `${}.toFixed(2)` with `formatNumber`
**When to use:** Declutter page `formatCurrency`, repair history `formatCurrency`, analytics page value display
**Key insight:** Currency symbol ($/EUR) stays hardcoded or from data; only the NUMBER formatting changes.
**Example:**
```typescript
// BEFORE (declutter/page.tsx):
function formatCurrency(amountCents: number | null | undefined, currencyCode: string): string {
  if (amountCents == null) return "-";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currencyCode }).format(amountCents / 100);
}

// AFTER:
function formatCurrency(amountCents: number | null | undefined, currencyCode: string, formatNumber: (n: number, d?: number) => string): string {
  if (amountCents == null) return "-";
  const symbol = currencyCode === "USD" ? "$" : currencyCode === "EUR" ? "\u20AC" : currencyCode;
  return `${symbol}${formatNumber(amountCents / 100, 2)}`;
}
```

### Anti-Patterns to Avoid
- **Using `.toLocaleString()` without user preferences:** Ties formatting to browser locale, not user choice
- **Using `Intl.NumberFormat("en-US")` hardcoded:** Forces US format regardless of user preference
- **Switching ALL inputs to `type="text"`:** Only switch decimal-value inputs; keep `type="number"` for integers
- **Formatting numbers in CSV export with thousand separators:** CSV is for data exchange; thousand separators can break parsing in spreadsheet software. Only format price decimals correctly; leave raw integers as-is.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Number formatting with user separators | Custom regex per component | `useNumberFormat().formatNumber` | Already built, tested, handles edge cases |
| Parsing user-formatted numbers | Custom string manipulation | `useNumberFormat().parseNumber` | Handles all separator combinations correctly |
| Currency display | `Intl.NumberFormat` with hardcoded locale | `formatNumber(amount, 2)` + currency symbol | Respects user preference |

**Key insight:** The hook already exists and handles the hard parts (regex for thousand grouping, separator replacement for parsing). The work is purely plumbing -- importing and calling it at each site.

## Common Pitfalls

### Pitfall 1: CSV Export with Thousand Separators
**What goes wrong:** Exporting `"1,234"` as a CSV value -- the comma breaks CSV parsing
**Why it happens:** Applying `formatNumber` to raw integer columns in CSV
**How to avoid:** Only use `formatNumber` in CSV for decimal values (prices) where you need the correct decimal separator. For integer columns (quantity, count), export raw numbers. The `escapeCsvField` utility already handles quoting if needed.
**Warning signs:** CSV opens in Excel with split columns

### Pitfall 2: Input type="number" Rejecting User's Decimal Separator
**What goes wrong:** European user types `12,50` into `<input type="number">` and it's rejected or parsed as `1250`
**Why it happens:** HTML spec says `type="number"` only accepts `.` as decimal
**How to avoid:** Use `type="text"` with `inputMode="decimal"` for price/cost inputs
**Warning signs:** Form validation errors when users enter comma-separated decimals

### Pitfall 3: Double Formatting
**What goes wrong:** A value is formatted twice (e.g., `formatNumber(formatNumber(value))`) producing garbled output like `1,234.56` becoming `1,234.56` -> wrong
**Why it happens:** When a value is already a formatted string and passed to `formatNumber` again
**How to avoid:** Always pass raw numbers to `formatNumber`, never formatted strings
**Warning signs:** Numbers with double separators or missing digits

### Pitfall 4: Forgetting useMemo Dependencies
**What goes wrong:** Changing number format in settings doesn't update CSV export columns or displayed numbers
**Why it happens:** `formatNumber` not included in `useMemo` dependency array for export columns
**How to avoid:** Always add `formatNumber` to dependency arrays when used inside `useMemo` or `useCallback`. Phase 32 established this pattern with `formatDate`.
**Warning signs:** Numbers don't update after changing format settings until page refresh

### Pitfall 5: Cents-to-Dollars Conversion Errors
**What goes wrong:** Prices display as `123456` instead of `1,234.56`
**Why it happens:** Forgetting to divide cents by 100 before formatting
**How to avoid:** The backend stores prices in cents. Always `formatNumber(amountCents / 100, 2)`.
**Warning signs:** Prices that are 100x too large

### Pitfall 6: File Size Formatting Confusion
**What goes wrong:** Trying to apply user number format to file size displays (KB, MB)
**Why it happens:** File sizes use `.toFixed()` but are technical display, not user data
**How to avoid:** Leave file size formatting (`formatFileSize`) as-is. These are technical values that follow universal conventions (1.5 MB), not user-chosen format. The requirements (NUM-04 through NUM-08) specifically list inventory counts, quantities, prices, and statistics -- not file sizes.
**Warning signs:** Over-engineering scope creep

## Code Examples

Verified patterns from the existing codebase:

### Replacing Dashboard toLocaleString
```typescript
// Source: frontend/app/[locale]/(dashboard)/dashboard/page.tsx line 264
// BEFORE:
value={stats.total_items.toLocaleString()}

// AFTER:
const { formatNumber } = useNumberFormat();
value={formatNumber(stats.total_items)}
```

### Replacing Analytics Hardcoded Price Display
```typescript
// Source: frontend/app/[locale]/(dashboard)/dashboard/analytics/page.tsx line 443
// BEFORE:
${(location.total_value / 100).toFixed(2)}

// AFTER:
const { formatNumber } = useNumberFormat();
{formatNumber(location.total_value / 100, 2)}
```

### Replacing Declutter formatCurrency
```typescript
// Source: frontend/app/[locale]/(dashboard)/dashboard/declutter/page.tsx line 46-54
// BEFORE:
function formatCurrency(amountCents: number | null | undefined, currencyCode: string | null | undefined): string {
  if (amountCents === null || amountCents === undefined) return "-";
  const amount = amountCents / 100;
  const currency = currencyCode || "EUR";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}

// AFTER: Pass formatNumber from hook into a helper
// Note: Currency symbol handling is separate from number formatting
```

### Replacing Conflict Resolution toLocaleString
```typescript
// Source: frontend/components/conflict-resolution-dialog.tsx line 93
// BEFORE:
return value.toLocaleString();

// AFTER: This is in a utility function, not a component. Since useNumberFormat is a hook,
// it cannot be called here. Options:
// 1. Pass formatNumber as a parameter
// 2. Accept the browser locale default for this edge case
// Recommendation: Leave conflict-resolution as-is since it's a rare edge case display
```

### Replacing Export Dialog toLocaleString
```typescript
// Source: frontend/components/ui/export-dialog.tsx lines 180, 190
// BEFORE:
Current page ({currentCount.toLocaleString()} ...)
All data ({allCount.toLocaleString()} ...)

// AFTER:
const { formatNumber } = useNumberFormat();
Current page ({formatNumber(currentCount)} ...)
All data ({formatNumber(allCount)} ...)
```

### Repair History Cost Input (Decimal Input Pattern)
```typescript
// Source: frontend/components/inventory/repair-history.tsx line 560-568
// BEFORE:
<Input type="number" step="0.01" min="0" value={formCost} placeholder="0.00" />

// AFTER:
const { parseNumber, decimalSeparator } = useNumberFormat();
<Input type="text" inputMode="decimal" value={formCost}
  placeholder={`0${decimalSeparator}00`} />
// On save: const parsed = parseNumber(formCost);
```

## Comprehensive Inventory of Number Display Sites

### Category 1: Statistics (NUM-07)
| File | Line(s) | Current Code | Type |
|------|---------|-------------|------|
| `dashboard/page.tsx` | 264 | `stats.total_items.toLocaleString()` | `.toLocaleString()` |
| `dashboard/page.tsx` | 269, 275, 280 | `stats.total_locations`, `stats.total_containers`, `stats.active_loans` | raw number |
| `analytics/page.tsx` | 219, 225, 233, 239 | `dashboardStats.total_items` etc. | raw number (8 stats cards) |
| `analytics/page.tsx` | 465-479 | `loanStats.total_loans/active/returned/overdue` | raw number (4 loan stats) |
| `analytics/page.tsx` | 399 | `borrower.total_loans` | raw number in table |
| `analytics/page.tsx` | 401 | `borrower.active_loans` | raw number in badge |
| `imports/[jobId]/page.tsx` | 291, 299, 303, 307 | `job.processed_rows`, `job.total_rows`, `job.success_count`, `job.error_count` | raw numbers |
| `export-dialog.tsx` | 180, 190 | `currentCount.toLocaleString()`, `allCount.toLocaleString()` | `.toLocaleString()` |
| `declutter/page.tsx` | 264 | `currentCount` | raw number |

### Category 2: Prices/Currency (NUM-06)
| File | Line(s) | Current Code | Type |
|------|---------|-------------|------|
| `analytics/page.tsx` | 443 | `${(location.total_value / 100).toFixed(2)}` | `.toFixed(2)` with `$` prefix |
| `declutter/page.tsx` | 46-54 | `Intl.NumberFormat("en-US", { style: "currency" })` | `Intl.NumberFormat` hardcoded |
| `declutter/page.tsx` | 172 | `(value / 100).toFixed(2)` | CSV export formatter |
| `repair-history.tsx` | 131-139 | `Intl.NumberFormat("en-US", { style: "currency" })` | `Intl.NumberFormat` hardcoded |
| `inventory/page.tsx` | 914-915 | `value ? \`$\${value}\`` | CSV export formatter (unit_price, total_value) |

### Category 3: Quantities (NUM-04, NUM-05)
| File | Line(s) | Current Code | Type |
|------|---------|-------------|------|
| `inventory/page.tsx` | 1354 | `inventory.quantity.toString()` in InlineEditCell | raw number |
| `loans/page.tsx` | 1062 | `{loan.quantity}` | raw number |
| `loans/page.tsx` | 1236 | `Qty: {inv.quantity}` | raw number in text |
| `loans/page.tsx` | 1282 | `{availableInventory...quantity || 0}` | raw number (max label) |
| `analytics/page.tsx` | 440-441 | `{location.item_count}`, `{location.total_quantity}` | raw number in table |
| `items/[id]/page.tsx` | 400 | `{item.min_stock_level}` | raw number |
| `items/page.tsx` | 1351 | `{item.min_stock_level}` | raw number in table |
| `out-of-stock/page.tsx` | 212 | `{item.min_stock_level}` | raw number |
| `declutter/page.tsx` | 340 | `{item.days_unused}` | raw number |

### Category 4: Number Inputs (NUM-08)
| File | Line(s) | Current Code | Input Type | Needs Change? |
|------|---------|-------------|-----------|---------------|
| `inventory/page.tsx` | 1535 | Quantity input | `type="number"` | No (integer) |
| `inventory/page.tsx` | 364, 373 | Filter min/max quantity | `type="number"` | No (integer filter) |
| `loans/page.tsx` | 1274 | Loan quantity | `type="number"` | No (integer) |
| `items/page.tsx` | 1548 | Min stock level | `type="number"` | No (integer) |
| `containers/page.tsx` | 188, 197 | Capacity range filters | `type="number"` | No (integer) |
| `repair-history.tsx` | 562 | Repair cost | `type="number" step="0.01"` | **YES** (decimal price) |

### Category 5: Utility Number Displays (keep as-is)
| File | Line(s) | Current Code | Why Keep |
|------|---------|-------------|----------|
| `imports/[jobId]/page.tsx` | 179-180 | File size `.toFixed(1)` KB/MB | Technical display, not user data |
| `imports/new/page.tsx` | 225 | File size `.toFixed(2)` KB | Technical display |
| `backup-restore-dialog.tsx` | 317 | File size `.toFixed(2)` KB | Technical display |
| `repair-attachments.tsx` | 54 | File size formatting | Technical display |
| `lib/utils/image.ts` | 38, 104 | File size formatting | Technical utility |
| `lib/hooks/use-photo-upload.ts` | 88 | Compressed size in console | Debug logging |
| `conflict-resolution-dialog.tsx` | 93 | `value.toLocaleString()` | Edge case utility function (not a component hook context) |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `.toLocaleString()` | `useNumberFormat().formatNumber()` | Phase 30 (hook created) | Gives user control over format |
| `Intl.NumberFormat("en-US")` | `useNumberFormat().formatNumber()` | Phase 30 | No more hardcoded locale |
| `type="number"` for price inputs | `type="text"` + `inputMode="decimal"` | Industry standard | Accepts comma decimals |

## Open Questions

1. **Currency symbol handling**
   - What we know: The app uses `$` prefix in some places and `Intl.NumberFormat` currency formatting in others. Currency codes come from data (EUR, USD, etc.)
   - What's unclear: Should currency symbol be derived from the currency code, or should users set their preferred symbol? The requirements only mention number FORMAT (separators), not currency.
   - Recommendation: Keep currency symbol from data/hardcoded as-is. Only change the NUMBER part of the formatting. This is about separators, not currency symbols.

2. **Conflict resolution dialog**
   - What we know: `formatValue` in `conflict-resolution-dialog.tsx` calls `value.toLocaleString()` for numbers, but it's a plain function, not a component, so cannot use hooks.
   - What's unclear: Whether this edge case needs conversion.
   - Recommendation: Skip this for now. It's a conflict resolution preview that appears rarely, and the function would need significant refactoring to accept a formatter parameter. Flag for future consideration.

3. **Recharts tooltip/axis formatting**
   - What we know: Analytics page uses Recharts with default number formatting on axes and tooltips.
   - What's unclear: Whether chart axis numbers and tooltip values should respect user format.
   - Recommendation: Out of scope for this phase. Chart numbers are internal data visualization labels. The requirements specify "Statistics display" which refers to the stat cards and table numbers, not chart axes.

## Sources

### Primary (HIGH confidence)
- Codebase analysis of `frontend/lib/hooks/use-number-format.ts` -- hook API verified
- Codebase analysis of `frontend/lib/hooks/use-date-format.ts` -- established pattern for format rollout
- Codebase grep for all `.toFixed()`, `.toLocaleString()`, `Intl.NumberFormat` usages -- complete inventory
- Phase 32 RESEARCH.md -- established precedent for format rollout approach

### Secondary (MEDIUM confidence)
- HTML spec for `<input type="number">` -- only accepts period as decimal (MDN verified behavior)
- `inputMode="decimal"` -- shows numeric keyboard on mobile while accepting any text (standard web API)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - hook already exists and is tested
- Architecture: HIGH - follows identical pattern to Phase 32 (date format rollout)
- Pitfalls: HIGH - based on direct codebase analysis and known HTML input limitations
- Number display inventory: HIGH - complete grep-based analysis of all frontend files

**Research date:** 2026-02-08
**Valid until:** 2026-03-08 (30 days - stable, no external dependencies changing)
