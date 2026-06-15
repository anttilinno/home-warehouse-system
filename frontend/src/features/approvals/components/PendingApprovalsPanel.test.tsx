import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { http, HttpResponse } from "msw";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@/lib/i18n";
import { server } from "@/test/msw/server";
import { PendingApprovalsPanel } from "./PendingApprovalsPanel";

// Phase 13 Plan 02 — DASH-03 side-rail panel. Asserts the count for admins,
// the calm 0 state, the silent 403 degrade (NO error banner), and a loading
// placeholder. wsId is mocked at the SSOT (useWorkspace) like the maintenance
// drawer test; the pending-changes endpoint is faked per-test via MSW.

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

const ENDPOINT = "/api/workspaces/:wsId/pending-changes";

function renderPanel() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    </I18nProvider>
  );
  return render(<PendingApprovalsPanel />, { wrapper });
}

afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});

describe("PendingApprovalsPanel", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
    setWsId("ws-1");
  });

  it("renders the titled panel + count for an admin (total=3)", async () => {
    setWsId("ws-1");
    server.use(
      http.get(ENDPOINT, () => HttpResponse.json({ changes: [], total: 3 })),
    );
    renderPanel();
    expect(await screen.findByText("Pending approvals")).toBeInTheDocument();
    expect(await screen.findByText("3")).toBeInTheDocument();
    // total>0 → a Review link to the approvals page.
    const link = await screen.findByRole("link", { name: /review/i });
    expect(link).toHaveAttribute("href", "/approvals");
  });

  it("renders a calm 'Nothing pending' state when total=0 (no error)", async () => {
    setWsId("ws-1");
    server.use(
      http.get(ENDPOINT, () => HttpResponse.json({ changes: [], total: 0 })),
    );
    renderPanel();
    expect(await screen.findByText("Nothing pending")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /review/i }),
    ).not.toBeInTheDocument();
  });

  it("degrades SILENTLY on a 403 — renders nothing, no error banner", async () => {
    setWsId("ws-1");
    server.use(
      http.get(ENDPOINT, () =>
        HttpResponse.json({ detail: "forbidden" }, { status: 403 }),
      ),
    );
    const { container } = renderPanel();
    // Settle the rejected query (retry:false → one shot), then assert nothing
    // rendered: no title, no count, and crucially no error/forbidden text.
    await vi.waitFor(() => {
      expect(container.querySelector("section")).not.toBeInTheDocument();
    });
    expect(screen.queryByText("Pending approvals")).not.toBeInTheDocument();
    expect(screen.queryByText(/forbidden/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
  });

  it("shows a Loading… placeholder while the query is in flight", () => {
    setWsId("ws-1");
    server.use(
      http.get(
        ENDPOINT,
        () =>
          new Promise(() => {
            /* never resolves — keep the query pending */
          }),
      ),
    );
    renderPanel();
    // Title is rendered immediately; the body shows the loading line.
    expect(screen.getByText("Pending approvals")).toBeInTheDocument();
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });
});
