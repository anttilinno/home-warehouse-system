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
import type { Inventory } from "@/lib/types";
import { InventoryPanel } from "./InventoryPanel";

const WS = "ws-A";
const ITEM = "it-1";

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

function makeEntry(overrides: Partial<Inventory> = {}): Inventory {
  return {
    id: "inv-1",
    workspace_id: WS,
    item_id: ITEM,
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

interface Fixtures {
  entries?: Inventory[];
  locations?: { id: string; name: string }[];
  containers?: { id: string; name: string }[];
}

function installHandlers(f: Fixtures) {
  server.use(
    http.get("/api/workspaces/:wsId/inventory/by-item/:itemId", () =>
      HttpResponse.json({ items: f.entries ?? [] }),
    ),
    http.get("/api/workspaces/:wsId/locations", () =>
      HttpResponse.json({ items: f.locations ?? [] }),
    ),
    http.get("/api/workspaces/:wsId/containers", () =>
      HttpResponse.json({ items: f.containers ?? [] }),
    ),
    http.get("/api/workspaces/:wsId/items", () =>
      HttpResponse.json({ items: [] }),
    ),
  );
}

function renderPanel() {
  setWsId(WS);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <ModalStackProvider>
          <RetroToaster />
          <MemoryRouter initialEntries={["/items/it-1"]}>
            <Routes>
              <Route
                path="/items/:id"
                element={<InventoryPanel wsId={WS} itemId={ITEM} />}
              />
              <Route path="/inventory/new" element={<div>NEW ENTRY PAGE</div>} />
              <Route
                path="/inventory/:id/edit"
                element={<div>EDIT ENTRY PAGE</div>}
              />
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

describe("InventoryPanel", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("shows the IN STOCK total summed across entries and one row per entry", async () => {
    installHandlers({
      entries: [
        makeEntry({ id: "inv-1", quantity: 3, condition: "GOOD", status: "AVAILABLE", location_id: "loc-1" }),
        makeEntry({ id: "inv-2", quantity: 5, condition: "NEW", status: "IN_USE", location_id: "loc-2" }),
      ],
      locations: [
        { id: "loc-1", name: "Garage" },
        { id: "loc-2", name: "Attic" },
      ],
    });
    renderPanel();

    // Total = 3 + 5 = 8.
    expect(await screen.findByText("8")).toBeInTheDocument();
    // Quantity lines.
    expect(screen.getByText("×3")).toBeInTheDocument();
    expect(screen.getByText("×5")).toBeInTheDocument();
    // Status + condition pills (Title Case).
    expect(screen.getByText("Available")).toBeInTheDocument();
    expect(screen.getByText("In use")).toBeInTheDocument();
    expect(screen.getByText("Good")).toBeInTheDocument();
    expect(screen.getByText("New")).toBeInTheDocument();
    // Location path resolved from the locations cache.
    expect(screen.getByText("Garage")).toBeInTheDocument();
    expect(screen.getByText("Attic")).toBeInTheDocument();
  });

  it("renders the location/container path joined when a container is set", async () => {
    installHandlers({
      entries: [
        makeEntry({ location_id: "loc-1", container_id: "ct-1" }),
      ],
      locations: [{ id: "loc-1", name: "Garage" }],
      containers: [{ id: "ct-1", name: "Bin 7" }],
    });
    renderPanel();
    expect(await screen.findByText(/Garage \/ Bin 7/)).toBeInTheDocument();
  });

  it("MOVE opens the move dialog for the entry", async () => {
    const user = userEvent.setup();
    installHandlers({
      entries: [makeEntry()],
      locations: [{ id: "loc-1", name: "Garage" }],
    });
    renderPanel();
    await screen.findByText("×3");
    await user.click(screen.getByRole("button", { name: /^move$/i }));
    expect(
      await screen.findByRole("dialog", { name: /move entry/i }),
    ).toBeInTheDocument();
  });

  it("EDIT navigates to the entry edit route", async () => {
    const user = userEvent.setup();
    installHandlers({ entries: [makeEntry({ id: "inv-9" })] });
    renderPanel();
    await screen.findByText("×3");
    await user.click(screen.getByRole("link", { name: /^edit$/i }));
    expect(await screen.findByText("EDIT ENTRY PAGE")).toBeInTheDocument();
  });

  it("titlebar ⊕ ADD links to /inventory/new prefilled with the item", async () => {
    installHandlers({ entries: [makeEntry()] });
    renderPanel();
    await screen.findByText("×3");
    const add = screen.getByRole("link", { name: /add/i });
    expect(add).toHaveAttribute("href", "/inventory/new?item=it-1");
  });

  it("renders the recessed empty state with an ADD ENTRY CTA when no entries", async () => {
    installHandlers({ entries: [] });
    renderPanel();
    expect(
      await screen.findByText(/no stock entries yet/i),
    ).toBeInTheDocument();
    const region = screen.getByRole("region", { name: /inventory/i });
    const cta = within(region).getByRole("link", { name: /add entry/i });
    expect(cta).toHaveAttribute("href", "/inventory/new?item=it-1");
  });

  it("shows a muted dash for an unresolved location", async () => {
    installHandlers({
      entries: [makeEntry({ location_id: "loc-unknown" })],
      locations: [],
    });
    renderPanel();
    await screen.findByText("×3");
    await waitFor(() =>
      expect(screen.getByTestId("entry-path-inv-1")).toHaveTextContent("—"),
    );
  });
});
