import { http, HttpResponse } from "msw";

// Phase 8 Plan 01 — MSW loan handlers for the Wave 2/3 component tests. Mirrors
// the base-URL convention in src/test/msw/handlers.ts: endpoints match at the
// `/api/...` prefix because api.ts prepends BASE_URL = "/api". Lists return BARE
// { items } envelopes (no pagination wrapper — matches loansApi list typing and
// huma's bare-list shape; `$schema` omitted). Single-entity mutations return a
// decorated Loan. The fixture set deliberately includes one ACTIVE, one OVERDUE
// (is_overdue:true), and one RETURNED loan so downstream status-pill / row-tint
// rendering is exercisable. Per-case overrides via `server.use(...)`.

const ACTIVE_LOAN = {
  id: "loan-active",
  workspace_id: "ws-1",
  inventory_id: "inv-1",
  borrower_id: "bor-1",
  quantity: 1,
  loaned_at: "2026-06-01T00:00:00Z",
  due_date: "2026-07-01T00:00:00Z",
  is_active: true,
  is_overdue: false,
  created_at: "2026-06-01T00:00:00Z",
  updated_at: "2026-06-01T00:00:00Z",
  item: { id: "it-1", name: "Cordless Drill" },
  borrower: { id: "bor-1", name: "Alex" },
};

const OVERDUE_LOAN = {
  ...ACTIVE_LOAN,
  id: "loan-overdue",
  inventory_id: "inv-2",
  due_date: "2026-06-05T00:00:00Z",
  is_overdue: true,
  borrower: { id: "bor-2", name: "Sam" },
};

const RETURNED_LOAN = {
  ...ACTIVE_LOAN,
  id: "loan-returned",
  inventory_id: "inv-3",
  returned_at: "2026-06-05T00:00:00Z",
  is_active: false,
  is_overdue: false,
  borrower: { id: "bor-3", name: "Jordan" },
};

const ALL_LOANS = [ACTIVE_LOAN, OVERDUE_LOAN, RETURNED_LOAN];

export const loanHandlers = [
  // Dedicated list endpoints (specific routes BEFORE the /loans/:id catch-all).
  http.get("/api/workspaces/:wsId/loans/active", () =>
    HttpResponse.json({ items: [ACTIVE_LOAN] }),
  ),
  http.get("/api/workspaces/:wsId/loans/overdue", () =>
    HttpResponse.json({ items: [OVERDUE_LOAN] }),
  ),

  // Per-borrower loans (BARE { items }).
  http.get("/api/workspaces/:wsId/borrowers/:borrowerId/loans", () =>
    HttpResponse.json({ items: ALL_LOANS }),
  ),

  // Mutations (specific :id sub-routes BEFORE the /loans/:id catch-all).
  http.post("/api/workspaces/:wsId/loans/:id/return", ({ params }) =>
    HttpResponse.json({
      ...RETURNED_LOAN,
      id: String(params.id),
    }),
  ),
  http.patch("/api/workspaces/:wsId/loans/:id/extend", ({ params }) =>
    HttpResponse.json({
      ...ACTIVE_LOAN,
      id: String(params.id),
      due_date: "2026-08-01T00:00:00Z",
    }),
  ),

  // Loan by id (catch-all for the :id segment) + full PATCH (due_date + notes).
  http.get("/api/workspaces/:wsId/loans/:id", ({ params }) =>
    HttpResponse.json({ ...ACTIVE_LOAN, id: String(params.id) }),
  ),
  http.patch("/api/workspaces/:wsId/loans/:id", ({ params }) =>
    HttpResponse.json({ ...ACTIVE_LOAN, id: String(params.id) }),
  ),

  // Loan list (BARE { items }) + create (returns a decorated active Loan).
  http.get("/api/workspaces/:wsId/loans", () =>
    HttpResponse.json({ items: ALL_LOANS }),
  ),
  http.post("/api/workspaces/:wsId/loans", () =>
    HttpResponse.json(ACTIVE_LOAN),
  ),
];
