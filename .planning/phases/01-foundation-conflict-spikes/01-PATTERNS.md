# Phase 1: Foundation + Conflict Spikes — Pattern Map

**Mapped:** 2026-05-01
**Files analyzed:** 14 (12 new under `frontend2/`, 2 new planning docs, 1 new CI workflow)
**Analogs found:** 13 / 14 (one no-analog: throwaway spike harness)

> **Key archaeology source:** `frontend2/` is currently empty (only `.gitkeep`), but git history holds the complete v2.1 scaffold from commit `5cbde14` (`feat(48-01): scaffold Vite + React 19 project in frontend2/`). The v2.1 scaffold was Vite 8 + React 19 + SWC + Lingui v5 + RR7 — i.e. the **same target stack** as v3.0 minus the Lingui-version bump. Every Phase 1 file has a near-perfect analog accessible via `git show <SHA>:frontend2/<path>`.
>
> **Convention:** when an analog cites `git show 5cbde14:` it means "the v2.1 scaffold commit"; `git show 4d4c233:` is plan 56-01 (TanStack Query wiring); `git show 879b3c4:` is plan 48-02 (RR7 + i18n); `git show 3826d24:` is plan 49-01 (api.ts); `git show c570d9f:` is plan 56-04 (forbidden-imports wiring); `git show 5e77f98:` is plan 65-11 (Playwright config).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `frontend2/package.json` | config (manifest) | — | `git show 5cbde14:frontend2/package.json` + `git show c570d9f:frontend2/package.json` | exact (same stack, version bumps only) |
| `frontend2/vite.config.ts` | config (build tool) | — | `git show 5cbde14:frontend2/vite.config.ts` | exact |
| `frontend2/tsconfig.json` | config (TS solution) | — | `git show 5cbde14:frontend2/tsconfig.json` | exact |
| `frontend2/tsconfig.app.json` | config (TS app) | — | `git show 5cbde14:frontend2/tsconfig.app.json` | exact |
| `frontend2/tsconfig.node.json` | config (TS for vite.config) | — | `git show 5cbde14:frontend2/tsconfig.node.json` | exact |
| `frontend2/index.html` | static (entry HTML) | — | `git show 5cbde14:frontend2/index.html` | exact |
| `frontend2/src/main.tsx` | entry (React bootstrap) | — | `git show 5cbde14:frontend2/src/main.tsx` | exact |
| `frontend2/src/App.tsx` | provider wiring | — | `git show 4d4c233:frontend2/src/App.tsx` (post-56-01 provider stack) | role-match (Phase 1 stub is a subset) |
| `frontend2/src/routes/index.tsx` | route config | — | `git show 879b3c4:frontend2/src/routes/index.tsx` | role-match (Phase 1 has only one placeholder route) |
| `frontend2/src/lib/queryClient.ts` | config (singleton) | — | `git show 4d4c233:frontend2/src/lib/queryClient.ts` | exact (port verbatim) |
| `frontend2/src/lib/api.ts` | utility (HTTP client) | request-response | `git show 3826d24:frontend2/src/lib/api.ts` (+ post-56-01 FormData edit at `git show 4d4c233:`) | exact (port verbatim per CARRY-FORWARD) |
| `frontend2/src/styles/globals.css` | static (CSS entry) | — | `git show 5cbde14:frontend2/src/styles/globals.css` | exact |
| `frontend2/.gitignore` | config (VCS) | — | `git show 5cbde14:frontend2/.gitignore` + `git show 5e77f98:frontend2/.gitignore` | exact |
| `frontend2/playwright.config.ts` | config (E2E) | — | `git show 5e77f98:frontend2/playwright.config.ts` | exact (port verbatim per CLAUDE.md) |
| `frontend2/vitest.config.ts` | config (unit tests) | — | `git show 5e77f98:frontend2/vitest.config.ts` | exact |
| `frontend2/lingui.config.ts` *(only if Lingui wins)* | config (i18n) | — | `git show 5cbde14:frontend2/lingui.config.ts` | exact (locale list extends to et+ru) |
| `scripts/check-forbidden-imports.mjs` | utility (CI guard) | batch (file scan) | EXISTING — `/home/antti/Repos/Misc/home-warehouse-system/scripts/check-forbidden-imports.mjs` | self (no edit; wire only) |
| `.github/workflows/lint-frontend2.yml` | CI surface | event-driven (PR/push) | none in repo (`.github/` does not exist) | no analog — use RESEARCH.md Code Example |
| `.planning/research/CARRY-FORWARD.md` | doc (planning) | — | RESEARCH.md Pattern 5 layout | no codebase analog (planning artifact) |
| `.planning/research/I18N-DECISION.md` | doc (planning) | — | RESEARCH.md Pattern 2 evidence template | no codebase analog (planning artifact) |
| **i18n spike harness** *(throwaway branch only)* | scratch | — | RESEARCH.md Pattern 2 | NO ANALOG (intentionally not committed to main) |

## Pattern Assignments

### `frontend2/package.json` (NEW, role: config)

**Analog:** `git show 5cbde14:frontend2/package.json` (initial scaffold) merged with `git show c570d9f:frontend2/package.json` (forbidden-imports + prebuild script).

**Verbatim base from v2.1 scaffold** (top-level shape — copy field-for-field, only versions change):

```json
{
  "name": "frontend2",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "prebuild": "bun run lint:imports",
    "preview": "vite preview",
    "lint": "eslint .",
    "lint:imports": "node ../scripts/check-forbidden-imports.mjs src",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "test:e2e:headed": "playwright test --headed",
    "i18n:extract": "lingui extract",
    "i18n:compile": "lingui compile"
  }
}
```

**Phase 1 deltas vs v2.1 base** (per RESEARCH.md `## Standard Stack`):

- Bump `vite` `^8.0.4` → `^8.0.10`, `tailwindcss` & `@tailwindcss/vite` `^4.2.2` → `^4.2.4`
- Bump `typescript` `~6.0.2` → **`^5.9.5`** (downgrade — research D-A4 explicitly pins 5.9.5; do NOT debut TS 6 in Phase 1 even though v2.1 used `~6.0.2`)
- Bump `react` & `react-dom` `^19.2.5` → `^19.2.5` (unchanged)
- Bump `react-router` `^7.14.0` → `^7.14.2`
- Add `@tanstack/react-query@^5.100.7` + `@tanstack/react-query-devtools@^5.100.7` (matches plan 56-01 pattern)
- Add `react-hook-form@^7.74.0` + `@hookform/resolvers@^5.2.2` + `zod@^4.4.1` (FOUND-01 stack)
- Add `@playwright/test@^1.59.1` + `vitest@^4.1.5` + `@testing-library/{react,jest-dom,user-event}` + `msw@^2.14.2` + `rollup-plugin-visualizer`
- i18n deps: install ONLY the spike winner. If Lingui wins (D-03 default), use `@lingui/{core,react}@^6.0.1` + dev `@lingui/{cli,vite-plugin}@^6.0.1` + `@lingui/swc-plugin@^6.0.0` (note: v2.1 was `^5.9.5` — Phase 1 bumps to v6 if it wins).
- Drop `eslint-config-next` etc. from the legacy `frontend/package.json` (not relevant; this is Vite, not Next)

**Pitfall checks per RESEARCH.md:**
- AP-6: pin `^X.Y.Z`, never `latest`
- Pitfall 1: pin `@lingui/swc-plugin` exact (no caret) if Lingui wins
- Plan 56-04 lesson: the `prebuild: "bun run lint:imports"` line is what makes the CI guard local-fail-fast — preserve it verbatim.

---

### `frontend2/vite.config.ts` (NEW, role: config)

**Analog:** `git show 5cbde14:frontend2/vite.config.ts` (verbatim — the v2.1 scaffold ALREADY had `/api → :8080` proxy + `@vitejs/plugin-react-swc` + `@tailwindcss/vite` + `@lingui/swc-plugin` + `@/` alias).

**Port-verbatim core pattern** (everything in this block lands unchanged in Phase 1):

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import { lingui } from "@lingui/vite-plugin";
import path from "path";

export default defineConfig({
  plugins: [
    react({
      plugins: [["@lingui/swc-plugin", {}]],
    }),
    tailwindcss(),
    lingui(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
});
```

**Phase 1 conditional edits:**

- If react-intl wins the spike: REMOVE the `lingui()` plugin AND the `react({ plugins: [["@lingui/swc-plugin", {}]] })` inner-plugins arg. Keep `react()` bare. Add `vite-plugin-babel` + `babel-plugin-formatjs` ONLY if the spike concludes Babel is needed (RESEARCH.md AP-7 — prefer FormatJS CLI extraction out-of-band over mixing toolchains).
- Pitfall 6: keep `changeOrigin: true` — it rewrites the Host header so backend cookies bind correctly. RESEARCH.md Code Example also adds `secure: false`; v2.1 omitted it because backend is plain HTTP. Acceptable to add or omit; recommend matching RESEARCH.md.
- Forward-compat (Phase 11): leave a commented `manualChunks` slot; v2.1 added scanner-WASM chunking in commit `5646d3e` (`chore(64-02)`). Phase 1 should leave a placeholder comment per RESEARCH.md Code Example.
- Add `port: 5173` under `server` block (v2.1 omitted; Vite defaults to 5173 anyway, but RESEARCH.md Code Example includes it for explicitness — recommend adding for E2E contract clarity).

---

### `frontend2/tsconfig.json` + `frontend2/tsconfig.app.json` + `frontend2/tsconfig.node.json` (NEW, role: config)

**Analog:** `git show 5cbde14:frontend2/tsconfig*.json` — verbatim port. The three-file project-references layout is the official Vite `react-swc-ts` template shape.

**Port-verbatim `tsconfig.json` (solution file):**

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

**Port-verbatim `tsconfig.app.json` core flags** (all preserved; only `target` may bump to ES2022 per Wave 0 gap list):

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true,
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src"]
}
```

**Phase 1 deltas:** Add `"verbatimModuleSyntax": true` (RESEARCH.md `## Standard Stack` calls this out for TS 5.9.5 idioms). Optionally bump `target`/`lib` to ES2022/ES2023; v2.1 used ES2020 with no issue.

`tsconfig.node.json` is **verbatim** from v2.1 — no edits.

---

### `frontend2/index.html` (NEW, role: static entry)

**Analog:** `git show 5cbde14:frontend2/index.html` — port verbatim. The IBM Plex Mono CDN preconnect is locked design infrastructure but Phase 1 does NOT yet use it (Phase 2 owns typography). Recommend keeping the preconnect lines so Phase 2 doesn't have to touch this file again.

**Port-verbatim:**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;700&display=swap" rel="stylesheet" />
    <title>Home Warehouse</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

**Phase 1 delta:** v2.1 used `IBM Plex Mono`. Phase 2 will swap to `JetBrains Mono` per `## Standard Stack`. Phase 1 may either (a) leave Plex (Phase 2 swaps), or (b) preemptively use `@fontsource-variable/jetbrains-mono` in Phase 2's spirit. **Recommend (a)** — keep v2.1 verbatim; Phase 1 is plumbing.

---

### `frontend2/src/main.tsx` (NEW, role: entry)

**Analog:** `git show 5cbde14:frontend2/src/main.tsx` — port verbatim.

**Port-verbatim:**

```typescript
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/styles/globals.css";
import App from "@/App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

No deltas — this file is a no-decision file; the v2.1 shape is the standard `react-swc-ts` template output.

---

### `frontend2/src/App.tsx` (NEW, role: provider wiring)

**Analog:** `git show 4d4c233:frontend2/src/App.tsx` (post-Plan-56-01 provider stack — the most mature analog).

**Phase 1 scope is a SUBSET of the analog.** The full v2.1 stack mounted I18nProvider + BrowserRouter + QueryClientProvider + AuthProvider + ToastProvider. Phase 1 mounts ONLY `QueryClientProvider + BrowserRouter + Routes` (RESEARCH.md `## Code Examples → Provider stack skeleton`). AuthProvider/ToastProvider/I18nProvider land in Phase 5/6.

**Provider-stack scaffold pattern from analog** (lines 23-49 of `git show 4d4c233:frontend2/src/App.tsx`):

```tsx
import { useEffect, useState, lazy, Suspense } from "react";
import { BrowserRouter } from "react-router";
import { I18nProvider } from "@lingui/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { i18n, loadCatalog, defaultLocale } from "@/lib/i18n";
import { queryClient } from "@/lib/queryClient";
import { AuthProvider } from "@/features/auth/AuthContext";
import { ToastProvider } from "@/components/retro";
import { AppRoutes } from "@/routes";

const ReactQueryDevtoolsLazy = lazy(() =>
  import("@tanstack/react-query-devtools").then((m) => ({ default: m.ReactQueryDevtools }))
);

function DevtoolsLazy() {
  return (
    <Suspense fallback={null}>
      <ReactQueryDevtoolsLazy initialIsOpen={false} />
    </Suspense>
  );
}

export default function App() {
  // ... loadCatalog gate omitted in Phase 1 (no i18n yet)
  return (
    <I18nProvider i18n={i18n}>
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <ToastProvider>
              <AppRoutes />
            </ToastProvider>
          </AuthProvider>
          {import.meta.env.DEV && <DevtoolsLazy />}
        </QueryClientProvider>
      </BrowserRouter>
    </I18nProvider>
  );
}
```

**Phase 1 reduction (RESEARCH.md `## Code Examples → Provider stack skeleton`):**

```tsx
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtoolsLazy } from "@/lib/devtools";  // OR inline lazy as in analog
import { BrowserRouter } from "react-router";
import { queryClient } from "@/lib/queryClient";
import { AppRoutes } from "@/routes";

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
      {import.meta.env.DEV && <ReactQueryDevtoolsLazy />}
    </QueryClientProvider>
  );
}
```

**Locked invariants from analog (do NOT regress in Phase 1):**

- Provider order is `BrowserRouter > QueryClientProvider`. RESEARCH.md Code Example shows them swapped (`QueryClientProvider > BrowserRouter`); the v2.1 production order has BrowserRouter outermost. Either works for Phase 1 (no AuthProvider yet); recommend matching v2.1 order so Phase 6 doesn't have to reorder.
- Devtools MUST be lazy (`React.lazy` + `Suspense`) AND gated by `import.meta.env.DEV` (Pitfall 4 — ships ~30KB to prod otherwise).
- Use `<ReactQueryDevtools initialIsOpen={false} />` per analog.

**Phase 1 explicit OMISSIONS (deferred to later phases):**
- I18nProvider + `loadCatalog` gate — Phase 5 (after i18n spike winner is wired)
- AuthProvider — Phase 5
- ToastProvider — Phase 6

---

### `frontend2/src/routes/index.tsx` (NEW, role: route config)

**Analog:** `git show 879b3c4:frontend2/src/routes/index.tsx` (Plan 48-02 — RR7 library mode with declarative `<Routes>`).

**Library-mode pattern from analog** (port the SHAPE, not the v2.1 retro-cream styling — that's Phase 2/3 territory):

```tsx
import { Routes, Route } from "react-router";

function PlaceholderShell() {
  return (
    <main style={{ padding: 16, fontFamily: "monospace" }}>
      <h1>frontend2 — v3.0 placeholder shell</h1>
      <p>Phase 1 scaffold OK. Tokens (Phase 2), chrome (Phase 3), atoms (Phase 4) follow.</p>
    </main>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<PlaceholderShell />} />
      <Route path="*" element={<PlaceholderShell />} />
    </Routes>
  );
}
```

**Locked invariants from analog (RESEARCH.md AP-1):**
- Library mode (`<Routes>` + `<Route>`) — NOT framework mode. The analog NEVER imports from `react-router/dom` framework helpers; it imports `Routes`, `Route`, `Link` from `"react-router"` (RR7's core).
- `AppRoutes` is a named export (not default) — App.tsx imports it via `import { AppRoutes } from "@/routes"`.

**Phase 1 explicit OMISSIONS:**
- No retro panels / hazard-stripe / NavBar — those carry tokens/atoms from Phase 2-4.
- No `useLingui` — i18n is post-spike Phase 5 work.
- No multiple routes — the Phase 1 placeholder shell is one page; later phases add real routes.

---

### `frontend2/src/lib/queryClient.ts` (NEW, role: config singleton)

**Analog:** `git show 4d4c233:frontend2/src/lib/queryClient.ts` — port VERBATIM (Plan 56-01 hit this exact shape and it shipped).

**Verbatim port:**

```typescript
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: { retry: 0 },
  },
});
```

**Notes:**
- v2.1 PATTERNS.md (56-PATTERNS.md lines 77-99) cites `lib/i18n.ts` as the singleton-shape analog (named const, no class wrapper, no default export). The same convention applies in v3.0.
- RESEARCH.md `## Code Examples → frontend2/src/lib/queryClient.ts` shows the same shape minus the `gcTime` and `mutations` keys. The v2.1 shipped shape is fuller — recommend using v2.1's exact constants (CARRY-FORWARD.md item 7 in RESEARCH.md "Don't Hand-Roll" table: "Port `lib/queryClient.ts` from v2.1 archive (defaults: staleTime: 30_000, retry: standard)").

---

### `frontend2/src/lib/api.ts` (NEW, role: utility — port verbatim per CARRY-FORWARD)

**Analog:** `git show 3826d24:frontend2/src/lib/api.ts` (Plan 49-01 — original with cookie-JWT + 401 single-flight refresh + HttpError + helpers) PLUS the FormData edit applied by Plan 56-01 in commit `4d4c233` (added `postMultipart` + FormData detection).

**Port-verbatim core (fetch wrapper with single-flight 401 refresh):**

```typescript
import type { ApiError } from "./types";

const BASE_URL = "/api";

let storedRefreshToken: string | null = null;
let refreshPromise: Promise<void> | null = null;

export function setRefreshToken(token: string | null): void { storedRefreshToken = token; }
export function getRefreshToken(): string | null { return storedRefreshToken; }

async function parseError(response: Response): Promise<Error> {
  try {
    const error: ApiError = await response.json();
    return new Error(error.detail || error.message || `HTTP ${response.status}`);
  } catch {
    return new Error(`HTTP ${response.status}: ${response.statusText || "Request failed"}`);
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) return undefined as T;
  return response.json();
}

async function doRefresh(): Promise<void> {
  if (!storedRefreshToken) throw new Error("Session expired");
  const res = await fetch(`${BASE_URL}/auth/refresh`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: storedRefreshToken }),
  });
  if (!res.ok) { storedRefreshToken = null; throw new Error("Session expired"); }
  const data = await res.json();
  if (data.refresh_token) storedRefreshToken = data.refresh_token;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const isFormData = options.body instanceof FormData;            // ← from Plan 56-01
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(options.headers as Record<string, string>),
  };

  const response = await fetch(`${BASE_URL}${endpoint}`, { ...options, headers, credentials: "include" });

  if (response.status === 401) {
    if (!refreshPromise) refreshPromise = doRefresh();
    try { await refreshPromise; } catch (err) { refreshPromise = null; throw err; }
    refreshPromise = null;
    const retryResponse = await fetch(`${BASE_URL}${endpoint}`, { ...options, headers, credentials: "include" });
    if (!retryResponse.ok) throw await parseError(retryResponse);
    return parseResponse<T>(retryResponse);
  }

  if (!response.ok) throw await parseError(response);
  return parseResponse<T>(response);
}

export function get<T>(endpoint: string): Promise<T> { return request<T>(endpoint, { method: "GET" }); }
export function post<T>(endpoint: string, data?: unknown): Promise<T> {
  return request<T>(endpoint, { method: "POST", body: data ? JSON.stringify(data) : undefined });
}
export function patch<T>(endpoint: string, data: unknown): Promise<T> {
  return request<T>(endpoint, { method: "PATCH", body: JSON.stringify(data) });
}
export function del<T = void>(endpoint: string): Promise<T> { return request<T>(endpoint, { method: "DELETE" }); }
export function postMultipart<T>(endpoint: string, form: FormData): Promise<T> {
  return request<T>(endpoint, { method: "POST", body: form });   // ← from Plan 56-01
}
```

**Locked invariants (CARRY-FORWARD.md item 1; RESEARCH.md AP-2):**
- Cookie-JWT pattern: `credentials: "include"` on every fetch. Do NOT regress to localStorage Bearer tokens (Pitfall #10).
- Single-flight refresh: `refreshPromise` module-level — the second concurrent 401 awaits the same in-flight refresh.
- Refresh endpoint MUST keep `Content-Type: application/json` (count of `application/json` in file MUST be exactly 2 — request() and doRefresh()).
- FormData bypass: `isFormData ? {} : { "Content-Type": "application/json" }` lets the browser supply the multipart boundary.

**Phase 1 dependency:** This file imports `ApiError` from `./types`. Carry forward `frontend2/src/lib/types.ts` from `git show 3826d24:frontend2/src/lib/types.ts` in the same plan task (or inline the `ApiError` type if `types.ts` carries a wider surface that Phase 1 doesn't need yet).

---

### `frontend2/src/styles/globals.css` (NEW, role: static)

**Analog:** `git show 5cbde14:frontend2/src/styles/globals.css` — verbatim one-liner.

**Port-verbatim (Phase 1 minimum per RESEARCH.md `## Code Examples → Tailwind v4 entry`):**

```css
@import "tailwindcss";

/* Body resets only — DO NOT add tokens or scanlines yet (Phase 2 territory). */
html, body, #root { height: 100%; margin: 0; }
```

**Locked invariant (Pitfall 3):** Phase 1 ships ONLY `@import "tailwindcss";` (+ minimal body reset). NO `@theme` block — Phase 2 ports the locked design tokens. Pinning `tailwindcss` and `@tailwindcss/vite` to identical `^4.2.4` is critical (version skew breaks v4's parser).

---

### `frontend2/.gitignore` (NEW, role: config)

**Analog:** `git show 5cbde14:frontend2/.gitignore` (initial scaffold) merged with `git show 5e77f98:frontend2/.gitignore` (added Playwright write-dirs).

**Port-verbatim merged set:**

```gitignore
# Logs
logs
*.log
npm-debug.log*

node_modules
dist
dist-ssr
*.local
*.tsbuildinfo

# Playwright (added by Plan 65-11)
test-results/
playwright-report/
playwright/.cache/

# Editor directories and files
.vscode/*
!.vscode/extensions.json
.idea
.DS_Store

# Env files (security: never commit)
.env*
```

**Phase 1 delta:** add `.env*` (RESEARCH.md `## Security Domain` — `.gitignore` excludes `.env*` is the standard control for V14 Configuration).

---

### `frontend2/playwright.config.ts` (NEW, role: config)

**Analog:** `git show 5e77f98:frontend2/playwright.config.ts` — port VERBATIM. This is THE auth-contract config from CLAUDE.md; Phase 1 reserves the path even though no specs ship yet.

**Verbatim port:**

```typescript
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  reporter: "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "en-US",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox",  use: { ...devices["Desktop Firefox"] } },
  ],
  // No webServer config — expect the developer to have `bun run dev` + backend running.
});
```

**Locked invariants (RESEARCH.md AP-8 + CLAUDE.md auth contract):**
- `baseURL` defaults to `http://localhost:5173` — matches Vite dev server port.
- TWO projects (chromium + firefox); webkit is intentionally NOT in the v2.1 contract.
- NO `webServer` config — developer runs the stack manually per CLAUDE.md runbook.
- `E2E_BASE_URL` env override is preserved.

---

### `frontend2/vitest.config.ts` (NEW, role: config)

**Analog:** `git show 5e77f98:frontend2/vitest.config.ts` — port VERBATIM.

**Verbatim port:**

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [
    react({
      plugins: [["@lingui/swc-plugin", {}]],
    }),
  ],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test-utils.tsx"],
    globals: true,
    exclude: ["**/node_modules/**", "**/dist/**", "**/e2e/**"],
  },
});
```

**Locked invariants:**
- `exclude: ["**/e2e/**"]` is critical — Playwright's `test.describe` API differs from Vitest's; co-mingling breaks `bun run test`.
- The `@/` alias resolution must be identical to vite.config.ts so unit-test imports resolve the same way as build.
- If react-intl wins the spike: drop the `@lingui/swc-plugin` from the plugins array (mirror vite.config.ts edits).
- `setupFiles: ["./src/test-utils.tsx"]` — Phase 1 reserves the path; the file may be a one-line stub until Phase 4 brings real RTL helpers.

---

### `frontend2/lingui.config.ts` (NEW, **only if Lingui wins**)

**Analog:** `git show 5cbde14:frontend2/lingui.config.ts`.

**Port-verbatim with locale extension:**

```typescript
import { defineConfig } from "@lingui/cli";

export default defineConfig({
  sourceLocale: "en",
  locales: ["en", "et", "ru"],   // ← v2.1 was ["en", "et"]; v3.0 adds ru per Pitfall 2
  catalogs: [
    { path: "<rootDir>/locales/{locale}/messages", include: ["src"] },
  ],
});
```

**Locked invariants (Pitfall 2):**
- If carrying v2.1 catalog files forward, run `lingui extract --convert-from=v5` once and commit in the same SHA.
- Lock `format: "po"` (matches `## Code Examples → Lingui v6 + SWC config` in RESEARCH.md, even though v2.1 omitted the field — Lingui v6's default is `po`, so explicit is safer).

---

### `scripts/check-forbidden-imports.mjs` (EXISTING — wire into CI only)

**Analog:** itself — already exists at `/home/antti/Repos/Misc/home-warehouse-system/scripts/check-forbidden-imports.mjs`, already tested at `scripts/__tests__/check-forbidden-imports.test.mjs`.

**Read carefully — important behaviors that the planner should NOT regress:**

```javascript
// Lines 11-12: scan root override via first CLI arg
const SCAN_ROOT = resolve(process.argv[2] || join(REPO_ROOT, "frontend2", "src"));

// Lines 14-18: hard-fails if scan root missing (Pitfall 7)
try { statSync(SCAN_ROOT); } catch {
  console.error(`check-forbidden-imports: scan root not found: ${SCAN_ROOT}`);
  process.exit(1);
}

// Lines 22-24: forbid pattern set
const SPECIFIER_RE = /(?:from|import)\s*\(?\s*["']([^"']+)["']/g;
const FORBIDDEN_EXACT = /^(?:idb|serwist|@serwist\/.+)$/i;
const FORBIDDEN_SUBSTR = /(offline|sync)/i;
```

**Phase 1 actions:**
- DO NOT modify the script.
- Add `frontend2/package.json` script: `"lint:imports": "node ../scripts/check-forbidden-imports.mjs src"` (verbatim from `git show c570d9f:frontend2/package.json`).
- Add `prebuild: "bun run lint:imports"` (verbatim from same commit) — local fail-fast guard.
- Pitfall 7 sequencing: ensure `frontend2/src/main.tsx` exists BEFORE the CI lint workflow runs on the Phase 1 PR (otherwise `statSync` throws and the guard exits 1 with "scan root not found"). Order Phase 1 plan tasks accordingly.

**Existing tests** (do not regress):
- `scripts/__tests__/check-forbidden-imports.test.mjs` runs via `node --test`. Test 5 (line 33-37) explicitly verifies `frontend2/src` passes the guard — Phase 1's main.tsx must not import any forbidden specifier (it doesn't).

---

### `.github/workflows/lint-frontend2.yml` (NEW — no codebase analog)

**Analog:** none — `.github/` does not exist at repo root (RESEARCH.md `## Existing Code Insights`). Use the verbatim YAML from RESEARCH.md `## Code Examples → GitHub Actions workflow`.

**Verbatim port from RESEARCH.md:**

```yaml
name: lint-frontend2

on:
  pull_request:
    paths:
      - "frontend2/**"
      - "scripts/check-forbidden-imports.mjs"
  push:
    branches: [master]
    paths:
      - "frontend2/**"
      - "scripts/check-forbidden-imports.mjs"

jobs:
  forbidden-imports:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with: { bun-version: 1.3.13 }
      - name: Run forbidden-imports grep guard
        run: node scripts/check-forbidden-imports.mjs
      - name: Run grep-guard self-tests
        run: node --test scripts/__tests__/check-forbidden-imports.test.mjs

  typecheck-frontend2:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with: { bun-version: 1.3.13 }
      - run: cd frontend2 && bun install --frozen-lockfile
      - run: cd frontend2 && bun run lint:tsc
```

**Locked invariants:**
- `oven-sh/setup-bun@v2` with `bun-version: 1.3.13` matches `## Standard Stack`.
- The `paths:` filter scopes the workflow to `frontend2/` + the script — touching backend Go code does NOT trigger this workflow.
- Pitfall 7 mitigation: the `forbidden-imports` job runs `node scripts/check-forbidden-imports.mjs` with NO scan-root arg, defaulting to `<repo>/frontend2/src`. Phase 1 must commit `frontend2/src/main.tsx` BEFORE merging this workflow, or the very first run fails on its own scaffold PR.

---

### `.planning/research/CARRY-FORWARD.md` (NEW — planning artifact, no codebase analog)

**Analog:** RESEARCH.md `## Architecture Patterns → Pattern 5: CARRY-FORWARD.md Structure` provides a verbatim layout template (RESEARCH.md lines 397-444).

**Required sections (FOUND-03):**

1. **Port Verbatim** table with exactly these 5 items (RESEARCH.md `## Existing Code Insights → Reusable Assets`):
   1. Auth flow (`lib/api.ts` cookie-JWT with single-flighted 401 refresh)
   2. OAuth callback handler
   3. Format hooks (`useDateFormat`, `useTimeFormat`, `useNumberFormat`)
   4. Playwright auth helper
   5. `scripts/check-forbidden-imports.mjs`

2. **Rebuild from Scratch** table with exactly these 4 items:
   1. Chrome (TopBar / Sidebar / Bottombar / PageHeader) — Phase 3
   2. Retro atoms — Phase 4
   3. Layout grid + design tokens — Phase 2
   4. Provider stack composition — Phase 6

3. **Backend Endpoint Specs** (D-10/D-11 — Phase 13 dashboard rollups):
   - `GET /api/workspaces/{wsId}/stats/capacity` → `{ total_items: number, capacity_target: number | null }`
   - `GET /api/workspaces/{wsId}/stats/activity?days=14` → `{ days: Array<{ date: string, count: number }> }`

**Source-SHA discipline (RESEARCH.md Open Question 1):** Each "Port Verbatim" row should cite the v2.1 source SHA explicitly (e.g., "Source: `git show 4d4c233:frontend2/src/lib/api.ts`"). This makes the document executable archaeology — a future planner can `git show` to reconstitute the exact text.

---

### `.planning/research/I18N-DECISION.md` (NEW — planning artifact, no codebase analog)

**Analog:** RESEARCH.md `## Architecture Patterns → Pattern 2: i18n Empirical Spike Protocol` (lines 320-361) provides the evidence template.

**Required content (FOUND-04):**
- Date + spike branch SHA (RESEARCH.md Open Question 3 — recommend tagging head SHA as `spike/i18n-decision-evidence` and referencing it here).
- For each candidate (Lingui v6 / react-intl): three evidence rows (compile log excerpt, extracted catalog excerpt, browser DOM snapshot).
- Final verdict + rationale.
- Bundle-size measurement for the winner via `vite build --report`.

**Default outcome (per D-03 tiebreaker):** if both pass all three test parts, Lingui v6 wins. If only one passes, that one wins. If neither passes, BLOCK Phase 1 and escalate (no viable i18n path).

---

### i18n spike harness — throwaway branch only (NO ANALOG, NOT COMMITTED TO MAIN)

Test harness is per-candidate: three minimal source files exercising one `<Trans>`/`<FormattedMessage>`, one plural rule, one interpolation. Same three messages on both candidates. Lives in branch `spike/i18n-decision`; NEVER merged to master per D-04.

Pitfall 8: spike branch's `bun.lockb` records platform-specific Lingui native binary; do a fresh `bun install` from clean when installing the winner in master.

---

## Shared Patterns

These cross-cutting concerns apply to multiple Phase 1 files.

### Pattern A: Pin Exact Versions, Never `latest`

**Source:** RESEARCH.md AP-6.
**Apply to:** `frontend2/package.json`, `.github/workflows/lint-frontend2.yml` (Bun version pin).

Every dep in `package.json` is `^X.Y.Z` form. Re-run `npm view <pkg> version` if execution date is > 7 days after research date (2026-05-01).

### Pattern B: `@/` Path Alias Resolution

**Source:** `git show 5cbde14:frontend2/tsconfig.app.json` line 21 + `git show 5cbde14:frontend2/vite.config.ts` lines 14-17 + `git show 5e77f98:frontend2/vitest.config.ts` lines 12-14.
**Apply to:** All three of `tsconfig.app.json` + `vite.config.ts` + `vitest.config.ts`.

```typescript
// vite.config.ts + vitest.config.ts
resolve: { alias: { "@": path.resolve(__dirname, "./src") } }

// tsconfig.app.json
"paths": { "@/*": ["./src/*"] }
```

If any one of these three drifts, IDE imports resolve but runtime/test fails (or vice versa). All three must be set consistently.

### Pattern C: SWC + (Conditional) Lingui Plugin Slot

**Source:** `git show 5cbde14:frontend2/vite.config.ts` lines 9-13 + `git show 5e77f98:frontend2/vitest.config.ts` lines 7-9.
**Apply to:** `vite.config.ts` + `vitest.config.ts`.

```typescript
react({
  plugins: [["@lingui/swc-plugin", {}]],
})
```

If Lingui wins spike → both files keep this. If react-intl wins → both files drop the inner-plugins arg (`react()` bare). Drift between the two files breaks unit-test parity with build (e.g., `t\`Hello\`` macro un-transformed in tests).

### Pattern D: `import.meta.env.DEV` Build-Time Gating

**Source:** `git show 4d4c233:frontend2/src/App.tsx` line 41 + RESEARCH.md Pitfall 4.
**Apply to:** `frontend2/src/App.tsx` (Devtools mount), any future dev-only diagnostic surfaces.

```tsx
{import.meta.env.DEV && <DevtoolsLazy />}
```

Vite static-replaces `import.meta.env.DEV` to `false` for production; the dead branch is then tree-shaken by Rolldown. Verify by grepping the prod bundle for `react-query-devtools` (Phase 1 verification per RESEARCH.md `## Common Pitfalls → Pitfall 4`).

### Pattern E: Vite Proxy Contract `/api → :8080`

**Source:** `git show 5cbde14:frontend2/vite.config.ts` lines 19-26 + project-root CLAUDE.md.
**Apply to:** `vite.config.ts`.

```typescript
server: {
  proxy: {
    "/api": { target: "http://localhost:8080", changeOrigin: true },
  },
}
```

`changeOrigin: true` is non-negotiable (Pitfall 6 — strips Set-Cookie otherwise). The Playwright auth contract from CLAUDE.md ASSUMES this proxy works.

### Pattern F: Bun-First Tooling Posture

**Source:** project-root CLAUDE.md + RESEARCH.md `## Standard Stack`.
**Apply to:** `frontend2/package.json` scripts, `.github/workflows/lint-frontend2.yml` Bun setup, mise tasks (if added).

All install/run commands use `bun`: `bun install`, `bun run dev`, `bun run build`, `bun run test`, `bun run lint:imports`. Vite (not Bun's bundler) drives dev/build.

### Pattern G: Forbidden-Import Categories (Online-Only Constraint)

**Source:** EXISTING `scripts/check-forbidden-imports.mjs` lines 22-24.
**Apply to:** Every new file under `frontend2/src/**`.

```javascript
const FORBIDDEN_EXACT = /^(?:idb|serwist|@serwist\/.+)$/i;
const FORBIDDEN_SUBSTR = /(offline|sync)/i;
```

Phase 1 has no user-facing strings to fail on, BUT the planner must not accidentally name a file `frontend2/src/lib/sync.ts` or import a package whose name contains "sync"/"offline" — even something benign like `@some-org/event-sync` would fail the guard.

---

## No Analog Found

| File | Role | Why no analog |
|------|------|---------------|
| `.github/workflows/lint-frontend2.yml` | CI | `.github/` does not exist at repo root; this is NEW infrastructure. RESEARCH.md `## Code Examples → GitHub Actions workflow` provides the verbatim template. |
| `.planning/research/CARRY-FORWARD.md` | doc | Planning artifact; format is discretionary per CONTEXT.md. RESEARCH.md Pattern 5 provides the layout. |
| `.planning/research/I18N-DECISION.md` | doc | Planning artifact written AFTER the spike; format defined in RESEARCH.md Pattern 2. |
| i18n spike harness (3 source files × 2 candidates) | scratch | Lives in throwaway branch; never committed to master per D-04. |

## Metadata

**Analog search scope:**
- `frontend2/` (current — empty, only `.gitkeep`)
- Git history via `git show` for SHAs `5cbde14` (initial scaffold), `879b3c4` (RR7+i18n), `3826d24` (api.ts), `4d4c233` (queryClient + provider stack), `c570d9f` (forbidden-imports wiring), `5e77f98` (Playwright)
- `scripts/check-forbidden-imports.mjs` (existing, working — verified by reading source)
- `scripts/__tests__/check-forbidden-imports.test.mjs` (existing tests)
- `.planning/milestones/v2.1-phases/56-foundation-api-client-and-react-query/56-PATTERNS.md` (predecessor PATTERNS.md style reference)
- `.mise.toml` (task surface alternative for CI)
- `frontend/` (legacy Next.js — referenced for Playwright shape contrast only; v2.1 frontend2 patterns dominate)

**Files scanned:** ~25 (most via `git show` from 6 SHAs)

**Pattern extraction date:** 2026-05-01

**Key insight for the planner:** Phase 1 is **assembly, not design**. Every Phase 1 file has either (a) a verbatim git-history analog from the v2.1 scaffold + plans 48-02 / 49-01 / 56-01 / 56-04 / 65-11, or (b) a verbatim code example in RESEARCH.md. The two exceptions are the two new planning docs (CARRY-FORWARD.md / I18N-DECISION.md) and the throwaway spike harness — and even those have verbatim layout templates in RESEARCH.md. The planner's job is sequencing + delta-application, not invention.
