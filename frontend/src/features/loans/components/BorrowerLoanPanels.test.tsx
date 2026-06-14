import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@lingui/react";
import { MemoryRouter } from "react-router";
import { i18n } from "@/lib/i18n";
import { server } from "@/test/msw/server";
import { RetroToaster } from "@/components/retro";
import { ShortcutsProvider } from "@/components/shortcuts";
import { ModalStackProvider } from "@/components/modal";
import { BorrowerLoanPanels } from "./BorrowerLoanPanels";

// Phase 8 Plan 05 — BorrowerLoanPanels is a reusable component (LOAN-06). These
// tests mount it DIRECTLY in a MemoryRouter wrapper (NO <Routes>/<Route>). The
// Phase-8 "no borrower route yet" guard was removed in Phase 9 (BORR-03), which
// intentionally registers the borrower routes that mount this component.

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

const ACTIVE = {
  id: "loan-active",
  workspace_id: "ws-1",
  inventory_id: "inv-1",
  borrower_id: "bor-1",
  quantity: 1,
  loaned_at: "2026-06-01T00:00:00Z",
  due_date: "2026-07-01T00:00:00Z",
  is_active: true,
  is_overdue: false,
  created_at: "2026-06-01T00:00:00Z",
  updated_at: "2026-06-01T00:00:00Z",
  item: { id: "it-1", name: "Cordless Drill" },
  borrower: { id: "bor-1", name: "Alex" },
};

const OVERDUE = {
  ...ACTIVE,
  id: "loan-overdue",
  inventory_id: "inv-2",
  due_date: "2026-06-05T00:00:00Z",
  is_overdue: true,
  item: { id: "it-2", name: "Tile Saw" },
};

const RETURNED = {
  ...ACTIVE,
  id: "loan-returned",
  inventory_id: "inv-3",
  returned_at: "2026-06-05T00:00:00Z",
  is_active: false,
  is_overdue: false,
  item: { id: "it-3", name: "Pressure Washer" },
};

function byBorrower(items: unknown[]) {
  return http.get(
    "/api/workspaces/:wsId/borrowers/:borrowerId/loans",
    () => HttpResponse.json({ items }),
  );
}

function renderPanels(borrowerId = "bor-1") {
  setWsId("ws-1");
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <ShortcutsProvider>
          <ModalStackProvider>
            <RetroToaster />
            <MemoryRouter>
              <BorrowerLoanPanels wsId="ws-1" borrowerId={borrowerId} />
            </MemoryRouter>
          </ModalStackProvider>
        </ShortcutsProvider>
      </QueryClientProvider>
    </I18nProvider>,
  );
}

afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});

describe("BorrowerLoanPanels", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("shows the mint empty Active panel when the borrower has nothing out", async () => {
    server.use(byBorrower([RETURNED]));
    renderPanels();
    expect(await screen.findByText(/Nothing out/i)).toBeInTheDocument();
  });

  it("renders an active-loan row per active loan with item link, status pill, RETURN + EXTEND", async () => {
    server.use(byBorrower([ACTIVE, OVERDUE, RETURNED]));
    renderPanels();

    // Active rows: both the on-time and overdue active loans appear.
    const drill = await screen.findByRole("link", { name: /Cordless Drill/i });
    expect(drill).toHaveAttribute("href", "/items/it-1");
    const saw = screen.getByRole("link", { name: /Tile Saw/i });
    expect(saw).toHaveAttribute("href", "/items/it-2");

    // Server-flag overdue chip (⚠ −{n}d), never client date math.
    expect(screen.getByText(/⚠/)).toBeInTheDocument();
    // Status pills from loanStatus (ACTIVE + OVERDUE).
    expect(screen.getByText("ACTIVE")).toBeInTheDocument();
    expect(screen.getByText("OVERDUE")).toBeInTheDocument();

    // Each active row exposes RETURN + EXTEND.
    expect(screen.getAllByRole("button", { name: /^RETURN$/i }).length).toBe(2);
    expect(screen.getAllByRole("button", { name: /^EXTEND$/i }).length).toBe(2);
  });

  it("renders the Loan History panel with returned loans", async () => {
    server.use(byBorrower([ACTIVE, RETURNED]));
    renderPanels();
    expect(
      await screen.findByText(/Pressure Washer/i),
    ).toBeInTheDocument();
    expect(screen.getByText("RETURNED")).toBeInTheDocument();
  });

  it("shows the empty Loan History state when nothing was returned", async () => {
    server.use(byBorrower([ACTIVE]));
    renderPanels();
    expect(await screen.findByText(/NO LOAN HISTORY/i)).toBeInTheDocument();
    expect(
      screen.getByText(/hasn't returned anything yet/i),
    ).toBeInTheDocument();
  });

  it("RETURN fires the Plan-04 return mutation (POST /loans/{id}/return)", async () => {
    server.use(byBorrower([ACTIVE]));
    let returnHit = false;
    server.use(
      http.post("/api/workspaces/:wsId/loans/:id/return", ({ params }) => {
        returnHit = true;
        return HttpResponse.json({
          ...RETURNED,
          id: String(params.id),
        });
      }),
    );
    renderPanels();

    const user = userEvent.setup();
    await screen.findByRole("link", { name: /Cordless Drill/i });
    await user.click(screen.getByRole("button", { name: /^RETURN$/i }));
    // Confirm inside the dialog (scoped — the row's RETURN button also matches).
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /^Return$/i }));

    await waitFor(() => expect(returnHit).toBe(true));
  });
});
