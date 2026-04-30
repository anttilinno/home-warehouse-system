# Phase 57 Deferred Items

Pre-existing issues discovered during 57-01 execution. Out of scope per executor scope-boundary rules.

## Lint (pre-existing, unrelated to 57-01)

- `src/components/layout/AppShell.tsx:25` — react-hooks/set-state-in-effect
- `src/components/layout/useRouteLoading.ts:14` — react-hooks/set-state-in-effect
- `src/components/retro/__tests__/RetroDialog.test.tsx:2` — unused `fireEvent`
- `src/components/retro/__tests__/RetroToast.test.tsx` — similar unused import
- `src/features/auth/AuthCallbackPage.tsx:24` — set-state-in-effect
- `src/features/auth/AuthContext.tsx:67` — set-state-in-effect
- `src/features/auth/__tests__/RequireAuth.test.tsx:94` — cannot reassign
- `src/features/dashboard/ActivityFeed.tsx:41` — set-state-in-effect
- `src/lib/api.ts:89` — no-useless-catch

## TypeScript (pre-existing)

- `src/lib/i18n.ts:13,14` — missing `../../locales/en|et/messages.ts` (compile step not run)
- `src/pages/ApiDemoPage.tsx:47` — RetroPanel `style` prop type mismatch

None of these files are modified by plan 57-01.
