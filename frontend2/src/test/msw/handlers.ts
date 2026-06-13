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

// --- Items + Photos fixtures (Phase 7 Plan 01) ---
// ABSOLUTE photo URLs on purpose — consumer tests must exercise the rewrite.
const PHOTO = {
  id: "p-1",
  item_id: "it-1",
  workspace_id: "ws-1",
  filename: "drill.jpg",
  file_size: 1234,
  mime_type: "image/jpeg",
  width: 800,
  height: 600,
  display_order: 0,
  is_primary: true,
  caption: "front",
  url: "http://localhost:8080/workspaces/ws-1/items/it-1/photos/p-1",
  thumbnail_url:
    "http://localhost:8080/workspaces/ws-1/items/it-1/photos/p-1/thumbnail",
  thumbnail_status: "complete",
  created_at: "2026-06-13T00:00:00Z",
  updated_at: "2026-06-13T00:00:00Z",
};

const ITEM = {
  id: "it-1",
  workspace_id: "ws-1",
  sku: "SKU-1",
  name: "Cordless Drill",
  description: "18V",
  min_stock_level: 0,
  short_code: "abc123",
  is_archived: false,
  primary_photo_url:
    "http://localhost:8080/workspaces/ws-1/items/it-1/photos/p-1",
  primary_photo_thumbnail_url:
    "http://localhost:8080/workspaces/ws-1/items/it-1/photos/p-1/thumbnail",
  created_at: "2026-06-13T00:00:00Z",
  updated_at: "2026-06-13T00:00:00Z",
};

const LABEL = {
  id: "lbl-1",
  workspace_id: "ws-1",
  name: "Power Tools",
  color: "#b73348",
};

const ACTIVE_LOAN = {
  id: "loan-1",
  workspace_id: "ws-1",
  inventory_id: "inv-1",
  borrower_id: "bor-1",
  quantity: 1,
  loaned_at: "2026-06-01T00:00:00Z",
  is_active: true,
  is_overdue: false,
  created_at: "2026-06-01T00:00:00Z",
  updated_at: "2026-06-01T00:00:00Z",
  item: { id: "it-1", name: "Cordless Drill" },
  borrower: { id: "bor-1", name: "Alex" },
};

const RETURNED_LOAN = {
  ...ACTIVE_LOAN,
  id: "loan-2",
  returned_at: "2026-06-05T00:00:00Z",
  is_active: false,
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

  // --- Items + Photos (Phase 7 Plan 01) ---
  // Contract-shaped happy-path fixtures for downstream feature unit tests.
  // Photo fixtures deliberately carry ABSOLUTE localhost:8080 url/thumbnail_url
  // so consumer tests exercise the toProxyUrl rewrite (Pitfall 1). The Huma
  // `$schema` key is omitted (tests ignore it — Pitfall 7). Per-case overrides
  // via `server.use(...)`.

  // Item list / by-barcode (specific routes registered BEFORE :id catch-all).
  http.get("/api/workspaces/:wsId/items/by-barcode/:code", ({ params }) =>
    HttpResponse.json({ ...ITEM, barcode: String(params.code) }),
  ),
  http.get("/api/workspaces/:wsId/items", () =>
    HttpResponse.json({ items: [ITEM], total: 1, page: 1, total_pages: 1 }),
  ),
  http.post("/api/workspaces/:wsId/items", () => HttpResponse.json(ITEM)),

  // Item labels (specific) BEFORE item :id.
  http.get("/api/workspaces/:wsId/items/:id/labels", () =>
    HttpResponse.json({ label_ids: ["lbl-1"] }),
  ),
  http.post("/api/workspaces/:wsId/items/:id/labels/:labelId", () => new HttpResponse(null, { status: 204 })),
  http.delete("/api/workspaces/:wsId/items/:id/labels/:labelId", () => new HttpResponse(null, { status: 204 })),

  // Item loans (specific) BEFORE item :id.
  http.get("/api/workspaces/:wsId/items/:id/loans", () =>
    HttpResponse.json({ items: [ACTIVE_LOAN, RETURNED_LOAN] }),
  ),

  // Item photos list (specific) BEFORE item :id.
  http.get("/api/workspaces/:wsId/items/:id/photos/list", () =>
    HttpResponse.json([PHOTO]),
  ),

  // Item lifecycle (specific) BEFORE item :id.
  http.post("/api/workspaces/:wsId/items/:id/archive", () => new HttpResponse(null, { status: 204 })),
  http.post("/api/workspaces/:wsId/items/:id/restore", () => new HttpResponse(null, { status: 204 })),

  // Item by id (catch-all for the :id segment — registered last of the item GETs).
  http.get("/api/workspaces/:wsId/items/:id", () => HttpResponse.json(ITEM)),
  http.patch("/api/workspaces/:wsId/items/:id", () => HttpResponse.json(ITEM)),
  http.delete("/api/workspaces/:wsId/items/:id", () => new HttpResponse(null, { status: 204 })),

  // Workspace labels.
  http.get("/api/workspaces/:wsId/labels", () =>
    HttpResponse.json({ items: [LABEL] }),
  ),

  // Photo JSON ops.
  http.put("/api/workspaces/:wsId/photos/:id/primary", () => new HttpResponse(null, { status: 204 })),
  http.put("/api/workspaces/:wsId/photos/:id/caption", () => HttpResponse.json(PHOTO)),
  http.put("/api/workspaces/:wsId/items/:id/photos/order", () => new HttpResponse(null, { status: 204 })),
  http.delete("/api/workspaces/:wsId/photos/:id", () => new HttpResponse(null, { status: 204 })),

  // Photo multipart + bulk.
  http.post("/api/workspaces/:wsId/items/:id/photos/check-duplicate", () =>
    HttpResponse.json({ has_duplicates: false, duplicates: [] }),
  ),
  http.post("/api/workspaces/:wsId/items/:id/photos/bulk-delete", () => new HttpResponse(null, { status: 204 })),
  http.post("/api/workspaces/:wsId/items/:id/photos/bulk-caption", () => new HttpResponse(null, { status: 204 })),
  http.post("/api/workspaces/:wsId/items/:id/photos", () => HttpResponse.json(PHOTO)),
];
