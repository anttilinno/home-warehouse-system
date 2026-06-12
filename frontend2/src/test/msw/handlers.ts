import { http, HttpResponse } from "msw";

// Shared MSW handlers for auth-endpoint unit tests (Phase 05 Plan 02).
// Endpoints are matched at the BASE_URL prefix `/api/...` because the api.ts
// client prepends `BASE_URL = "/api"` to every request. Default handlers return
// contract-shaped happy-path JSON (shapes per 05-UI-SPEC Backend contract
// table); individual tests override per-case with `server.use(...)`.

const PLACEHOLDER_TOKENS = {
  // Placeholder values only — never real secrets (threat T-05-08). Refresh
  // tokens stay in-memory in the client, never localStorage.
  token: "test-access-token",
  refresh_token: "test-refresh-token",
};

const WORKSPACES = [
  {
    id: "ws-1",
    name: "Personal",
    slug: "personal",
    description: null,
    role: "owner",
    is_personal: true,
  },
];

const SESSIONS = [
  {
    id: "sess-1",
    device: "Chrome on Linux",
    ip: "127.0.0.1",
    last_active_at: "2026-06-12T10:00:00Z",
    created_at: "2026-06-12T09:00:00Z",
    is_current: true,
  },
];

const ME = {
  id: "user-1",
  email: "seeder@test.local",
  full_name: "Seed Er",
  has_password: true,
  avatar_url: null,
};

export const handlers = [
  // --- Auth ---
  http.post("/api/auth/login", () => HttpResponse.json(PLACEHOLDER_TOKENS)),
  http.post("/api/auth/register", () => HttpResponse.json(PLACEHOLDER_TOKENS)),
  http.post("/api/auth/oauth/exchange", () =>
    HttpResponse.json(PLACEHOLDER_TOKENS),
  ),

  // --- Identity / workspaces ---
  http.get("/api/users/me", () => HttpResponse.json(ME)),
  http.get("/api/users/me/workspaces", () => HttpResponse.json(WORKSPACES)),

  // --- Sessions ---
  http.get("/api/users/me/sessions", () => HttpResponse.json(SESSIONS)),
  http.delete("/api/users/me/sessions/:id", () => new HttpResponse(null, { status: 204 })),
  http.delete("/api/users/me/sessions", () => new HttpResponse(null, { status: 204 })),

  // --- Password / account ---
  http.patch("/api/users/me/password", () => new HttpResponse(null, { status: 204 })),
  http.get("/api/users/me/can-delete", () =>
    HttpResponse.json({ can_delete: true, blocking_workspaces: [] }),
  ),
  http.delete("/api/users/me", () => new HttpResponse(null, { status: 204 })),

  // --- Connected OAuth accounts ---
  http.get("/api/auth/oauth/accounts", () => HttpResponse.json({ accounts: [] })),
  http.delete("/api/auth/oauth/accounts/:provider", () => new HttpResponse(null, { status: 204 })),
];
