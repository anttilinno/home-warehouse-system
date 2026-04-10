---
phase: 49-auth-api-client
plan: 01
subsystem: frontend2-api-client
tags: [api-client, auth, fetch-wrapper, testing, vite-proxy]
dependency_graph:
  requires: []
  provides: [api-client, auth-types, test-infrastructure]
  affects: [frontend2/src/lib/api.ts, frontend2/src/lib/types.ts, frontend2/vite.config.ts]
tech_stack:
  added: ["@testing-library/react", "@testing-library/jest-dom", "jsdom"]
  patterns: [fetch-wrapper-with-refresh, concurrent-dedup-promise, vitest-jsdom]
key_files:
  created:
    - frontend2/src/lib/api.ts
    - frontend2/src/lib/types.ts
    - frontend2/src/lib/__tests__/api.test.ts
    - frontend2/src/test-utils.tsx
  modified:
    - frontend2/vite.config.ts
    - frontend2/package.json
decisions:
  - "D-07 lightweight fetch wrapper: no axios/ky, plain fetch with credentials: include"
  - "In-memory refresh token storage; access_token survives via HttpOnly cookie"
  - "Concurrent 401 deduplication via shared promise pattern"
metrics:
  duration: 104s
  completed: "2026-04-10"
  tasks_completed: 2
  tasks_total: 2
  tests_added: 7
---

# Phase 49 Plan 01: API Client & Auth Types Summary

Lightweight fetch-based API client with 401 refresh-retry deduplication, shared auth types, and Vite proxy fix for backend routing.

## What Was Built

### Task 1: Vite Proxy Fix & Shared Auth Types
- Fixed Vite dev proxy to rewrite `/api` prefix so `/api/auth/login` routes to `http://localhost:8080/auth/login`
- Created `lib/types.ts` exporting `User`, `AuthTokenResponse`, `RegisterData`, `ApiError` interfaces matching backend response shapes

### Task 2: API Client & Test Infrastructure (TDD)
- Built `lib/api.ts` fetch wrapper exporting `get`, `post`, `patch`, `del` functions
- All requests use `credentials: "include"` for HttpOnly cookie transport
- On 401: automatically calls `POST /api/auth/refresh` with stored refresh token, then retries original request
- Concurrent 401 responses share a single refresh promise (deduplication)
- If refresh fails, throws "Session expired" and clears stored token
- Created `test-utils.tsx` with `renderWithRouter` and `createRouterWrapper` for React component testing
- Added vitest jsdom environment config and testing-library dependencies
- 7 unit tests covering: GET/POST/DELETE methods, credentials, 401 refresh-retry, concurrent dedup, refresh failure, 204 handling

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 470b32f | Fix Vite proxy rewrite and create shared auth types |
| 2 | 3826d24 | API client with 401 refresh-retry and test infrastructure |

## Deviations from Plan

None -- plan executed exactly as written.

## Verification Results

- `bun run test`: 7/7 tests pass
- `credentials: "include"` present in api.ts fetch calls
- `rewrite` function present in vite.config.ts proxy
- `refreshPromise` deduplication logic present in api.ts
