import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@/lib/i18n";
import { server } from "@/test/msw/server";
import type { Workspace } from "@/lib/types";
import type { WorkspaceContextValue } from "@/features/workspace/WorkspaceProvider";

// Phase 05 Plan 03 — AUTH-06. The dashboard's wsId now comes from the D-12
// useWorkspace() context, NOT the workspaces.data?.[0]?.id hardcode. Mock the
// hook so the page's stats/activity fetch can be asserted under a context-driven
// wsId, plus the zero-workspace empty-state branch.

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

function setContext(partial: Partial<WorkspaceContextValue>) {
  useWorkspaceMock.mockReturnValue({
    currentWorkspaceId: "ws-A",
    setWorkspace: vi.fn(),
    workspaces: WS,
    isLoading: false,
    ...partial,
  });
}

function renderDashboard() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <DashboardPage />
      </QueryClientProvider>
    </I18nProvider>,
  );
}

afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});

describe("DashboardPage", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("fetches stats + activity under the context wsId (not a first-workspace hardcode)", async () => {
    setContext({ currentWorkspaceId: "ws-A", workspaces: WS });
    let dashboardUrl = "";
    let activityUrl = "";
    server.use(
      http.get("/api/workspaces/:wsId/analytics/dashboard", ({ request }) => {
        dashboardUrl = new URL(request.url).pathname;
        return HttpResponse.json({
          total_items: 7,
          total_inventory: 42,
          active_loans: 3,
          overdue_loans: 0,
          low_stock_items: 0,
          total_locations: 2,
          total_containers: 4,
          total_categories: 5,
          total_borrowers: 6,
        });
      }),
      http.get("/api/workspaces/:wsId/analytics/activity", ({ request }) => {
        activityUrl = new URL(request.url).pathname;
        return HttpResponse.json([]);
      }),
    );

    renderDashboard();

    // The "Items" stat value resolves once the dashboard query lands.
    expect(await screen.findByText("7")).toBeInTheDocument();
    // Both entity calls were keyed to the context workspace id.
    expect(dashboardUrl).toBe("/api/workspaces/ws-A/analytics/dashboard");
    expect(activityUrl).toBe("/api/workspaces/ws-A/analytics/activity");
  });

  it("renders the empty-state Window when the context has zero workspaces", () => {
    setContext({ currentWorkspaceId: null, workspaces: [] });
    renderDashboard();
    expect(screen.getByText(/your account has no workspaces yet/i)).toBeInTheDocument();
  });
});
