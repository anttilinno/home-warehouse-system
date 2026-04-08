# Architecture Research

**Domain:** Retro-styled second frontend (SPA) for existing Go backend
**Researched:** 2026-04-08
**Confidence:** HIGH

## System Overview

```
                           Production (Angie reverse proxy :80)
 ┌──────────────────────────────────────────────────────────────────────┐
 │                                                                      │
 │  /retro/*  ──────────► frontend2 (Vite SPA :3001)                   │
 │  /auth/retro/callback ► frontend2                                    │
 │                                                                      │
 │  /auth/*, /users/*, /workspaces/*, /health, /barcode/*              │
 │           ──────────► backend (Go :8080)                             │
 │                                                                      │
 │  /* (default) ──────► frontend1 (Next.js :3000)                     │
 │                                                                      │
 └──────────────────────────────────────────────────────────────────────┘

                           Development
 ┌──────────────────────────────────────────────────────────────────────┐
 │                                                                      │
 │  frontend2 Vite dev :3001                                           │
 │    └── proxy /auth/*, /users/*, /workspaces/* ──► backend :8080     │
 │                                                                      │
 │  frontend1 Next.js dev :3000                                        │
 │    └── (existing, unchanged)                                         │
 │                                                                      │
 │  backend Go :8080                                                   │
 │    └── CORS allows :3000 and :3001 (already configured)             │
 │                                                                      │
 └──────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|----------------|----------------|
| Vite Dev Server | Serves SPA, proxies API in dev | `vite.config.ts` with `server.proxy` |
| React Router v7 | Client-side routing (library mode) | `createBrowserRouter` + `RouterProvider` |
| API Client | HTTP calls to Go backend | Adapted from frontend1's `ApiClient` class |
| Auth Context | JWT management, user state, workspace selection | React context wrapping `apiClient` |
| SSE Provider | Real-time event connection | EventSource to `/workspaces/{id}/sse` |
| i18n | EN + ET translations | `react-i18next` with JSON namespace files |
| Design System | Retro industrial component library | Custom components over Tailwind CSS 4 |

## Recommended Project Structure

```
frontend2/
├── index.html                  # Vite entry point
├── vite.config.ts              # Vite config with proxy + path aliases
├── tailwind.config.ts          # Tailwind CSS 4 config (retro theme tokens)
├── tsconfig.json
├── package.json
├── public/
│   └── favicon.ico
├── src/
│   ├── main.tsx                # App bootstrap: i18n init, RouterProvider
│   ├── router.tsx              # createBrowserRouter route tree
│   ├── app.tsx                 # Root layout (nav shell, providers)
│   │
│   ├── api/                    # API client layer
│   │   ├── client.ts           # ApiClient class (adapted from frontend1)
│   │   ├── auth.ts             # Auth endpoints + types
│   │   ├── items.ts            # Item CRUD + types
│   │   ├── inventory.ts        # Inventory endpoints + types
│   │   ├── loans.ts            # Loan endpoints + types
│   │   ├── borrowers.ts        # Borrower endpoints + types
│   │   ├── categories.ts       # Category endpoints + types
│   │   ├── locations.ts        # Location endpoints + types
│   │   ├── containers.ts       # Container endpoints + types
│   │   ├── item-photos.ts      # Photo upload/serve + types
│   │   ├── notifications.ts    # Notification endpoints + types
│   │   ├── repair-logs.ts      # Repair log endpoints + types
│   │   ├── analytics.ts        # Dashboard analytics + types
│   │   ├── declutter.ts        # Declutter assistant + types
│   │   ├── importexport.ts     # Import/export + types
│   │   └── search.ts           # Search endpoint + types
│   │
│   ├── contexts/               # React contexts (global state)
│   │   ├── auth-context.tsx    # User, workspace, login/logout
│   │   ├── sse-context.tsx     # SSE connection + event distribution
│   │   └── theme-context.tsx   # Dark/light theme
│   │
│   ├── hooks/                  # Shared custom hooks
│   │   ├── use-sse.ts          # SSE subscription hook
│   │   ├── use-date-format.ts  # User date format preference
│   │   ├── use-time-format.ts  # User time format preference
│   │   ├── use-number-format.ts # User number format preference
│   │   └── use-debounce.ts     # Input debouncing
│   │
│   ├── components/             # Design system (retro components)
│   │   ├── ui/                 # Primitive UI components
│   │   │   ├── retro-button.tsx
│   │   │   ├── retro-input.tsx
│   │   │   ├── retro-card.tsx
│   │   │   ├── retro-panel.tsx
│   │   │   ├── retro-dialog.tsx
│   │   │   ├── retro-badge.tsx
│   │   │   ├── retro-select.tsx
│   │   │   ├── retro-table.tsx
│   │   │   ├── retro-tabs.tsx
│   │   │   └── retro-toast.tsx
│   │   ├── layout/             # Layout shells
│   │   │   ├── app-shell.tsx   # Main authenticated layout
│   │   │   ├── auth-shell.tsx  # Login/register layout
│   │   │   ├── sidebar.tsx     # Navigation sidebar
│   │   │   └── header.tsx      # Top bar
│   │   └── shared/             # Composite reusable components
│   │       ├── data-table.tsx  # Table with sort/filter/pagination
│   │       ├── form-field.tsx  # Label + input + error
│   │       ├── empty-state.tsx
│   │       ├── loading-state.tsx
│   │       └── confirm-dialog.tsx
│   │
│   ├── pages/                  # Route page components
│   │   ├── auth/
│   │   │   ├── login.tsx
│   │   │   ├── register.tsx
│   │   │   └── oauth-callback.tsx
│   │   ├── dashboard/
│   │   │   └── index.tsx
│   │   ├── items/
│   │   │   ├── list.tsx
│   │   │   ├── detail.tsx
│   │   │   └── create.tsx
│   │   ├── inventory/
│   │   │   └── index.tsx
│   │   ├── loans/
│   │   │   ├── list.tsx
│   │   │   └── detail.tsx
│   │   ├── borrowers/
│   │   │   ├── list.tsx
│   │   │   └── detail.tsx
│   │   ├── categories/
│   │   │   └── index.tsx
│   │   ├── locations/
│   │   │   └── index.tsx
│   │   ├── containers/
│   │   │   └── index.tsx
│   │   ├── scanner/
│   │   │   └── index.tsx
│   │   ├── settings/
│   │   │   ├── index.tsx       # Settings hub
│   │   │   ├── profile.tsx
│   │   │   ├── appearance.tsx
│   │   │   ├── language.tsx
│   │   │   ├── regional.tsx
│   │   │   ├── security.tsx
│   │   │   ├── notifications.tsx
│   │   │   └── connected-accounts.tsx
│   │   └── not-found.tsx
│   │
│   ├── i18n/                   # Internationalization
│   │   ├── config.ts           # i18next init
│   │   └── locales/
│   │       ├── en/
│   │       │   ├── common.json
│   │       │   ├── auth.json
│   │       │   ├── items.json
│   │       │   ├── inventory.json
│   │       │   ├── loans.json
│   │       │   └── settings.json
│   │       └── et/
│   │           ├── common.json
│   │           ├── auth.json
│   │           ├── items.json
│   │           ├── inventory.json
│   │           ├── loans.json
│   │           └── settings.json
│   │
│   ├── lib/                    # Utilities
│   │   ├── utils.ts            # cn(), formatDate(), etc.
│   │   └── constants.ts        # App-wide constants
│   │
│   └── styles/
│       └── globals.css         # Tailwind directives + retro base styles
```

### Structure Rationale

- **`api/` flat files:** Each file maps 1:1 to a backend domain. Types are co-located with endpoints (no separate `types/` folder) because frontend2 has no offline layer -- types only serve the API client. This differs from frontend1 which split types out for IndexedDB/sync use.
- **`components/ui/` prefix `retro-`:** Explicit naming prevents confusion when reading code -- every component is obviously from the custom design system, not a third-party library. When the design system stabilizes, these could be extracted to a package.
- **`pages/` mirrors routes:** Each subfolder maps to a URL segment. Page components are thin -- they compose API hooks and UI components. Business logic lives in hooks and API layer, not in pages.
- **`contexts/` minimal set:** Only three contexts needed (auth, SSE, theme). No offline context, no sync context -- frontend2 is online-only.
- **`i18n/locales/` namespaced JSON:** Namespace per feature domain prevents one massive translation file. Only EN + ET for v2.0 (no RU, unlike frontend1 which has 3 languages).
- **No `features/` folder:** Frontend1 has `features/auth/components/` but frontend2 keeps it simpler. With online-only and no PWA, the codebase is small enough that flat `pages/` + `components/` is clearer than feature slicing.

## Architectural Patterns

### Pattern 1: React Router v7 Library Mode (not Framework Mode)

**What:** Use React Router v7 as a client-side routing library with `createBrowserRouter`, not in framework mode (which would add SSR/RSC complexity matching Remix).

**When to use:** Pure SPA without server-side rendering requirements. Frontend2 is online-only and does not need SSR, so library mode keeps the stack simple.

**Trade-offs:** No SSR means slower first paint vs Next.js, but avoids the complexity of a second SSR framework running alongside Next.js. The retro UI is a secondary/fun frontend, not the primary production app.

**Example:**
```typescript
// src/router.tsx
import { createBrowserRouter } from "react-router";
import { AppShell } from "./components/layout/app-shell";
import { AuthShell } from "./components/layout/auth-shell";

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <AuthShell />,
    children: [
      { index: true, lazy: () => import("./pages/auth/login") },
    ],
  },
  {
    path: "/register",
    element: <AuthShell />,
    children: [
      { index: true, lazy: () => import("./pages/auth/register") },
    ],
  },
  {
    path: "/auth/callback",
    lazy: () => import("./pages/auth/oauth-callback"),
  },
  {
    path: "/",
    element: <AppShell />,   // Authenticated layout with sidebar
    children: [
      { path: "dashboard", lazy: () => import("./pages/dashboard") },
      { path: "items", lazy: () => import("./pages/items/list") },
      { path: "items/new", lazy: () => import("./pages/items/create") },
      { path: "items/:id", lazy: () => import("./pages/items/detail") },
      // ... remaining routes
    ],
  },
]);
```

### Pattern 2: Adapted API Client (Copy, Do Not Share)

**What:** Copy the API client pattern from frontend1 and adapt it for Vite (no `process.env`, use `import.meta.env`). Do not create a shared package between frontends.

**When to use:** Always. The two frontends have different env var patterns (Next.js `NEXT_PUBLIC_*` vs Vite `VITE_*`), different build systems, and different runtime assumptions (SSR vs SPA). A shared package creates coupling that slows both down.

**Trade-offs:** Duplicated type definitions. Worth it because: (a) types diverge over time (frontend1 has offline types, frontend2 does not), (b) no build orchestration overhead, (c) each frontend evolves independently.

**Example:**
```typescript
// src/api/client.ts
const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.token = localStorage.getItem("auth_token");
  }

  // Same request pattern as frontend1 but:
  // - No "typeof window" checks (always in browser)
  // - credentials: "include" for cookies
  // - 401 redirects to /login (not /[locale]/login)
  // - No SSR considerations
}

export const apiClient = new ApiClient(API_URL);
```

### Pattern 3: Vite Dev Proxy for Backend

**What:** Use Vite's built-in `server.proxy` to forward API requests to the Go backend during development, avoiding CORS issues.

**When to use:** Development. In production, Angie reverse proxy handles routing.

**Trade-offs:** Simpler than configuring CORS for a third origin. The backend already allows `:3001` in CORS defaults, so direct calls would work too, but the proxy approach matches what most Vite+API projects use.

**Example:**
```typescript
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": "/src" },
  },
  server: {
    port: 3001,
    proxy: {
      "/auth": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
      "/users": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
      "/workspaces": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
      "/health": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
      "/notifications": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
      "/barcode": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
      "/push": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
      "/api/v1": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
});
```

### Pattern 4: OAuth Integration via APP_URL Configuration

**What:** The backend's OAuth flow redirects to `{APP_URL}/auth/callback` after successful authentication. Frontend2 needs its own callback route that exchanges the one-time code for a JWT token.

**When to use:** OAuth login (Google, GitHub).

**Critical integration detail:** The backend's `APP_URL` env var determines where OAuth callbacks redirect. In dev, this points to `http://localhost:3000` (frontend1). For frontend2 to work with OAuth in dev, the Vite proxy approach solves this -- when the backend redirects to `{APP_URL}/auth/callback` and APP_URL is `http://localhost:3001`, the callback hits frontend2's Vite dev server which serves the SPA route.

Set `APP_URL=http://localhost:3001` when developing frontend2 with OAuth. Or, more practically, skip OAuth in early phases and use email/password login (works immediately, no config changes).

In production with Angie, both frontends share the same origin (`:80`), so the OAuth callback path just needs to be routed to the correct frontend.

**Example:**
```typescript
// src/pages/auth/oauth-callback.tsx
import { useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router";
import { authApi } from "../../api/auth";

export default function OAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const exchanged = useRef(false);

  useEffect(() => {
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    if (error) {
      navigate(`/login?error=${encodeURIComponent(error)}`);
      return;
    }
    if (!code || exchanged.current) return;
    exchanged.current = true;

    authApi.exchangeOAuthCode(code)
      .then(() => navigate("/dashboard"))
      .catch(() => navigate("/login?error=exchange_failed"));
  }, [searchParams, navigate]);

  return <div>Completing sign in...</div>;
}
```

### Pattern 5: SSE Connection via Shared Context

**What:** A single EventSource connection per workspace, managed in a React context. Components subscribe to events via a hook. Simplified from frontend1 -- no offline/sync concerns.

**When to use:** Any page that needs real-time updates (inventory changes, loan events, notifications).

**Key detail:** EventSource does not support custom headers. The existing frontend1 uses `credentials: "include"` (cookies). Frontend2 should do the same -- the HttpOnly JWT cookie set by the backend during login is automatically sent with EventSource connections since they are same-origin (via proxy in dev, via Angie in prod).

**Example:**
```typescript
// src/contexts/sse-context.tsx
const url = `/workspaces/${workspaceId}/sse`;
const eventSource = new EventSource(url, { withCredentials: true });
```

## Data Flow

### Auth Flow

```
User visits /login
    |
    ├── Email/Password ──► POST /auth/login ──► JWT token + HttpOnly cookie
    │                                            ├── Store token in localStorage
    │                                            └── navigate("/dashboard")
    │
    └── OAuth (Google/GitHub)
         ├── Click ──► GET /auth/oauth/{provider} ──► Redirect to provider
         ├── Provider callback ──► GET /auth/oauth/{provider}/callback
         │                          └── Backend exchanges code, stores in Redis
         │                          └── Redirect to {APP_URL}/auth/callback?code=XXX
         └── Frontend callback page ──► POST /auth/oauth/exchange {code}
                                         ├── JWT token + HttpOnly cookie
                                         └── navigate("/dashboard")
```

### API Request Flow

```
Component
    ↓ calls hook or api function
ApiClient.get/post/patch/delete(endpoint, workspaceId?)
    ↓ adds headers: Authorization (Bearer token), X-Workspace-ID, credentials: "include"
    ↓
  [Dev] Vite proxy ──► Go backend :8080
  [Prod] Angie proxy ──► Go backend :8080
    ↓
  Response JSON
    ↓ 401? → clear token, redirect /login
    ↓ ok? → return typed data
Component re-renders
```

### SSE Event Flow

```
AuthContext confirms: isAuthenticated + currentWorkspace
    ↓
SSEProvider creates EventSource
    URL: /workspaces/{workspace_id}/sse (cookies sent automatically)
    ↓ (persistent connection)
Backend broadcasts events (CRUD, notifications)
    ↓
SSEProvider distributes to subscribers
    ↓
Components re-fetch affected data or update local state
```

### Key Data Flows

1. **Auth token lifecycle:** Login sets token in localStorage + cookie. ApiClient reads from localStorage on construction. 401 response clears both and redirects to /login. OAuth uses one-time Redis code exchange to avoid cross-origin cookie issues.
2. **Workspace scoping:** Every API call after auth includes `X-Workspace-ID` header. User selects workspace after login. All data queries are workspace-scoped on the backend.
3. **SSE real-time updates:** Single connection per workspace. Events trigger component-level re-fetches (not global state updates). If disconnected, reconnect with exponential backoff and re-fetch.

## Integration Points

### Existing Backend -- No Modifications Required

| Integration | Mechanism | Notes |
|-------------|-----------|-------|
| REST API | Same endpoints as frontend1 | All at `:8080`, no API versioning needed |
| Auth (email/pw) | `POST /auth/login`, `POST /auth/register` | Returns JWT, sets HttpOnly cookie |
| Auth (OAuth) | `GET /auth/oauth/{provider}` | Redirects to provider, callback returns to `{APP_URL}/auth/callback` |
| OAuth exchange | `POST /auth/oauth/exchange` | One-time code from Redis, returns JWT |
| SSE | `GET /workspaces/{id}/sse` | EventSource with cookies (withCredentials: true) |
| File uploads | `POST` with `multipart/form-data` | Photos, avatars, imports |
| CORS | Already allows `:3001` | `cors.go` line 14: `"http://localhost:3001"` in default origins |

### Backend/Infrastructure Modifications Needed

| Change | Why | Scope |
|--------|-----|-------|
| Angie config update | Route frontend2 traffic to its container | Add upstream + location blocks |
| `docker-compose.yml` | Add `frontend2` service in prod profile | New service definition |
| `APP_URL` in dev | OAuth redirects to frontend2 when testing OAuth | Env var change (temporary, per-dev) |
| `CORS_ALLOWED_ORIGINS` | Production may need explicit frontend2 origin | Only if frontend2 runs on separate domain/subdomain |

### OAuth Callback Strategy

**Recommended approach for v2.0:** Build email/password login first (works immediately with zero backend changes). Add OAuth in a later phase once the deployment topology is decided.

For OAuth when ready, two options:

**Option A -- Path-based routing (simpler):** Frontend2 at `/retro/`, callback at `/retro/auth/callback`. Requires backend change to make the redirect path configurable per OAuth initiation (add a `redirect_to` param to the initiate endpoint). More invasive.

**Option B -- Dev: separate APP_URL, Prod: shared origin (recommended):**
- Dev: Set `APP_URL=http://localhost:3001` when working on frontend2 OAuth. Frontend1 OAuth breaks, but that is fine -- you are developing frontend2.
- Prod: Both frontends behind Angie on same origin. Angie routes `/auth/callback` to whichever frontend the user was using (can be determined by a cookie or simply route to frontend1 and have frontend1's callback be a thin redirect based on a `source` param).

**Pragmatic v2.0 answer:** Email/password in early phases. OAuth in final phase after deployment is tested.

## Coexistence with Frontend1

### Development

Both frontends run simultaneously:
- Frontend1: `cd frontend && npm run dev` (port 3000)
- Frontend2: `cd frontend2 && npm run dev` (port 3001)
- Backend: `cd backend && go run ./cmd/server` (port 8080)

No conflicts. CORS already allows both ports. Each has independent `node_modules`, `package.json`, and build config.

### Production (Docker Compose)

```yaml
# Addition to docker-compose.yml
frontend2:
  build:
    context: ./frontend2
    dockerfile: Dockerfile
  profiles: ["prod"]
  healthcheck:
    test: ["CMD", "wget", "-qO-", "http://127.0.0.1:3001"]
    interval: 5s
    timeout: 5s
    retries: 10
    start_period: 10s
  networks:
    - warehouse
```

Frontend2 Dockerfile (simpler than frontend1, no Next.js standalone build):
```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3001
```

SPA requires nginx `try_files` for client-side routing:
```nginx
server {
    listen 3001;
    root /usr/share/nginx/html;
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### Angie Routing (Production)

Add to `angie.conf`:
```nginx
upstream frontend2 {
    server frontend2:3001;
}

# Path-based routing (simpler, no DNS changes needed)
location /retro/ {
    proxy_pass http://frontend2/;
    proxy_http_version 1.1;
}
location /retro {
    return 301 /retro/;
}
```

### What Is New vs Modified

| Category | New (frontend2 only) | Modified (existing infra) |
|----------|---------------------|---------------------------|
| Code | Entire `/frontend2` directory | None in `/frontend` or `/backend` |
| Config | Frontend2 Dockerfile + nginx.conf | `docker-compose.yml` (add service) |
| Config | Frontend2 `package.json`, `vite.config.ts` | `docker/angie/angie.conf` (add routing) |
| Backend | Nothing | Nothing (CORS already covers :3001) |
| CI | Frontend2 build/test step | Pipeline config (add parallel job) |

## Build Order for Phased Development

### Phase 1: Foundation
Scaffold Vite + React 19 + Router v7 + Tailwind CSS 4. ApiClient adapted from frontend1. Auth context with email/password login. One protected route (dashboard placeholder). Vite proxy config. Verify API calls work end-to-end.
**Why first:** Everything else depends on auth and routing working. Proves the integration with existing backend.

### Phase 2: Design System Core
Retro UI primitives (button, input, card, panel, dialog, badge, table). Layout shells (app-shell with sidebar + header, auth-shell). Theme tokens in Tailwind config. Dark/light theme toggle.
**Why second:** All feature pages need these components. Building them before features prevents throwaway work.

### Phase 3: i18n Setup
react-i18next config with EN + ET. Translation files for common + auth namespaces. Language switcher. Wire existing pages to use `useTranslation`.
**Why third:** Better to wire i18n before building all pages. Retrofitting i18n into existing pages is painful and error-prone.

### Phase 4: Core Feature Pages
Dashboard (analytics), items CRUD, inventory management, categories, locations, containers. Data tables with sort/filter/pagination. Search.
**Why fourth:** Core data model pages using the design system and API client from phases 1-3. Largest phase by page count.

### Phase 5: Secondary Feature Pages
Loans, borrowers, repair logs, scanner (barcode/QR), declutter assistant, import/export. Settings hub with all 8 subpages (profile, appearance, language, regional, security, notifications, data, connected accounts).
**Why fifth:** Depends on item/inventory infrastructure. Settings uses auth context from phase 1.

### Phase 6: Real-time and Polish
SSE connection + notification dropdown. OAuth login (Google, GitHub). Error boundaries. Loading skeletons. Toast notifications. Final responsive/mobile polish.
**Why last:** SSE is an enhancement, not a blocker for feature development. OAuth requires deployment topology to be decided. Polish makes sense after all pages exist.

## Anti-Patterns

### Anti-Pattern 1: Shared Package Between Frontends

**What people do:** Create a `packages/shared` with types and utilities used by both frontends.
**Why it's wrong:** Couples two independent frontends with different build systems (Next.js vs Vite), different env var patterns (`NEXT_PUBLIC_*` vs `VITE_*`), different runtime assumptions (SSR vs SPA). One breaking change blocks both. Monorepo tooling (Turborepo) adds complexity for marginal benefit when the shared surface is just TypeScript interfaces.
**Do this instead:** Copy types. They are small. Each frontend owns its type definitions and evolves independently. Frontend1 has offline types, frontend2 does not -- they diverge naturally.

### Anti-Pattern 2: React Router Framework Mode for an SPA

**What people do:** Use React Router v7 in framework mode because "it's the new way" (it evolved from Remix).
**Why it's wrong:** Framework mode adds SSR, server loaders, server actions -- none of which frontend2 needs. It requires the `@react-router/dev` Vite plugin with its own file conventions (`app/root.tsx`, `app/routes.ts`), adding complexity for no benefit in a pure SPA.
**Do this instead:** Use library mode with `createBrowserRouter`. Import from `react-router` (not `react-router-dom`, which is deprecated in v7). Define routes as a code array with lazy imports for code splitting.

### Anti-Pattern 3: next-intl in a Vite SPA

**What people do:** Try to use the same i18n library as frontend1 (`next-intl`) for consistency.
**Why it's wrong:** `next-intl` is tightly coupled to Next.js middleware, server components, and `[locale]` URL path segments. It does not work outside Next.js.
**Do this instead:** Use `react-i18next` + `i18next`. It is the standard for React SPAs. Translation JSON structure can be similar but files are independent. No URL-based locale prefix needed -- store locale in user preferences (already persisted in backend `users.language` column).

### Anti-Pattern 4: Running Backend with Two APP_URLs for OAuth

**What people do:** Try to make the backend serve both frontends for OAuth by switching `APP_URL` dynamically per request.
**Why it's wrong:** `APP_URL` is a startup config read once at boot, not a per-request setting. OAuth state cookies and PKCE verifiers are tied to the callback URL.
**Do this instead:** In dev, use email/password auth for frontend2 (or temporarily change `APP_URL` to `:3001`). In prod, put both frontends behind the same origin (Angie) so `APP_URL` works for both via path routing.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Single user (dev) | Current architecture is fine. Vite dev server + Go backend. |
| 10-100 users | Add Angie routing for frontend2 in prod. Static SPA served from nginx is effectively free to scale. |
| Frontend2 replaces frontend1 | Consider adding SSR (switch to framework mode), PWA/offline (port sync infra). These are v3.0+ concerns. |

### Scaling Priorities

1. **First bottleneck:** Will not be frontend2. It is a static SPA -- nginx serves pre-built files. Backend API and database are the shared bottleneck, already handled by frontend1's architecture.
2. **Second bottleneck:** Bundle size. Use React Router lazy imports for code splitting. Vite's tree-shaking handles the rest. Monitor with `vite-plugin-visualizer`.

## Sources

- [React Router Modes Documentation](https://reactrouter.com/start/modes) - Library vs Framework vs Data mode
- [React Router Installation (Data/Library mode)](https://reactrouter.com/start/data/installation) - createBrowserRouter setup
- [react-i18next Quick Start](https://react.i18next.com/guides/quick-start) - i18n for React SPAs
- Backend CORS config: `backend/internal/api/middleware/cors.go` (`:3001` already in default allowed origins)
- Backend OAuth flow: `backend/internal/domain/auth/oauth/handler.go` (APP_URL-based redirects)
- Backend router: `backend/internal/api/router.go` (complete API surface)
- Production proxy: `docker/angie/angie.conf` (reverse proxy routing pattern)
- Frontend1 API client: `frontend/lib/api/client.ts` (pattern to adapt for Vite)
- Frontend1 OAuth callback: `frontend/app/[locale]/(auth)/callback/page.tsx` (exchange flow to replicate)
- Frontend1 SSE context: `frontend/lib/contexts/sse-context.tsx` (EventSource pattern to simplify)
- Frontend1 i18n config: `frontend/i18n/config.ts` (locale list: en, et, ru)
- Docker Compose: `docker-compose.yml` (production service topology)

---
*Architecture research for: Retro-styled second frontend (SPA) for existing Go backend*
*Researched: 2026-04-08*
