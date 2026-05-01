---
phase: 01-foundation-conflict-spikes
reviewed: 2026-05-01T22:30:00Z
depth: standard
files_reviewed: 23
files_reviewed_list:
  - frontend2/package.json
  - frontend2/vite.config.ts
  - frontend2/vitest.config.ts
  - frontend2/playwright.config.ts
  - frontend2/tsconfig.json
  - frontend2/tsconfig.app.json
  - frontend2/tsconfig.node.json
  - frontend2/index.html
  - frontend2/src/main.tsx
  - frontend2/src/App.tsx
  - frontend2/src/routes/index.tsx
  - frontend2/src/lib/api.ts
  - frontend2/src/lib/queryClient.ts
  - frontend2/src/lib/types.ts
  - frontend2/src/styles/globals.css
  - frontend2/src/test-utils.tsx
  - frontend2/src/vite-env.d.ts
  - frontend2/src/lib/i18n.ts
  - frontend2/lingui.config.ts
  - frontend2/src/locales/en/messages.po
  - frontend2/src/locales/et/messages.po
  - frontend2/src/locales/ru/messages.po
  - .github/workflows/lint-frontend2.yml
  - scripts/verify-phase-01-scaffold.sh
findings:
  critical: 0
  warning: 5
  info: 2
  total: 7
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-05-01T22:30:00Z
**Depth:** standard
**Files Reviewed:** 23
**Status:** issues_found

## Summary

Phase 1 scaffold is structurally sound. The provider stack, router, API client, i18n runtime, and build toolchain are all wired correctly. No security vulnerabilities or data-loss bugs were found. Five warnings require attention before later phases build on this foundation: two involve silent correctness failures in the API client, two are type-checking coverage gaps that could let config-file regressions pass CI undetected, and one is a verify-script false-pass risk. Two info items flag non-deterministic dependency pins.

---

## Warnings

### WR-01: `post()` silently drops a defined but falsy body

**File:** `frontend2/src/lib/api.ts:133-137`
**Issue:** The body guard uses a truthiness check (`data ? JSON.stringify(data) : undefined`) rather than an explicit `undefined` check. Any caller passing `null`, `0`, `false`, or an empty string as `data` gets a POST with no body instead of a POST with `null`/`0`/`false` serialised. This is a silent data-loss failure — the call succeeds (no exception), but the wrong payload reaches the server. `null` is the most realistic trigger (e.g., `post<void>('/logout', null)` to signal an explicit empty body).

**Fix:**
```typescript
export function post<T>(endpoint: string, data?: unknown): Promise<T> {
  return request<T>(endpoint, {
    method: "POST",
    body: data !== undefined ? JSON.stringify(data) : undefined,
  });
}
```

---

### WR-02: `parseResponse` unsafely casts `undefined` to the generic type `T`

**File:** `frontend2/src/lib/api.ts:59-65`
**Issue:** When the response lacks a `Content-Type: application/json` header, `parseResponse` returns `undefined as T`. This type assertion is a lie: the TypeScript type says the caller receives a `T`, but at runtime they receive `undefined`. Any consumer that immediately accesses a property on the result (e.g., `const r = await get<User>('/profile'); console.log(r.id)`) will throw a runtime TypeError with no indication from the type system. The `del<void>` case is fine, but `get<T>`, `post<T>`, and `patch<T>` all pass through the same code path.

**Fix:** Return `undefined` explicitly typed, or narrow the return type of `parseResponse` to `T | undefined` and propagate that to the public helpers:
```typescript
async function parseResponse<T>(response: Response): Promise<T | undefined> {
  const contentType = response.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    return undefined;
  }
  return response.json() as Promise<T>;
}
```
Public helpers whose callers always expect a body (`get`, `post`, `patch`) can then assert non-null at their own boundary, making the risk explicit and auditable.

---

### WR-03: `vitest.config.ts` and `lingui.config.ts` are excluded from TypeScript checking

**File:** `frontend2/tsconfig.node.json:18`
**Issue:** `tsconfig.node.json` only `include`s `vite.config.ts`. Neither `vitest.config.ts` nor `lingui.config.ts` is covered. The CI `typecheck-frontend2` job runs `tsc -b --noEmit`, which respects the project references in `tsconfig.json` — meaning both config files are silently excluded. A type-breaking change to either (e.g., a renamed Lingui config field in a version bump, or an invalid vitest option) will pass CI undetected until a developer runs the affected tool manually.

**Fix:**
```json
// tsconfig.node.json
{
  "include": ["vite.config.ts", "vitest.config.ts", "lingui.config.ts"]
}
```

---

### WR-04: CI workflow has no unit-test job; `bun run test` never runs in CI

**File:** `.github/workflows/lint-frontend2.yml`
**Issue:** The workflow contains two jobs: `forbidden-imports` (grep guard) and `typecheck-frontend2` (`tsc -b`). There is no job that runs `bun run test` (vitest). Unit tests are written and configured but are never executed automatically on pull requests or pushes to `master`. A regression in a tested code path would not block a merge.

**Fix:** Add a third job:
```yaml
unit-tests:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: oven-sh/setup-bun@v2
      with:
        bun-version: 1.3.13
    - run: cd frontend2 && bun install --frozen-lockfile
    - run: cd frontend2 && bun run test
```

---

### WR-05: `verify-phase-01-scaffold.sh` dev-server smoke gives a false pass if port 5173 is already occupied

**File:** `scripts/verify-phase-01-scaffold.sh:32-41`
**Issue:** The script starts a background Vite process (`bun run dev &`), sleeps 4 seconds, then curls `localhost:5173`. If port 5173 is already in use (developer has a dev server running), Vite exits immediately with a bind error. The `trap` cleanup silently swallows that (`kill "$DEVPID" 2>/dev/null || true`), and the `curl` succeeds against the pre-existing server. The smoke check reports PASS even though the script's own server never started. There is no check that Vite actually bound the port or that `$DEVPID` is still alive before curling.

**Fix:** Check that the background process is still alive before curling, or pre-check that port 5173 is free:
```bash
# Before starting the server:
if lsof -ti:5173 > /dev/null 2>&1; then
  echo "FAIL: port 5173 already in use — cannot run dev-server smoke" >&2
  exit 1
fi
bun run dev &> /tmp/vite-dev-smoke.log &
DEVPID=$!
# After sleep, verify the process is still running before curling:
if ! kill -0 "$DEVPID" 2>/dev/null; then
  echo "FAIL: Vite dev server exited early" >&2
  tail -50 /tmp/vite-dev-smoke.log >&2
  exit 1
fi
```

---

## Info

### IN-01: Four devDependencies pinned to `"latest"` — non-deterministic installs

**File:** `frontend2/package.json:39,41,46,47`
**Issue:** `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom`, and `rollup-plugin-visualizer` all use `"latest"` as their version specifier. A major version bump to any of these (especially `jest-dom` or `jsdom`, which have breaking changes between majors) will silently change behaviour on the next `bun install` run that does not use `--frozen-lockfile`. The lockfile (`bun.lock`) freezes the current resolution, but the intent encoded in `package.json` is misleading and any `bun install` without `--frozen-lockfile` (e.g., manual local installs, Dependabot) will pull the latest major.

**Fix:** Replace `"latest"` with the exact version currently resolved by the lockfile:
```json
"@testing-library/jest-dom": "^6.x.x",
"@testing-library/user-event": "^14.x.x",
"jsdom": "^25.x.x",
"rollup-plugin-visualizer": "^5.x.x"
```
(Substitute the actual versions from `bun.lock`.)

---

### IN-02: `SPECIFIER_RE` regex in `check-forbidden-imports.mjs` matches import strings inside comments

**File:** `scripts/check-forbidden-imports.mjs:22`
**Issue:** The regex `/(?:from|import)\s*\(?\s*["']([^"']+)["']/g` matches any occurrence of `from '...'` or `import('...')` in the file text, including inside block and line comments. A comment like `// previously imported from 'react-query-sync-adapter'` would trigger a false positive and break the CI guard. The risk is low given the current tiny codebase, but grows as the codebase scales and developer comments accumulate.

**Fix:** Either strip comments before applying the regex (e.g., using a proper AST parser such as `acorn`), or add a comment-line skip heuristic:
```javascript
for (const line of src.split('\n')) {
  const stripped = line.replace(/\/\/.*$/, ''); // strip line comments
  // then apply SPECIFIER_RE to `stripped`
}
```
Full block-comment stripping requires more work; a line-comment strip covers the majority of practical cases.

---

_Reviewed: 2026-05-01T22:30:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
