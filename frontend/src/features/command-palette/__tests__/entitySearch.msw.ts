import { http, HttpResponse } from "msw";

// MSW handlers for the 4 command-palette entity-search endpoints (§4 parity).
// Mirrors src/test/msw/borrowerHandlers.ts: routes match at the `/api/...`
// prefix (api.ts prepends BASE_URL = "/api"); added PER-TEST via `server.use(...)`
// (NOT to the global setupServer set) so each spec opts in.
//
// Shapes match the api layer exactly:
//  - items:      itemsApi.list → PAGINATED { items, total, page, total_pages }
//  - borrowers:  borrowersApi.search → BARE { items } (.then(r => r.items))
//  - locations:  locationApi.search → BARE { items } (.then(r => r.items))
//  - containers: containerApi.search → BARE { items } (.then(r => r.items))
//
// Each list returns ONE deterministic row whose name contains the queried text,
// so a CommandPalette test can type "wrench"/"alex"/… and assert the row renders.

function itemRow(id: string, name: string) {
  return {
    id,
    workspace_id: "ws-1",
    sku: `SKU-${id}`,
    name,
    min_stock_level: 0,
    short_code: `code-${id}`,
    is_archived: false,
    created_at: "2026-06-13T00:00:00Z",
    updated_at: "2026-06-13T00:00:00Z",
  };
}

function borrowerRow(id: string, name: string) {
  return {
    id,
    workspace_id: "ws-1",
    name,
    is_archived: false,
    created_at: "2026-06-13T00:00:00Z",
    updated_at: "2026-06-13T00:00:00Z",
  };
}

function locationRow(id: string, name: string) {
  return {
    id,
    workspace_id: "ws-1",
    name,
    is_archived: false,
    created_at: "2026-06-13T00:00:00Z",
    updated_at: "2026-06-13T00:00:00Z",
  };
}

function containerRow(id: string, name: string) {
  return {
    id,
    workspace_id: "ws-1",
    name,
    location_id: "loc-1",
    is_archived: false,
    created_at: "2026-06-13T00:00:00Z",
    updated_at: "2026-06-13T00:00:00Z",
  };
}

/** Deterministic search fixtures keyed off the query string for the palette tests. */
export const ENTITY_FIXTURES = {
  item: itemRow("item-1", "Wrench Set"),
  borrower: borrowerRow("bor-1", "Alex Carter"),
  location: locationRow("loc-1", "Garage Shelf"),
  container: containerRow("con-1", "Toolbox A"),
};

export const entitySearchHandlers = [
  // Items list (PAGINATED envelope) — itemsApi.list with ?search=&limit=.
  http.get("/api/workspaces/:wsId/items", () =>
    HttpResponse.json({
      items: [ENTITY_FIXTURES.item],
      total: 1,
      page: 1,
      total_pages: 1,
    }),
  ),

  // Borrowers search (BARE { items }) — registered before any /:id param route.
  http.get("/api/workspaces/:wsId/borrowers/search", () =>
    HttpResponse.json({ items: [ENTITY_FIXTURES.borrower] }),
  ),

  // Locations search (BARE { items }).
  http.get("/api/workspaces/:wsId/locations/search", () =>
    HttpResponse.json({ items: [ENTITY_FIXTURES.location] }),
  ),

  // Containers search (BARE { items }).
  http.get("/api/workspaces/:wsId/containers/search", () =>
    HttpResponse.json({ items: [ENTITY_FIXTURES.container] }),
  ),
];
