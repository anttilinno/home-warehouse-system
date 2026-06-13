import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@lingui/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router";
import { i18n } from "@/lib/i18n";
import { server } from "@/test/msw/server";
import { ExpiringPage } from "./ExpiringPage";

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

let lastSearch = "";
function Probe() {
  lastSearch = useLocation().search;
  return null;
}

// One FUTURE (expiration, far ahead) + one PAST (warranty, overdue) so the
// near/past split is exercisable. `date` is YYYY-MM-DD (Pitfall 4).
const FUTURE_DATE = "2099-12-31";
const PAST_DATE = "2020-01-01";
const EXPIRING = {
  items: [
    {
      inventory_id: "inv-1",
      item_id: "it-1",
      item_name: "Cordless Drill",
      quantity: 3,
      kind: "expiration",
      date: FUTURE_DATE,
    },
    {
      inventory_id: "inv-2",
      item_id: "it-2",
      item_name: "Old Battery",
      quantity: 1,
      kind: "warranty",
      date: PAST_DATE,
    },
  ],
  total: 2,
};

function expiringHandler(captureDays?: (d: string | null) => void) {
  return http.get(
    "/api/workspaces/:wsId/inventory/expiring",
    ({ request }) => {
      if (captureDays) {
        captureDays(new URL(request.url).searchParams.get("days"));
      }
      return HttpResponse.json(EXPIRING);
    },
  );
}

function renderPage(initialEntries: string[] = ["/inventory/expiring"]) {
  setWsId("ws-A");
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={initialEntries}>
          <Probe />
          <Routes>
            <Route path="/inventory/expiring" element={<ExpiringPage />} />
            <Route path="/items/:id" element={<div>ITEM DETAIL</div>} />
            <Route path="/inventory" element={<div>LIST PAGE</div>} />
          </Routes>
        </MemoryRouter>
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

describe("ExpiringPage", () => {
  it("renders both a future and a past entry", async () => {
    server.use(expiringHandler());
    renderPage();
    expect(await screen.findByText("Cordless Drill")).toBeInTheDocument();
    expect(screen.getByText("Old Battery")).toBeInTheDocument();
    // Kind chips.
    expect(screen.getByText("EXPIRY")).toBeInTheDocument();
    expect(screen.getByText("WARRANTY")).toBeInTheDocument();
  });

  it("marks the future entry 'in' and the past entry with ⚠ / − (non-color signal)", async () => {
    server.use(expiringHandler());
    renderPage();
    const futureRow = (await screen.findByText("Cordless Drill")).closest(
      "tr",
    )!;
    const pastRow = screen.getByText("Old Battery").closest("tr")!;

    // The future entry's When chip uses the "in {n}d" idiom.
    expect(within(futureRow).getByText(/^in \d+d$/)).toBeInTheDocument();
    // The past entry's When chip carries the ⚠ glyph + a leading − sign — the
    // signal is NOT color alone.
    expect(within(pastRow).getByText(/⚠/)).toBeInTheDocument();
    expect(within(pastRow).getByText(/−\d+d/)).toBeInTheDocument();
  });

  it("sorts rows by date ascending (most-overdue first)", async () => {
    server.use(expiringHandler());
    renderPage();
    await screen.findByText("Cordless Drill");
    const rows = screen.getAllByRole("row").filter((r) =>
      within(r).queryByText(/Cordless Drill|Old Battery/),
    );
    // Past date (2020) sorts before the future date (2099).
    expect(within(rows[0]).getByText("Old Battery")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Cordless Drill")).toBeInTheDocument();
  });

  it("changing the days selector updates the ?days query param", async () => {
    const user = userEvent.setup();
    const seen: (string | null)[] = [];
    server.use(expiringHandler((d) => seen.push(d)));
    renderPage();
    await screen.findByText("Cordless Drill");

    await user.selectOptions(
      screen.getByLabelText(/window/i),
      "90",
    );
    await waitFor(() => expect(lastSearch).toContain("days=90"));
    await waitFor(() => expect(seen).toContain("90"));
  });

  it("shows the NOTHING EXPIRING empty state with the window in the body", async () => {
    server.use(
      http.get("/api/workspaces/:wsId/inventory/expiring", () =>
        HttpResponse.json({ items: [], total: 0 }),
      ),
    );
    renderPage();
    expect(await screen.findByText(/nothing expiring/i)).toBeInTheDocument();
    // Default window of 30 days surfaced in the empty-state body copy.
    expect(
      screen.getByText(/expiring or out of warranty in the next 30 days/i),
    ).toBeInTheDocument();
  });

  it("a row click navigates to the owning item detail", async () => {
    const user = userEvent.setup();
    server.use(expiringHandler());
    renderPage();
    await user.click(await screen.findByText("Cordless Drill"));
    expect(await screen.findByText("ITEM DETAIL")).toBeInTheDocument();
  });
});
