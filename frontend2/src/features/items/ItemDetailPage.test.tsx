import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { I18nProvider } from "@lingui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Routes, Route } from "react-router";
import { i18n } from "@/lib/i18n";
import { server } from "@/test/msw/server";
import { ModalStackProvider } from "@/components/modal";
import { RetroToaster } from "@/components/retro";
import type { Inventory, Item, Loan, Movement, Photo } from "@/lib/types";
import { ItemDetailPage } from "./ItemDetailPage";

const WS = "ws-A";
const ID = "it-1";

const useWorkspaceMock = vi.fn();
vi.mock("@/features/workspace/useWorkspace", () => ({
  useWorkspace: () => useWorkspaceMock(),
}));

function setWsId(currentWorkspaceId: string | null) {
  useWorkspaceMock.mockReturnValue({
    currentWorkspaceId,
    setWorkspace: vi.fn(),
    workspaces: [],
    isLoading: false,
  });
}

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: ID,
    workspace_id: WS,
    sku: "SKU-1",
    name: "Cordless Drill",
    description: "A handy drill",
    barcode: "BC-12345",
    min_stock_level: 4,
    short_code: "code-1",
    is_archived: false,
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-10T00:00:00Z",
    ...overrides,
  };
}

function photo(id: string, overrides: Partial<Photo> = {}): Photo {
  return {
    id,
    item_id: ID,
    workspace_id: WS,
    filename: `${id}.jpg`,
    file_size: 1000,
    mime_type: "image/jpeg",
    width: 800,
    height: 600,
    display_order: 0,
    is_primary: false,
    caption: id,
    url: `https://backend/x/${id}`,
    thumbnail_url: `https://backend/x/${id}/thumb`,
    thumbnail_status: "ready",
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
    ...overrides,
  };
}

function makeLoan(overrides: Partial<Loan> = {}): Loan {
  return {
    id: "l-1",
    workspace_id: WS,
    inventory_id: "inv-1",
    borrower_id: "b-1",
    quantity: 1,
    loaned_at: "2026-05-01T00:00:00Z",
    is_active: false,
    is_overdue: false,
    created_at: "2026-05-01T00:00:00Z",
    updated_at: "2026-05-01T00:00:00Z",
    item: { id: ID, name: "Cordless Drill" },
    borrower: { id: "b-1", name: "Alice" },
    ...overrides,
  };
}

function makeInventory(overrides: Partial<Inventory> = {}): Inventory {
  return {
    id: "inv-1",
    workspace_id: WS,
    item_id: ID,
    location_id: "loc-1",
    quantity: 3,
    condition: "GOOD",
    status: "AVAILABLE",
    is_archived: false,
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
    ...overrides,
  };
}

function makeMovement(overrides: Partial<Movement> = {}): Movement {
  return {
    id: "mv-1",
    workspace_id: WS,
    inventory_id: "inv-1",
    to_location_id: "loc-2",
    quantity: 1,
    created_at: "2026-06-05T00:00:00Z",
    ...overrides,
  };
}

interface Fixtures {
  item?: Item | null;
  itemStatus?: number;
  photos?: Photo[];
  loans?: Loan[];
  inventory?: Inventory[];
  movementsByInv?: Record<string, Movement[]>;
  onArchive?: () => void;
}

function installHandlers(f: Fixtures) {
  const handlers = [
    http.get("/api/workspaces/:wsId/items/:id", () => {
      if (f.itemStatus && f.itemStatus !== 200) {
        return new HttpResponse(null, { status: f.itemStatus });
      }
      return HttpResponse.json(f.item ?? makeItem());
    }),
    http.get("/api/workspaces/:wsId/items/:id/photos/list", () =>
      HttpResponse.json(f.photos ?? []),
    ),
    http.get("/api/workspaces/:wsId/items/:id/loans", () =>
      HttpResponse.json({ items: f.loans ?? [] }),
    ),
    http.get("/api/workspaces/:wsId/items/:id/labels", () =>
      HttpResponse.json({ label_ids: [] }),
    ),
    http.get("/api/workspaces/:wsId/labels", () =>
      HttpResponse.json({ items: [] }),
    ),
    http.get("/api/workspaces/:wsId/inventory/by-item/:itemId", () =>
      HttpResponse.json({ items: f.inventory ?? [] }),
    ),
    http.get(
      "/api/workspaces/:wsId/inventory/:invId/movements",
      ({ params }) =>
        HttpResponse.json({
          items: f.movementsByInv?.[params.invId as string] ?? [],
        }),
    ),
    http.get("/api/workspaces/:wsId/locations", () =>
      HttpResponse.json({ items: [{ id: "loc-1", name: "Garage" }] }),
    ),
    http.get("/api/workspaces/:wsId/containers", () =>
      HttpResponse.json({ items: [] }),
    ),
    http.get("/api/workspaces/:wsId/items", () =>
      HttpResponse.json({ items: [] }),
    ),
    http.post("/api/workspaces/:wsId/items/:id/archive", () => {
      f.onArchive?.();
      return new HttpResponse(null, { status: 204 });
    }),
    http.delete("/api/workspaces/:wsId/items/:id", () =>
      new HttpResponse(null, { status: 204 }),
    ),
  ];
  server.use(...handlers);
}

function renderDetail(initialPath = `/items/${ID}`) {
  setWsId(WS);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <ModalStackProvider>
          <RetroToaster />
          <MemoryRouter initialEntries={[initialPath]}>
            <Routes>
              <Route path="/items/:id" element={<ItemDetailPage />} />
              <Route path="/items" element={<div>ITEMS LIST</div>} />
              <Route path="/items/:id/edit" element={<div>EDIT PAGE</div>} />
            </Routes>
          </MemoryRouter>
        </ModalStackProvider>
      </QueryClientProvider>
    </I18nProvider>,
  );
}

afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});

describe("ItemDetailPage", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("renders the item fields, the three tabs, and the live side-rail inventory panel", async () => {
    installHandlers({
      item: makeItem(),
      inventory: [makeInventory({ quantity: 3 }), makeInventory({ id: "inv-2", quantity: 5 })],
    });
    renderDetail();
    // Titlebar + fields.
    expect(await screen.findAllByText(/cordless drill/i)).not.toHaveLength(0);
    expect(screen.getByText("BC-12345")).toBeInTheDocument();
    // Tabs.
    expect(screen.getByRole("tab", { name: /details/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /photos/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /history/i })).toBeInTheDocument();
    // Side-rail inventory panel is a real named region with the live IN STOCK total.
    const rail = await screen.findByRole("region", { name: /inventory/i });
    expect(within(rail).getByText("8")).toBeInTheDocument();
  });

  it("HISTORY tab shows per-item movements aggregated across the item's entries", async () => {
    const user = userEvent.setup();
    installHandlers({
      item: makeItem(),
      inventory: [makeInventory({ id: "inv-1" }), makeInventory({ id: "inv-2" })],
      movementsByInv: {
        "inv-1": [makeMovement({ id: "mv-a", inventory_id: "inv-1", created_at: "2026-06-01T00:00:00Z" })],
        "inv-2": [makeMovement({ id: "mv-b", inventory_id: "inv-2", created_at: "2026-06-09T00:00:00Z" })],
      },
    });
    renderDetail();
    await user.click(await screen.findByRole("tab", { name: /history/i }));
    // The movements section renders both entries' movements.
    const rows = await screen.findAllByText("×1");
    expect(rows.length).toBeGreaterThanOrEqual(2);
  });

  it("HISTORY tab shows the NO MOVEMENTS empty state when the item has none", async () => {
    const user = userEvent.setup();
    installHandlers({ item: makeItem(), inventory: [] });
    renderDetail();
    await user.click(await screen.findByRole("tab", { name: /history/i }));
    expect(await screen.findByText(/no movements/i)).toBeInTheDocument();
  });

  it("PHOTOS tab shows the gallery and opens the lightbox on thumbnail click", async () => {
    const user = userEvent.setup();
    installHandlers({ item: makeItem(), photos: [photo("p-1"), photo("p-2")] });
    renderDetail();
    await screen.findByRole("tab", { name: /photos/i });
    await user.click(screen.getByRole("tab", { name: /photos/i }));

    // Click the first gallery thumbnail → lightbox dialog.
    const openBtn = await screen.findByRole("button", { name: /open p-1/i });
    await user.click(openBtn);
    expect(
      await screen.findByRole("dialog", { name: /photo 1 of 2/i }),
    ).toBeInTheDocument();
  });

  it("renders the active-loan panel for an on-loan item", async () => {
    installHandlers({
      item: makeItem(),
      loans: [
        makeLoan({ is_active: true, borrower: { id: "b-1", name: "Alice" } }),
      ],
    });
    renderDetail();
    expect(await screen.findByText(/on loan to alice/i)).toBeInTheDocument();
  });

  it("archive action from the overflow menu calls itemsApi.archive", async () => {
    const user = userEvent.setup();
    let archived = false;
    installHandlers({ item: makeItem(), onArchive: () => (archived = true) });
    renderDetail();
    await screen.findByRole("tab", { name: /details/i });

    await user.click(screen.getByRole("button", { name: /more actions/i }));
    await user.click(await screen.findByRole("button", { name: /^archive$/i }));
    await waitFor(() => expect(archived).toBe(true));
  });

  it("delete is disabled until the item is archived", async () => {
    const user = userEvent.setup();
    installHandlers({ item: makeItem({ is_archived: false }) });
    renderDetail();
    await screen.findByRole("tab", { name: /details/i });

    await user.click(screen.getByRole("button", { name: /more actions/i }));
    const del = await screen.findByRole("button", { name: /delete/i });
    expect(del).toBeDisabled();
  });

  it("delete on an archived item is type-to-confirm gated", async () => {
    const user = userEvent.setup();
    installHandlers({ item: makeItem({ is_archived: true }) });
    renderDetail();
    await screen.findByRole("tab", { name: /details/i });

    await user.click(screen.getByRole("button", { name: /more actions/i }));
    await user.click(await screen.findByRole("button", { name: /delete…/i }));

    // The confirm dialog opens; DELETE stays disabled until the name is typed.
    const dialog = await screen.findByRole("dialog", { name: /delete item/i });
    const confirmBtn = within(dialog).getByRole("button", { name: /^delete$/i });
    expect(confirmBtn).toBeDisabled();

    await user.type(
      within(dialog).getByRole("textbox", { name: /confirm item name/i }),
      "Cordless Drill",
    );
    expect(confirmBtn).not.toBeDisabled();

    await user.click(confirmBtn);
    expect(await screen.findByText("ITEMS LIST")).toBeInTheDocument();
  });

  it("shows ITEM NOT FOUND when the item 404s", async () => {
    installHandlers({ itemStatus: 404 });
    renderDetail();
    expect(await screen.findByText(/item not found/i)).toBeInTheDocument();
  });

  it("EDIT navigates to the edit route", async () => {
    const user = userEvent.setup();
    installHandlers({ item: makeItem() });
    renderDetail();
    await screen.findByRole("tab", { name: /details/i });
    await user.click(screen.getByRole("button", { name: /^edit$/i }));
    expect(await screen.findByText("EDIT PAGE")).toBeInTheDocument();
  });
});
