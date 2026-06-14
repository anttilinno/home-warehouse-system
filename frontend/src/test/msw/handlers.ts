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
  // Phase 12 (Settings) — GetMe carries the seven preference fields. Downstream
  // preferences subpages READ these from the shared ["me"] query.
  date_format: "YYYY-MM-DD",
  time_format: "24h",
  thousand_separator: " ",
  decimal_separator: ",",
  language: "en",
  theme: "light",
  notification_preferences: {} as Record<string, boolean>,
};

// Phase 12 (Settings) — a single member fixture for the workspace-members
// handlers. email/full_name reflect the enriched MemberResponse (Plan 12-01).
const MEMBER_FIXTURE = {
  id: "mem-1",
  workspace_id: "ws-1",
  user_id: "user-1",
  role: "member",
  email: "member@test.local",
  full_name: "Mem Ber",
  created_at: "2026-06-13T00:00:00Z",
  updated_at: "2026-06-13T00:00:00Z",
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
  is_archived: false,
  created_at: "2026-06-13T00:00:00Z",
  updated_at: "2026-06-13T00:00:00Z",
};

// --- Taxonomy fixtures (Phase 10 Plan 01, TAX-01..07) ---
// Envelope discipline (Pitfall 2): categories + labels + ALL /search return a
// BARE { items }; locations + containers LIST return a PAGINATED
// { items, total, page, total_pages }. Categories nest via parent_category_id;
// locations via parent_location (NOT _id — Pitfall 6); containers are flat with
// location_id. Two-level trees so buildTree/RetroTree consumer tests exercise
// nesting + orphan paths. Per-case overrides via server.use().

const CATEGORIES = [
  {
    id: "cat-electronics",
    workspace_id: "ws-1",
    name: "Electronics",
    description: "Gadgets and devices",
    is_archived: false,
    created_at: "2026-06-13T00:00:00Z",
    updated_at: "2026-06-13T00:00:00Z",
  },
  {
    id: "cat-phones",
    workspace_id: "ws-1",
    name: "Phones",
    parent_category_id: "cat-electronics",
    is_archived: false,
    created_at: "2026-06-13T00:00:00Z",
    updated_at: "2026-06-13T00:00:00Z",
  },
  {
    id: "cat-tools",
    workspace_id: "ws-1",
    name: "Tools",
    is_archived: false,
    created_at: "2026-06-13T00:00:00Z",
    updated_at: "2026-06-13T00:00:00Z",
  },
];

const LOCATIONS = [
  {
    id: "loc-1",
    workspace_id: "ws-1",
    name: "Garage",
    short_code: "GAR1",
    is_archived: false,
    created_at: "2026-06-13T00:00:00Z",
    updated_at: "2026-06-13T00:00:00Z",
  },
  {
    id: "loc-2",
    workspace_id: "ws-1",
    name: "Shelf A",
    parent_location: "loc-1", // ⚠ parent_location, NOT parent_location_id
    short_code: "SHLF",
    is_archived: false,
    created_at: "2026-06-13T00:00:00Z",
    updated_at: "2026-06-13T00:00:00Z",
  },
];

const CONTAINERS = [
  {
    id: "cont-1",
    workspace_id: "ws-1",
    name: "Toolbox A",
    location_id: "loc-1", // flat — TAX-05 group-by is client-side
    capacity: 12,
    short_code: "TBXA",
    is_archived: false,
    created_at: "2026-06-13T00:00:00Z",
    updated_at: "2026-06-13T00:00:00Z",
  },
  {
    id: "cont-2",
    workspace_id: "ws-1",
    name: "Bin 3",
    location_id: "loc-2",
    short_code: "BIN3",
    is_archived: false,
    created_at: "2026-06-13T00:00:00Z",
    updated_at: "2026-06-13T00:00:00Z",
  },
];

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

// --- Inventory + Movements fixtures (Phase 7b Plan 01) ---
// Contract-shaped happy-path data for downstream INV-01..08 component tests.
// item_id matches the items fixture (`it-1`) so client-side name joins resolve.
// The `$schema` key is omitted (Pitfall 7). Per-case overrides via server.use().

// Three entries with distinct status/condition values so list/pill rendering is
// exercisable. inv-1 is the canonical entry (it-1).
const INVENTORY = [
  {
    id: "inv-1",
    workspace_id: "ws-1",
    item_id: "it-1",
    location_id: "loc-1",
    container_id: "cont-1",
    quantity: 3,
    condition: "GOOD",
    status: "AVAILABLE",
    date_acquired: "2026-01-15T00:00:00Z",
    is_archived: false,
    created_at: "2026-06-13T00:00:00Z",
    updated_at: "2026-06-13T00:00:00Z",
  },
  {
    id: "inv-2",
    workspace_id: "ws-1",
    item_id: "it-1",
    location_id: "loc-2",
    quantity: 1,
    condition: "FAIR",
    status: "ON_LOAN",
    is_archived: false,
    created_at: "2026-06-13T00:00:00Z",
    updated_at: "2026-06-13T00:00:00Z",
  },
  {
    id: "inv-3",
    workspace_id: "ws-1",
    item_id: "it-1",
    location_id: "loc-1",
    quantity: 0,
    condition: "DAMAGED",
    status: "MISSING",
    is_archived: false,
    created_at: "2026-06-13T00:00:00Z",
    updated_at: "2026-06-13T00:00:00Z",
  },
];

// Expiring projection: one near-future (expiration) + one PAST (warranty) so the
// near/past split is exercisable. `date` is YYYY-MM-DD (NOT RFC3339 — Pitfall 4).
const EXPIRING = {
  items: [
    {
      inventory_id: "inv-1",
      item_id: "it-1",
      item_name: "Cordless Drill",
      quantity: 3,
      kind: "expiration",
      date: "2099-12-31",
    },
    {
      inventory_id: "inv-2",
      item_id: "it-1",
      item_name: "Cordless Drill",
      quantity: 1,
      kind: "warranty",
      date: "2020-01-01",
    },
  ],
  total: 2,
};

// --- Barcode product lookup (Phase 11 Plan 01, SCAN-10) ---
// GET /api/barcode/:barcode — UPC product-prefill lookup (NOT the item by-barcode
// route, which is /workspaces/:wsId/items/by-barcode/:code). Verified response
// shape (11-RESEARCH Pattern 6 / OQ5): { barcode, name, brand?, category?,
// image_url?, found }. `name` is "" when not found. The handler returns a FOUND
// fixture for the canonical found code and a NOT-FOUND payload for the canonical
// not-found code; any other code defaults to found so happy-path tests stay
// terse. Per-case overrides via server.use(). The canonical FOUND code is
// "0123456789012" (any non-not-found code resolves to the found product);
// the canonical NOT-FOUND code is BARCODE_NOT_FOUND_CODE below.
const BARCODE_NOT_FOUND_CODE = "9999999999999";

const BARCODE_PRODUCT_FOUND = {
  name: "Cordless Drill",
  brand: "Acme",
  category: "Power Tools",
  image_url: "https://example.com/drill.jpg",
};

export const handlers = [
  // --- Barcode product lookup (SCAN-10) ---
  http.get("/api/barcode/:barcode", ({ params }) => {
    const barcode = String(params.barcode);
    if (barcode === BARCODE_NOT_FOUND_CODE) {
      return HttpResponse.json({ barcode, name: "", found: false });
    }
    return HttpResponse.json({
      barcode,
      ...BARCODE_PRODUCT_FOUND,
      found: true,
    });
  }),

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

  // --- Profile + preferences + avatar (Phase 12 Plan 02) ---
  http.patch("/api/users/me", () => HttpResponse.json(ME)),
  http.patch("/api/users/me/preferences", () => HttpResponse.json(ME)),
  http.post("/api/users/me/avatar", () =>
    HttpResponse.json({ ...ME, avatar_url: "/api/users/me/avatar" }),
  ),
  http.delete("/api/users/me/avatar", () =>
    HttpResponse.json({ ...ME, avatar_url: null }),
  ),

  // --- Workspace members (Phase 12 Plan 02) ---
  http.get("/api/workspaces/:wsId/members", () =>
    HttpResponse.json({ items: [] }),
  ),
  http.post("/api/workspaces/:wsId/members", () =>
    HttpResponse.json(MEMBER_FIXTURE),
  ),
  http.patch("/api/workspaces/:wsId/members/:userId", () =>
    HttpResponse.json(MEMBER_FIXTURE),
  ),
  http.delete("/api/workspaces/:wsId/members/:userId", () => new HttpResponse(null, { status: 204 })),

  // --- Workspace full export (Phase 12 Plan 02) ---
  http.get("/api/workspaces/:wsId/export/workspace", () =>
    HttpResponse.text("BLOB", {
      headers: { "content-type": "application/octet-stream" },
    }),
  ),

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
  // Items list (PAGINATED). When filtered by ?category_id= (TAX-02 usage-count
  // read, GET /items?category_id=&limit=1) the default fixture reports zero
  // assigned items so the archive-warning path defaults to "no items"; tests
  // override per-case via server.use() to surface a non-zero total.
  http.get("/api/workspaces/:wsId/items", ({ request }) => {
    const url = new URL(request.url);
    if (url.searchParams.has("category_id")) {
      return HttpResponse.json({ items: [], total: 0, page: 1, total_pages: 0 });
    }
    return HttpResponse.json({ items: [ITEM], total: 1, page: 1, total_pages: 1 });
  }),
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

  // Workspace labels — BARE { items } list (Pitfall 2) + TAX-07 manager CRUD.
  http.get("/api/workspaces/:wsId/labels", () =>
    HttpResponse.json({ items: [LABEL] }),
  ),
  http.post("/api/workspaces/:wsId/labels", () => HttpResponse.json(LABEL)),
  http.get("/api/workspaces/:wsId/labels/:id", ({ params }) =>
    HttpResponse.json({ ...LABEL, id: String(params.id) }),
  ),
  http.patch("/api/workspaces/:wsId/labels/:id", ({ params }) =>
    HttpResponse.json({ ...LABEL, id: String(params.id) }),
  ),
  http.post("/api/workspaces/:wsId/labels/:id/archive", () => new HttpResponse(null, { status: 204 })),
  http.post("/api/workspaces/:wsId/labels/:id/restore", () => new HttpResponse(null, { status: 204 })),
  http.delete("/api/workspaces/:wsId/labels/:id", () => new HttpResponse(null, { status: 204 })),

  // --- Taxonomy: categories (BARE { items } list — Pitfall 2) ---
  // create returns 201 (categories); other domains return 200.
  http.get("/api/workspaces/:wsId/categories", () =>
    HttpResponse.json({ items: CATEGORIES }),
  ),
  http.post("/api/workspaces/:wsId/categories", () =>
    HttpResponse.json(CATEGORIES[0], { status: 201 }),
  ),
  http.get("/api/workspaces/:wsId/categories/:id", ({ params }) =>
    HttpResponse.json({ ...CATEGORIES[0], id: String(params.id) }),
  ),
  http.patch("/api/workspaces/:wsId/categories/:id", ({ params }) =>
    HttpResponse.json({ ...CATEGORIES[0], id: String(params.id) }),
  ),
  http.post("/api/workspaces/:wsId/categories/:id/archive", () => new HttpResponse(null, { status: 204 })),
  http.post("/api/workspaces/:wsId/categories/:id/restore", () => new HttpResponse(null, { status: 204 })),
  http.delete("/api/workspaces/:wsId/categories/:id", () => new HttpResponse(null, { status: 204 })),

  // --- Taxonomy: locations (PAGINATED list; BARE /search — Pitfall 2) ---
  // /locations/search (literal) registered BEFORE /locations/:id (param).
  http.get("/api/workspaces/:wsId/locations/search", () =>
    HttpResponse.json({ items: LOCATIONS }),
  ),
  http.get("/api/workspaces/:wsId/locations", () =>
    HttpResponse.json({
      items: LOCATIONS,
      total: LOCATIONS.length,
      page: 1,
      total_pages: 1,
    }),
  ),
  http.post("/api/workspaces/:wsId/locations", () =>
    HttpResponse.json(LOCATIONS[0]),
  ),
  http.get("/api/workspaces/:wsId/locations/:id", ({ params }) =>
    HttpResponse.json({ ...LOCATIONS[0], id: String(params.id) }),
  ),
  http.patch("/api/workspaces/:wsId/locations/:id", ({ params }) =>
    HttpResponse.json({ ...LOCATIONS[0], id: String(params.id) }),
  ),
  http.post("/api/workspaces/:wsId/locations/:id/archive", () => new HttpResponse(null, { status: 204 })),
  http.post("/api/workspaces/:wsId/locations/:id/restore", () => new HttpResponse(null, { status: 204 })),
  http.delete("/api/workspaces/:wsId/locations/:id", () => new HttpResponse(null, { status: 204 })),

  // --- Taxonomy: containers (PAGINATED list; BARE /search — Pitfall 2) ---
  // /containers/search (literal) registered BEFORE /containers/:id (param).
  http.get("/api/workspaces/:wsId/containers/search", () =>
    HttpResponse.json({ items: CONTAINERS }),
  ),
  http.get("/api/workspaces/:wsId/containers", () =>
    HttpResponse.json({
      items: CONTAINERS,
      total: CONTAINERS.length,
      page: 1,
      total_pages: 1,
    }),
  ),
  http.post("/api/workspaces/:wsId/containers", () =>
    HttpResponse.json(CONTAINERS[0]),
  ),
  http.get("/api/workspaces/:wsId/containers/:id", ({ params }) =>
    HttpResponse.json({ ...CONTAINERS[0], id: String(params.id) }),
  ),
  http.patch("/api/workspaces/:wsId/containers/:id", ({ params }) =>
    HttpResponse.json({ ...CONTAINERS[0], id: String(params.id) }),
  ),
  http.post("/api/workspaces/:wsId/containers/:id/archive", () => new HttpResponse(null, { status: 204 })),
  http.post("/api/workspaces/:wsId/containers/:id/restore", () => new HttpResponse(null, { status: 204 })),
  http.delete("/api/workspaces/:wsId/containers/:id", () => new HttpResponse(null, { status: 204 })),

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

  // --- Inventory + Movements (Phase 7b Plan 01) ---
  // Specific routes registered BEFORE the /inventory/:id catch-all so by-item /
  // expiring / sub-resources are not shadowed.

  // Per-inventory movements (specific) BEFORE /inventory/:id. Empty by default
  // (movements only appear after a move — Pitfall 3); tests override per-case.
  http.get("/api/workspaces/:wsId/inventory/:id/movements", () =>
    HttpResponse.json({ items: [] }),
  ),

  // Scoped reads — BARE { items } (no pagination envelope — Pitfall 1).
  http.get("/api/workspaces/:wsId/inventory/by-item/:itemId", () =>
    HttpResponse.json({ items: INVENTORY }),
  ),
  http.get("/api/workspaces/:wsId/inventory/by-location/:locationId", () =>
    HttpResponse.json({ items: INVENTORY }),
  ),
  http.get("/api/workspaces/:wsId/inventory/by-container/:containerId", () =>
    HttpResponse.json({ items: INVENTORY }),
  ),
  http.get("/api/workspaces/:wsId/inventory/expiring", () =>
    HttpResponse.json(EXPIRING),
  ),

  // Inventory lifecycle (specific) BEFORE /inventory/:id.
  http.post("/api/workspaces/:wsId/inventory/:id/archive", () => new HttpResponse(null, { status: 204 })),
  http.post("/api/workspaces/:wsId/inventory/:id/restore", () => new HttpResponse(null, { status: 204 })),
  http.post("/api/workspaces/:wsId/inventory/:id/move", ({ params }) =>
    HttpResponse.json({ ...INVENTORY[0], id: String(params.id) }),
  ),
  http.patch("/api/workspaces/:wsId/inventory/:id/quantity", ({ params }) =>
    HttpResponse.json({ ...INVENTORY[0], id: String(params.id) }),
  ),
  http.patch("/api/workspaces/:wsId/inventory/:id/status", ({ params }) =>
    HttpResponse.json({ ...INVENTORY[0], id: String(params.id) }),
  ),

  // Inventory list (full envelope) + create. When filtered by ?container_id=
  // (TAX-06 container-delete usage read, GET /inventory?container_id=&limit=1)
  // the default fixture reports zero so the delete-warning path defaults to
  // "nothing assigned"; tests override per-case to surface a non-zero total.
  http.get("/api/workspaces/:wsId/inventory", ({ request }) => {
    const url = new URL(request.url);
    if (url.searchParams.has("container_id")) {
      return HttpResponse.json({ items: [], total: 0, page: 1, total_pages: 0 });
    }
    return HttpResponse.json({
      items: INVENTORY,
      total: INVENTORY.length,
      page: 1,
      total_pages: 1,
    });
  }),
  http.post("/api/workspaces/:wsId/inventory", () =>
    HttpResponse.json(INVENTORY[0]),
  ),

  // Inventory by id (catch-all for the :id segment — registered last of the
  // inventory GETs) + full PATCH (condition rides here; NO status — Pitfall 6).
  http.get("/api/workspaces/:wsId/inventory/:id", ({ params }) =>
    HttpResponse.json({ ...INVENTORY[0], id: String(params.id) }),
  ),
  http.patch("/api/workspaces/:wsId/inventory/:id", ({ params }) =>
    HttpResponse.json({ ...INVENTORY[0], id: String(params.id) }),
  ),

  // Movement reads — BARE { items }, empty by default (empty-state — Pitfall 3).
  http.get("/api/workspaces/:wsId/movements", () =>
    HttpResponse.json({ items: [] }),
  ),
  http.get("/api/workspaces/:wsId/locations/:id/movements", () =>
    HttpResponse.json({ items: [] }),
  ),
];
