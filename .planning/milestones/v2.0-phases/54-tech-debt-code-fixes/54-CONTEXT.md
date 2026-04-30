# Phase 54: Tech Debt Code Fixes - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Close 9 specific code-level tech debt items in `frontend2`: the 7 success criteria from the ROADMAP plus 2 unresolved warnings from the Phase 51 code review (WR-01, WR-02). No new features, no scope expansion — pure correctness fixes.

</domain>

<decisions>
## Implementation Decisions

### Plan Structure
- **D-01:** Two plans.
  - **Plan 1 — Nav + Auth hardening:** Sidebar ITEMS/LOANS links, HttpError class in api.ts, AuthContext 401/403-only token clear, DataPage null-guard.
  - **Plan 2 — i18n + Type + Consistency:** `entity_name` type fix, NotFoundPage `t` macro + catalogs, AuthCallbackPage `<HazardStripe>`, barrel imports for `useToast`, Phase 51 WR-01 (timeout leak), Phase 51 WR-02 (`SYSTEM ERROR` translation).

### Sidebar Navigation
- **D-02:** Add ITEMS and LOANS NavLinks to `frontend2/src/components/layout/Sidebar.tsx`. Final order: DASHBOARD, ITEMS, LOANS, SETTINGS. Matches the ROADMAP success criterion explicitly.
- **D-03:** Update `Sidebar.test.tsx` to cover all 4 NavLinks.

### AuthContext Error Hardening
- **D-04:** Introduce a typed `HttpError` class in `frontend2/src/lib/api.ts`. The class carries an HTTP `status: number` field. `parseError()` returns `new HttpError(response.status, message)` instead of a plain `Error`.
- **D-05:** In `AuthContext.tsx` `loadUser` catch block, replace the `instanceof TypeError` guard with:
  ```ts
  if (err instanceof HttpError && (err.status === 401 || err.status === 403)) {
    setRefreshToken(null);
  }
  ```
  This clears the token only on definitive auth rejections, not on network failures (TypeError) or server errors (5xx).
- **D-06:** Export `HttpError` from `api.ts` so AuthContext can import it without a circular dependency. Both live in `src/lib/`.

### DataPage Null Guard
- **D-07:** Disable the EXPORT and IMPORT buttons in `DataPage.tsx` when `workspaceId` is `null` or `undefined`. Use the `disabled` prop on `RetroButton`. Visually the disabled state should follow the existing `RetroButton` disabled pattern (check the component — use whatever `disabled` styling is already there).

### Types Fix
- **D-08:** In `frontend2/src/lib/types.ts`, change `entity_name?: string | null` to `entity_name: string | null`. Remove the optional marker — the field is always present in the backend contract (nullable, not absent).

### NotFoundPage i18n
- **D-09:** The `NotFoundPage` function is currently inline in `frontend2/src/routes/index.tsx`. Keep it inline (no extraction needed) but wrap all visible strings in the Lingui `t` macro: "SECTOR NOT FOUND", "The requested area does not exist. Return to base.", "RETURN TO BASE".
- **D-10:** Run `bun run extract` (or equivalent Lingui extract command for this project) to generate catalog entries, then add ET translations to `frontend2/locales/et/messages.po`. Check `frontend2/package.json` for the correct extract script name.

### AuthCallbackPage HazardStripe
- **D-11:** In `frontend2/src/features/auth/AuthCallbackPage.tsx`, replace the inline hazard stripe div:
  ```tsx
  <div className="bg-hazard-stripe h-[8px] mb-md" />
  ```
  with the `<HazardStripe>` component imported from `@/components/retro`. Match the existing usage pattern from other files that use `<HazardStripe>`.

### Barrel Imports for useToast
- **D-12:** Update all settings pages that currently import `useToast` directly from `@/components/retro/RetroToast` to import from the barrel `@/components/retro` instead.
  Files to update: `AppearancePage.tsx`, `DataPage.tsx`, `NotificationsPage.tsx`, `LanguagePage.tsx`, `FormatsPage.tsx`.
  (ProfilePage.tsx and SecurityPage.tsx already import from the barrel — confirm but don't touch if correct.)

### Phase 51 WR-01: useRouteLoading Timeout Leak
- **D-13:** Fix `frontend2/src/components/layout/useRouteLoading.ts` — the inner `t2` timeout is currently declared inside the `t1` callback, making it unreachable by the outer cleanup. Declare `t2` in outer scope so both `t1` and `t2` can be cancelled in the return cleanup:
  ```ts
  let t2: ReturnType<typeof setTimeout>;
  const t1 = setTimeout(() => {
    setProgress(100);
    t2 = setTimeout(() => { setIsLoading(false); setProgress(0); }, 200);
  }, 300);
  return () => { clearTimeout(t1); clearTimeout(t2); };
  ```

### Phase 51 WR-02: SYSTEM ERROR Translation
- **D-14:** In `frontend2/src/components/layout/ErrorBoundaryPage.tsx`, wrap the `"SYSTEM ERROR"` heading in the `t` macro. Add the key to both `.po` files — English as-is, Estonian translation to be provided (use "SÜSTEEMIVIGA" as the translation, consistent with the Phase 51 review recommendation).

### Claude's Discretion
- Exact `RetroButton` `disabled` prop behavior (check existing component — use whatever is already there)
- Whether to update `Sidebar.test.tsx` with `aria-label` queries or text queries (follow existing test patterns)
- Lingui extract command invocation details (check package.json scripts)
- Whether `HttpError` should extend `Error` or be a standalone class (standard practice: extend Error)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Files Being Modified (Plan 1)
- `frontend2/src/components/layout/Sidebar.tsx` — add ITEMS + LOANS NavLinks
- `frontend2/src/components/layout/__tests__/Sidebar.test.tsx` — update tests for 4 NavLinks
- `frontend2/src/lib/api.ts` — add HttpError class
- `frontend2/src/features/auth/AuthContext.tsx` — update catch block
- `frontend2/src/features/settings/DataPage.tsx` — add workspaceId null-guard

### Files Being Modified (Plan 2)
- `frontend2/src/lib/types.ts` — entity_name type fix
- `frontend2/src/routes/index.tsx` — NotFoundPage i18n
- `frontend2/src/features/auth/AuthCallbackPage.tsx` — HazardStripe component
- `frontend2/src/features/settings/AppearancePage.tsx` — barrel import
- `frontend2/src/features/settings/DataPage.tsx` — barrel import
- `frontend2/src/features/settings/NotificationsPage.tsx` — barrel import
- `frontend2/src/features/settings/LanguagePage.tsx` — barrel import
- `frontend2/src/features/settings/FormatsPage.tsx` — barrel import
- `frontend2/src/components/layout/useRouteLoading.ts` — WR-01 timeout fix
- `frontend2/src/components/layout/ErrorBoundaryPage.tsx` — WR-02 i18n fix
- `frontend2/locales/en/messages.po` — new catalog entries
- `frontend2/locales/et/messages.po` — new catalog entries with ET translations

### Component Patterns (established)
- `frontend2/src/components/retro/index.ts` — barrel export (includes `useToast`, `HazardStripe`)
- `frontend2/src/components/retro/HazardStripe.tsx` — HazardStripe component (check props)
- `frontend2/src/components/retro/RetroButton.tsx` — check disabled prop handling
- `frontend2/src/components/layout/AppShell.tsx` — HazardStripe usage example via RetroPanel

### Prior Phase Context
- `.planning/phases/51-app-layout/51-CONTEXT.md` — D-05: Sidebar nav pattern
- `.planning/phases/51-app-layout/51-REVIEW.md` — WR-01, WR-02, IN-02 full details
- `.planning/phases/50-design-system/50-CONTEXT.md` — component patterns (forwardRef, Tailwind-only)
- `.planning/phases/48-project-scaffold/48-CONTEXT.md` — Lingui extract workflow

### ROADMAP Success Criteria
- `.planning/ROADMAP.md` — Phase 54 success criteria 1-7 (authoritative)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `RetroButton` — already has `disabled` prop pattern (check component for exact implementation)
- `HazardStripe` — already exported from barrel `@/components/retro`
- `useLingui` — already used in most pages; `t` macro pattern is established
- `useAuth()` — `workspaceId: string | null` already exposed

### Established Patterns
- Tailwind CSS 4 utility classes only — no CSS-in-JS
- Lingui v5 `t` macro from `useLingui()` hook (not the `Trans` component)
- Feature-based directories: settings pages in `frontend2/src/features/settings/`
- NavLink active class: `bg-retro-amber shadow-retro-pressed` (from Sidebar.tsx)
- Error class pattern: extend `Error`, set `this.name`

### Integration Points
- `api.ts` exports: `get`, `post`, `patch`, `del`, `setRefreshToken`, `getRefreshToken` — add `HttpError` export
- `AuthContext.tsx` imports from `@/lib/api` — will import `HttpError` from there
- Sidebar.tsx imports from `react-router` NavLink — same import for ITEMS/LOANS links

</code_context>

<specifics>
## Specific Ideas

- HttpError should extend Error (standard practice), carry `status: number`, and be exported from `api.ts`.
- The inner `t2` variable in `useRouteLoading.ts` must be declared in outer scope with `let` (not `const`) so it can be assigned inside the `t1` callback. TypeScript will infer the type as `ReturnType<typeof setTimeout>`.

</specifics>

<deferred>
## Deferred Ideas

- **IN-02 (DemoPage route):** Phase 51 review flagged `/demo` route as a possible dev artifact. Not included in Phase 54 — if it's intentional, leave it; if not, a separate cleanup task can address it.
- **IN-03 (Obsolete .po entries):** Phase 51 review flagged obsolete `#~` entries in `.po` catalogs. Deferred to Phase 55 (validation/requirements cleanup) where lingui extract with `--clean` will be run anyway.
- Phase 51 info item IN-01 (avatar alt text fallback) — minor UX polish, defer to a future UX pass.

</deferred>

---

*Phase: 54-tech-debt-code-fixes*
*Context gathered: 2026-04-11*
