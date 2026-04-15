---
phase: 56
status: issues-found
findings_count: 5
blocking: 2
advisory: 3
---

# Phase 56: Code Review — Foundation API Client and React Query

**Reviewed:** 2026-04-15
**Depth:** standard
**Files reviewed:** 18

## Summary

Phase 56 introduces a FormData-aware `request()` function, a `QueryClient` singleton, seven domain API modules with query-key factories, an `ApiDemoPage`, an updated route table, and a `check-forbidden-imports` CI guard. The overall structure is clean and consistent. Two blocking issues were found: a race condition in the token-refresh path that can allow concurrent requests to each trigger a separate refresh attempt, and a path-argument mismatch in the `lint:imports` npm script. Three advisory items cover a type-unsafe cast in the refresh handler, duplicated `toQuery` helpers across domain modules, and an unguarded route on the demo page.

---

## Blocking Issues

### BL-01: Token-refresh race condition — concurrent 401s each race to start a new refresh

**File:** `frontend2/src/lib/api.ts:83-102`

The `refreshPromise` singleton correctly coalesces concurrent refresh calls **for requests that arrive while a refresh is already in flight**. However, it does not prevent two requests that both receive a 401 simultaneously from each checking `if (!refreshPromise)` before either has set it. Because `refreshPromise` is only assigned after the first caller enters the branch (`refreshPromise = doRefresh()`), a second concurrent 401 evaluated in the same microtask queue tick will also see `null` and start a second `doRefresh()`.

`doRefresh()` POSTs to `/auth/refresh` with the current `storedRefreshToken`. If two calls race through simultaneously, the first successful response rotates `storedRefreshToken` to `new-token-A`; the second call, which used the old token, will likely get a 401 from the refresh endpoint, zero out `storedRefreshToken`, and then propagate `"Session expired"` — logging the user out despite a valid session.

**Fix:** Replace the module-level variable approach with a promise that is set synchronously before any `await`:

```ts
// Existing pattern — window opens between null-check and assignment
if (!refreshPromise) {
  refreshPromise = doRefresh();   // two callers can both reach here
}

// Safe pattern: the assignment is still synchronous, but make the
// guard unconditional for callers that arrive *before* the first
// doRefresh() resolves.  The key insight is that this already works
// correctly when requests arrive *during* a refresh — the only gap
// is simultaneous arrivals in the same tick.
//
// Minimal fix: wrap doRefresh in a closure that always resets the slot,
// and ensure no other code path can clear it while it is pending:

if (!refreshPromise) {
  refreshPromise = doRefresh().finally(() => {
    refreshPromise = null;
  });
}
try {
  await refreshPromise;
} catch (err) {
  throw err;
}
// Remove the manual `refreshPromise = null` lines that appear after
// the try/catch — they are now handled in the .finally() above and
// the current placement could null the slot prematurely if more than
// two concurrent callers are waiting.
```

The current manual `refreshPromise = null` assignments on lines 91 and 93 are also fragile: line 91 (in the catch block) nulls the slot before waiting callers resume, meaning the third concurrent caller would start yet another refresh.

---

### BL-02: `lint:imports` script passes a relative path — breaks when run from a non-`frontend2` cwd

**File:** `frontend2/package.json:12`

```json
"lint:imports": "node ../scripts/check-forbidden-imports.mjs src",
```

`check-forbidden-imports.mjs` resolves the scan root via `resolve(process.argv[2] || ...)`. When `process.argv[2]` is the bare string `"src"`, `resolve("src")` expands relative to `process.cwd()`, not relative to the script or the package. This works when `bun run lint:imports` is invoked from inside `frontend2/` (because bun/npm change cwd to the package root before running scripts). However:

1. Running `node ../scripts/check-forbidden-imports.mjs src` from the repo root resolves `src` to `/home/antti/Repos/Misc/home-warehouse-system/src`, which does not exist — the script will silently scan nothing and exit 0.
2. The `prebuild` hook inherits this same vulnerability; a CI runner that builds from the repo root would skip the guard without warning.

**Fix:** In `check-forbidden-imports.mjs`, resolve the CLI argument relative to `cwd()` explicitly and add a guard if the resolved path does not exist:

```js
import { existsSync } from "node:fs";

const rawArg = process.argv[2];
const SCAN_ROOT = rawArg
  ? resolve(process.cwd(), rawArg)        // explicit cwd-relative
  : resolve(REPO_ROOT, "frontend2", "src"); // default

if (!existsSync(SCAN_ROOT)) {
  console.error(`check-forbidden-imports: scan root does not exist: ${SCAN_ROOT}`);
  process.exit(1);
}
```

This makes a wrong path a hard failure rather than a silent pass-through.

---

## Advisory Items

### AD-01: Unsafe cast of `options.headers` swallows `HeadersInit` variants

**File:** `frontend2/src/lib/api.ts:74`

```ts
...(options.headers as Record<string, string>),
```

`RequestInit.headers` is typed `HeadersInit`, which is `string[][] | Record<string, string> | Headers`. The cast to `Record<string, string>` is only safe for the plain-object variant. If a caller passes a `Headers` instance or a `string[][]`, the spread produces an empty object silently, dropping all caller-supplied headers. For the current codebase this is not exercised, but the type signature advertises safety it does not provide.

**Suggestion:** Narrow to `Record<string, string>` in the function signature, or convert to `Headers` unconditionally:

```ts
async function request<T>(
  endpoint: string,
  options: Omit<RequestInit, "headers"> & { headers?: Record<string, string> } = {}
): Promise<T> {
```

This eliminates the cast entirely and makes the constraint explicit to callers.

---

### AD-02: `toQuery` helper is duplicated across five domain modules

**Files:**
- `frontend2/src/lib/api/items.ts:73-79`
- `frontend2/src/lib/api/loans.ts:44-50`
- `frontend2/src/lib/api/borrowers.ts:38-44`
- `frontend2/src/lib/api/categories.ts:36-42`
- `frontend2/src/lib/api/locations.ts:42-48`
- `frontend2/src/lib/api/containers.ts:45-51`

All six copies are byte-for-byte identical. Any future change (e.g., handling boolean serialisation differently) must be applied six times.

**Suggestion:** Extract to `frontend2/src/lib/api/utils.ts` and import from there:

```ts
// utils.ts
export function toQuery(params: Record<string, unknown>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params))
    if (v !== undefined && v !== null) sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : "";
}
```

---

### AD-03: `ApiDemoPage` is reachable unauthenticated but silently fetches with a non-null assertion

**File:** `frontend2/src/pages/ApiDemoPage.tsx:14`

```ts
queryFn: () => itemsApi.list(workspaceId!, params),
```

The non-null assertion on `workspaceId!` is guarded by `enabled: !!workspaceId`, so React Query will not call `queryFn` when `workspaceId` is falsy. This is safe in practice. However, the route is public (`/rq-demo` has no `RequireAuth` wrapper — `routes/index.tsx:53`) and the comment on line 29 of `ApiDemoPage.tsx` acknowledges this. If `queryFn` is ever invoked outside of React Query's `enabled` check (e.g., via `query.refetch()` while `workspaceId` is still null), the assertion will throw and produce an unhandled error rather than a user-visible message.

The `Retry fetch` button on line 54 calls `query.refetch()` unconditionally. If `workspaceId` is null, React Query respects `enabled: false` during an automatic refetch but **will execute `queryFn` on a manual `.refetch()` call** regardless of `enabled`.

**Suggestion:** Replace the non-null assertion with an early return in `queryFn`:

```ts
queryFn: () => {
  if (!workspaceId) return Promise.reject(new Error("Not authenticated"));
  return itemsApi.list(workspaceId, params);
},
```

The `Retry fetch` button is already conditionally rendered only when `workspaceId && query.isError`, so the risk is low in the current UI — but the API contract of `workspaceId!` is fragile for future maintainers.

---

_Reviewed: 2026-04-15_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
