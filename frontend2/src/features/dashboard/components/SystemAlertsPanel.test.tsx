import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@lingui/react";
import { MemoryRouter } from "react-router";
import { i18n } from "@/lib/i18n";
import { server } from "@/test/msw/server";
import { SystemAlertsPanel } from "./SystemAlertsPanel";

// useExpiringQuery + useMaintenanceDueQuery both read the active workspace via
// useWorkspace; mock it so the queries enable with a fixed wsId.
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

const EXPIRING_TWO = {
  items: [
    {
      inventory_id: "inv-1",
      item_id: "it-1",
      item_name: "Cordless Drill",
      quantity: 3,
      kind: "expiration",
      date: "2099-12-31",
    },
    {
      inventory_id: "inv-2",
      item_id: "it-2",
      item_name: "Old Battery",
      quantity: 1,
      kind: "warranty",
      date: "2020-01-01",
    },
  ],
  total: 2,
};

// One overdue (server flag) + one not-yet-overdue → due count 2, overdue 1.
const DUE_ONE_OVERDUE = {
  items: [
    {
      id: "sch-1",
      title: "Replace filter",
      interval_days: 30,
      next_due: "2020-01-01",
      item_id: "it-1",
      item_name: "Furnace",
      is_overdue: true,
    },
    {
      id: "sch-2",
      title: "Lubricate",
      interval_days: 90,
      next_due: "2099-12-31",
      item_id: "it-2",
      item_name: "Garage Door",
      is_overdue: false,
    },
  ],
};

function expiringHandler(body: object) {
  return http.get("/api/workspaces/:wsId/inventory/expiring", () =>
    HttpResponse.json(body),
  );
}

function dueHandler(body: object) {
  return http.get("/api/workspaces/:wsId/maintenance/due", () =>
    HttpResponse.json(body),
  );
}

function renderPanel() {
  setWsId("ws-A");
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/"]}>
          <SystemAlertsPanel />
        </MemoryRouter>
      </QueryClientProvider>
    </I18nProvider>,
  );
}

/** The card link whose label matches `re`. */
function cardByLabel(re: RegExp) {
  return screen.getByText(re).closest("a") as HTMLAnchorElement;
}

afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});

beforeAll(() => {
  i18n.load("en", {});
  i18n.activate("en");
});

describe("SystemAlertsPanel", () => {
  it("shows the expiring count (2) with a link to /inventory/expiring", async () => {
    server.use(expiringHandler(EXPIRING_TWO), dueHandler({ items: [] }));
    renderPanel();

    const link = (await screen.findByText(/expiring soon/i)).closest("a")!;
    expect(link).toHaveAttribute("href", "/inventory/expiring");
    // Wait for the expiring query to resolve to the count.
    expect(await within(link).findByText("2")).toBeInTheDocument();
  });

  it("shows the due count and an OVERDUE danger badge from the server is_overdue flag", async () => {
    server.use(
      expiringHandler({ items: [], total: 0 }),
      dueHandler(DUE_ONE_OVERDUE),
    );
    renderPanel();

    // Overdue badge driven by the SERVER flag (1 of the 2 rows) — wait for the
    // due query to resolve.
    expect(await screen.findByText(/1 overdue/i)).toBeInTheDocument();
    const card = screen.getByText(/maintenance due/i).closest("a")!;
    expect(card).toHaveAttribute("href", "/maintenance/due");
    // Due count = 2 rows.
    expect(within(card).getByText("2")).toBeInTheDocument();
  });

  it("degrades to calm empty states (no crash, no error banner) when both are empty", async () => {
    server.use(
      expiringHandler({ items: [], total: 0 }),
      dueHandler({ items: [] }),
    );
    renderPanel();

    // Both cards resolve to 0 with calm one-liners.
    expect(await screen.findByText(/nothing expiring/i)).toBeInTheDocument();
    expect(await screen.findByText(/nothing due/i)).toBeInTheDocument();

    const expiringCard = cardByLabel(/expiring soon/i);
    expect(within(expiringCard).getByText("0")).toBeInTheDocument();
    const dueCard = cardByLabel(/maintenance due/i);
    expect(within(dueCard).getByText("0")).toBeInTheDocument();

    // No overdue badge when nothing is overdue.
    expect(screen.queryByText(/overdue/i)).not.toBeInTheDocument();
  });
});
