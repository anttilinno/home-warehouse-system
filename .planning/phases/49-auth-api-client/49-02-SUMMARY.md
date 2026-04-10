---
phase: 49-auth-api-client
plan: 02
subsystem: frontend2-auth-context
tags: [auth-context, route-guard, session-restore, react-context]
dependency_graph:
  requires: [api-client, auth-types]
  provides: [auth-context, route-guard, auth-provider]
  affects: [frontend2/src/features/auth/AuthContext.tsx, frontend2/src/features/auth/RequireAuth.tsx, frontend2/src/routes/index.tsx, frontend2/src/App.tsx]
tech_stack:
  added: []
  patterns: [react-context-auth, route-guard-redirect, session-restore-on-mount]
key_files:
  created:
    - frontend2/src/features/auth/AuthContext.tsx
    - frontend2/src/features/auth/RequireAuth.tsx
    - frontend2/src/features/auth/__tests__/AuthContext.test.tsx
    - frontend2/src/features/auth/__tests__/RequireAuth.test.tsx
  modified:
    - frontend2/src/routes/index.tsx
    - frontend2/src/App.tsx
decisions:
  - "React Router v7 requires Navigate inside Routes/Route to avoid infinite render loops in jsdom tests"
  - "Mutable variable mock pattern for useAuth in RequireAuth tests (vi.fn caused issues with module mock hoisting)"
metrics:
  duration: 844s
  completed: "2026-04-10"
  tasks_completed: 2
  tasks_total: 2
  tests_added: 11
---

# Phase 49 Plan 02: Auth Context & Route Guards Summary

React auth context provider with login/register/logout, session restoration via /users/me on mount, and RequireAuth route guard redirecting unauthenticated users to /login with return-path state.

## What Was Built

### Task 1: AuthContext Provider (TDD)
- Created `AuthContext.tsx` with `AuthProvider` and `useAuth` hook
- On mount, calls `GET /users/me` to restore session from cookies; sets `isAuthenticated` accordingly
- `login(email, password)` calls `POST /auth/login`, stores refresh_token, loads user profile
- `register(data)` calls `POST /auth/register`, stores refresh_token, loads user profile
- `logout()` calls `POST /auth/logout`, clears refresh_token and user state (ignores network errors)
- `refreshUser()` re-fetches user profile for manual refresh
- `useAuth()` outside `AuthProvider` throws descriptive error
- 7 unit tests covering all auth flows and edge cases

### Task 2: RequireAuth Guard & Wiring (TDD)
- Created `RequireAuth.tsx` that checks `isAuthenticated` and `isLoading` from auth context
- Unauthenticated users redirected to `/login` with `state.from` containing original location
- Loading state renders null (prevents flash of login page during session restore)
- Updated `routes/index.tsx`: wrapped `/` and `/settings` with `<RequireAuth>`, added `/login` and `/auth/callback` placeholder routes
- Updated `App.tsx`: wrapped `<AppRoutes>` with `<AuthProvider>` inside `<BrowserRouter>`
- 4 unit tests covering authenticated, unauthenticated redirect, loading, and state.from passthrough

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 (RED) | 9c882da | Add failing tests for AuthContext provider |
| 1 (GREEN) | facff78 | Implement AuthContext with login/register/logout and session restore |
| 2 (RED) | d432ddc | Add failing tests for RequireAuth guard |
| 2 (GREEN) | c070212 | Add RequireAuth guard, wire auth into routes and App |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] React Router v7 Navigate hang in tests**
- **Found during:** Task 2 (RequireAuth tests)
- **Issue:** Using `Navigate` component inside a bare `MemoryRouter` (without `Routes`/`Route`) causes an infinite render loop in React Router v7 jsdom environment, hanging vitest
- **Fix:** Wrapped all RequireAuth test renders in `Routes`/`Route` with a `/login` catch route so Navigate can resolve
- **Files modified:** RequireAuth.test.tsx

## Known Stubs

| Stub | File | Reason |
|------|------|--------|
| LoginPlaceholder | frontend2/src/routes/index.tsx:102 | Temporary placeholder; will be replaced by Plan 03 (auth UI forms) |
| CallbackPlaceholder | frontend2/src/routes/index.tsx:108 | Temporary placeholder; will be replaced by Plan 03 (OAuth callback) |

## Verification Results

- `bun run test`: 18/18 tests pass (7 AuthContext + 7 API client + 4 RequireAuth)
- `grep RequireAuth routes/index.tsx`: routes are guarded
- `grep AuthProvider App.tsx`: context is wired
- `grep 'Navigate.*login' RequireAuth.tsx`: redirect present

## Self-Check: PASSED
