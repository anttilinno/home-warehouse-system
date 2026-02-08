# Phase 30: Format Infrastructure - Research

**Researched:** 2026-02-08
**Domain:** Database schema extension, Go API updates, React hooks for time/number format preferences
**Confidence:** HIGH

## Summary

This phase extends the existing user preferences infrastructure (date_format, language, theme) with two new preference categories: time format and number format. The codebase has a well-established, repeatable pattern for user preferences that makes this straightforward.

1. **Database extension is simple**: The `auth.users` table already stores `date_format`, `language`, and `theme` as VARCHAR columns. Adding `time_format`, `thousand_separator`, and `decimal_separator` follows the identical pattern -- a new migration with `ALTER TABLE ADD COLUMN` and sensible defaults.

2. **Backend plumbing is formulaic**: The User entity (`entity.go`), User repository (`user_repository.go`), SQL queries (`users.sql`), service layer (`service.go`), and HTTP handler (`handler.go`) all follow a consistent pattern. Every layer must be touched to thread the new fields through: entity struct -> Reconstruct -> getters -> UpdatePreferences -> repository Save/scan -> SQL queries -> API request/response DTOs -> JSON serialization.

3. **Frontend hooks mirror useDateFormat**: The existing `useDateFormat` hook reads `user.date_format` from the auth context, provides formatting functions, and falls back to a default. The new `useTimeFormat` and `useNumberFormat` hooks follow the same pattern: read from `user`, memoize, provide formatting utilities, fall back to defaults.

**Primary recommendation:** Follow the exact pattern established by `date_format` for all three new columns. Add them in a single migration. Update all backend layers in one pass. Create the two frontend hooks as thin wrappers around the auth context user data.

## Standard Stack

### Core (Backend - Already in Use)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Go | 1.25 | Language | Project standard |
| Chi router | v5 | HTTP routing | Already used for all API routes |
| Huma | v2 | OpenAPI/validation | Already handles all request/response DTOs |
| pgx | v5 | PostgreSQL driver | Already used in repository layer |
| dbmate | latest | Migrations | Already manages all schema changes |
| sqlc | 1.30 | Generated queries | Already generates DB query code |

### Core (Frontend - Already in Use)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React 19 | 19.x | UI framework | Project standard |
| Next.js 16 | 16.x | Framework | Project standard |
| date-fns | latest | Date formatting | Already used by useDateFormat hook |
| next-intl | latest | i18n | Already handles translations |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| sonner | latest | Toast notifications | User feedback on preference save |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Separate columns | JSON preferences blob | Separate columns: type-safe, queryable, matches existing pattern. JSON: flexible but loses DB-level defaults and type safety |
| VARCHAR columns | ENUM types | VARCHAR is what existing `date_format` uses, ENUMs add migration complexity for additions |

## Architecture Patterns

### Recommended Project Structure

No new directories needed. New files slot into existing locations:

```
backend/
  db/migrations/010_format_preferences.sql    # NEW: add 3 columns
  db/queries/users.sql                         # MODIFY: update queries
  internal/domain/auth/user/entity.go          # MODIFY: add fields
  internal/domain/auth/user/handler.go         # MODIFY: update DTOs
  internal/domain/auth/user/service.go         # MODIFY: update input struct
  internal/infra/postgres/user_repository.go   # MODIFY: update scan/save

frontend/
  lib/hooks/use-time-format.ts                 # NEW hook
  lib/hooks/use-number-format.ts               # NEW hook
  lib/api/auth.ts                              # MODIFY: extend User type
```

### Pattern 1: User Preference Column Addition (Backend)

**What:** Add a new preference column to `auth.users`, thread it through all backend layers.
**When to use:** Any time a new user preference is added.
**Example (established by date_format):**

1. **Migration**: `ALTER TABLE auth.users ADD COLUMN <name> VARCHAR(<len>) NOT NULL DEFAULT '<default>';`
2. **Entity** (`entity.go`): Add private field, add to `NewUser`, add to `Reconstruct`, add getter method
3. **UpdatePreferences** (`entity.go`): Add parameter, add conditional update logic
4. **Repository** (`user_repository.go`): Add to `Save` INSERT/UPSERT, add to all `scan` functions, add to all SELECT column lists
5. **SQL queries** (`users.sql`): Add column to all SELECT lists, UPDATE queries
6. **Handler DTOs** (`handler.go`): Add to `UserResponse`, `UserAdminResponse`, `UpdatePrefsRequestBody`, and `UpdatePreferencesInput`
7. **Service** (`service.go`): Add to `UpdatePreferencesInput` struct

### Pattern 2: Frontend Preference Hook

**What:** A React hook that reads a user preference from the auth context and provides formatting utilities.
**When to use:** Any time a user preference needs to be consumed in UI components.
**Example (established by useDateFormat):**

```typescript
export function useTimeFormat(): UseTimeFormatReturn {
  const { user } = useAuth();

  const format = useMemo(() => {
    return (user?.time_format as TimeFormatOption) || DEFAULT_TIME_FORMAT;
  }, [user?.time_format]);

  const formatTime = useCallback(
    (date: Date | string | null | undefined): string => {
      // formatting logic using date-fns format()
    },
    [format]
  );

  return { format, formatTime, ... };
}
```

### Pattern 3: Number Formatting (No External Library Needed)

**What:** Format numbers with user-selected thousand and decimal separators.
**When to use:** Displaying counts, quantities, prices.
**Example:**

```typescript
function formatNumber(
  value: number,
  thousandSep: string,
  decimalSep: string,
  decimals?: number
): string {
  const parts = value.toFixed(decimals ?? 0).split(".");
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, thousandSep);
  return parts.length > 1 ? `${intPart}${decimalSep}${parts[1]}` : intPart;
}
```

### Anti-Patterns to Avoid

- **Separate API endpoint per preference**: The existing `PATCH /users/me/preferences` handles all preferences in one call. Do not create separate endpoints for time/number format. Extend the existing one.
- **Storing format strings in localStorage**: Preferences MUST come from the server via the user profile API. The auth context is the single source of truth. No local caching of format preferences.
- **Using Intl.NumberFormat directly**: While `Intl.NumberFormat` is powerful, the requirements specify explicit separator choices (comma/period/space), not locale-based formatting. A simple custom formatter gives direct control.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Date/time formatting | Custom date parser | date-fns `format()` | Already used by useDateFormat, handles edge cases |
| Auth context access | Custom state management | Existing `useAuth()` hook | Single source of truth, already provides `refreshUser` |
| API calls for preferences | Custom fetch wrapper | Existing `PATCH /users/me/preferences` | Pattern established, works with `refreshUser()` |

**Key insight:** This phase is almost entirely about threading new fields through existing infrastructure. There is very little new logic -- just new data flowing through established patterns.

## Common Pitfalls

### Pitfall 1: Missing a Layer When Adding Fields
**What goes wrong:** New column added to DB but not to repository scan, or added to entity but not to JSON response.
**Why it happens:** The user preference data flows through 7+ layers (migration -> sqlc models -> repository scan -> entity -> service -> handler DTO -> API JSON). Missing any one layer causes runtime errors or silent data loss.
**How to avoid:** Follow the checklist in Pattern 1 above. After making changes, test the full round-trip: save preference via API, then GET /users/me and verify the new field appears in the response.
**Warning signs:** Compile errors (good -- caught early), or preference saving but not appearing in frontend (bad -- layer missed).

### Pitfall 2: Forgetting to Regenerate sqlc
**What goes wrong:** SQL queries updated but generated Go code is stale.
**Why it happens:** sqlc generates code from SQL files. After modifying `users.sql`, must run `mise run sqlc`.
**How to avoid:** Run `mise run sqlc` after any SQL query changes. The generated code lives in `internal/infra/queries/` -- but note that this project uses the hand-written repository (`user_repository.go`) not the generated queries directly for user operations. Still, regenerating ensures the models stay in sync with schema.
**Warning signs:** Generated `AuthUser` struct in `models.go` doesn't have the new fields.

### Pitfall 3: Conflicting Thousand/Decimal Separator
**What goes wrong:** User selects period as both thousand separator AND decimal separator.
**Why it happens:** No validation prevents conflicting choices.
**How to avoid:** Add validation either in the backend `UpdatePreferences` method or in the frontend hook. If `thousandSep === decimalSep`, either reject or auto-adjust. The requirements specify thousand separator options (comma/period/space) and decimal separator options (period/comma) -- a simple check that they differ suffices.
**Warning signs:** Numbers display ambiguously (e.g., "1.234" -- is it one thousand two hundred thirty-four, or one point two three four?).

### Pitfall 4: Empty String vs Missing Field in PATCH
**What goes wrong:** Sending `{"time_format": ""}` resets the preference to empty instead of leaving it unchanged.
**Why it happens:** The existing `UpdatePreferences` method in `entity.go` only updates if the string is non-empty (`if dateFormat != "" { ... }`). This is correct behavior -- empty string means "don't change". But callers must understand this convention.
**How to avoid:** Follow the same pattern: new fields use the same `if value != "" { u.field = value }` guard.
**Warning signs:** Saving one preference resets another to its default.

### Pitfall 5: Frontend Type Not Updated
**What goes wrong:** Backend returns new fields in JSON, but frontend `User` interface doesn't declare them, so TypeScript doesn't know they exist.
**Why it happens:** Frontend `User` interface in `auth.ts` must be manually updated to match backend `UserResponse`.
**How to avoid:** Add `time_format`, `thousand_separator`, `decimal_separator` to the frontend `User` interface in `frontend/lib/api/auth.ts`.
**Warning signs:** Hook reads `user?.time_format` and gets `undefined` even after saving because TypeScript allows it (property access on `any`-like types).

## Code Examples

### Migration (010_format_preferences.sql)

```sql
-- migrate:up
ALTER TABLE auth.users
  ADD COLUMN time_format VARCHAR(10) NOT NULL DEFAULT '24h',
  ADD COLUMN thousand_separator VARCHAR(5) NOT NULL DEFAULT ',',
  ADD COLUMN decimal_separator VARCHAR(5) NOT NULL DEFAULT '.';

COMMENT ON COLUMN auth.users.time_format IS
'User''s preferred time format: 12h or 24h';

COMMENT ON COLUMN auth.users.thousand_separator IS
'User''s preferred thousand separator for number display: comma, period, or space';

COMMENT ON COLUMN auth.users.decimal_separator IS
'User''s preferred decimal separator for number display: period or comma';

-- migrate:down
ALTER TABLE auth.users
  DROP COLUMN time_format,
  DROP COLUMN thousand_separator,
  DROP COLUMN decimal_separator;
```

### Entity Extension (entity.go additions)

```go
// Add to User struct:
timeFormat         string
thousandSeparator  string
decimalSeparator   string

// Add to NewUser defaults:
timeFormat:        "24h",
thousandSeparator: ",",
decimalSeparator:  ".",

// Add to Reconstruct parameters and assignment

// Add getters:
func (u *User) TimeFormat() string        { return u.timeFormat }
func (u *User) ThousandSeparator() string { return u.thousandSeparator }
func (u *User) DecimalSeparator() string  { return u.decimalSeparator }

// Extend UpdatePreferences:
func (u *User) UpdatePreferences(dateFormat, language, theme, timeFormat, thousandSeparator, decimalSeparator string) {
    if dateFormat != ""         { u.dateFormat = dateFormat }
    if language != ""           { u.language = language }
    if theme != ""              { u.theme = theme }
    if timeFormat != ""         { u.timeFormat = timeFormat }
    if thousandSeparator != ""  { u.thousandSeparator = thousandSeparator }
    if decimalSeparator != ""   { u.decimalSeparator = decimalSeparator }
    u.updatedAt = time.Now()
}
```

### Handler DTO Extension (handler.go)

```go
// UserResponse - add fields:
type UserResponse struct {
    ID                uuid.UUID `json:"id"`
    Email             string    `json:"email"`
    FullName          string    `json:"full_name"`
    DateFormat        string    `json:"date_format"`
    TimeFormat        string    `json:"time_format"`
    ThousandSeparator string    `json:"thousand_separator"`
    DecimalSeparator  string    `json:"decimal_separator"`
    Language          string    `json:"language"`
    Theme             string    `json:"theme"`
    AvatarURL         *string   `json:"avatar_url,omitempty"`
}

// UpdatePrefsRequestBody - add fields:
type UpdatePrefsRequestBody struct {
    DateFormat        string `json:"date_format,omitempty"`
    TimeFormat        string `json:"time_format,omitempty"`
    ThousandSeparator string `json:"thousand_separator,omitempty"`
    DecimalSeparator  string `json:"decimal_separator,omitempty"`
    Language          string `json:"language,omitempty"`
    Theme             string `json:"theme,omitempty"`
}
```

### Frontend User Type Extension (auth.ts)

```typescript
export interface User {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  date_format: string;
  time_format: string;         // "12h" | "24h"
  thousand_separator: string;  // "," | "." | " "
  decimal_separator: string;   // "." | ","
  language: string;
  theme: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}
```

### useTimeFormat Hook

```typescript
"use client";
import { useCallback, useMemo } from "react";
import { format as dateFnsFormat, parseISO, isValid } from "date-fns";
import { useAuth } from "@/lib/contexts/auth-context";

export type TimeFormatOption = "12h" | "24h";
const DEFAULT_TIME_FORMAT: TimeFormatOption = "24h";

export interface UseTimeFormatReturn {
  format: TimeFormatOption;
  formatTime: (date: Date | string | null | undefined) => string;
  timeFormatString: string; // date-fns format string: "HH:mm" or "h:mm a"
}

export function useTimeFormat(): UseTimeFormatReturn {
  const { user } = useAuth();

  const format = useMemo<TimeFormatOption>(() => {
    const pref = user?.time_format as TimeFormatOption | undefined;
    return pref === "12h" || pref === "24h" ? pref : DEFAULT_TIME_FORMAT;
  }, [user?.time_format]);

  const timeFormatString = format === "12h" ? "h:mm a" : "HH:mm";

  const formatTime = useCallback(
    (date: Date | string | null | undefined): string => {
      if (!date) return "-";
      try {
        const dateObj = typeof date === "string" ? parseISO(date) : date;
        if (!isValid(dateObj)) return "-";
        return dateFnsFormat(dateObj, timeFormatString);
      } catch {
        return "-";
      }
    },
    [timeFormatString]
  );

  return { format, formatTime, timeFormatString };
}
```

### useNumberFormat Hook

```typescript
"use client";
import { useCallback, useMemo } from "react";
import { useAuth } from "@/lib/contexts/auth-context";

export type ThousandSeparator = "," | "." | " ";
export type DecimalSeparator = "." | ",";

const DEFAULT_THOUSAND_SEP: ThousandSeparator = ",";
const DEFAULT_DECIMAL_SEP: DecimalSeparator = ".";

export interface UseNumberFormatReturn {
  thousandSeparator: ThousandSeparator;
  decimalSeparator: DecimalSeparator;
  formatNumber: (value: number, decimals?: number) => string;
  parseNumber: (formatted: string) => number | null;
}

export function useNumberFormat(): UseNumberFormatReturn {
  const { user } = useAuth();

  const thousandSeparator = useMemo<ThousandSeparator>(() => {
    const pref = user?.thousand_separator;
    if (pref === "," || pref === "." || pref === " ") return pref;
    return DEFAULT_THOUSAND_SEP;
  }, [user?.thousand_separator]);

  const decimalSeparator = useMemo<DecimalSeparator>(() => {
    const pref = user?.decimal_separator;
    if (pref === "." || pref === ",") return pref;
    return DEFAULT_DECIMAL_SEP;
  }, [user?.decimal_separator]);

  const formatNumber = useCallback(
    (value: number, decimals?: number): string => {
      const parts = decimals !== undefined
        ? value.toFixed(decimals).split(".")
        : value.toString().split(".");
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, thousandSeparator);
      return parts.length > 1
        ? `${parts[0]}${decimalSeparator}${parts[1]}`
        : parts[0];
    },
    [thousandSeparator, decimalSeparator]
  );

  const parseNumber = useCallback(
    (formatted: string): number | null => {
      // Remove thousand separators, replace decimal separator with period
      const cleaned = formatted
        .replaceAll(thousandSeparator, "")
        .replace(decimalSeparator, ".");
      const num = Number(cleaned);
      return isNaN(num) ? null : num;
    },
    [thousandSeparator, decimalSeparator]
  );

  return { thousandSeparator, decimalSeparator, formatNumber, parseNumber };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Locale-based formatting (Intl.NumberFormat) | Explicit user choice | This project's design | Direct control over separators, no locale guessing |
| Single preference endpoint per setting | Batch preference update (PATCH with optional fields) | Established in v1.5 | Fewer API calls, simpler UX |

**Deprecated/outdated:**
- None relevant. The patterns in this codebase are current and well-established.

## Open Questions

1. **Should conflicting separators be validated server-side?**
   - What we know: If thousand_separator and decimal_separator are the same, numbers become ambiguous (e.g., "1.234.56" with both as period).
   - What's unclear: Should the backend reject this, or should the frontend prevent it via UI constraints, or both?
   - Recommendation: Validate in the backend's `UpdatePreferences` method. Return 400 if `thousandSeparator == decimalSeparator` and both are non-empty. Also prevent via UI in Phase 31 (settings UI). This is a minor concern for Phase 30 since the defaults (comma/period) don't conflict.

2. **Should the `UpdatePreferences` method signature change?**
   - What we know: Currently it takes `(dateFormat, language, theme string)` as positional args. Adding 3 more positional strings is unwieldy.
   - What's unclear: Should we refactor to pass a struct instead?
   - Recommendation: The `UpdatePreferencesInput` struct already exists in `service.go`. The entity method should either accept that struct or be refactored. Since the entity method currently takes positional args, the cleanest approach is to extend the positional args for consistency. Alternatively, refactor to accept a struct -- either approach works. The service layer already uses `UpdatePreferencesInput` struct, so adding fields there is clean.

## Sources

### Primary (HIGH confidence)
- Codebase inspection: `backend/internal/domain/auth/user/entity.go` -- User entity with existing preference fields
- Codebase inspection: `backend/internal/domain/auth/user/handler.go` -- Handler DTOs and preferences endpoint
- Codebase inspection: `backend/internal/domain/auth/user/service.go` -- Service layer with UpdatePreferencesInput
- Codebase inspection: `backend/internal/infra/postgres/user_repository.go` -- Repository with scan/save patterns
- Codebase inspection: `backend/db/queries/users.sql` -- SQL queries for user operations
- Codebase inspection: `backend/db/migrations/001_initial_schema.sql` -- Current users table schema
- Codebase inspection: `frontend/lib/hooks/use-date-format.ts` -- Existing preference hook pattern
- Codebase inspection: `frontend/lib/api/auth.ts` -- Frontend User type definition
- Codebase inspection: `frontend/lib/contexts/auth-context.tsx` -- Auth context providing user data

### Secondary (MEDIUM confidence)
- date-fns format documentation -- time format strings `HH:mm` (24h) and `h:mm a` (12h) are well-documented standard patterns

### Tertiary (LOW confidence)
- None. All findings based on direct codebase inspection.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already in use, no new dependencies
- Architecture: HIGH - exact patterns established by date_format, repeatable
- Pitfalls: HIGH - pitfalls identified from direct code inspection of multi-layer data flow

**Research date:** 2026-02-08
**Valid until:** 2026-03-08 (stable -- patterns are internal to this codebase)
