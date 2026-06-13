import type { ReactNode } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { I18nProvider } from "@lingui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { ModalStackProvider } from "@/components/modal";
import { i18n } from "@/lib/i18n";
import { server } from "@/test/msw/server";
import type { Loan } from "@/lib/types";
import { ActiveLoanPanel, LoanHistoryList, LoanPanels } from "./LoanPanels";
import { InventoryPanelStub } from "./InventoryPanelStub";

const WS = "ws-1";
const IT = "it-1";

// The dialogs (RETURN/EXTEND) call useLoanMutations → useWorkspace; mock it so
// the panel's lifecycle wiring renders without a WorkspaceProvider.
vi.mock("@/features/workspace/useWorkspace", () => ({
  useWorkspace: () => ({
    currentWorkspaceId: WS,
    setWorkspace: vi.fn(),
    workspaces: [],
    isLoading: false,
  }),
}));

function loan(id: string, overrides: Partial<Loan> = {}): Loan {
  return {
    id,
    workspace_id: WS,
    inventory_id: "inv-1",
    borrower_id: "b-1",
    quantity: 1,
    loaned_at: "2026-05-01T00:00:00Z",
    is_active: false,
    is_overdue: false,
    created_at: "2026-05-01T00:00:00Z",
    updated_at: "2026-05-01T00:00:00Z",
    item: { id: IT, name: "Drill" },
    borrower: { id: "b-1", name: "Alice" },
    ...overrides,
  };
}

function renderWithProviders(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <ModalStackProvider>
          <MemoryRouter>{ui}</MemoryRouter>
        </ModalStackProvider>
      </QueryClientProvider>
    </I18nProvider>,
  );
}

afterEach(() => server.resetHandlers());

describe("LoanPanels", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("ActiveLoanPanel shows the pink on-loan state with live RETURN + EXTEND", () => {
    renderWithProviders(
      <ActiveLoanPanel
        itemId={IT}
        active={[
          loan("l-1", {
            is_active: true,
            due_date: "2026-07-01T00:00:00Z",
            borrower: { id: "b-1", name: "Alice" },
          }),
        ]}
      />,
    );
    expect(screen.getByText(/on loan to alice/i)).toBeInTheDocument();
    // The Phase-8 stub hint is gone; RETURN is now an enabled live button.
    expect(
      screen.queryByText(/loan actions arrive in phase 8/i),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /return/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /extend/i })).toBeEnabled();
  });

  it("ActiveLoanPanel RETURN opens the return dialog and fires the mutation", async () => {
    let returned = false;
    server.use(
      http.post("/api/workspaces/:wsId/loans/:id/return", () => {
        returned = true;
        return HttpResponse.json(loan("l-1", { is_active: false }));
      }),
    );
    renderWithProviders(
      <ActiveLoanPanel
        itemId={IT}
        active={[loan("l-1", { is_active: true })]}
      />,
    );
    const user = userEvent.setup();
    // Panel RETURN button opens the dialog.
    await user.click(screen.getByRole("button", { name: /^return$/i }));
    expect(
      await screen.findByText(/mark "drill" returned by alice/i),
    ).toBeInTheDocument();
    // Now two RETURN buttons exist (panel + dialog confirm); the dialog confirm
    // is the last one — click it to fire the mutation.
    const returnButtons = screen.getAllByRole("button", { name: /^return$/i });
    await user.click(returnButtons[returnButtons.length - 1]);
    await vi.waitFor(() => expect(returned).toBe(true));
  });

  it("ActiveLoanPanel overdue shows a danger chip + line from is_overdue", () => {
    renderWithProviders(
      <ActiveLoanPanel
        itemId={IT}
        active={[loan("l-1", { is_active: true, is_overdue: true })]}
      />,
    );
    expect(screen.getByText(/⚠ overdue/i)).toBeInTheDocument();
    expect(screen.getByText(/this loan is overdue/i)).toBeInTheDocument();
  });

  it("ActiveLoanPanel available state shows the ⊕ LOAN THIS ITEM CTA", () => {
    renderWithProviders(<ActiveLoanPanel itemId={IT} active={[]} />);
    expect(screen.getByText(/available/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /loan this item/i }),
    ).toBeInTheDocument();
  });

  it("LoanHistoryList lists returned loans with the three-way pill", () => {
    renderWithProviders(
      <LoanHistoryList
        history={[
          loan("l-2", {
            borrower: { id: "b-2", name: "Bob" },
            returned_at: "2026-05-15T00:00:00Z",
          }),
        ]}
      />,
    );
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText(/returned/i)).toBeInTheDocument();
  });

  it("LoanHistoryList renders the OVERDUE pill for a still-out overdue loan", () => {
    renderWithProviders(
      <LoanHistoryList
        history={[
          loan("l-3", {
            is_active: true,
            is_overdue: true,
            borrower: { id: "b-3", name: "Cara" },
          }),
        ]}
      />,
    );
    expect(screen.getByText(/overdue/i)).toBeInTheDocument();
  });

  it("LoanHistoryList shows NO LOAN HISTORY when empty", () => {
    renderWithProviders(<LoanHistoryList history={[]} />);
    expect(screen.getByText(/no loan history/i)).toBeInTheDocument();
  });

  it("LoanPanels fetches and renders the active panel from the partitioned query", async () => {
    server.use(
      http.get("/api/workspaces/:wsId/items/:itemId/loans", () =>
        HttpResponse.json({
          items: [
            loan("l-1", {
              is_active: true,
              borrower: { id: "b-1", name: "Carol" },
            }),
          ],
        }),
      ),
    );
    renderWithProviders(<LoanPanels wsId={WS} itemId={IT} />);
    expect(await screen.findByText(/on loan to carol/i)).toBeInTheDocument();
  });
});

describe("InventoryPanelStub", () => {
  it("renders the named 7b slot with the exact stub copy", () => {
    renderWithProviders(<InventoryPanelStub />);
    expect(screen.getByText("Stock entries arrive in 7b.")).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: /inventory/i }),
    ).toBeInTheDocument();
  });
});
