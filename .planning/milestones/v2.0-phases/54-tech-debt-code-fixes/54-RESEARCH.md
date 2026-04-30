# Phase 54: v2.0 Tech Debt — Code Fixes - Research

**Researched:** 2026-04-11
**Domain:** React/TypeScript frontend code quality — nav, auth, types, i18n, component consistency
**Confidence:** HIGH (all findings verified against actual source files)

## Summary

Phase 54 closes 9 specific code-level tech debt items in `frontend2`. All research was performed by directly reading current source files — no external lookups required. The tech stack (Lingui v5, Vitest, React Router v7, Tailwind CSS 4, RetroButton/HazardStripe components) is fully understood from prior phases.

**Critical pre-flight discovery:** Two items listed in CONTEXT.md as "to fix" are ALREADY FIXED in the current codebase:
- **WR-01** (`useRouteLoading.ts` timeout leak): Fixed — `t2` is already declared in outer scope. [VERIFIED: source file read]
- **WR-02** (`ErrorBoundaryPage` SYSTEM ERROR not translated): Fixed — `t\`SYSTEM ERROR\`` is in place, and `SÜSTEEMIVIGA` is already in `locales/et/messages.po`. [VERIFIED: source file read]

The planner must NOT create tasks for WR-01 or WR-02 — they would be no-ops that could introduce regressions if re-applied.

**Primary recommendation:** Two plans as decided: Plan 1 for Nav + Auth hardening (5 code items), Plan 2 for i18n + Type + Consistency (5 code items, minus the 2 already-done WR items = 3 effective items plus catalog updates).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** Two plans.
- Plan 1 — Nav + Auth hardening: Sidebar ITEMS/LOANS links, HttpError class in api.ts, AuthContext 401/403-only token clear, DataPage null-guard.
- Plan 2 — i18n + Type + Consistency: `entity_name` type fix, NotFoundPage `t` macro + catalogs, AuthCallbackPage `<HazardStripe>`, barrel imports for `useToast`, Phase 51 WR-01 (timeout leak), Phase 51 WR-02 (`SYSTEM ERROR` translation).

**D-02:** Add ITEMS and LOANS NavLinks to `frontend2/src/components/layout/Sidebar.tsx`. Final order: DASHBOARD, ITEMS, LOANS, SETTINGS.

**D-03:** Update `Sidebar.test.tsx` to cover all 4 NavLinks.

**D-04:** Introduce a typed `HttpError` class in `frontend2/src/lib/api.ts`. Carries `status: number`.

**D-05:** In `AuthContext.tsx` `loadUser` catch block, replace `instanceof TypeError` guard with `instanceof HttpError && (err.status === 401 || err.status === 403)`.

**D-06:** Export `HttpError` from `api.ts` so AuthContext can import it without circular dependency.

**D-07:** Disable EXPORT and IMPORT buttons in `DataPage.tsx` when `workspaceId` is `null` or `undefined`. Use `disabled` prop on `RetroButton`.

**D-08:** In `frontend2/src/lib/types.ts`, change `entity_name?: string | null` to `entity_name: string | null`.

**D-09:** Wrap all visible strings in `NotFoundPage` in Lingui `t` macro. Keep function inline in `routes/index.tsx`.

**D-10:** Run `bun run i18n:extract` then add ET translations to `locales/et/messages.po`.

**D-11:** In `AuthCallbackPage.tsx`, replace `<div className="bg-hazard-stripe h-[8px] mb-md" />` with `<HazardStripe>` imported from `@/components/retro`.

**D-12:** Update settings pages that import `useToast` directly from `@/components/retro/RetroToast` to import from barrel `@/components/retro` instead. Files: `AppearancePage.tsx`, `DataPage.tsx`, `NotificationsPage.tsx`, `LanguagePage.tsx`, `FormatsPage.tsx`.

**D-13:** Fix `useRouteLoading.ts` — declare `t2` in outer scope. *(SEE RESEARCH NOTE: ALREADY FIXED)*

**D-14:** Wrap `"SYSTEM ERROR"` in `ErrorBoundaryPage.tsx` in `t` macro + add to both `.po` files. *(SEE RESEARCH NOTE: ALREADY FIXED)*

### Claude's Discretion

- Exact `RetroButton` `disabled` prop behavior (check existing component — use whatever is already there)
- Whether to update `Sidebar.test.tsx` with `aria-label` queries or text queries (follow existing test patterns)
- Lingui extract command invocation details (check package.json scripts)
- Whether `HttpError` should extend `Error` or be a standalone class (standard practice: extend Error)

### Deferred Ideas (OUT OF SCOPE)

- **IN-02 (DemoPage route):** `/demo` route as possible dev artifact. Not included in Phase 54.
- **IN-03 (Obsolete .po entries):** Deferred to Phase 55 where lingui extract with `--clean` will be run.
- Phase 51 info item IN-01 (avatar alt text fallback) — deferred to future UX pass.
</user_constraints>

---

## Pre-Flight: Already-Fixed Items

### WR-01: useRouteLoading timeout leak — ALREADY FIXED

**Verification:** Read `frontend2/src/components/layout/useRouteLoading.ts` — line 17 already has `let t2: ReturnType<typeof setTimeout>;` declared in outer scope, and line 26-29 `return () => { clearTimeout(t1); clearTimeout(t2); }` correctly cancels both. [VERIFIED: source file]

**Planner action:** Do NOT include WR-01 fix as a task. It is a no-op. If included, it risks silently changing correct code.

### WR-02: SYSTEM ERROR translation — ALREADY FIXED

**Verification:** Read `frontend2/src/components/layout/ErrorBoundaryPage.tsx` — line 31 shows `{t\`SYSTEM ERROR\`}` macro in place. Read `frontend2/locales/et/messages.po` lines 525-527 — entry `msgid "SYSTEM ERROR"` with `msgstr "SÜSTEEMIVIGA"` already exists. EN catalog also has the entry. [VERIFIED: source files]

**Planner action:** Do NOT include WR-02 fix as a task.

---

## Confirmed Work Items

All 7 success criteria plus 2 WR items = 9 items. 2 WR items are done. 7 remain.

### Item 1: Sidebar nav (SC-1)
**Current state:** `Sidebar.tsx` has 2 NavLinks: `DASHBOARD` (to="/") and `SETTINGS` (to="/settings"). [VERIFIED: source file]
**Required state:** 4 NavLinks — DASHBOARD, ITEMS (to="/items"), LOANS (to="/loans"), SETTINGS.
**Test gap:** `Sidebar.test.tsx` has tests for 2 links only; needs 4-link coverage.

### Item 2: AuthContext error hardening (SC-2)
**Current state:** `AuthContext.tsx` catch block uses `if (!(err instanceof TypeError))` to guard token clear. [VERIFIED: source file]
**Required state:** `HttpError` class in `api.ts`, catch block uses `err instanceof HttpError && (err.status === 401 || err.status === 403)`.
**Current api.ts exports:** `get`, `post`, `patch`, `del`, `setRefreshToken`, `getRefreshToken`. `parseError()` returns `new Error(...)`. [VERIFIED: source file]

### Item 3: DataPage workspaceId null-guard (SC-3)
**Current state:** EXPORT button has `disabled={exporting}` only; IMPORT button has `disabled={importing}` only. `workspaceId` is already destructured from `useAuth()`. [VERIFIED: source file]
**Required state:** `disabled={exporting || !workspaceId}` on EXPORT button; `disabled={importing || !workspaceId}` on IMPORT button. The `RetroButton` `disabled` prop is fully implemented — uses `disabled:bg-retro-gray disabled:cursor-not-allowed disabled:shadow-none disabled:text-retro-cream` CSS classes. [VERIFIED: RetroButton.tsx]

### Item 4: entity_name type fix (SC-4)
**Current state:** `frontend2/src/lib/types.ts` line 107: `entity_name?: string | null;` (has `?` optional marker). [VERIFIED: source file]
**Required state:** `entity_name: string | null;` (remove `?`).
**Risk assessment:** Removing `?` makes the field required at the type level. Any consumer that assumes the field might be absent (via `?.entity_name`) will get a TypeScript error — those should be updated to `!= null` null-checks instead. Check usages. [ASSUMED: standard TypeScript behavior]

### Item 5: NotFoundPage i18n (SC-5)
**Current state:** `NotFoundPage` inline function in `routes/index.tsx` lines 22-41. Three hardcoded strings: `"SECTOR NOT FOUND"`, `"The requested area does not exist. Return to base."`, `"RETURN TO BASE"` — none wrapped in `t` macro. `useLingui` is not imported in that file. [VERIFIED: source file]
**Catalog state:** `"RETURN TO BASE"` already exists in EN+ET catalogs (used by `ErrorBoundaryPage.tsx` line 40). `"SECTOR NOT FOUND"` does NOT exist in either catalog. [VERIFIED: grep on locales]
**Required state:** Add `useLingui` import + `const { t } = useLingui()` inside `NotFoundPage`, wrap all 3 strings. Run `bun run i18n:extract` to update catalogs. Add ET translations manually.
**ET translations needed:** `"SECTOR NOT FOUND"` → `"SEKTOR EI LEITUD"` [ASSUMED — provide as recommendation, translator may override], `"The requested area does not exist. Return to base."` → `"Soovitud ala ei eksisteeri. Naase baasi."` [ASSUMED], `"RETURN TO BASE"` already translated as `"TAGASI BAASI"`.

### Item 6: AuthCallbackPage HazardStripe component (SC-6)
**Current state:** `AuthCallbackPage.tsx` line 50: `<div className="bg-hazard-stripe h-[8px] mb-md" />` — inline div. [VERIFIED: source file]
**Required state:** Replace with `<HazardStripe className="mb-md" />` imported from `@/components/retro`.
**HazardStripe props:** `height?: number` (default 8), `className?: string`. Default height of 8px matches the inline div's `h-[8px]`. The `mb-md` spacing class goes on `className` prop. [VERIFIED: HazardStripe.tsx]
**Current import:** `AuthCallbackPage.tsx` does NOT currently import from `@/components/retro`. The import for `post` and `setRefreshToken` comes from `@/lib/api`. A new import line is needed. [VERIFIED: source file]

### Item 7: Barrel imports for useToast (SC-7)
**Files needing fix:** 4 files import from direct path `@/components/retro/RetroToast`:
- `AppearancePage.tsx` line 7
- `DataPage.tsx` line 7
- `NotificationsPage.tsx` line 7
- `LanguagePage.tsx` line 6
- `FormatsPage.tsx` line 7

**Files already correct (barrel import):**
- `ProfilePage.tsx` — imports `useToast` from `@/components/retro` (barrel) ✓
- `SecurityPage.tsx` — imports `useToast` from `@/components/retro` (barrel) ✓

**Additional finding:** `NotificationsPage.tsx` also imports `HazardStripe` directly from `@/components/retro/HazardStripe` (line 5). D-12 only specifies fixing `useToast` barrel imports — however, fixing the HazardStripe import in the same file is consistent and low-risk. Claude's discretion: fix both non-barrel imports in `NotificationsPage.tsx` in the same task, or only fix `useToast` per D-12. [VERIFIED: source file]

**Barrel exports confirmed:** `useToast` is exported from `@/components/retro` barrel (`index.ts` line 11). `HazardStripe` is also exported from the barrel (line 4). [VERIFIED: index.ts]

---

## Standard Stack

### Core Technologies (this phase)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React Router v7 | 7.14.0 | NavLink for sidebar | Already used, `to="/items"` and `to="/loans"` routes already registered in `routes/index.tsx` |
| Lingui v5 | 5.9.5 | `t` macro, `useLingui` hook | Project i18n standard |
| TypeScript 6 | ~6.0.2 | `HttpError extends Error` | Project language |
| Vitest 4 | 4.1.3 | Test runner | Project test standard |

### Lingui Extract Command
**Script name in package.json:** `i18n:extract` (not `extract` or `lingui:extract`)
**Full command:** `bun run i18n:extract` from `frontend2/` directory. [VERIFIED: package.json]

### RetroButton disabled Pattern
The `RetroButton` component accepts native `ButtonHTMLAttributes<HTMLButtonElement>`, so `disabled` prop is standard HTML. When disabled:
- Removes `shadow-retro-raised active:shadow-retro-pressed cursor-pointer` (the `activeClasses`)
- Applies `disabled:bg-retro-gray disabled:cursor-not-allowed disabled:shadow-none disabled:text-retro-cream`
This is already used in `DataPage` for `disabled={exporting}` and `disabled={importing}`. [VERIFIED: RetroButton.tsx]

---

## Architecture Patterns

### HttpError Class Pattern
Standard TypeScript practice: extend `Error`, set `this.name`. Consistent with D-04/D-06.

```typescript
// Source: CONTEXT.md D-04, D-06 + standard TS convention [ASSUMED: extends Error pattern]
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "HttpError";
  }
}
```

`parseError()` in `api.ts` becomes:
```typescript
return new HttpError(response.status, error.detail || error.message || `HTTP ${response.status}`);
```

AuthContext catch block becomes:
```typescript
if (err instanceof HttpError && (err.status === 401 || err.status === 403)) {
  setRefreshToken(null);
}
```

### NavLink Pattern (existing)
The existing Sidebar uses this pattern exactly — new ITEMS/LOANS links follow the same structure:
```tsx
// Source: frontend2/src/components/layout/Sidebar.tsx [VERIFIED]
<NavLink
  to="/items"
  className={({ isActive }) =>
    `${navItemBase} ${isActive ? navItemActive : navItemDefault}`
  }
  onClick={onNavClick}
>
  {t`ITEMS`}
</NavLink>
```

### Sidebar Test Pattern
Existing tests use `screen.getByText("DASHBOARD")` text queries (not aria queries). New tests for ITEMS/LOANS should follow the same pattern. [VERIFIED: Sidebar.test.tsx]

### HazardStripe Usage in AuthCallbackPage
```tsx
// Replace:
<div className="bg-hazard-stripe h-[8px] mb-md" />
// With:
<HazardStripe className="mb-md" />
```
Import: `import { HazardStripe } from "@/components/retro";`
Default height is 8px — matches the replaced div. `mb-md` spacing passed via `className`. [VERIFIED: HazardStripe.tsx]

### Barrel Import Correction Pattern
```typescript
// Before (in AppearancePage, DataPage, NotificationsPage, LanguagePage, FormatsPage):
import { useToast } from "@/components/retro/RetroToast";
// After:
import { useToast } from "@/components/retro";
```
Note: if the file already imports other things from `@/components/retro` (most do), merge into that import. Example for AppearancePage:
```typescript
// Before:
import { RetroPanel, RetroButton } from "@/components/retro";
import { useToast } from "@/components/retro/RetroToast";
// After:
import { RetroPanel, RetroButton, useToast } from "@/components/retro";
```
[VERIFIED: source files for all 5 pages]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP status discrimination | Custom error property tacking | `HttpError extends Error` with `status` field | Standard TS pattern, instanceof checks work correctly |
| Disabled button state | Opacity/pointer-events hacks | Native `disabled` prop on `RetroButton` | Already implemented with correct CSS, accessible |
| i18n strings | Hardcoded translations | Lingui `t` macro + `.po` files | Compile-time safety, locale switching |

---

## Common Pitfalls

### Pitfall 1: Applying WR-01 / WR-02 "fixes" to already-fixed code
**What goes wrong:** The planner creates tasks for WR-01 and WR-02 based on CONTEXT.md without checking current file state. Applying the "fix" to already-correct code changes nothing at best; at worst, a diff-based edit tool might corrupt the file.
**Why it happens:** CONTEXT.md was written before the Phase 51 review fixes were committed.
**How to avoid:** Planner must note these items are resolved. Plans should include a verification step confirming the items remain fixed, but no modification tasks.

### Pitfall 2: NotFoundPage — "RETURN TO BASE" catalog key already exists
**What goes wrong:** `bun run i18n:extract` adds a new `"RETURN TO BASE"` entry from `routes/index.tsx`, creating a duplicate of the existing entry sourced from `ErrorBoundaryPage.tsx`. Lingui handles multiple source references on a single key gracefully (merges source comments), but the implementer might be surprised.
**How to avoid:** After extraction, verify the EN catalog has one `msgid "RETURN TO BASE"` with two source comment lines, not two separate entries.

### Pitfall 3: entity_name type change breaking call sites
**What goes wrong:** Changing `entity_name?: string | null` to `entity_name: string | null` makes the field required. TypeScript will flag any destructuring like `const { entity_name } = activity` where the object might not have the field if the consuming code assumed it could be absent.
**How to avoid:** After the type change, run `bun run build` or `tsc --noEmit` to catch any type errors at call sites. The field is always present in API responses so runtime behavior is unchanged.

### Pitfall 4: DataPage null-guard — two conditions per button
**What goes wrong:** Only adding `!workspaceId` without keeping the existing `exporting`/`importing` state guard, breaking the "loading in progress" disable behavior.
**How to avoid:** Condition is `disabled={exporting || !workspaceId}` (EXPORT) and `disabled={importing || !workspaceId}` (IMPORT). Both conditions required.

### Pitfall 5: AuthCallbackPage — missing import for HazardStripe
**What goes wrong:** Adding `<HazardStripe />` JSX without updating the import statement causes a runtime error.
**How to avoid:** `AuthCallbackPage.tsx` currently has NO import from `@/components/retro`. A new import line `import { HazardStripe } from "@/components/retro";` must be added.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.3 |
| Config file | `frontend2/vitest.config.ts` |
| Quick run command | `cd frontend2 && bun run test` |
| Full suite command | `cd frontend2 && bun run test` |

### Phase Requirements → Test Map
| Item | Behavior | Test Type | Automated Command | File Exists? |
|------|----------|-----------|-------------------|-------------|
| SC-1 Sidebar 4 links | Sidebar renders ITEMS + LOANS NavLinks | unit | `cd frontend2 && bun run test -- Sidebar` | ✅ update existing |
| SC-2 AuthContext | HttpError guard replaces TypeError guard | unit (manual verify) | `cd frontend2 && bun run test` | no new test needed |
| SC-3 DataPage null-guard | Buttons disabled when workspaceId null | visual/manual | `cd frontend2 && bun run test` | no existing test |
| SC-4 entity_name type | TypeScript compile succeeds | tsc | `cd frontend2 && bun run build` | N/A (type check) |
| SC-5 NotFoundPage i18n | Strings in catalogs | catalog presence | `bun run i18n:extract && grep "SECTOR NOT FOUND" locales/en/messages.po` | N/A |
| SC-6 HazardStripe | AuthCallbackPage compiles | tsc | `cd frontend2 && bun run build` | N/A |
| SC-7 Barrel imports | No direct RetroToast imports in settings | grep | `grep -r "retro/RetroToast" frontend2/src/features/settings/` | N/A |

### Sampling Rate
- **Per task commit:** `cd frontend2 && bun run test`
- **Per wave merge:** `cd frontend2 && bun run test && bun run build`
- **Phase gate:** Full test suite + TypeScript build clean before `/gsd-verify-work`

### Wave 0 Gaps
None — existing test infrastructure covers phase requirements. No new test files need to be created (Sidebar.test.tsx exists and will be updated, not created).

---

## Environment Availability

Step 2.6: No external dependencies beyond `bun` (already the project package manager) and the existing `frontend2` Vite/Vitest/Lingui setup.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| bun | All tasks | ✓ | latest (mise) | — |
| Lingui CLI | i18n:extract | ✓ | 5.9.5 (devDep) | — |

---

## Security Domain

This phase makes no changes to authentication flows, API endpoints, session management, or user data handling beyond hardening the error discrimination logic. The HttpError change improves auth robustness (only clear tokens on confirmed 401/403, not network failures) — this is a security improvement, not a regression.

ASVS V2/V3: The token-clear hardening (D-05) is a minor improvement to session resilience. No new auth surfaces introduced. No validation architecture changes.

---

## Sources

### Primary (HIGH confidence)
All findings are verified from direct source file reads within this session.

- `frontend2/src/components/layout/Sidebar.tsx` — current 2-link state confirmed
- `frontend2/src/components/layout/useRouteLoading.ts` — WR-01 already fixed confirmed
- `frontend2/src/components/layout/ErrorBoundaryPage.tsx` — WR-02 already fixed confirmed
- `frontend2/src/components/layout/__tests__/Sidebar.test.tsx` — test pattern confirmed
- `frontend2/src/lib/api.ts` — parseError returns plain Error, no HttpError yet
- `frontend2/src/features/auth/AuthContext.tsx` — TypeError guard in place
- `frontend2/src/features/settings/DataPage.tsx` — missing workspaceId guard confirmed
- `frontend2/src/lib/types.ts` — `entity_name?: string | null` optional marker confirmed
- `frontend2/src/routes/index.tsx` — NotFoundPage strings unlocalized confirmed
- `frontend2/src/features/auth/AuthCallbackPage.tsx` — inline hazard div confirmed
- `frontend2/src/components/retro/HazardStripe.tsx` — props interface confirmed
- `frontend2/src/components/retro/RetroButton.tsx` — disabled pattern confirmed
- `frontend2/src/components/retro/index.ts` — barrel exports confirmed
- `frontend2/locales/en/messages.po` — RETURN TO BASE present, SECTOR NOT FOUND absent
- `frontend2/locales/et/messages.po` — SYSTEM ERROR/SÜSTEEMIVIGA present
- `frontend2/package.json` — i18n:extract script name confirmed
- `frontend2/vitest.config.ts` — test framework confirmed

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `HttpError extends Error` is correct class pattern | Architecture Patterns | Low — standard TS; if wrong, use composition |
| A2 | ET translations for NotFoundPage strings ("SEKTOR EI LEITUD", "Naase baasi.") | Item 5 confirmed work | Low — translations are suggestions, human review expected |

---

## Open Questions

None — all items have sufficient detail from source inspection to plan and implement directly.

---

## Metadata

**Confidence breakdown:**
- Pre-flight findings (WR-01/WR-02 already fixed): HIGH — direct source file verification
- Remaining 7 items: HIGH — direct source file verification
- ET translation strings: LOW — assumed/suggested, flagged as needing human review
- HttpError class design: HIGH — standard TypeScript pattern matches CONTEXT.md spec

**Research date:** 2026-04-11
**Valid until:** 2026-04-25 (stable codebase, changes only through planned phase execution)
