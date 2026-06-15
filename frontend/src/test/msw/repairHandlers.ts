import { http, HttpResponse } from "msw";

// Phase 10b Plan 01 — MSW repair handlers for the Wave 2/3 component tests.
// Mirrors loanHandlers.ts: endpoints match at the `/api/...` prefix (api.ts
// prepends BASE_URL = "/api"). Lists return BARE { items } / { items, total }
// envelopes (huma's `$schema` omitted; mirrors repairsApi typing). The repair
// fixture set deliberately includes one PENDING, one IN_PROGRESS, and one
// COMPLETED row so downstream status-pill rendering is exercisable.
//
// Per-case overrides via `server.use(...)` — this array is NOT registered in the
// global handlers.ts (loanHandlers convention).

const PENDING_REPAIR = {
  id: "repair-pending",
  workspace_id: "ws-1",
  inventory_id: "inv-1",
  status: "PENDING" as const,
  description: "Replace worn brake pads",
  cost: 4250, // cents
  currency_code: "EUR",
  is_warranty_claim: false,
  created_at: "2026-06-01T00:00:00Z",
  updated_at: "2026-06-01T00:00:00Z",
};

const IN_PROGRESS_REPAIR = {
  ...PENDING_REPAIR,
  id: "repair-in-progress",
  status: "IN_PROGRESS" as const,
  description: "Rebuild carburetor",
  cost: 12000,
  service_provider: "Acme Repairs",
};

const COMPLETED_REPAIR = {
  ...PENDING_REPAIR,
  id: "repair-completed",
  status: "COMPLETED" as const,
  description: "Swap timing belt",
  cost: 8900,
  completed_at: "2026-06-05T00:00:00Z",
  new_condition: "GOOD" as const,
};

const ALL_REPAIRS = [PENDING_REPAIR, IN_PROGRESS_REPAIR, COMPLETED_REPAIR];

// Single-currency cost rollup (the common case — one currency, never summed
// across currencies).
const COST_SINGLE = [
  { currency_code: "EUR", total_cost_cents: 25150, repair_count: 3 },
];

// 2-currency rollup fixture helper — exercises the grouped-by-currency render
// path (NEVER cross-currency summed). Import + server.use per-test when needed.
export const COST_MULTI_CURRENCY = [
  { currency_code: "EUR", total_cost_cents: 16250, repair_count: 2 },
  { currency_code: "USD", total_cost_cents: 8900, repair_count: 1 },
];

const REPAIR_PHOTO = {
  id: "rphoto-1",
  repair_log_id: "repair-completed",
  photo_type: "AFTER" as const,
  caption: "After repair",
  url: "http://localhost:8080/workspaces/ws-1/repairs/repair-completed/photos/rphoto-1",
  thumbnail_url:
    "http://localhost:8080/workspaces/ws-1/repairs/repair-completed/photos/rphoto-1/thumb",
  created_at: "2026-06-05T00:00:00Z",
};

const REPAIR_ATTACHMENT = {
  id: "ratt-1",
  repair_log_id: "repair-completed",
  file_id: "file-1",
  attachment_type: "RECEIPT" as const,
  title: "Parts receipt",
  file_name: "receipt.pdf",
  file_mime_type: "application/pdf",
  file_size_bytes: 20480,
};

export const repairHandlers = [
  // --- Per-inventory rollups (specific routes; no :id collision risk) ---
  http.get("/api/workspaces/:wsId/inventory/:invId/repair-cost", () =>
    HttpResponse.json({ items: COST_SINGLE }),
  ),
  http.get("/api/workspaces/:wsId/inventory/:invId/repairs", () =>
    HttpResponse.json({ items: ALL_REPAIRS, total: ALL_REPAIRS.length }),
  ),

  // --- Repair sub-routes (photos + attachments) BEFORE the /repairs/:id
  // catch-all so the :id segment never swallows them. ---
  http.get("/api/workspaces/:wsId/repairs/:id/photos/list", () =>
    HttpResponse.json([REPAIR_PHOTO]),
  ),
  http.get("/api/workspaces/:wsId/repairs/:id/attachments", () =>
    HttpResponse.json({ items: [REPAIR_ATTACHMENT], total: 1 }),
  ),

  // --- Lifecycle mutations (specific :id sub-routes BEFORE the catch-all) ---
  http.post("/api/workspaces/:wsId/repairs/:id/start", ({ params }) =>
    HttpResponse.json({
      ...IN_PROGRESS_REPAIR,
      id: String(params.id),
    }),
  ),
  http.post("/api/workspaces/:wsId/repairs/:id/complete", ({ params }) =>
    HttpResponse.json({
      ...COMPLETED_REPAIR,
      id: String(params.id),
    }),
  ),

  // --- Repair by id (catch-all) + update + delete ---
  http.get("/api/workspaces/:wsId/repairs/:id", ({ params }) =>
    HttpResponse.json({ ...PENDING_REPAIR, id: String(params.id) }),
  ),
  http.patch("/api/workspaces/:wsId/repairs/:id", ({ params }) =>
    HttpResponse.json({ ...PENDING_REPAIR, id: String(params.id) }),
  ),
  http.delete(
    "/api/workspaces/:wsId/repairs/:id",
    () => new HttpResponse(null, { status: 204 }),
  ),

  // --- Create ---
  http.post("/api/workspaces/:wsId/repairs", () =>
    HttpResponse.json(PENDING_REPAIR),
  ),
];
