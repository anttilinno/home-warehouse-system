---
phase: 52-dashboard
reviewed: 2026-04-11T00:00:00Z
depth: standard
files_reviewed: 19
files_reviewed_list:
  - frontend2/locales/en/messages.po
  - frontend2/locales/et/messages.po
  - frontend2/src/components/layout/Sidebar.tsx
  - frontend2/src/components/layout/index.ts
  - frontend2/src/features/auth/AuthContext.tsx
  - frontend2/src/features/auth/__tests__/AuthContext.test.tsx
  - frontend2/src/features/dashboard/ActivityFeed.tsx
  - frontend2/src/features/dashboard/DashboardPage.tsx
  - frontend2/src/features/dashboard/QuickActionCards.tsx
  - frontend2/src/features/dashboard/StatPanel.tsx
  - frontend2/src/features/dashboard/__tests__/DashboardPage.test.tsx
  - frontend2/src/features/items/ItemsPage.tsx
  - frontend2/src/features/loans/LoansPage.tsx
  - frontend2/src/features/scan/ScanPage.tsx
  - frontend2/src/features/settings/SettingsPage.tsx
  - frontend2/src/features/setup/SetupPage.tsx
  - frontend2/src/lib/types.ts
  - frontend2/src/routes/index.tsx
  - frontend2/vitest.config.ts
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 52: Code Review Report

**Reviewed:** 2026-04-11T00:00:00Z
**Depth:** standard
**Files Reviewed:** 19
**Status:** issues_found

## Summary

This phase introduces the dashboard page (stats, activity feed, quick action cards), integrates workspaceId resolution into AuthContext, adds a Sidebar nav, and wires up stub pages for Items/Loans/Scan/Settings. The overall structure is clean and follows consistent patterns throughout.

Three warnings were found: an SSE URL that uses a different base path prefix than the REST API client (likely causing 404 in production), a type definition mismatch where `entity_name` is typed as `string | undefined` but the test fixture and runtime branch handle `null`, and transient network errors in `loadUser` incorrectly clearing the refresh token. Three info items cover untranslated strings in NotFoundPage, a redundant vitest globals pattern, and a test fixture type inconsistency.

## Warnings

### WR-01: SSE URL uses `/api/` prefix — inconsistent with REST calls

**File:** `frontend2/src/features/dashboard/ActivityFeed.tsx:46`

**Issue:** The SSE `EventSource` is constructed with `/api/workspaces/${workspaceId}/sse` (hardcoded `/api/` prefix), while the REST `get()` call at line 31 uses `/workspaces/${workspaceId}/analytics/activity` (no prefix). The API client library (`@/lib/api`) controls the base URL and proxy configuration for REST calls. Mixing a hardcoded `/api/` prefix for SSE with the client-managed prefix for REST will cause one or both to be routed incorrectly — likely the SSE connection fails in production (or in dev if the Vite proxy maps differently).

**Fix:** Use the same base URL strategy for SSE as for REST. If the api client exposes a base URL or there is a shared constant, derive the SSE URL from it. At minimum, align the prefix:

```typescript
// If REST calls go through /api (Vite proxy strips it), SSE should too:
const sseUrl = `/api/workspaces/${workspaceId}/sse`;

// If REST calls do NOT have /api prefix, remove it from SSE:
const sseUrl = `/workspaces/${workspaceId}/sse`;
```

Check the Vite proxy config and `@/lib/api` base URL to determine which form is correct, then use it consistently.

---

### WR-02: `RecentActivity.entity_name` typed as `string | undefined` but `null` is used at runtime

**File:** `frontend2/src/lib/types.ts:69` and `frontend2/src/features/dashboard/ActivityFeed.tsx:14`

**Issue:** `RecentActivity.entity_name` is declared as `entity_name?: string` (i.e. `string | undefined`). However the test fixture at `DashboardPage.test.tsx:196` passes `entity_name: null`, and the backend API likely returns `null` for missing names (standard JSON null). The truthiness check `if (entry.entity_name)` at `ActivityFeed.tsx:14` handles `null` correctly at runtime in JavaScript, but the TypeScript type is wrong — TypeScript will not flag passing `null` through `entity_name` if the consumer ever accesses `.length` or similar without a null-guard, and it allows the test fixture type error to go unnoticed.

**Fix:** Update the type to allow `null` explicitly:

```typescript
// frontend2/src/lib/types.ts
export interface RecentActivity {
  id: string;
  user_id?: string;
  action: string;
  entity_type: string;
  entity_id: string;
  entity_name?: string | null;   // null is valid from API
  created_at: string;
}
```

---

### WR-03: Transient network error in `loadUser` clears refresh token, causing spurious logout

**File:** `frontend2/src/features/auth/AuthContext.tsx:54-58`

**Issue:** The `catch` block in `loadUser` calls `setRefreshToken(null)` unconditionally on any error. This means a brief network interruption (DNS timeout, server restart, mobile losing signal) during the `/users/me` check will permanently clear the refresh token and log the user out. The intent is likely to clear only on a definitive authentication failure (401/403), not on network errors.

```typescript
// Current: clears token on ALL errors including network failures
} catch {
  setUser(null);
  setWorkspaceId(null);
  setRefreshToken(null);  // <-- clears on ECONNREFUSED, timeout, etc.
}
```

**Fix:** Inspect the error type or HTTP status before clearing the token. The API client likely throws a typed error or includes a status code:

```typescript
} catch (err) {
  setUser(null);
  setWorkspaceId(null);
  // Only clear token on auth errors, not transient network failures
  const status = (err as { status?: number })?.status;
  if (!status || status === 401 || status === 403) {
    setRefreshToken(null);
  }
}
```

The exact shape depends on what `@/lib/api` throws on HTTP errors vs. network errors. If the API client always wraps network errors with a distinguishable type, use that instead.

---

## Info

### IN-01: `NotFoundPage` in `routes/index.tsx` contains untranslated strings

**File:** `frontend2/src/routes/index.tsx:20-29`

**Issue:** "SECTOR NOT FOUND", "The requested area does not exist. Return to base.", and "RETURN TO BASE" are hardcoded strings not wrapped in `t\`\`` or added to the message catalog. All other UI strings in this codebase use Lingui i18n. This is inconsistent and will break when a non-English locale is active.

**Fix:** Import `useLingui` and wrap the strings:

```typescript
import { useLingui } from "@lingui/react/macro";

function NotFoundPage() {
  const { t } = useLingui();
  return (
    // ...
    <h1>{t`SECTOR NOT FOUND`}</h1>
    <p>{t`The requested area does not exist. Return to base.`}</p>
    <Link ...>{t`RETURN TO BASE`}</Link>
  );
}
```

Also add the corresponding entries to both `.po` files.

---

### IN-02: `vitest.config.ts` sets `globals: true` but tests import vitest APIs explicitly

**File:** `frontend2/vitest.config.ts:19` and test files

**Issue:** With `globals: true`, vitest injects `describe`, `it`, `expect`, `vi`, `beforeEach` etc. as globals, making explicit imports unnecessary. All test files still import them explicitly (e.g., `import { describe, it, expect, vi, beforeEach } from "vitest"`). This is redundant — the imports are harmless but add visual noise and can confuse readers about which pattern is authoritative.

**Fix:** Either remove `globals: true` from `vitest.config.ts` (keep explicit imports — preferred for IDE type inference without `@types/vitest`) or remove the explicit imports from test files. Keeping explicit imports and dropping `globals: true` is the more explicit and IDE-friendly choice.

---

### IN-03: Test fixture `entity_name: null` does not match TypeScript type

**File:** `frontend2/src/features/dashboard/__tests__/DashboardPage.test.tsx:196`

**Issue:** The `fakeActivity` fixture sets `entity_name: null` for the second entry. The `RecentActivity` type declares `entity_name?: string` (string or undefined, not null). TypeScript should flag this as a type error, suggesting the type declarations are not strictly checked in the test environment or the test fixture is typed loosely. This is a related consequence of WR-02.

**Fix:** Once WR-02 is addressed (changing the type to `string | null | undefined`), this fixture will type-check correctly without modification. No separate fix needed beyond WR-02.

---

_Reviewed: 2026-04-11T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
