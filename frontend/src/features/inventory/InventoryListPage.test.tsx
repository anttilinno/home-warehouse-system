import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@lingui/react";
import { MemoryRouter, Routes, Route } from "react-router";
import { i18n } from "@/lib/i18n";
import { server } from "@/test/msw/server";
import { ShortcutsProvider } from "@/components/shortcuts";
import { ModalStackProvider } from "@/components/modal";
import { RetroToaster } from "@/components/retro";
import { InventoryListPage } from "./InventoryListPage";

const useWorkspaceMock = vi.fn();
vi.mock("@/features/workspace/useWorkspace", () => ({
  useWorkspace: () => useWorkspaceMock(),
}));

function setWsId(currentWorkspaceId: string | null) {
  useWorkspaceMock.mockReturnValue({
    currentWorkspaceId,
    setWorkspace: vi.fn(),
    workspaces: [
      {
        id: "ws-A",
        name: "Alpha",
        slug: "alpha",
        description: null,
        role: "owner",
        is_personal: true,
      },
    ],
    isLoading: false,
  });
}

function makeEntry(id: string, over: Record<string, unknown> = {}) {
  return {
    id,
    workspace_id: "ws-A",
    item_id: "it-1",
    location_id: "loc-1",
    quantity: 3,
    condition: "GOOD",
    status: "AVAILABLE",
    is_archived: false,
    created_at: "2026-06-13T00:00:00Z",
    updated_at: "2026-06-13T00:00:00Z",
    ...over,
  };
}

function makeItem(id: string, name: string) {
  return {
    id,
    workspace_id: "ws-A",
    sku: `SKU-${id}`,
    name,
    min_stock_level: 0,
    short_code: `code-${id}`,
    is_archived: false,
    created_at: "2026-06-13T00:00:00Z",
    updated_at: "2026-06-13T00:00:00Z",
  };
}

function listOf(
  items: ReturnType<typeof makeEntry>[],
  page = 1,
  totalPages = 1,
) {
  return { items, total: items.length, page, total_pages: totalPages };
}

function seedItems(items = [makeItem("it-1", "Cordless Drill")]) {
  server.use(
    http.get("/api/workspaces/:wsId/items", () =>
      HttpResponse.json({
        items,
        total: items.length,
        page: 1,
        total_pages: 1,
      }),
    ),
  );
}

// usePickerOptions (wired into the MOVE dialog this plan) fetches locations +
// containers — seed them so the dialog's selects populate.
function seedPickers() {
  server.use(
    http.get("/api/workspaces/:wsId/locations", () =>
      HttpResponse.json({
        items: [
          { id: "loc-1", name: "Garage" },
          { id: "loc-2", name: "Attic" },
        ],
        total: 2,
        page: 1,
        total_pages: 1,
      }),
    ),
    http.get("/api/workspaces/:wsId/containers", () =>
      HttpResponse.json({
        items: [{ id: "cont-1", name: "Bin A" }],
        total: 1,
        page: 1,
        total_pages: 1,
      }),
    ),
  );
}

function renderPage(initialEntries: string[] = ["/inventory"]) {
  setWsId("ws-A");
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <ShortcutsProvider>
          <ModalStackProvider>
            <RetroToaster />
            <MemoryRouter initialEntries={initialEntries}>
              <Routes>
                <Route path="/inventory" element={<InventoryListPage />} />
                <Route path="/items/:id" element={<div>ITEM DETAIL</div>} />
                <Route path="/inventory/new" element={<div>NEW ENTRY</div>} />
              </Routes>
            </MemoryRouter>
          </ModalStackProvider>
        </ShortcutsProvider>
      </QueryClientProvider>
    </I18nProvider>,
  );
}

afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});

describe("InventoryListPage", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("the item-name join requests limit ≤ 100 (the backend item-list cap)", async () => {
    // D-07b-A: requesting limit=200 against the backend's `maximum:"100"` cap
    // 422s, the join never resolves, and the Item column renders "—" for every
    // row. Guard the clamp so it can never regress past the cap.
    let joinLimit: number | null = null;
    server.use(
      http.get("/api/workspaces/:wsId/items", ({ request }) => {
        const url = new URL(request.url);
        const raw = url.searchParams.get("limit");
        joinLimit = raw === null ? null : Number(raw);
        return HttpResponse.json({
          items: [makeItem("it-1", "Cordless Drill")],
          total: 1,
          page: 1,
          total_pages: 1,
        });
      }),
      http.get("/api/workspaces/:wsId/inventory", () =>
        HttpResponse.json(listOf([makeEntry("inv-1")])),
      ),
    );
    renderPage();
    // The name resolving in the cell proves the join request succeeded.
    expect(await screen.findByText("Cordless Drill")).toBeInTheDocument();
    expect(joinLimit).not.toBeNull();
    expect(joinLimit as unknown as number).toBeLessThanOrEqual(100);
  });

  it("renders entries with joined item names and status/condition pills", async () => {
    seedItems();
    server.use(
      http.get("/api/workspaces/:wsId/inventory", () =>
        HttpResponse.json(
          listOf([
            makeEntry("inv-1", { status: "ON_LOAN", condition: "FAIR" }),
          ]),
        ),
      ),
    );
    renderPage();
    expect(await screen.findByText("Cordless Drill")).toBeInTheDocument();
    expect(screen.getByText("On loan")).toBeInTheDocument();
    expect(screen.getByText("Fair")).toBeInTheDocument();
  });

  it("a client status filter narrows the visible rows (no server round-trip)", async () => {
    const user = userEvent.setup();
    seedItems([makeItem("it-1", "Cordless Drill"), makeItem("it-2", "Hammer")]);
    let inventoryHits = 0;
    server.use(
      http.get("/api/workspaces/:wsId/inventory", () => {
        inventoryHits += 1;
        return HttpResponse.json(
          listOf([
            makeEntry("inv-1", { item_id: "it-1", status: "AVAILABLE" }),
            makeEntry("inv-2", { item_id: "it-2", status: "ON_LOAN" }),
          ]),
        );
      }),
    );
    renderPage();
    await screen.findByText("Cordless Drill");
    expect(screen.getByText("Hammer")).toBeInTheDocument();
    const hitsBefore = inventoryHits;

    // Open the STATUS facet and pick "On loan".
    await user.click(screen.getByRole("button", { name: /status ▾/i }));
    await user.click(await screen.findByRole("checkbox", { name: /on loan/i }));

    await waitFor(() =>
      expect(screen.queryByText("Cordless Drill")).not.toBeInTheDocument(),
    );
    expect(screen.getByText("Hammer")).toBeInTheDocument();
    // Filtering is client-side: no extra inventory fetch fired.
    expect(inventoryHits).toBe(hitsBefore);
  });

  it("inline qty edit fires the quantity mutation", async () => {
    const user = userEvent.setup();
    seedItems();
    let qtyBody: unknown = null;
    server.use(
      http.get("/api/workspaces/:wsId/inventory", () =>
        HttpResponse.json(listOf([makeEntry("inv-1", { quantity: 3 })])),
      ),
      http.patch(
        "/api/workspaces/:wsId/inventory/:id/quantity",
        async ({ request }) => {
          qtyBody = await request.json();
          return HttpResponse.json(makeEntry("inv-1", { quantity: 8 }));
        },
      ),
    );
    renderPage();
    await screen.findByText("Cordless Drill");

    const qtyCell = screen.getByRole("button", {
      name: /edit quantity for cordless drill/i,
    });
    await user.click(qtyCell);
    const input = screen.getByRole("spinbutton", {
      name: /edit quantity for cordless drill/i,
    });
    await user.clear(input);
    await user.type(input, "8{Enter}");
    await waitFor(() => expect(qtyBody).toEqual({ quantity: 8 }));
  });

  it("opens the movements drawer from a row", async () => {
    const user = userEvent.setup();
    seedItems();
    server.use(
      http.get("/api/workspaces/:wsId/inventory", () =>
        HttpResponse.json(listOf([makeEntry("inv-1")])),
      ),
      // Movements default-empty handler is already registered globally.
    );
    renderPage();
    await screen.findByText("Cordless Drill");

    const row = screen.getByText("Cordless Drill").closest("tr")!;
    await user.click(
      within(row).getByRole("button", { name: /movement history/i }),
    );
    // The blue MOVEMENTS dialog opens with the NO MOVEMENTS empty state.
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(await screen.findByText(/no movements/i)).toBeInTheDocument();
  });

  it("the MOVE row action opens the MoveDialog for that entry", async () => {
    const user = userEvent.setup();
    seedItems();
    seedPickers();
    server.use(
      http.get("/api/workspaces/:wsId/inventory", () =>
        HttpResponse.json(
          listOf([makeEntry("inv-1", { location_id: "loc-1" })]),
        ),
      ),
    );
    renderPage();
    await screen.findByText("Cordless Drill");

    const row = screen.getByText("Cordless Drill").closest("tr")!;
    await user.click(within(row).getByRole("button", { name: /^move$/i }));

    // The blue MOVE ENTRY dialog opens, seeded from the entry's placement.
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/move entry/i)).toBeInTheDocument();
    // The location picker is populated from usePickerOptions.
    await waitFor(() =>
      expect(
        within(within(dialog).getByLabelText(/to location/i)).getByText(
          /attic/i,
        ),
      ).toBeInTheDocument(),
    );
  });

  it("shows the NO STOCK ENTRIES empty state when the workspace has none", async () => {
    seedItems([]);
    server.use(
      http.get("/api/workspaces/:wsId/inventory", () =>
        HttpResponse.json(listOf([])),
      ),
    );
    renderPage();
    expect(await screen.findByText(/no stock entries/i)).toBeInTheDocument();
  });

  it("row click navigates to the owning item detail", async () => {
    const user = userEvent.setup();
    seedItems();
    server.use(
      http.get("/api/workspaces/:wsId/inventory", () =>
        HttpResponse.json(listOf([makeEntry("inv-1")])),
      ),
    );
    renderPage();
    await user.click(await screen.findByText("Cordless Drill"));
    expect(await screen.findByText("ITEM DETAIL")).toBeInTheDocument();
  });
});
