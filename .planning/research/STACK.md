# Stack Research — v3.0 Premium-Terminal Frontend2 Rebuild

**Domain:** SPA rebuild — premium-terminal TUI aesthetic, multi-tenant inventory, online-only, full feature parity with `/frontend` (Next.js).
**Researched:** 2026-04-30
**Confidence:** HIGH (versions registry-verified 2026-04-30; predecessor stack already shipped v2.0+v2.1 in production)

## Context (read first)

This is a **clean-slate rebuild of `/frontend2`** following the wipe of the v2.0/v2.1/partial-v2.2 codebase. It is NOT a greenfield product:

- **Backend, API contract, and `/frontend` (legacy Next.js) are stable** — do not re-research.
- **The aesthetic is locked** to sketches 001–005 (premium terminal: amber + green dual-channel, AAA contrast, monospace, scanlines, sharp corners, function-key bottombar, sidebar group labels, slim brand topbar). Source of truth: `.claude/skills/sketch-findings-home-warehouse-system/sources/themes/default.css`.
- **The previous frontend2 stack (Vite + React 19 + Tailwind 4 + RR7 + Lingui v5 + TanStack Query v5 + RHF + zod) is the validated baseline** and it shipped successfully. The job here is to confirm versions, drop dead weight, and add only what the TUI pattern + feature parity require.

The dominant evaluation question for every dep is: **"does this fight the locked aesthetic, or amplify it?"** Generic-aesthetic libraries (shadcn, Material, Mantine, Chakra) lose by definition — they bring soft shadows, rounded corners, and animation systems that the locked theme explicitly rejects.

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why for this rebuild |
|------------|---------|---------|----------------------|
| **Vite** | `^8.0.10` | Build + dev server | Stays. Predecessor used Vite 8; React 19 + Tailwind 4 + Lingui SWC plugin all work today. Vite 8 dev startup ~150 ms warm, HMR sub-50 ms — the iteration speed is load-bearing for a redesign milestone with frequent visual checkpoints. |
| **`@vitejs/plugin-react-swc`** | `^4.3.0` | React plugin via SWC | Stays. SWC over Babel saves ~30% cold start. Required also because Lingui's SWC plugin runs in the same compile pass — keeping the same compiler avoids dual-toolchain pain. |
| **React** | `^19.2.5` | View library | Stays. React 19 is what `/frontend` ships and what the design system was authored against. No reason to step back to 18. |
| **React Router** | `^7.14.2` (library mode) | Client-side routing | Stays. Library mode (not framework / data router opinionated mode) — frontend2 is a pure SPA, no SSR, no nested-route data loaders. RR7 in library mode is a thin `<BrowserRouter>` + `<Routes>` shell, ~12 kB gzip, zero magic. |
| **TypeScript** | `^5.9.5` | Type system | Stays. Strict mode + `verbatimModuleSyntax`. `5.9` brings the `using` keyword (handy for AbortController scopes in the scan flow). |
| **Tailwind CSS** | `^4.2.4` | Utility CSS | Stays. v4's `@theme` block + CSS-variable–first design is a perfect fit for the locked-token system: the entire `default.css` token block can drop into one `@theme` block. v4 also kills PostCSS config files and the `tailwind.config.ts` rats nest — config lives in CSS. |
| **`@tailwindcss/vite`** | `^4.2.4` | Tailwind Vite integration | Stays. Replaces `@tailwindcss/postcss` for Vite projects — fewer config files, faster dev rebuild. |
| **Bun** | `^1.3.13` | Package manager + script runner | Stays. Predecessor used `bun install` + `bun run dev`. ~5–10× faster install than npm. **Note:** Bun is the package manager only — Vite still drives dev/build (Bun's built-in bundler is not used). |

### Data, Forms, State

| Library | Version | Purpose | Why for this rebuild |
|---------|---------|---------|----------------------|
| **`@tanstack/react-query`** | `^5.100.6` | Server state + caching | Stays. v5 has `useSuspenseQuery`, `placeholderData`, query-key factories — all heavily used in v2.1 entity API modules. The CI grep guard (`idb`/`offline`/`sync`) keeps it the **only** persistence layer; no mutation queue, no optimistic offline. Pair with `staleTime: 30_000` for read-heavy lists. |
| **`@tanstack/react-query-devtools`** | `^5.100.6` | Query inspector | Stays in dev. Tree-shaken from prod bundle. Critical for diagnosing the `scan→create→rescan` cache-staleness pitfall (v2.2 PITFALL #7). |
| **react-hook-form** | `^7.74.0` | Form state | Stays. RHF + zod is the only viable combo at our complexity (multi-step wizards, draft autosave, controlled retro inputs). Alternatives (`@tanstack/react-form`, `formik`, `final-form`) either lack zod-first ergonomics or have weaker community. |
| **`@hookform/resolvers`** | `^5.2.2` | RHF ↔ zod bridge | Stays. v5 of the resolvers package targets zod v4. |
| **zod** | `^4.4.1` | Schema validation | Stays. zod v4 is non-trivially different from v3 (issue path API, narrower types, faster); we already moved in v2.1, do not regress. Use zod for: form schemas, API response parsing in API client, env config. |

### i18n (recommendation: **stay on Lingui v5**)

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| **`@lingui/core`** | `^6.0.1` | Runtime i18n engine | Latest is v6 (released since v2.1). Note: predecessor used v5 — bumping to v6 is appropriate for a rebuild milestone. Compile-time message extraction means the runtime payload is just the catalog map; no AST overhead. |
| **`@lingui/react`** | `^6.0.1` | React bindings (`<Trans>`, `useLingui`) | Same as above. |
| **`@lingui/cli`** | `^6.0.1` | Catalog extract / compile tooling | Stays. `lingui extract` + `lingui compile` produce per-locale `.ts` modules that Vite tree-shakes by route. |
| **`@lingui/swc-plugin`** | `^6.0.0` | SWC transform for `<Trans>` macros | Stays. Compile-time extraction of `t\`...\`` and `<Trans>` requires this plugin — pairs with `plugin-react-swc`. |
| **`@lingui/vite-plugin`** | `^6.0.1` | Vite catalog HMR | Stays. Reloads compiled catalogs without full page refresh. |

**Why Lingui v6 over native `Intl` + a wrapper, or `next-intl`-on-Vite, or `react-intl`:**

- **Native `Intl.MessageFormat` (TC39 / ECMA-402)** is shipping but browser support is incomplete (Safari has `Intl.MessageFormat` behind a flag as of 2026-04). Building a small wrapper means re-implementing pluralization, gender, and select rules — Lingui's core is exactly that runtime. Net deps saved: zero (you'd ship a polyfill anyway). Verdict: **revisit in 12–18 months, not now.**
- **`next-intl`** is Next.js-specific. There is no `next-intl-on-vite` package; trying to use the App-Router-coupled APIs in a Vite SPA means re-implementing the file-routing assumptions. Even if it worked, frontend1 already uses next-intl — switching to a different library on frontend2 is fine when justified by the runtime mismatch (Vite vs Next).
- **`react-intl` (FormatJS)** runtime is ~12 kB gzip vs Lingui's ~3 kB; Lingui's compile-time extraction means catalogs are tree-shaken per route. For a 3-locale (en/et/ru) app where every locale is loaded lazily, Lingui wins on bundle.
- **Predecessor used Lingui v5 successfully** — the et/ru gap-fill discipline is already in the project's muscle memory. Dropping it to switch i18n libraries on the rebuild has no upside.

### UI Building Blocks

| Library | Version | Purpose | Why for this rebuild |
|---------|---------|---------|----------------------|
| **`@floating-ui/react`** | `^0.27.19` | Positioning primitive (popovers, tooltips, command palette, FAB radial, dropdowns) | Stays. The retro component library is hand-rolled; `@floating-ui/react` provides the *math* for positioning without imposing chrome. Same library Radix uses internally. Used for: RetroCombobox, RetroDropdownMenu, FAB radial menu, command palette overlay, tooltip on torch button. |
| **lucide-react** | `^1.14.0` (current major) | Icons | **Confirmed by sketch 004.** 1.75 px stroke caps, geometric, work cleanly against the scanlines + monospace chrome. Pixel-art alternatives were tried in sketch 004B/C and declined (over-indexed on retro). Tree-shakeable per-icon imports — only the icons referenced ship. **Do NOT import the whole `lucide-react`** — use `import { Package } from 'lucide-react'` form so unused icons drop. |
| **sonner** | `^2.0.7` | Toast notifications | **NEW.** The legacy `RetroToast` was hand-rolled and did not ship a stack manager. Sonner is the de-facto React toast library in 2026, ~6 kB gzip, headless-stylable, supports promise toasts (`toast.promise(saveFn, { loading, success, error })`) — perfect for the scan→save flows. Style its CSS variables to use the locked tokens; keep its DOM, replace its colors. |
| **cmdk** | `^1.1.1` | Command palette (Ctrl+K / F2) primitive | **NEW (TUI pattern).** Headless command-menu (`<Command>` + `<Command.Input>` + `<Command.List>`) — no styling assumptions. Used by Linear, Vercel, Raycast. Ships with fuzzy filter built in. Pairs with the function-key bottombar pattern: F2 (or Ctrl+K) opens cmdk; bottombar shortcuts register with the same shortcut registry. |

### TUI Pattern Helpers

| Library | Version | Purpose | Why for this rebuild |
|---------|---------|---------|----------------------|
| **tinykeys** | `^3.0.0` | Keyboard shortcut listener | **NEW (TUI pattern).** ~400 bytes gzip. Used to register global F1/F2/F3/Esc and per-route function-key shortcuts that drive the bottombar. Predecessor used inline `keydown` listeners — fine for one screen, fragile when shortcut sets become route-aware. tinykeys' `tinykeys(window, { 'F1': fn, '$mod+K': fn })` pattern lines up 1:1 with the `useShortcuts([{key, label, action}])` hook described in `RETRO-THEME-ROLLOUT.md` Step 4. |
| **`@fontsource-variable/jetbrains-mono`** | `^5.2.8` | Self-hosted monospace font | **NEW.** The locked theme stack is `ui-monospace, "JetBrains Mono", "Fira Code", "SF Mono", Consolas, "Courier New", monospace`. `ui-monospace` works on macOS/iOS Safari but fonts diverge between OSes — typography is load-bearing in a TUI design, so self-host JetBrains Mono Variable. Variable font means one woff2 covers all weights (~75 kB gzip, subsetted Latin). Drop into `index.css` via `@import '@fontsource-variable/jetbrains-mono'`. |
| **`@fontsource-variable/jetbrains-mono` (subset latin-ext for et)** | `^5.2.8` | Estonian char support (õ, ä, ö, ü) | Estonian-specific glyphs are in `latin-ext` subset — import the right subset file or all et translations render with fallback metrics. |

### Scan / Mobile / Hardware

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| **`@yudiel/react-qr-scanner`** | `2.5.1` (EXACT) | Barcode + QR scanner | Stays. React 19 peerDep clean, built-in torch detection, ZXing-WASM under the hood. Same version `/frontend` ships. Keep the EXACT pin — predecessor v2.2 STACK research established this and the rationale (avoid 2.6.x breaking changes while both frontends coexist) still holds. |
| **ios-haptics** | `^0.1.5` | iOS Safari haptic feedback | Stays. The hidden-checkbox-switch trick is the only thing that works on iOS Safari for haptics. Bumped from v0.1.4 to v0.1.5 (current). |
| **uuid** | `^13.0.0` | Idempotency keys (UUIDv7 for time-ordered keys) | Stays. Used for client-generated idempotency keys on creates from scan flow. `import { v7 } from 'uuid'` to tree-shake. |

### Testing

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| **vitest** | `^4.1.5` | Unit + component tests | Stays. Vitest 4 uses `node:test`-style runner under the hood, ~2× faster than v3. Native Vite config sharing means the SWC + Lingui pipeline that runs in dev runs in tests too — no `tsc --noEmit` divergence. |
| **`@testing-library/react`** | `^16.3.2` | Component test API | Stays. v16 supports React 19 properly (concurrent rendering, `act` warnings). |
| **`@playwright/test`** | `^1.59.1` | E2E browser tests | Stays. Phase 65 Plan 65-11 (G-65-01 closure, documented in CLAUDE.md) introduced the first Playwright spec against real backend + real Postgres. Pattern is established; reuse. Two projects (`chromium` + `firefox`) — skip webkit until iOS-PWA-specific specs justify it. |
| **msw** | `^2.14.2` | Network mocking for unit tests | **NEW.** Component tests of TanStack Query hooks need fetch interception. msw v2 uses Service Worker in browser tests and Node's `http.Server` interceptor in Vitest — same handlers, both environments. Avoid `vi.mock('global.fetch')` patterns; they're brittle and don't catch URL-shape regressions. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `vite` (dev server) | HMR + bundling | `bun run dev` proxies `/api` → `localhost:8080`. Keep proxy config in `vite.config.ts` exactly as predecessor had it — Playwright `baseURL` assumes 5173. |
| `vite build --report` (rollup-plugin-visualizer) | Bundle inspection | Required acceptance check: scanner WASM must be manual-chunked under a `"scanner"` chunk so users who never open `/scan` don't pay for it. Predecessor v2.2 STACK research flagged this as load-bearing. |
| ESLint + `eslint-plugin-react-hooks` | Linting (light touch) | Predecessor used a minimal config. Don't introduce a heavy preset — premium-terminal aesthetic doesn't justify churn over `react/jsx-key` violations. |
| `tsc --noEmit` in CI | Type-check | Vitest type-checks during test runs but a separate `tsc --noEmit` step catches type errors in non-test files. |
| `scripts/check-forbidden-imports.mjs` | Grep guard against `idb`/`serwist`/`offline`/`sync` imports | Stays from v2.1. Online-only is a CI-enforced constraint, not just a convention. |

---

## Installation

```bash
# Initial scaffold
bun create vite frontend2 --template react-swc-ts
cd frontend2

# Core (note: many already in the Vite template — listed for completeness)
bun add react@^19.2.5 react-dom@^19.2.5 react-router@^7.14.2

# Styling
bun add tailwindcss@^4.2.4 @tailwindcss/vite@^4.2.4
bun add @fontsource-variable/jetbrains-mono@^5.2.8

# Data, forms, state
bun add @tanstack/react-query@^5.100.6
bun add react-hook-form@^7.74.0 @hookform/resolvers@^5.2.2 zod@^4.4.1

# i18n
bun add @lingui/core@^6.0.1 @lingui/react@^6.0.1
bun add -d @lingui/cli@^6.0.1 @lingui/vite-plugin@^6.0.1 @lingui/swc-plugin@^6.0.0

# UI primitives + icons + toasts + cmdk + shortcuts
bun add @floating-ui/react@^0.27.19
bun add lucide-react@^1.14.0
bun add sonner@^2.0.7
bun add cmdk@^1.1.1
bun add tinykeys@^3.0.0

# Scan + mobile
bun add @yudiel/react-qr-scanner@2.5.1   # EXACT, no caret
bun add ios-haptics@^0.1.5
bun add uuid@^13.0.0

# Dev
bun add -d @vitejs/plugin-react-swc@^4.3.0
bun add -d typescript@^5.9.5
bun add -d vitest@^4.1.5 @testing-library/react@^16.3.2 @testing-library/jest-dom @testing-library/user-event
bun add -d @playwright/test@^1.59.1
bun add -d msw@^2.14.2
bun add -d @types/uuid@^11.0.0
bun add -d @tanstack/react-query-devtools@^5.100.6
bun add -d rollup-plugin-visualizer
```

Total runtime deps: 16. Total dev deps: ~13. Comparable to predecessor v2.1.

---

## Alternatives Considered

| Recommended | Alternative | When the alternative would win |
|-------------|-------------|--------------------------------|
| Vite + RR7 library mode | **TanStack Start** (was TanStack Router + Start) | If we needed file-based routing + server functions in one package. We don't — backend is Go, no co-located server functions, RR7 library mode is simpler. |
| Vite + RR7 library mode | **Next.js 16 (App Router)** | If we needed SSR / RSC / server actions. We don't — frontend2 is a pure SPA, backend is Go. Next.js would also undo the explicit "frontend2 is a separate UI track" decision. |
| Vite + RR7 | **Remix (now part of RR7)** | RR7 already absorbed Remix. RR7 framework mode would pull in the data router; library mode skips it. |
| `@tanstack/react-query` | **SWR** | If we wanted simpler primitives (`useSWR(key)` only). Lose: query-key invalidation patterns, mutation queue ergonomics, devtools. RQ is more powerful for the scan→create→rescan cache invalidation pattern. |
| `@tanstack/react-query` | **`@tanstack/react-form`** for forms | RHF v7 is mature, has zod resolver, handles draft autosave + multi-step. TanStack Form is younger; swapping would re-litigate v2.1 patterns for negligible gain. |
| react-hook-form + zod | **Conform** | Conform shines for SSR/Action-driven forms (Next App Router). Pure-client SPA with TanStack Query mutations doesn't benefit. |
| Lingui v6 | **`react-aria-components` + `@formatjs/intl`** | If we adopted React Aria for the entire component layer. We're not — the retro components are hand-rolled. Mixing in `react-aria` for one feature buys nothing. |
| sonner | **react-hot-toast** | RHT is fine but not as actively maintained; sonner has clearer styling hooks for the locked tokens and `toast.promise` ergonomics. |
| cmdk | **kbar** (`^0.1.0-beta.48`) | kbar is in beta and unmaintained for 18+ months. cmdk is stable (1.1.x), Vercel-maintained. |
| tinykeys | **react-hotkeys-hook** | RHH is heavier (~3.5 kB), React-only API. tinykeys is framework-agnostic ~400 bytes — a function-key bottombar registry needs only `tinykeys(window, map)`. |
| `@floating-ui/react` | **`@radix-ui/react-*` (1.4.x — new unified package)** | Radix is excellent but its primitives ship with default-modern visual assumptions (focus rings, animations) that fight the locked aesthetic. We would override every visual; better to build atop the same `@floating-ui/react` Radix uses internally. |
| Hand-rolled retro components on `@floating-ui/react` | **shadcn/ui copy-paste** | shadcn shines on `/frontend` for a reason — it's a *re-skin*. frontend2 v3.0 is explicitly a *redesign* per `RETRO-THEME-ROLLOUT.md`. shadcn's components carry rounded corners, drop shadows, soft focus rings — re-skinning every one would be more code than building from `@floating-ui/react` primitives. |
| Self-host JetBrains Mono via fontsource | **Google Fonts CDN `<link>`** | CDN adds a cross-origin font load + hurts FCP. Self-hosted variable woff2 is ~75 kB and ships with your assets. |
| `@vitejs/plugin-react-swc` | **`@vitejs/plugin-react` (Babel)** | Babel works fine but Lingui's SWC plugin is the official path; mixing toolchains adds compile-pass complexity. |
| Vitest | **Jest** | Jest doesn't share Vite's compile pipeline, so SWC + Lingui macros would need a separate Jest config. Vitest reuses `vite.config.ts`. Done. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **Any animation library** (`motion`, `framer-motion`, `react-spring`, `auto-animate`) | The locked aesthetic uses 80 ms CSS `transition: background, border, color` — sharp, mechanical, deliberately un-bouncy. Spring physics fight the look. Predecessor v2.2 explicitly removed `motion`; do not re-add. | Tailwind 4 transition utilities + `data-[state=open]:` variants. The bottombar clock tick, scanline pulse, and pill blink all use CSS keyframes (`@keyframes blink` already in `default.css`). |
| **shadcn/ui** (frontend1's choice) | Drop-shadows, rounded corners, focus rings, animation defaults all fight the locked theme. Re-skinning shadcn = more code than building 19 retro atoms on `@floating-ui/react`. The frontend1 *re-skin* uses shadcn well; frontend2's *redesign* doesn't. | Hand-rolled retro components on `@floating-ui/react`. Reuse the v2.1 retro library shape (RetroPanel, RetroButton, RetroInput, RetroCombobox, etc.). |
| **Material UI / Mantine / Chakra / Ant Design** | Same as shadcn but worse — they lock in their own theme system that fights CSS-variable-first design. | See above. |
| **`idb` / IndexedDB libraries** | Online-only milestone constraint. CI grep guard blocks `idb`/`offline`/`sync` substrings. | Server state via TanStack Query; ephemeral state via `useState`; persistent UI prefs via `localStorage` with versioned keys. |
| **`serwist` / `vite-plugin-pwa` / service workers** | Same online-only constraint. CI grep guard blocks `serwist`. PWA shell is a future milestone, not v3.0. | Plain SPA; `/login` works only when backend reachable. |
| **`fuse.js`** | Predecessor v1.3 used it for offline fuzzy search. Online-only frontend2 does server-side search via the items list endpoint (`?search=<query>`) — moving fuzzy filtering to the client adds bundle weight for negligible UX gain on lists already paginated to 25/page. cmdk has a built-in fuzzy filter for the command palette. | Backend FTS via `?search=` query param. cmdk's built-in filter for the command palette. |
| **`pixelarticons` / chunky-pixel icon sets** | Sketch 004 explicitly tried these and declined them — read busy against scanlines + monospace, over-index on retro vibe. | lucide-react with 1.75 px stroke caps. |
| **`barcode-detector` as a direct dep** | `@yudiel/react-qr-scanner` 2.5.1 already ships `barcode-detector@3.0.8` transitively. Declaring it directly forces version drift. | Trust the transitive. |
| **`html5-qrcode`, `@zxing/browser`, `@ericblade/quagga2`** | None have React 19 peerDep; bundles are 3–15× larger than `@yudiel`; no torch helper. | `@yudiel/react-qr-scanner@2.5.1`. |
| **`@spaceymonk/react-radial-menu`** | Imposes own theming + animations. FAB radial is ~150 LOC on `@floating-ui/react`. | Hand-roll on existing `@floating-ui/react`. |
| **`react-haptic-feedback` / generic haptic wrappers** | They call `navigator.vibrate` and silently no-op on iOS Safari. | `ios-haptics` (specific iOS Safari technique). |
| **`react-hotkeys-hook` / `mousetrap` / `hotkeys-js`** | Predecessor used inline listeners; for the bottombar shortcut registry, tinykeys is 1/10 the size and framework-agnostic. | tinykeys. |
| **`new Audio('/beep.mp3').play()` for scan feedback** | Mobile Safari stalls after 3rd playback; doesn't respect silent switch. | Native `AudioContext` oscillator (~5 lines). Pattern in v2.2 STACK archive. |
| **`react-toastify` / `react-hot-toast`** | Style overrides fight the aesthetic; sonner has cleaner CSS variables to remap. | sonner. |
| **kbar** | Beta + unmaintained 18+ months. | cmdk. |
| **`use-long-press` / similar gesture libs** | Long-press for FAB is a 20-LOC inline `pointerdown` timer. Predecessor verified this. | Inline timer pattern. |
| **next-intl** | Next.js-coupled APIs do not run on Vite SPA; switching frontends to a different i18n library has a small cost (catalog format reformat) but no runtime payoff. | Lingui v6 (predecessor's choice, registry-current). |
| **TanStack Form / Conform / Formik / React Final Form** | RHF + zod is mature in this project; switching for a rebuild has no payoff. | react-hook-form. |
| **CRT shader libraries (`crt.js`, WebGL CRT effects, postprocess libraries)** | Sketch 002–005 deliberately use a CSS-only scanline (`repeating-linear-gradient` 1 px every 3 px). Shaders eat GPU, hurt battery, and force a `<canvas>` overlay that fights accessibility. | The locked CSS scanline in `default.css` is final. Respect `prefers-reduced-motion`. |
| **Bun's built-in bundler / dev server** | Vite's plugin ecosystem (Lingui, Tailwind v4, Visualizer) doesn't run under Bun's bundler today. | Bun for install + run-script. Vite for dev/build. |

---

## Stack Patterns by Variant

**If we ship a desktop Electron / Tauri build later:**
- Vite still drives the build; nothing changes here.
- Add `@tauri-apps/api` for OS-native dialogs + safe-area; the function-key bottombar already mirrors a desktop app pattern, so the visual shift is small.

**If we ship a mobile-only flow first (likely — premium-terminal HUD is desktop-led):**
- Bottombar keeps its function-key chips on tablet (md+) but on phones it should auto-collapse to a 4-key strip with overflow into a `[≡]` chip (cmdk-driven).
- FAB radial menu (predecessor v1.3 pattern) is mobile-only; reuse the planned hand-rolled `@floating-ui/react` build.

**If the design system gets componentized later for shared use across frontend1 + frontend2:**
- Tailwind v4's `@theme` block + locked CSS variables can extract to a shared file (already proposed in `RETRO-THEME-ROLLOUT.md` Step 5: `.planning/shared-tokens/retro-terminal.css`).
- Keep this in scope for Step 5 of the rollout, not for v3.0 itself.

---

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| React 19.2 | RR7 7.14 | Confirmed; RR7 declared `react@^19` peerDep at 7.5.0+. |
| React 19.2 | RHF 7.74 | Confirmed via `peerDependencies` (`react@^16.8 || ^17 || ^18 || ^19`). |
| React 19.2 | TanStack Query 5.100 | Confirmed; v5 supports React 19 since 5.62. |
| React 19.2 | `@yudiel/react-qr-scanner` 2.5.1 | Confirmed (`react@^17 || ^18 || ^19`). |
| React 19.2 | `@floating-ui/react` 0.27 | Confirmed. |
| React 19.2 | sonner 2.0 | Confirmed; v2 dropped React 17 support, requires React 18+. |
| React 19.2 | cmdk 1.1 | Confirmed. |
| Vite 8 | Tailwind 4.2 + `@tailwindcss/vite` | Confirmed; this is the recommended path on `tailwindcss.com/docs/installation/using-vite`. |
| Vite 8 | `@vitejs/plugin-react-swc` 4.3 | Confirmed; v4 of the SWC plugin targets Vite 8. |
| Vite 8 | Lingui SWC plugin 6.0 | Confirmed; Lingui v6 supports the SWC chain Vite 8 uses. |
| Vitest 4 | Vite 8 | Confirmed (Vitest 4 was released alongside Vite 8 compatibility). |
| zod 4 | `@hookform/resolvers` 5.2 | Confirmed; resolvers v5 supports zod v4. |
| TypeScript 5.9 | All above | TS 5.9 is the current stable; all listed packages publish current types. |

---

## Risks / Watch-outs Specific to This Rebuild

1. **Tailwind v4's `@theme` block is the right place for the locked tokens** — but if you put them in `:root` instead (predecessor pattern), Tailwind utilities like `bg-retro-panel` won't autocomplete. Use `@theme { --color-retro-panel: #0a0e0a; }` so utilities generate.

2. **The function-key bottombar is the *defining* UX pattern of this milestone.** It's cross-cutting (every authenticated route registers its shortcuts) and depends on the cmdk + tinykeys + a Provider. Get the `useShortcuts` hook + `<ShortcutsProvider>` shape right in the foundation phase — retrofitting is painful.

3. **cmdk + tinykeys overlap** — both can register shortcuts. Rule: tinykeys handles single-key + global modifiers (F1, F2, Esc, Ctrl+K open). cmdk's internal filter handles command-palette item activation once the palette is open. Don't fight this — register the palette open key with tinykeys, let cmdk own filtering inside.

4. **JetBrains Mono Variable subset** — Estonian glyphs (`õ ä ö ü`) live in `latin-ext`. Importing only `latin` saves ~10 kB but breaks Estonian rendering. Import both subsets or accept the broken fallback metrics.

5. **TanStack Query devtools in production bundle** — must be `import.meta.env.DEV ? <Devtools /> : null`. Predecessor handled this; verify in the rebuild.

6. **Scanner WASM chunking** — must remain a manual chunk (`build.rollupOptions.output.manualChunks: { scanner: [...] }`). Predecessor v2.2 STACK archive is the reference. Verify with `vite build --report` in the foundation phase.

7. **Lingui v5 → v6 catalog migration** — predecessor catalogs were v5 format; v6 changed `.po` extraction defaults. If catalogs are imported from `/frontend` or the v2.1 archive, run `lingui extract --convert-from=v5` once.

8. **MSW v2 setup** — Service Worker handler in browser tests, Node interceptor in Vitest. The two share `handlers.ts` but registration differs. Predecessor never used MSW; treat its introduction as a foundation-phase task with its own checkpoint.

9. **`scripts/check-forbidden-imports.mjs` from v2.1** — port verbatim. Online-only is CI-enforced.

---

## Sources

- `.planning/research/v2.2-archive/STACK.md` — predecessor stack research, version-verified 2026-04-18 (HIGH — direct lineage)
- `.planning/research/v2.2-archive/SUMMARY.md` — predecessor research consolidation (HIGH)
- `.planning/PROJECT.md` — v3.0 milestone scope, current tech stack, prior validated requirements (HIGH)
- `.planning/RETRO-THEME-ROLLOUT.md` — frontend1 re-skin plan with locked tokens; defines what "premium-terminal aesthetic" means in code (HIGH)
- `.claude/skills/sketch-findings-home-warehouse-system/SKILL.md` — design-system source of truth (HIGH)
- `.claude/skills/sketch-findings-home-warehouse-system/sources/themes/default.css` — locked CSS variables (HIGH)
- `CLAUDE.md` (project root) — Playwright + Go integration test conventions established Phase 65 Plan 65-11 (HIGH)
- npm registry `npm view` for every listed library (2026-04-30) — version + peerDep + license verification (HIGH)
- `frontend/package.json` (legacy) — confirms `@yudiel/react-qr-scanner@2.5.1` + `ios-haptics` are production-validated in this org (HIGH)

---

## Final-Answer Cheat Sheet (per the question prompt)

1. **Vite + React 19 + Tailwind 4 + RR7 — keep all four.** No 2026 alternative offers a meaningful upgrade for a pure-SPA + Go-backend setup. TanStack Start is the closest contender and only wins if you want server functions in the same package — we don't.
2. **i18n — Lingui v6** (bumped one major from predecessor's v5). Native Intl + wrapper isn't ready (Safari). next-intl is Next-only. Lingui's compile-time extraction + tree-shake is the right tradeoff for 3-locale en/et/ru.
3. **State / data — TanStack Query v5 stays. NO Zustand / Jotai / Valtio added.** The only "global" state we have is workspace ID + auth, which lives in TanStack Query (`/users/me`) plus a tiny React Context. Adding a state-management lib for "command palette open?" + "current shortcuts?" is over-engineered — those are React Context + tinykeys.
4. **Forms — react-hook-form + zod stays.** No reason to switch.
5. **Motion — none. CSS only.** The aesthetic explicitly rejects spring/bouncy motion. Use 80 ms CSS transitions + Tailwind 4 `data-[state]:` variants. Scanline pulse + pill blink already in the locked CSS.
6. **Icons — Lucide.** Confirmed by sketch 004; pixel-art alternatives explicitly rejected.
7. **Barcode — `@yudiel/react-qr-scanner@2.5.1` (EXACT pin).** Confirmed by predecessor v2.2 research.
8. **Testing — Vitest + Playwright + MSW.** Vitest for unit/component, Playwright for E2E (Phase 65 Plan 65-11 pattern), MSW for fetch interception in unit tests.
9. **TUI-specific:**
   - Self-host JetBrains Mono Variable (`@fontsource-variable/jetbrains-mono`).
   - Sonner for toasts.
   - cmdk for command palette (F2 / Ctrl+K).
   - tinykeys for function-key shortcut registry.
   - **No CRT shader / WebGL effect libs** — the CSS scanline is final and respects `prefers-reduced-motion`.
10. **NOT to add (premature optimization / aesthetic-fight risk):** any animation library; shadcn / MUI / Mantine / Chakra; idb / serwist / PWA; fuse.js (server-side search now); pixelarticons; barcode-detector as direct dep; html5-qrcode / zxing-browser / quagga2; radial-menu libs; haptic wrappers other than `ios-haptics`; react-hotkeys-hook / mousetrap / hotkeys-js; HTMLAudioElement scan beep; react-toastify / react-hot-toast; kbar; long-press libs; next-intl; TanStack Form / Conform / Formik; CRT shader libs; Bun's built-in bundler.

---
*Stack research for: v3.0 Premium-Terminal Frontend2 Rebuild*
*Researched: 2026-04-30*
