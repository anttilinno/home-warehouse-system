import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@lingui/react";
import { MemoryRouter } from "react-router";
import { i18n } from "@/lib/i18n";
import { server } from "@/test/msw/server";
import {
  ShortcutsProvider,
  useShortcutsContext,
} from "@/components/shortcuts";
import type { Workspace } from "@/lib/types";
import type { WorkspaceContextValue } from "@/features/workspace/WorkspaceProvider";

// Phase 13 Plan 05 (Wave 2) — the extended dashboard. wsId comes from the D-12
// useWorkspace() context (AUTH-06); mock it. The page now also mounts the side
// rail (DASH-03), the HUD (DASH-04, flag-off default) and registers the DASH-05
// shortcuts, so the harness wraps Router + ShortcutsProvider. MSW serves the
// dashboard/activity reads AND the side-rail panel reads (expiring /
// maintenance-due / pending-changes) so the rail renders without crashing.

const useWorkspaceMock = vi.fn<() => WorkspaceContextValue>();
vi.mock("@/features/workspace/useWorkspace", () => ({
  useWorkspace: () => useWorkspaceMock(),
}));

import { DashboardPage } from "./DashboardPage";

const WS: Workspace[] = [
  {
    id: "ws-A",
    name: "Alpha",
    slug: "alpha",
    description: null,
    role: "owner",
    is_personal: true,
  },
];

function setContext(partial: Partial<WorkspaceContextValue> = {}) {
  useWorkspaceMock.mockReturnValue({
    currentWorkspaceId: "ws-A",
    setWorkspace: vi.fn(),
    workspaces: WS,
    isLoading: false,
    ...partial,
  });
}

const STATS = {
  total_items: 7,
  total_inventory: 42,
  active_loans: 3,
  overdue_loans: 0,
  low_stock_items: 0,
  total_locations: 2,
  total_containers: 4,
  total_categories: 5,
  total_borrowers: 6,
};

// One recent row (created 5m before NOW) WITH a user_id, and one older row
// WITHOUT a user_id (Actor → "—"). The fixture's created_at is computed at
// render time so the relative formatter always sees it as "5m ago".
function activityFixture() {
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  return [
    {
      id: "act-1",
      user_id: "abcd1234-ef56-7890-aaaa-bbbbbbbbbbbb",
      action: "CREATE",
      entity_type: "item",
      entity_id: "it-1",
      entity_name: "Cordless drill",
      created_at: fiveMinAgo,
    },
    {
      id: "act-2",
      action: "DELETE",
      entity_type: "item",
      entity_id: "it-2",
      entity_name: "Old battery",
      created_at: fiveMinAgo,
    },
  ];
}

// Surfaces the registered shortcut keys into the test scope.
let shortcutKeys: string[] = [];
function ShortcutProbe() {
  shortcutKeys = useShortcutsContext().shortcuts.map((s) => s.key.toUpperCase());
  return null;
}

function mountHandlers() {
  server.use(
    http.get("/api/workspaces/:wsId/analytics/dashboard", () =>
      HttpResponse.json(STATS),
    ),
    http.get("/api/workspaces/:wsId/analytics/activity", () =>
      HttpResponse.json(activityFixture()),
    ),
    http.get("/api/workspaces/:wsId/inventory/expiring", () =>
      HttpResponse.json({ items: [], total: 0 }),
    ),
    http.get("/api/workspaces/:wsId/maintenance/due", () =>
      HttpResponse.json({ items: [] }),
    ),
    http.get("/api/workspaces/:wsId/pending-changes", () =>
      HttpResponse.json({ changes: [], total: 2 }),
    ),
  );
}

function renderDashboard() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <ShortcutsProvider>
          <MemoryRouter initialEntries={["/"]}>
            <ShortcutProbe />
            <DashboardPage />
          </MemoryRouter>
        </ShortcutsProvider>
      </QueryClientProvider>
    </I18nProvider>,
  );
}

afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
  shortcutKeys = [];
});

describe("DashboardPage (extended — W2)", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("renders the four DASH-01 stat tiles (regression guard)", async () => {
    setContext();
    mountHandlers();
    renderDashboard();

    expect(await screen.findByText("Items")).toBeInTheDocument();
    expect(screen.getByText("Loans")).toBeInTheDocument();
    expect(screen.getByText("Overdue")).toBeInTheDocument();
    expect(screen.getByText("Low stock")).toBeInTheDocument();
    // Token-correct value lands from the stats query.
    expect(await screen.findByText("7")).toBeInTheDocument();
  });

  it("renders an action-derived Status pill in the activity table", async () => {
    setContext();
    mountHandlers();
    renderDashboard();

    const createRow = (await screen.findByText("Cordless drill")).closest("tr")!;
    // The Status column carries an action-derived pill (CREATE → ok variant).
    // The action text appears twice in the row: once as the plain Action cell
    // and once inside the Status pill (a styled badge <span> with rounded-chip).
    const creates = within(createRow).getAllByText("CREATE");
    expect(creates.length).toBe(2);
    const pill = creates.find((el) =>
      el.className.includes("rounded-chip"),
    );
    expect(pill).toBeDefined();
  });

  it("renders an Actor column: user_id → short slug, missing → '—'", async () => {
    setContext();
    mountHandlers();
    renderDashboard();

    const createRow = (await screen.findByText("Cordless drill")).closest("tr")!;
    // First 8 chars of the user_id.
    expect(within(createRow).getByText("abcd1234")).toBeInTheDocument();

    const deleteRow = (await screen.findByText("Old battery")).closest("tr")!;
    expect(within(deleteRow).getByText("—")).toBeInTheDocument();
  });

  it("renders relative time for a recent activity row", async () => {
    setContext();
    mountHandlers();
    renderDashboard();

    await screen.findByText("Cordless drill");
    // The 5-minute-old fixture row reads as a relative timestamp.
    expect(screen.getAllByText("5m ago").length).toBeGreaterThan(0);
  });

  it("mounts the side rail with Pending approvals ABOVE System alerts", async () => {
    setContext();
    mountHandlers();
    renderDashboard();

    const pending = await screen.findByText(/pending approvals/i);
    const alerts = await screen.findByText(/system alerts/i);
    expect(pending).toBeInTheDocument();
    expect(alerts).toBeInTheDocument();
    // DOM order guard: Pending approvals appears before System alerts.
    expect(
      pending.compareDocumentPosition(alerts) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("registers the N / S / L dashboard shortcuts (no render-loop)", async () => {
    setContext();
    mountHandlers();
    renderDashboard();

    await screen.findByText("Cordless drill");
    await waitFor(() => {
      expect(shortcutKeys).toContain("N");
      expect(shortcutKeys).toContain("S");
      expect(shortcutKeys).toContain("L");
    });
  });
});
