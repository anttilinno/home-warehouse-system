import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@lingui/react";
import { MemoryRouter } from "react-router";
import { http, HttpResponse } from "msw";
import { i18n } from "@/lib/i18n";
import { server } from "@/test/msw/server";
import { MyChangesPage } from "./MyChangesPage";

// Phase 14 Plan 02 Task 2 — MyChangesPage render tests. Mock useWorkspace,
// MSW the /my-pending-changes endpoint, render under QueryClient + Router +
// lingui. Contract: rows render in a RetroTable (entity_type + action/status
// badges); an empty body renders a calm RetroEmptyState (no error markup); a
// load error renders a calm danger line (not a crash).

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
        id: "ws-1",
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

const CHANGE = {
  id: "chg-1",
  entity_type: "item",
  entity_id: "it-12345678",
  action: "update" as const,
  status: "pending" as const,
  created_at: "2026-06-13T00:00:00Z",
};

function renderPage() {
  setWsId("ws-1");
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/my-changes"]}>
          <MyChangesPage />
        </MemoryRouter>
      </QueryClientProvider>
    </I18nProvider>,
  );
}

afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});

describe("MyChangesPage", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("renders rows in a RetroTable with entity + action/status badges", async () => {
    server.use(
      http.get("/api/workspaces/:wsId/my-pending-changes", () =>
        HttpResponse.json({ changes: [CHANGE], total: 1 }),
      ),
    );
    renderPage();

    // The entity_type renders in the row.
    expect(await screen.findByText(/item/i)).toBeInTheDocument();
    const row = screen.getByText("item").closest("tr")!;
    // action-derived badge + status-derived badge both render.
    expect(within(row).getByText(/update/i)).toBeInTheDocument();
    expect(within(row).getByText(/pending/i)).toBeInTheDocument();
  });

  it("renders a calm RetroEmptyState when there are no changes", async () => {
    server.use(
      http.get("/api/workspaces/:wsId/my-pending-changes", () =>
        HttpResponse.json({ changes: [], total: 0 }),
      ),
    );
    renderPage();

    expect(await screen.findByText(/no changes yet/i)).toBeInTheDocument();
    // No error markup on an empty (not failed) load.
    expect(screen.queryByText(/couldn't load/i)).not.toBeInTheDocument();
  });

  it("renders a calm danger line on a load error (no crash)", async () => {
    server.use(
      http.get("/api/workspaces/:wsId/my-pending-changes", () =>
        HttpResponse.json({ message: "boom" }, { status: 500 }),
      ),
    );
    renderPage();

    await waitFor(() =>
      expect(screen.getByText(/couldn't load/i)).toBeInTheDocument(),
    );
  });
});
