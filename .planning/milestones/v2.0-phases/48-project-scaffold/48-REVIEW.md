---
phase: 48-project-scaffold
reviewed: 2026-04-09T10:00:00Z
depth: standard
files_reviewed: 16
files_reviewed_list:
  - frontend2/eslint.config.mjs
  - frontend2/index.html
  - frontend2/lingui.config.ts
  - frontend2/locales/en/messages.po
  - frontend2/locales/et/messages.po
  - frontend2/package.json
  - frontend2/src/App.tsx
  - frontend2/src/lib/i18n.ts
  - frontend2/src/main.tsx
  - frontend2/src/routes/index.tsx
  - frontend2/src/styles/globals.css
  - frontend2/src/vite-env.d.ts
  - frontend2/tsconfig.app.json
  - frontend2/tsconfig.json
  - frontend2/tsconfig.node.json
  - frontend2/vite.config.ts
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 48: Code Review Report

**Reviewed:** 2026-04-09T10:00:00Z
**Depth:** standard
**Files Reviewed:** 16
**Status:** issues_found

## Summary

This is a project scaffold for the `frontend2` retro-themed React app. The stack is well-chosen (React 19, React Router 7, Lingui 5, Tailwind v4, Vite 8, TypeScript 6) with strict TypeScript settings enabled. The overall quality is good for a scaffold — no security vulnerabilities found, no hardcoded secrets.

Three warnings relate to runtime correctness in the i18n system: an unvalidated locale key lookup, an unhandled async language-switch, and a missing re-render trigger after catalog activation. Three info items cover a non-null assertion, the dependency on compiled catalog files, and the absence of the `eslint-plugin-react` plugin.

---

## Warnings

### WR-01: Unvalidated locale key lookup in `loadCatalog` will throw at runtime

**File:** `frontend2/src/lib/i18n.ts:18`
**Issue:** `catalogImports[locale]` is accessed without checking whether `locale` is a key in `catalogImports`. If any caller passes an unrecognised locale string (the language `<select>` calls `loadCatalog(e.target.value)` directly with the raw DOM value), the expression is `undefined`, and the subsequent `()` invocation throws `TypeError: catalogImports[locale] is not a function`. The `locales` map and `catalogImports` are maintained separately, so they can drift.
**Fix:**
```ts
export async function loadCatalog(locale: string) {
  if (!(locale in catalogImports)) {
    console.warn(`Unknown locale: ${locale}`);
    return;
  }
  const { messages } = await catalogImports[locale]();
  i18n.load(locale, messages);
  i18n.activate(locale);
}
```
Alternatively, accept `Locale` (the narrower type) instead of `string` and let TypeScript enforce it at compile time:
```ts
export async function loadCatalog(locale: Locale) {
  const { messages } = await catalogImports[locale]();
  i18n.load(locale, messages);
  i18n.activate(locale);
}
```

---

### WR-02: Unhandled promise in language-switch `onChange` handler

**File:** `frontend2/src/routes/index.tsx:56`
**Issue:** `onChange={(e) => loadCatalog(e.target.value)}` calls an `async` function without `await` or `.catch()`. If `loadCatalog` rejects (network error, unknown locale, missing compiled catalog), the rejection is silently swallowed. The user gets no feedback and the locale does not change.
**Fix:**
```tsx
onChange={(e) => {
  loadCatalog(e.target.value as Locale).catch((err) => {
    console.error("Failed to switch locale:", err);
    // optionally surface error to user via toast/alert
  });
}}
```
Or, if the component gains local state in the future, use an `async` event handler wrapper with error state.

---

### WR-03: Language switch does not trigger re-render of translated content

**File:** `frontend2/src/routes/index.tsx:36-67`
**Issue:** After `loadCatalog` resolves, `i18n.activate()` updates the global Lingui instance, but `DashboardPage` has no state update to force a re-render. The `useLinguiRuntime()` hook from `@lingui/react` subscribes to i18n changes internally, which works today, but `useLingui()` from `@lingui/react/macro` (the compile-time macro variant used on line 37) does not guarantee the same subscription behaviour. In practice the translations may not update until an unrelated re-render occurs.

The canonical pattern for a language switcher is to lift locale state into a React state variable so that changing locale triggers a React-driven re-render:
```tsx
// In App.tsx or a locale context
const [locale, setLocale] = useState<Locale>(defaultLocale);

const switchLocale = useCallback(async (next: Locale) => {
  await loadCatalog(next);
  setLocale(next);
}, []);
```
Then pass `switchLocale` down (or through context) so the select's `onChange` calls it and the component tree re-renders with the new locale.

---

## Info

### IN-01: Non-null assertion on `getElementById("root")` without fallback

**File:** `frontend2/src/main.tsx:6`
**Issue:** `document.getElementById("root")!` uses a TypeScript non-null assertion. If the element is absent (e.g., an HTML template is misconfigured), the runtime throws an unhelpful `Cannot read properties of null (reading 'render')`. This is standard Vite/React boilerplate but can be improved.
**Fix:**
```ts
const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element #root not found in document");
createRoot(rootEl).render(...);
```

---

### IN-02: App depends on compiled catalog files that are not tracked in the repository

**File:** `frontend2/src/lib/i18n.ts:13-14`
**Issue:** The dynamic imports reference `locales/en/messages.ts` and `locales/et/messages.ts`, which are the compiled output of `lingui compile` and are not in the reviewed file list (they are not committed). A fresh clone will fail to build or run until `npm run i18n:compile` is executed. This is not documented anywhere in the reviewed files.
**Fix:** Add a `postinstall` or `prebuild` script that runs `lingui compile`, or document the required setup step. For example in `package.json`:
```json
"scripts": {
  "prebuild": "lingui compile",
  "predev": "lingui compile",
  ...
}
```

---

### IN-03: `eslint-plugin-react` is absent from ESLint config

**File:** `frontend2/eslint.config.mjs`
**Issue:** Only `eslint-plugin-react-hooks` is configured. The core `eslint-plugin-react` is missing, which provides rules like `react/prop-types`, `react/display-name`, and `react/jsx-key`. The `react/jsx-key` rule in particular catches missing `key` props in mapped lists, which TypeScript does not detect.
**Fix:** Add `eslint-plugin-react` to devDependencies and extend the ESLint config:
```js
import reactPlugin from "eslint-plugin-react";

export default tseslint.config(
  { ignores: ["dist"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      "react": reactPlugin,
      "react-hooks": reactHooks,
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      "react/react-in-jsx-scope": "off", // not needed with React 17+ JSX transform
    },
    settings: {
      react: { version: "detect" },
    },
  },
);
```

---

_Reviewed: 2026-04-09T10:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
