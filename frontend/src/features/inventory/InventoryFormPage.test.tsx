import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@lingui/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router";
import { i18n } from "@/lib/i18n";
import { server } from "@/test/msw/server";
import { registerMutationDefaults } from "@/lib/offline/mutationDefaults";
import { ModalStackProvider } from "@/components/modal";
import { RetroToaster } from "@/components/retro";
import { InventoryFormPage } from "./InventoryFormPage";

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

let lastPath = "";
function Probe() {
  lastPath = useLocation().pathname;
  return null;
}

// Picker source fixtures (items/locations/containers paginated envelopes).
const ITEMS = {
  items: [
    { id: "it-1", name: "Cordless Drill", sku: "SKU-1" },
    { id: "it-2", name: "Ladder", sku: "SKU-2" },
  ],
  total: 2,
  page: 1,
  total_pages: 1,
};
const LOCATIONS = {
  items: [
    { id: "loc-1", name: "Garage" },
    { id: "loc-2", name: "Attic" },
  ],
  total: 2,
  page: 1,
  total_pages: 1,
};
const CONTAINERS = {
  items: [{ id: "cont-1", name: "Bin A" }],
  total: 1,
  page: 1,
  total_pages: 1,
};

const ENTRY = {
  id: "inv-9",
  workspace_id: "ws-A",
  item_id: "it-1",
  location_id: "loc-1",
  container_id: "cont-1",
  quantity: 4,
  condition: "FAIR",
  status: "ON_LOAN",
  date_acquired: "2026-01-15T00:00:00Z",
  is_archived: false,
  created_at: "2026-06-13T00:00:00Z",
  updated_at: "2026-06-13T00:00:00Z",
};

function pickerHandlers(opts?: {
  locations?: typeof LOCATIONS;
  items?: typeof ITEMS;
}) {
  return [
    http.get("/api/workspaces/:wsId/items", () =>
      HttpResponse.json(opts?.items ?? ITEMS),
    ),
    http.get("/api/workspaces/:wsId/locations", () =>
      HttpResponse.json(opts?.locations ?? LOCATIONS),
    ),
    http.get("/api/workspaces/:wsId/containers", () =>
      HttpResponse.json(CONTAINERS),
    ),
  ];
}

function renderForm(initialEntries: string[]) {
  setWsId("ws-A");
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  // create's mutationFn now lives in the registered default (C-create offline
  // replay), so the page test's client must register it.
  registerMutationDefaults(client);
  return render(
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <ModalStackProvider>
          <RetroToaster />
          <MemoryRouter initialEntries={initialEntries}>
            <Probe />
            <Routes>
              <Route path="/inventory/new" element={<InventoryFormPage />} />
              <Route
                path="/inventory/:id/edit"
                element={<InventoryFormPage />}
              />
              <Route path="/items/:id" element={<div>ITEM DETAIL</div>} />
              <Route path="/inventory" element={<div>LIST PAGE</div>} />
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

beforeAll(() => {
  i18n.load("en", {});
  i18n.activate("en");
});

describe("InventoryFormPage — create", () => {
  it("renders ADD ENTRY and populates the pickers", async () => {
    server.use(...pickerHandlers());
    renderForm(["/inventory/new"]);
    expect(
      screen.getByRole("heading", { name: /add entry/i }),
    ).toBeInTheDocument();

    const itemSelect = screen.getByLabelText(/^item/i);
    await waitFor(() =>
      expect(
        within(itemSelect).getByText(/cordless drill/i),
      ).toBeInTheDocument(),
    );
    expect(
      within(screen.getByLabelText(/^location/i)).getByText(/garage/i),
    ).toBeInTheDocument();
    // Status select is present on create.
    expect(screen.getByLabelText(/^status/i)).toBeInTheDocument();
  });

  it("submits a valid create (status + RFC3339 date) and navigates to the item", async () => {
    const user = userEvent.setup();
    let sentBody: Record<string, unknown> | undefined;
    server.use(
      ...pickerHandlers(),
      http.post("/api/workspaces/:wsId/inventory", async ({ request }) => {
        sentBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ...ENTRY, id: "inv-new", item_id: "it-1" });
      }),
    );
    renderForm(["/inventory/new"]);
    await waitFor(() =>
      expect(
        within(screen.getByLabelText(/^item/i)).getByText(/cordless drill/i),
      ).toBeInTheDocument(),
    );

    await user.selectOptions(screen.getByLabelText(/^item/i), "it-1");
    await user.selectOptions(screen.getByLabelText(/^location/i), "loc-1");
    await user.clear(screen.getByLabelText(/quantity/i));
    await user.type(screen.getByLabelText(/quantity/i), "3");
    await user.selectOptions(screen.getByLabelText(/condition/i), "GOOD");
    await user.selectOptions(screen.getByLabelText(/^status/i), "AVAILABLE");
    await user.type(screen.getByLabelText(/acquired/i), "2026-01-15");

    await user.click(screen.getByRole("button", { name: /save entry/i }));

    await waitFor(() => expect(sentBody).toBeDefined());
    expect(sentBody).toMatchObject({
      item_id: "it-1",
      location_id: "loc-1",
      quantity: 3,
      condition: "GOOD",
      status: "AVAILABLE",
      date_acquired: "2026-01-15T00:00:00Z",
    });
    await waitFor(() => expect(lastPath).toBe("/items/it-1"));
  });

  it("?item= prefills the Item select", async () => {
    server.use(...pickerHandlers());
    renderForm(["/inventory/new?item=it-2"]);
    await waitFor(() =>
      expect((screen.getByLabelText(/^item/i) as HTMLSelectElement).value).toBe(
        "it-2",
      ),
    );
  });

  it("disables an empty picker with the add-one-first hint", async () => {
    server.use(
      ...pickerHandlers({
        locations: { items: [], total: 0, page: 1, total_pages: 1 },
      }),
    );
    renderForm(["/inventory/new"]);
    await waitFor(() =>
      expect(screen.getByLabelText(/^location/i)).toBeDisabled(),
    );
    expect(
      screen.getByText(/no locations yet — add one first/i),
    ).toBeInTheDocument();
  });

  it("blocks submit and shows a required-field error when item is empty", async () => {
    const user = userEvent.setup();
    let posted = false;
    server.use(
      ...pickerHandlers(),
      http.post("/api/workspaces/:wsId/inventory", () => {
        posted = true;
        return HttpResponse.json(ENTRY);
      }),
    );
    renderForm(["/inventory/new"]);
    await waitFor(() =>
      expect(
        within(screen.getByLabelText(/^item/i)).getByText(/cordless drill/i),
      ).toBeInTheDocument(),
    );
    // Leave item unselected; submit.
    await user.click(screen.getByRole("button", { name: /save entry/i }));
    expect(await screen.findByText(/item is required/i)).toBeInTheDocument();
    expect(posted).toBe(false);
  });
});

describe("InventoryFormPage — edit", () => {
  it("loads the entry, omits Status, and PATCHes without status", async () => {
    const user = userEvent.setup();
    let sentBody: Record<string, unknown> | undefined;
    server.use(
      ...pickerHandlers(),
      http.get("/api/workspaces/:wsId/inventory/:id", () =>
        HttpResponse.json(ENTRY),
      ),
      http.patch("/api/workspaces/:wsId/inventory/:id", async ({ request }) => {
        sentBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(ENTRY);
      }),
    );
    renderForm(["/inventory/inv-9/edit"]);
    expect(
      screen.getByRole("heading", { name: /edit entry/i }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(
        (screen.getByLabelText(/^location/i) as HTMLSelectElement).value,
      ).toBe("loc-1"),
    );
    // Status field is NOT rendered in edit mode.
    expect(screen.queryByLabelText(/^status/i)).not.toBeInTheDocument();

    await user.clear(screen.getByLabelText(/quantity/i));
    await user.type(screen.getByLabelText(/quantity/i), "10");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(sentBody).toBeDefined());
    expect("status" in (sentBody as object)).toBe(false);
    expect(sentBody).toMatchObject({ quantity: 10, location_id: "loc-1" });
    await waitFor(() => expect(lastPath).toBe("/items/it-1"));
  });
});
