import { http, HttpResponse } from "msw";

// Phase 10b Plan 01 — MSW maintenance handlers for the Wave 2/3 component tests.
// Mirrors loanHandlers.ts: match at the `/api/...` prefix; lists return BARE
// { items } / { items, total }. The /due fixture carries one is_overdue:true and
// one is_overdue:false row (each with item_name) so overdue tinting is
// exercisable. Specific routes BEFORE the /maintenance/:id catch-all.
//
// Per-case overrides via `server.use(...)` — NOT registered in global handlers.ts.

const SCHEDULE_A = {
  id: "sched-a",
  title: "Oil change",
  notes: "Synthetic 5W-30",
  interval_days: 180,
  next_due: "2026-07-01",
  last_completed_at: "2026-01-02T00:00:00Z",
};

const SCHEDULE_B = {
  id: "sched-b",
  title: "Filter replacement",
  interval_days: 90,
  next_due: "2026-06-10",
};

const ALL_SCHEDULES = [SCHEDULE_A, SCHEDULE_B];

const DUE_OVERDUE = {
  ...SCHEDULE_B,
  item_id: "item-2",
  item_name: "Air Compressor",
  is_overdue: true,
};

const DUE_UPCOMING = {
  ...SCHEDULE_A,
  item_id: "item-1",
  item_name: "Lawn Mower",
  is_overdue: false,
};

export const maintenanceHandlers = [
  // --- Per-inventory list + due projection (specific routes BEFORE catch-all) ---
  http.get("/api/workspaces/:wsId/inventory/:invId/maintenance", () =>
    HttpResponse.json({ items: ALL_SCHEDULES }),
  ),
  http.get("/api/workspaces/:wsId/maintenance/due", () =>
    HttpResponse.json({ items: [DUE_OVERDUE, DUE_UPCOMING] }),
  ),

  // --- Schedule mutations (specific :id sub-route BEFORE the catch-all) ---
  http.post("/api/workspaces/:wsId/maintenance/:id/complete", ({ params }) =>
    HttpResponse.json({
      ...SCHEDULE_A,
      id: String(params.id),
      last_completed_at: "2026-06-13T00:00:00Z",
    }),
  ),

  // --- Schedule by id (catch-all) + update + delete ---
  http.get("/api/workspaces/:wsId/maintenance/:id", ({ params }) =>
    HttpResponse.json({ ...SCHEDULE_A, id: String(params.id) }),
  ),
  http.patch("/api/workspaces/:wsId/maintenance/:id", ({ params }) =>
    HttpResponse.json({ ...SCHEDULE_A, id: String(params.id) }),
  ),
  http.delete(
    "/api/workspaces/:wsId/maintenance/:id",
    () => new HttpResponse(null, { status: 204 }),
  ),

  // --- Top-level list (paginated → { items, total }) + create ---
  http.get("/api/workspaces/:wsId/maintenance", () =>
    HttpResponse.json({ items: ALL_SCHEDULES, total: ALL_SCHEDULES.length }),
  ),
  http.post("/api/workspaces/:wsId/maintenance", () =>
    HttpResponse.json(SCHEDULE_A),
  ),
];
