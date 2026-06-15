import { http, HttpResponse } from "msw";

// Phase 9 Plan 01 — MSW borrower handlers for the Wave 2/3 component tests.
// Mirrors loanHandlers.ts: endpoints match at the `/api/...` prefix (api.ts
// prepends BASE_URL = "/api"). Lists return a BARE { items } envelope (no
// total/page wrapper — matches borrowersApi typing + huma's bare-list shape;
// `$schema` deliberately unmodelled). Single-entity routes return a decorated
// Borrower; DELETE returns 204.
//
// Route ORDER matters in MSW: the specific `/borrowers/search` route is
// registered BEFORE the `/borrowers/:id` param route, which is registered
// BEFORE the bare `/borrowers` list route (specific-before-catch-all).
//
// CONVENTION (mirrors loanHandlers): these handlers are added PER-TEST via
// `server.use(...)`, NOT to the global setupServer set. A component test imports
// `borrowerHandlers` and spreads it into `server.use(...)` in its setup.
//
// Per-test 400-delete override (the BORR-05 guard test in 09-03 uses this to
// exercise the active-loans block — binding override #3):
//
//   server.use(
//     http.delete("/api/workspaces/:wsId/borrowers/:id", () =>
//       HttpResponse.json(
//         { detail: "cannot delete borrower with active loans" },
//         { status: 400 },
//       ),
//     ),
//   );

const B1 = {
  id: "bor-1",
  workspace_id: "ws-1",
  name: "Alex Carter",
  email: "alex@example.io",
  phone: "+1 555 0100",
  notes: "lives next door",
  is_archived: false,
  created_at: "2026-06-01T00:00:00Z",
  updated_at: "2026-06-01T00:00:00Z",
};

const B2 = {
  ...B1,
  id: "bor-2",
  name: "Sam Diaz",
  email: "sam@example.io",
  phone: undefined,
  notes: undefined,
};

const B3 = {
  ...B1,
  id: "bor-3",
  name: "Jordan Lee",
  email: undefined,
  phone: undefined,
  notes: undefined,
};

const ALL_BORROWERS = [B1, B2, B3];

export const borrowerHandlers = [
  // Search route (BARE { items }) — registered BEFORE the /:id param route.
  http.get("/api/workspaces/:wsId/borrowers/search", () =>
    HttpResponse.json({ items: ALL_BORROWERS }),
  ),

  // Mutations on /:id (PATCH/DELETE) + GET by id — BEFORE the bare list route.
  http.get("/api/workspaces/:wsId/borrowers/:id", ({ params }) =>
    HttpResponse.json({ ...B1, id: String(params.id) }),
  ),
  http.patch(
    "/api/workspaces/:wsId/borrowers/:id",
    async ({ params, request }) => {
      const body = (await request.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      return HttpResponse.json({ ...B1, id: String(params.id), ...body });
    },
  ),
  http.delete(
    "/api/workspaces/:wsId/borrowers/:id",
    () => new HttpResponse(null, { status: 204 }),
  ),

  // Bare list (BARE { items }) + create (returns the decorated B1).
  http.get("/api/workspaces/:wsId/borrowers", () =>
    HttpResponse.json({ items: ALL_BORROWERS }),
  ),
  http.post("/api/workspaces/:wsId/borrowers", async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    return HttpResponse.json({ ...B1, ...body });
  }),
];
