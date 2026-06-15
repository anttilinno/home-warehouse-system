import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@lingui/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router";
import { i18n } from "@/lib/i18n";
import { server } from "@/test/msw/server";
import { ModalStackProvider } from "@/components/modal";
import { RetroToaster } from "@/components/retro";
import { LoanFormPage } from "./LoanFormPage";

const useWorkspaceMock = vi.fn();
vi.mock("@/features/workspace/useWorkspace", () => ({
  useWorkspace: () => useWorkspaceMock(),
}));

function setWsId(currentWorkspaceId: string | null) {
  useWorkspaceMock.mockReturnValue({
    currentWorkspaceId,
    setWorkspace: vi.fn(),
    workspaces: [{ id: "ws-A", name: "Home" }],
    isLoading: false,
  });
}

let lastPath = "";
let lastSearch = "";
function Probe() {
  const loc = useLocation();
  lastPath = loc.pathname;
  lastSearch = loc.search;
  return null;
}

// Inventory entries: two for it-1 (so a single-match filter can be tested with a
// distinct target item it-2), one for it-2.
const INVENTORY = {
  items: [
    {
      id: "inv-1",
      workspace_id: "ws-A",
      item_id: "it-1",
      location_id: "loc-1",
      quantity: 3,
      condition: "GOOD",
      status: "AVAILABLE",
      is_archived: false,
      created_at: "2026-06-01T00:00:00Z",
      updated_at: "2026-06-01T00:00:00Z",
    },
    {
      id: "inv-2",
      workspace_id: "ws-A",
      item_id: "it-1",
      location_id: "loc-2",
      quantity: 1,
      condition: "FAIR",
      status: "AVAILABLE",
      is_archived: false,
      created_at: "2026-06-01T00:00:00Z",
      updated_at: "2026-06-01T00:00:00Z",
    },
    {
      id: "inv-3",
      workspace_id: "ws-A",
      item_id: "it-2",
      location_id: "loc-1",
      quantity: 5,
      condition: "NEW",
      status: "AVAILABLE",
      is_archived: false,
      created_at: "2026-06-01T00:00:00Z",
      updated_at: "2026-06-01T00:00:00Z",
    },
  ],
  total: 3,
  page: 1,
  total_pages: 1,
};

const ITEMS = {
  items: [
    { id: "it-1", name: "Cordless Drill", sku: "SKU-1" },
    { id: "it-2", name: "Ladder", sku: "SKU-2" },
  ],
  total: 2,
  page: 1,
  total_pages: 1,
};

const BORROWERS = {
  items: [
    { id: "bor-1", name: "Alex" },
    { id: "bor-2", name: "Sam" },
  ],
};

const CREATED_LOAN = {
  id: "loan-new",
  workspace_id: "ws-A",
  inventory_id: "inv-1",
  borrower_id: "bor-1",
  quantity: 1,
  loaned_at: "2026-06-13T00:00:00Z",
  is_active: true,
  is_overdue: false,
  created_at: "2026-06-13T00:00:00Z",
  updated_at: "2026-06-13T00:00:00Z",
  item: { id: "it-1", name: "Cordless Drill" },
  borrower: { id: "bor-1", name: "Alex" },
};

// A safely-future due date so the past-date refinement never trips in the
// happy-path tests regardless of when the suite runs.
function futureDate(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}
function pastDate(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().slice(0, 10);
}

function sourceHandlers(opts?: {
  inventory?: typeof INVENTORY;
  borrowers?: typeof BORROWERS;
}) {
  return [
    http.get("/api/workspaces/:wsId/inventory", () =>
      HttpResponse.json(opts?.inventory ?? INVENTORY),
    ),
    http.get("/api/workspaces/:wsId/items", () => HttpResponse.json(ITEMS)),
    http.get("/api/workspaces/:wsId/borrowers", () =>
      HttpResponse.json(opts?.borrowers ?? BORROWERS),
    ),
  ];
}

function renderForm(initialEntries: string[]) {
  setWsId("ws-A");
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <ModalStackProvider>
          <RetroToaster />
          <MemoryRouter initialEntries={initialEntries}>
            <Probe />
            <Routes>
              <Route path="/loans/new" element={<LoanFormPage />} />
              <Route path="/loans" element={<div>LOANS LIST</div>} />
              <Route path="/items/:id" element={<div>ITEM DETAIL</div>} />
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

describe("LoanFormPage", () => {
  it("renders NEW LOAN and populates the inventory + borrower pickers", async () => {
    server.use(...sourceHandlers());
    renderForm(["/loans/new"]);
    expect(
      screen.getByRole("heading", { name: /new loan/i }),
    ).toBeInTheDocument();

    const invSelect = screen.getByLabelText(/inventory entry/i);
    await waitFor(() =>
      expect(
        within(invSelect).getAllByText(/cordless drill/i).length,
      ).toBeGreaterThan(0),
    );
    const borSelect = screen.getByLabelText(/borrower/i);
    expect(within(borSelect).getByText(/alex/i)).toBeInTheDocument();
  });

  it("submits inventory_id (NOT item_id), borrower_id, quantity 1, due_date + notes", async () => {
    const user = userEvent.setup();
    let sentBody: Record<string, unknown> | undefined;
    server.use(
      ...sourceHandlers(),
      http.post("/api/workspaces/:wsId/loans", async ({ request }) => {
        sentBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(CREATED_LOAN);
      }),
    );
    renderForm(["/loans/new"]);
    await waitFor(() =>
      expect(
        within(screen.getByLabelText(/inventory entry/i)).getAllByText(
          /cordless drill/i,
        ).length,
      ).toBeGreaterThan(0),
    );

    await user.selectOptions(
      screen.getByLabelText(/inventory entry/i),
      "inv-1",
    );
    await user.selectOptions(screen.getByLabelText(/borrower/i), "bor-1");
    const due = futureDate();
    await user.type(screen.getByLabelText(/due date/i), due);
    await user.type(screen.getByLabelText(/notes/i), "Handle with care");

    await user.click(screen.getByRole("button", { name: /create loan/i }));

    await waitFor(() => expect(sentBody).toBeDefined());
    expect(sentBody).toMatchObject({
      inventory_id: "inv-1",
      borrower_id: "bor-1",
      quantity: 1,
      due_date: `${due}T00:00:00Z`,
      notes: "Handle with care",
    });
    // The load-bearing assertion: NO item_id on the wire (override 1).
    expect("item_id" in (sentBody as object)).toBe(false);
    await waitFor(() => expect(lastPath).toBe("/loans"));
  });

  it("?itemId=X filters the inventory picker to that item's entries + FROM ITEM badge", async () => {
    server.use(...sourceHandlers());
    // it-2 has exactly one matching entry (inv-3) → auto-select.
    renderForm(["/loans/new?itemId=it-2"]);

    await waitFor(() =>
      expect(screen.getByText(/from item/i)).toBeInTheDocument(),
    );

    const invSelect = screen.getByLabelText(
      /inventory entry/i,
    ) as HTMLSelectElement;
    // Only the it-2 entry (Ladder) is an option; it-1 entries are filtered out.
    await waitFor(() =>
      expect(within(invSelect).getByText(/ladder/i)).toBeInTheDocument(),
    );
    expect(within(invSelect).queryByText(/cordless drill/i)).toBeNull();
    // Exactly one match → auto-selected.
    await waitFor(() => expect(invSelect.value).toBe("inv-3"));
  });

  it("blocks submit with the past-date error when due date is in the past", async () => {
    const user = userEvent.setup();
    let posted = false;
    server.use(
      ...sourceHandlers(),
      http.post("/api/workspaces/:wsId/loans", () => {
        posted = true;
        return HttpResponse.json(CREATED_LOAN);
      }),
    );
    renderForm(["/loans/new"]);
    await waitFor(() =>
      expect(
        within(screen.getByLabelText(/inventory entry/i)).getAllByText(
          /cordless drill/i,
        ).length,
      ).toBeGreaterThan(0),
    );

    await user.selectOptions(
      screen.getByLabelText(/inventory entry/i),
      "inv-1",
    );
    await user.selectOptions(screen.getByLabelText(/borrower/i), "bor-1");
    await user.type(screen.getByLabelText(/due date/i), pastDate());
    await user.click(screen.getByRole("button", { name: /create loan/i }));

    expect(
      await screen.findByText(/due date can't be in the past/i),
    ).toBeInTheDocument();
    expect(posted).toBe(false);
  });

  it("disables the borrower picker with a hint when there are no borrowers", async () => {
    server.use(...sourceHandlers({ borrowers: { items: [] } }));
    renderForm(["/loans/new"]);
    await waitFor(() =>
      expect(screen.getByLabelText(/borrower/i)).toBeDisabled(),
    );
    expect(
      screen.getByText(/no borrowers yet — add one first/i),
    ).toBeInTheDocument();
  });

  it("keeps the inventory picker empty-disabled when there are no entries", async () => {
    server.use(
      ...sourceHandlers({
        inventory: { items: [], total: 0, page: 1, total_pages: 1 },
      }),
    );
    renderForm(["/loans/new"]);
    await waitFor(() =>
      expect(screen.getByLabelText(/inventory entry/i)).toBeDisabled(),
    );
    expect(
      screen.getByText(/no inventory entries yet — add one first/i),
    ).toBeInTheDocument();
    // Silence unused-var lint on lastSearch (it documents the route shape).
    expect(typeof lastSearch).toBe("string");
  });
});
