---
phase: 49-auth-api-client
reviewed: 2026-04-11T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - frontend2/src/lib/__tests__/api.test.ts
  - frontend2/vite.config.ts
  - frontend2/locales/en/messages.po
  - frontend2/locales/et/messages.po
findings:
  critical: 0
  warning: 2
  info: 2
  total: 4
status: issues_found
---

# Phase 49: Code Review Report

**Reviewed:** 2026-04-11T00:00:00Z
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Four files reviewed: the API client test suite, the Vite build configuration, and the English and Estonian i18n PO catalogs. The Vite config is clean and correct. The English catalog is complete with no untranslated strings. The test suite is well-structured and covers the key scenarios (happy path, 401 refresh, concurrent deduplication, 204 no-content), but has a non-deterministic ordering assumption in the concurrent-401 test and a missing assertion for a critical post-refresh-failure invariant. The Estonian catalog has several words with missing diacritics that will render incorrectly for native Estonian users.

## Warnings

### WR-01: Non-deterministic fetch call ordering in concurrent-401 test

**File:** `frontend2/src/lib/__tests__/api.test.ts:102-130`

**Issue:** The test launches two concurrent requests (`/a` and `/b`) with `Promise.all` and then filters `mockFetch.mock.calls` to count refresh calls. The result assertions (`resultA` / `resultB`) rely on `Promise.all` resolving in array-position order, which is correct for resolved values. However, the ordering of the *two initial fetch calls* (calls [0] and [1]) is determined by microtask scheduling, not by argument order to `Promise.all`. If the implementation ever changes its internal scheduling the mock queue — which maps positional responses to calls — could deliver the wrong response to the wrong request, causing a flaky or silently-wrong test.

**Fix:** Pin the test to a model that does not depend on call-order. One safe approach is to use a `mockImplementation` that dispatches responses based on the URL argument rather than position:

```ts
mockFetch.mockImplementation(async (url: string) => {
  if ((url as string).includes("/auth/refresh")) {
    return makeResponse(200, { token: "t2", refresh_token: "rt2" });
  }
  if ((url as string) === "/api/a") {
    // first call: 401; subsequent: 200
    return callCount["/api/a"]++ === 0
      ? makeResponse(401, {})
      : makeResponse(200, { name: "a" });
  }
  // similar for /api/b
});
```

Alternatively, add an explicit assertion that both retried calls used the correct URLs rather than relying solely on positional mock slots.

---

### WR-02: Missing assertion that refresh token is cleared after refresh failure

**File:** `frontend2/src/lib/__tests__/api.test.ts:132-142`

**Issue:** The test verifies that a failed refresh causes `get()` to reject with `"Session expired"`, but it does not assert that the stored refresh token is cleared (nulled) after the failure. If the API client retains a stale/expired refresh token in memory after a 401-on-refresh, subsequent calls will repeatedly attempt to refresh with the invalid token rather than surfacing the session-expired error immediately. This is a correctness invariant that the test suite should cover.

**Fix:** Add an assertion at the end of the test:

```ts
await expect(get("/fail")).rejects.toThrow("Session expired");
// Verify the stale token is not retained
expect(getRefreshToken()).toBeNull();
```

---

## Info

### IN-01: Missing diacritics in Estonian translations

**File:** `frontend2/locales/et/messages.po:26,32,45,63,67,71,83,131`

**Issue:** Several Estonian `msgstr` values use ASCII approximations that omit Estonian-specific diacritics (õ, ä, ö, ü). These will display as incorrect Estonian to native readers. Known instances:

| Line | Current | Should be |
|------|---------|-----------|
| 26 | `AUTENTIMINE EBAONNESTUS` | `AUTENTIMINE EBAÕNNESTUS` |
| 32 | `Autentimine ebaonnestus.` | `Autentimine ebaõnnestus.` |
| 45 | `Uhendus ebaonnestus.` | `Ühendus ebaõnnestus.` |
| 63 | `Taisnimi` | `Täisnimi` |
| 67 | `TAISNIMI` | `TÄISNIMI` |
| 71 | `Vale e-post voi parool.` | `Vale e-post või parool.` |
| 83 | `VOI` | `VÕI` |
| 131 | `Midagi laks valesti.` | `Midagi läks valesti.` |

**Fix:** Replace the ASCII approximations with the correct Unicode characters. Example for line 26:

```po
msgstr "AUTENTIMINE EBAÕNNESTUS"
```

---

### IN-02: No test for `401` when no refresh token is set

**File:** `frontend2/src/lib/__tests__/api.test.ts`

**Issue:** The test suite covers the 401 path only when a refresh token is available (`setRefreshToken("rt1")`). There is no test for the case where a `401` is received but `getRefreshToken()` returns `null` — i.e., the user was never authenticated or the token was already cleared. The expected behavior (throw immediately vs. attempt a token-less refresh) is unverified.

**Fix:** Add a test case:

```ts
it("401 with no refresh token throws immediately", async () => {
  // refreshToken is already null from beforeEach
  const mockFetch = vi.mocked(fetch);
  mockFetch.mockResolvedValueOnce(makeResponse(401, {}));

  await expect(get("/protected")).rejects.toThrow(/* expected message */);
  expect(mockFetch).toHaveBeenCalledTimes(1); // no refresh attempt
});
```

---

_Reviewed: 2026-04-11T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
