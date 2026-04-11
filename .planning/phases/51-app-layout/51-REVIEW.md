---
phase: 51-app-layout
reviewed: 2026-04-11T00:00:00Z
depth: standard
files_reviewed: 15
files_reviewed_list:
  - frontend2/locales/en/messages.po
  - frontend2/locales/et/messages.po
  - frontend2/src/components/layout/AppShell.tsx
  - frontend2/src/components/layout/ErrorBoundaryPage.tsx
  - frontend2/src/components/layout/LoadingBar.tsx
  - frontend2/src/components/layout/Sidebar.tsx
  - frontend2/src/components/layout/TopBar.tsx
  - frontend2/src/components/layout/__tests__/AppShell.test.tsx
  - frontend2/src/components/layout/__tests__/ErrorBoundary.test.tsx
  - frontend2/src/components/layout/__tests__/LoadingBar.test.tsx
  - frontend2/src/components/layout/__tests__/Sidebar.test.tsx
  - frontend2/src/components/layout/__tests__/TopBar.test.tsx
  - frontend2/src/components/layout/index.ts
  - frontend2/src/components/layout/useRouteLoading.ts
  - frontend2/src/routes/index.tsx
findings:
  critical: 0
  warning: 2
  info: 3
  total: 5
status: issues_found
---

# Phase 51: Code Review Report

**Reviewed:** 2026-04-11T00:00:00Z
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found

## Summary

This phase adds the application shell layout: `AppShell`, `Sidebar`, `TopBar`, `LoadingBar`, `ErrorBoundaryPage`, the `useRouteLoading` hook, route definitions, and i18n catalog updates. The overall implementation is clean and well-structured. Two warnings were found — one is a real memory/state bug in `useRouteLoading` (leaked inner timeout), the other is a missing i18n string in `ErrorBoundaryPage`. Three info items cover a hardcoded app title, an incomplete avatar `alt` attribute, and a leftover demo route import.

## Warnings

### WR-01: Inner timeout cleanup in `useRouteLoading` is silently ignored

**File:** `frontend2/src/components/layout/useRouteLoading.ts:17-24`

**Issue:** The `return () => clearTimeout(t2)` on line 23 is returned from inside the `setTimeout` callback for `t1`. `setTimeout` ignores the return value of its callback, so this cleanup function is never registered with React's effect system. If the component unmounts (or the effect re-runs due to a rapid route change) between the moment `t1` fires and before `t2` fires, `t2` will still execute and call `setIsLoading(false)` / `setProgress(0)` on the unmounted or stale component, causing a state update on an unmounted component.

**Fix:** Track `t2` in the outer scope so the outer cleanup can cancel it:

```ts
useEffect(() => {
  if (location.pathname === prevPath.current) return;
  prevPath.current = location.pathname;

  setIsLoading(true);
  setProgress(90);

  let t2: ReturnType<typeof setTimeout>;
  const t1 = setTimeout(() => {
    setProgress(100);
    t2 = setTimeout(() => {
      setIsLoading(false);
      setProgress(0);
    }, 200);
  }, 300);

  return () => {
    clearTimeout(t1);
    clearTimeout(t2);
  };
}, [location.pathname]);
```

### WR-02: Hardcoded "SYSTEM ERROR" heading in `ErrorBoundaryPage` is not translated

**File:** `frontend2/src/components/layout/ErrorBoundaryPage.tsx:31`

**Issue:** The `h1` element contains the literal string `"SYSTEM ERROR"` with no i18n wrapper. All other visible strings in this component use `t\`...\`` (via `useLingui`). This heading will always render in English regardless of the user's language setting. The string does not appear in either `.po` catalog.

**Fix:** Wrap in the translation macro and add the key to both `.po` files:

```tsx
// ErrorBoundaryPage.tsx line 31
<h1 className="text-[20px] font-bold uppercase text-retro-ink">
  {t`SYSTEM ERROR`}
</h1>
```

Then add to `frontend2/locales/en/messages.po`:
```
#: src/components/layout/ErrorBoundaryPage.tsx:31
msgid "SYSTEM ERROR"
msgstr "SYSTEM ERROR"
```

And to `frontend2/locales/et/messages.po`:
```
#: src/components/layout/ErrorBoundaryPage.tsx:31
msgid "SYSTEM ERROR"
msgstr "SÜSTEEMIVIGA"
```

(Estonian translation is illustrative — confirm with translator.)

## Info

### IN-01: Avatar `alt` text may be empty string or "undefined"

**File:** `frontend2/src/components/layout/TopBar.tsx:51`

**Issue:** `alt={user.full_name}` is used on the avatar `<img>`. The `user` object at this point is not optional-chained, and `full_name` is not explicitly typed as non-nullable. If `full_name` is `undefined` or an empty string, the rendered `alt` becomes either `"undefined"` (the string) or `""` (empty), both of which are incorrect for a user avatar image. An empty `alt` implies the image is decorative; "undefined" is meaningless.

**Fix:** Provide a meaningful fallback:

```tsx
<img
  src={user.avatar_url}
  alt={user.full_name ?? "User avatar"}
  className="..."
/>
```

### IN-02: `DemoPage` import and route in `routes/index.tsx` appears to be a development artifact

**File:** `frontend2/src/routes/index.tsx:6, 49`

**Issue:** `DemoPage` is imported and registered as a public route at `/demo`. This appears to be a development/prototyping artifact rather than a production feature. If this route ships to production, it represents an unintentional exposure of demo UI to users without any authentication guard.

**Fix:** Remove the import and route if not intentionally part of the production build, or add an authentication guard and document it as an intentional feature.

### IN-03: Obsolete i18n entries should be removed from `.po` catalogs

**File:** `frontend2/locales/en/messages.po:599-601`, `frontend2/locales/et/messages.po:599-601`

**Issue:** Both catalog files contain an obsolete entry (prefixed with `#~`) for `"Welcome to Home Warehouse"` — the tilde prefix means the source reference was removed but the entry was not purged. While lingui ignores obsolete entries at runtime, they accumulate as dead weight and can confuse translators.

**Fix:** Run `yarn lingui extract` (or equivalent) with the `--clean` flag, or manually remove the `#~`-prefixed block from both files. The lingui CLI does this automatically when catalogs are re-extracted with cleanup enabled.

---

_Reviewed: 2026-04-11T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
