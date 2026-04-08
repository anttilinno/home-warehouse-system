# Phase 48: Project Scaffold - Research

**Researched:** 2026-04-08
**Domain:** Vite + React 19 project scaffold with routing, design tokens, i18n, API proxy
**Confidence:** HIGH

## Summary

This phase sets up a greenfield Vite + React 19 SPA in `/frontend2` -- a completely separate frontend from the existing Next.js `frontend/`. The core stack is Vite 8, React 19, React Router v7 (declarative/library mode), Tailwind CSS 4 with `@theme` design tokens, and Lingui v5 for i18n (EN + ET). Bun is the package manager per project convention.

The backend CORS middleware already allows `http://localhost:3001` but NOT `http://localhost:5173` (Vite default). Either add `:5173` to CORS or configure Vite to use port 5173 and rely on proxy-only API access (proxy bypasses CORS). The Vite dev server proxy is the cleaner approach -- proxied requests go from Vite to Go directly, no CORS needed for `/api/*`.

**Primary recommendation:** Scaffold with `bun create vite frontend2 --template react-swc-ts`, then add Tailwind CSS 4 via `@tailwindcss/vite`, React Router v7 in declarative mode, and Lingui v5 with SWC plugin. Define retro design tokens in a single `globals.css` using Tailwind's `@theme` block.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Follow the BAM (Build & Mad) industrial game UI aesthetic pixel-accurately. Reference images stored in `.planning/references/retro-ui/` (6 screenshots).
- **D-02:** Color palette extracted from BAM references (cream #F5F0E1, charcoal #2A2A2A, near-black #1A1A1A borders 3-4px, amber #D4A017, orange #E67E22, red #CC3333, green #4A7C4A, blue #3366AA, hazard yellow #FFD700, hazard black #1A1A1A, gray #8B8B8B).
- **D-03:** Light theme only for scaffold. Retro-dark deferred.
- **D-04:** Design patterns: thick dark outlines (3-4px), hazard stripes, beveled buttons, file-folder tabs, red X close buttons, segmented progress bars.
- **D-05:** System sans-serif for body, monospace (JetBrains Mono or IBM Plex Mono) for data fields. No custom retro font files.
- **D-06:** Uppercase text via CSS `text-transform: uppercase` for headings, tab labels, button text.
- **D-07:** Use Bun as the package manager for `/frontend2`.
- **D-08:** Feature-based directory structure (components/retro, components/layout, features/*, hooks, lib, routes, styles, locales).

### Claude's Discretion
- Vite configuration details (plugins, build settings)
- React Router v7 route structure (placeholder routes per success criteria)
- Lingui configuration specifics (extraction method, catalog format)
- Vite proxy configuration for backend API
- ESLint/TypeScript configuration
- Which specific monospace font (JetBrains Mono or IBM Plex Mono or similar)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SCAF-01 | Vite 8 + React 19 project scaffolded in `/frontend2` with dev server proxying to Go backend | Vite 8.0.7 confirmed current; proxy config via `server.proxy` in vite.config.ts |
| SCAF-02 | React Router v7 (library mode) configured with route structure matching frontend1 pages | React Router 7.14.0 declarative mode with BrowserRouter/Routes/Route components |
| SCAF-03 | Tailwind CSS 4 configured with `@theme` block defining retro design tokens | Tailwind 4.2.2 + @tailwindcss/vite plugin; `@theme` block in CSS replaces config file |
| SCAF-04 | Lingui v5 configured with EN + ET locale support, message extraction, and compile-time catalogs | Lingui 5.9.5 + @lingui/vite-plugin + SWC plugin; PO format catalogs, dynamic import loading |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vite | 8.0.7 | Build tool / dev server | [VERIFIED: npm registry] Current stable, first-party Tailwind plugin support |
| react | 19.2.4 | UI framework | [VERIFIED: npm registry] Latest React 19 stable |
| react-dom | 19.2.4 | React DOM renderer | [VERIFIED: npm registry] Matches React version |
| react-router | 7.14.0 | Client-side routing | [VERIFIED: npm registry] Declarative mode = library-style SPA routing |
| tailwindcss | 4.2.2 | Utility-first CSS | [VERIFIED: npm registry] v4 with CSS-first config via @theme |
| @tailwindcss/vite | 4.2.2 | Tailwind Vite integration | [VERIFIED: npm registry] First-party plugin, fastest integration |
| @lingui/core | 5.9.5 | i18n runtime | [VERIFIED: npm registry] Compile-time catalogs, small runtime |
| @lingui/react | 5.9.5 | React bindings for Lingui | [VERIFIED: npm registry] I18nProvider + useLingui hook |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @vitejs/plugin-react-swc | 4.3.0+ | React SWC transform | [VERIFIED: npm 4.3.0] Faster than Babel, required for Lingui SWC plugin |
| @lingui/cli | 5.9.5 | Message extraction/compilation | [VERIFIED: npm registry] CLI for `lingui extract` and `lingui compile` |
| @lingui/vite-plugin | 5.9.5 | Vite catalog compilation | [VERIFIED: npm registry] On-the-fly PO catalog compilation |
| @lingui/swc-plugin | 5.11.0 | SWC macro transform | [VERIFIED: npm registry] Replaces Babel plugin, faster builds |
| typescript | 6.0.2 | Type checking | [VERIFIED: npm registry] Current stable |
| eslint | 10.2.0 | Linting | [VERIFIED: npm registry] Current major |
| vitest | 4.1.3 | Unit testing | [VERIFIED: npm registry] Vite-native test runner, matches frontend1 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SWC plugin | Babel (@vitejs/plugin-react) | Babel slower but more ecosystem plugins; SWC is 10-20x faster, Lingui supports both |
| PO catalogs | JSON catalogs | PO is Lingui default, better tooling (Poedit, Weblate); JSON simpler but less ecosystem |
| Vitest | Jest | Vitest is Vite-native, zero extra config; Jest needs separate transform setup |

**Installation:**
```bash
cd frontend2
bun add react react-dom react-router @lingui/core @lingui/react
bun add -d vite @vitejs/plugin-react-swc typescript @tailwindcss/vite tailwindcss @lingui/cli @lingui/vite-plugin @lingui/swc-plugin @types/react @types/react-dom eslint vitest
```

## Architecture Patterns

### Recommended Project Structure
```
frontend2/
  src/
    components/
      retro/             # Shared retro UI primitives (Phase 50, empty placeholder now)
      layout/            # App shell, sidebar, topbar (Phase 51, empty placeholder now)
    features/
      auth/              # Login, register, route guard (Phase 49)
      dashboard/         # HUD stats, activity feed (Phase 52)
      items/             # Item CRUD, search (future)
      settings/          # 8 settings subpages (Phase 53)
    hooks/               # Shared hooks
    lib/
      api.ts             # API client (fetch wrapper)
      i18n.ts            # Lingui i18n instance + locale loader
      utils.ts           # Shared utilities
    routes/
      index.tsx          # Route definitions
    styles/
      globals.css        # Tailwind import + @theme retro tokens
    main.tsx             # App entry point
    App.tsx              # Root component with BrowserRouter + I18nProvider
  public/
  locales/
    en/
      messages.po        # English message catalog
    et/
      messages.po        # Estonian message catalog
  index.html
  vite.config.ts
  tsconfig.json
  lingui.config.ts
  eslint.config.mjs
```

### Pattern 1: Vite Dev Server Proxy
**What:** Forward `/api/*` requests to Go backend, avoiding CORS entirely for API calls
**When to use:** All API requests during development
**Example:**
```typescript
// Source: https://vite.dev/config/server-options#server-proxy
// vite.config.ts
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
});
```

### Pattern 2: Tailwind CSS 4 Retro Design Tokens
**What:** Define all retro colors, borders, shadows as Tailwind tokens in CSS
**When to use:** Single source of truth for design system
**Example:**
```css
/* Source: https://tailwindcss.com/blog/tailwindcss-v4 */
/* globals.css */
@import "tailwindcss";

@theme {
  /* Retro color palette (from D-02) */
  --color-retro-cream: #F5F0E1;
  --color-retro-charcoal: #2A2A2A;
  --color-retro-ink: #1A1A1A;
  --color-retro-amber: #D4A017;
  --color-retro-orange: #E67E22;
  --color-retro-red: #CC3333;
  --color-retro-green: #4A7C4A;
  --color-retro-blue: #3366AA;
  --color-retro-hazard-yellow: #FFD700;
  --color-retro-hazard-black: #1A1A1A;
  --color-retro-gray: #8B8B8B;

  /* Retro borders */
  --border-width-retro-thick: 3px;
  --border-width-retro-extra-thick: 4px;

  /* Retro shadows (beveled/embossed) */
  --shadow-retro-raised: 2px 2px 0px #1A1A1A;
  --shadow-retro-pressed: inset 2px 2px 0px rgba(0,0,0,0.3);

  /* Fonts */
  --font-sans: system-ui, -apple-system, sans-serif;
  --font-mono: 'IBM Plex Mono', 'JetBrains Mono', ui-monospace, monospace;
}
```
This produces utility classes like `bg-retro-cream`, `border-retro-thick`, `text-retro-ink`, `shadow-retro-raised`.

### Pattern 3: Lingui i18n Setup with Dynamic Loading
**What:** Configure Lingui with I18nProvider, dynamic catalog imports, and locale switching
**When to use:** All translatable text in the app
**Example:**
```typescript
// Source: https://lingui.dev/tutorials/react
// src/lib/i18n.ts
import { i18n } from "@lingui/core";

export const locales = {
  en: "English",
  et: "Eesti",
};

export const defaultLocale = "en";

export async function loadCatalog(locale: string) {
  const { messages } = await import(`../locales/${locale}/messages.po`);
  i18n.load(locale, messages);
  i18n.activate(locale);
}

export { i18n };
```

```tsx
// src/App.tsx
import { I18nProvider } from "@lingui/react";
import { BrowserRouter, Routes, Route } from "react-router";
import { i18n } from "./lib/i18n";

export default function App() {
  return (
    <I18nProvider i18n={i18n}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/about" element={<AboutPage />} />
        </Routes>
      </BrowserRouter>
    </I18nProvider>
  );
}
```

```tsx
// Using the t macro in a component
import { useLingui } from "@lingui/react/macro";

function HomePage() {
  const { t } = useLingui();
  return <h1>{t`Welcome to Home Warehouse`}</h1>;
}
```

### Pattern 4: React Router v7 Declarative Mode
**What:** Simple SPA routing with BrowserRouter, no SSR or data loaders
**When to use:** All page navigation in the SPA
**Example:**
```tsx
// Source: https://reactrouter.com/start/modes
// src/routes/index.tsx
import { Routes, Route } from "react-router";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/settings/*" element={<SettingsPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
```

### Anti-Patterns to Avoid
- **React Router Framework Mode:** Do NOT use framework mode -- it adds SSR, file-based routing, and a Vite plugin that is unnecessary for this SPA. Declarative mode is correct per user decision.
- **tailwind.config.js:** Do NOT create a Tailwind config file. Tailwind v4 uses CSS-first configuration via `@theme` blocks. There is no `tailwind.config.js`.
- **Static Lingui imports:** Do NOT statically import all locale catalogs. Use dynamic `import()` via the Vite plugin so only the active locale is loaded.
- **PostCSS for Tailwind:** Do NOT use `@tailwindcss/postcss`. Use `@tailwindcss/vite` -- it is faster and the recommended approach for Vite projects.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSS utility generation | Custom CSS variables + classes | Tailwind `@theme` block | Automatic utility class generation, purging, responsive variants |
| i18n message extraction | Manual string collection | `lingui extract` CLI | Scans source for t macros, generates PO catalogs automatically |
| i18n catalog compilation | Manual JSON building | `lingui compile` CLI + Vite plugin | Compiles PO to optimized JS, tree-shakeable |
| Dev server proxy | nginx/manual CORS config | Vite `server.proxy` | Zero-config for dev, handles WebSocket too |
| SWC/TS transforms | Babel config | @vitejs/plugin-react-swc | 10-20x faster, zero config needed |

## Common Pitfalls

### Pitfall 1: CORS vs Proxy Confusion
**What goes wrong:** Developers add `http://localhost:5173` to backend CORS and make direct API calls instead of using the proxy.
**Why it happens:** Instinct to configure CORS for every origin.
**How to avoid:** Use Vite proxy for all `/api/*` requests. The browser sees requests going to `localhost:5173/api/...`, Vite forwards to `localhost:8080/api/...`. No CORS headers needed. The backend already has CORS for `localhost:3001` (frontend1); Vite proxy avoids adding another origin.
**Warning signs:** Seeing CORS errors in browser console during dev.

### Pitfall 2: Tailwind v4 @theme vs @theme inline
**What goes wrong:** Using `@theme inline` when not needed, or mixing v3-style config with v4 syntax.
**Why it happens:** Frontend1 uses `@theme inline` because shadcn/ui requires CSS variable indirection. Retro tokens are static hex values -- no variable indirection needed.
**How to avoid:** Use plain `@theme` (not `@theme inline`) for the retro design tokens. Reserve `inline` only if you need CSS variables that change at runtime (e.g., future dark theme toggle).
**Warning signs:** Token values not applying, or unnecessary CSS variable layers.

### Pitfall 3: Lingui SWC Plugin Version Mismatch
**What goes wrong:** `@lingui/swc-plugin` version must be compatible with the SWC version used by `@vitejs/plugin-react-swc`.
**Why it happens:** SWC has a strict plugin ABI -- plugin compiled for one SWC version may not work with another.
**How to avoid:** Install the latest versions of both packages together. If build errors mention SWC plugin incompatibility, check the Lingui changelog for compatible version pairs.
**Warning signs:** Build errors about SWC plugin loading or ABI mismatch.

### Pitfall 4: React Router import path
**What goes wrong:** Importing from `react-router-dom` instead of `react-router`.
**Why it happens:** v6 used `react-router-dom` for browser APIs; v7 consolidated into `react-router`.
**How to avoid:** Always import from `react-router`, not `react-router-dom`. The package `react-router-dom` still exists as a re-export but `react-router` is canonical in v7.
**Warning signs:** Duplicate router packages, confusing import paths.

### Pitfall 5: Lingui Catalog Location
**What goes wrong:** Placing `locales/` inside `src/` instead of at project root, or misconfiguring `lingui.config.ts` paths.
**Why it happens:** Convention varies. D-08 places locales at `frontend2/locales/`.
**How to avoid:** Ensure `lingui.config.ts` `catalogs[0].path` points to `<rootDir>/locales/{locale}/messages` and `include` points to `["src"]`.
**Warning signs:** `lingui extract` finds no messages or writes to wrong location.

## Code Examples

### Lingui Configuration File
```typescript
// Source: https://lingui.dev/installation
// frontend2/lingui.config.ts
import { defineConfig } from "@lingui/cli";

export default defineConfig({
  sourceLocale: "en",
  locales: ["en", "et"],
  catalogs: [
    {
      path: "<rootDir>/locales/{locale}/messages",
      include: ["src"],
    },
  ],
});
```

### Vite Configuration (Complete)
```typescript
// frontend2/vite.config.ts
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

### Locale Switching Component
```tsx
// Source: https://lingui.dev/tutorials/react
import { useLingui } from "@lingui/react";
import { loadCatalog, locales } from "@/lib/i18n";

function LocaleSwitcher() {
  const { i18n } = useLingui();

  return (
    <select
      value={i18n.locale}
      onChange={(e) => loadCatalog(e.target.value)}
    >
      {Object.entries(locales).map(([code, name]) => (
        <option key={code} value={code}>{name}</option>
      ))}
    </select>
  );
}
```

### Hazard Stripe CSS Pattern
```css
/* Reusable hazard stripe background pattern for decorative borders */
@layer utilities {
  .bg-hazard-stripe {
    background: repeating-linear-gradient(
      -45deg,
      #FFD700,
      #FFD700 10px,
      #1A1A1A 10px,
      #1A1A1A 20px
    );
  }
}
```

### Package.json Scripts
```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "lint": "eslint .",
    "test": "vitest run",
    "test:watch": "vitest",
    "i18n:extract": "lingui extract",
    "i18n:compile": "lingui compile"
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| tailwind.config.js | CSS `@theme` blocks | Tailwind v4 (Jan 2025) | No JS config file, CSS-first tokens |
| @tailwindcss/postcss | @tailwindcss/vite | Tailwind v4 (Jan 2025) | 5x faster full builds, 100x faster incremental |
| react-router-dom v6 | react-router v7 | React Router v7 (2024) | Consolidated package, 3 modes (declarative/data/framework) |
| Lingui Babel plugin | Lingui SWC plugin | Lingui 4.x+ | 10-20x faster macro transforms |
| CRA (Create React App) | Vite | 2022+ | CRA deprecated, Vite is standard |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | IBM Plex Mono is available via system fonts or CDN without explicit install | Standard Stack | LOW -- fallback to ui-monospace works fine |
| A2 | @lingui/swc-plugin 5.11.0 is compatible with latest @vitejs/plugin-react-swc | Common Pitfalls | MEDIUM -- if incompatible, fall back to Babel plugin |
| A3 | Vite proxy handles cookie forwarding correctly for HttpOnly JWT cookies | Architecture Patterns | LOW -- Vite proxy forwards all headers by default |

## Open Questions

1. **Monospace Font Choice**
   - What we know: D-05 says "JetBrains Mono or IBM Plex Mono" -- both are Google Fonts / self-hosted options
   - What's unclear: Whether to use a CDN link, self-host the font, or rely on system fallback
   - Recommendation: Use IBM Plex Mono via Google Fonts CDN (single `<link>` in index.html). It has a more industrial feel matching BAM aesthetic. Fall back to `ui-monospace, monospace` for systems without network.

2. **ESLint Configuration Style**
   - What we know: ESLint 10.x uses flat config (eslint.config.mjs). Frontend1 uses eslint.config.mjs.
   - What's unclear: Which specific rules/plugins to include for React 19 + TypeScript
   - Recommendation: Use `@eslint/js` + `typescript-eslint` + `eslint-plugin-react-hooks`. Keep minimal for scaffold phase.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Bun | Package manager (D-07) | Yes | 1.3.9 | -- |
| Node.js | Vite runtime | Yes | 24.14.0 | -- |
| Go backend | API proxy target | Yes (project) | 1.25 | -- |
| PostgreSQL | Backend database | Yes (Docker) | -- | -- |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No (Phase 49) | -- |
| V3 Session Management | No (Phase 49) | -- |
| V4 Access Control | No (Phase 49) | -- |
| V5 Input Validation | No (scaffold only) | -- |
| V6 Cryptography | No | -- |

No security concerns for this scaffold phase -- it sets up tooling and placeholder pages only. Auth and API client are Phase 49.

## Sources

### Primary (HIGH confidence)
- npm registry -- verified versions for all 15+ packages via `npm view`
- [Lingui Installation Docs](https://lingui.dev/installation) -- Vite setup with SWC/Babel options
- [Lingui Vite Plugin Docs](https://lingui.dev/ref/vite-plugin) -- Dynamic catalog loading pattern
- [Lingui React Tutorial](https://lingui.dev/tutorials/react) -- I18nProvider, useLingui hook, locale switching
- [Lingui CLI Reference](https://lingui.dev/ref/cli) -- extract/compile commands
- [React Router Modes](https://reactrouter.com/start/modes) -- Declarative mode (library) setup
- [Tailwind CSS v4 Blog](https://tailwindcss.com/blog/tailwindcss-v4) -- @theme blocks, @tailwindcss/vite plugin

### Secondary (MEDIUM confidence)
- Existing project codebase (`frontend/app/globals.css`) -- @theme inline pattern from frontend1
- Backend CORS middleware (`backend/internal/api/middleware/cors.go`) -- verified allowed origins

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all versions verified against npm registry
- Architecture: HIGH -- patterns from official docs, consistent with project conventions
- Pitfalls: HIGH -- based on official docs and real version differences (v6->v7 imports, Tailwind v3->v4 config)

**Research date:** 2026-04-08
**Valid until:** 2026-05-08 (stable stack, 30 days)
