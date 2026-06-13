import type { ReactNode } from "react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { I18nProvider } from "@lingui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { i18n } from "@/lib/i18n";
import { server } from "@/test/msw/server";
import type { Loan } from "@/lib/types";
import { ActiveLoanPanel, LoanHistoryList, LoanPanels } from "./LoanPanels";
import { InventoryPanelStub } from "./InventoryPanelStub";

const WS = "ws-1";
const IT = "it-1";

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
      <QueryClientProvider client={client}>{ui}</QueryClientProvider>
    </I18nProvider>,
  );
}

afterEach(() => server.resetHandlers());

describe("LoanPanels", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("ActiveLoanPanel shows the pink on-loan state with the borrower", () => {
    renderWithProviders(
      <ActiveLoanPanel
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
    expect(screen.getByText(/loan actions arrive in phase 8/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /return/i }),
    ).toBeDisabled();
  });

  it("ActiveLoanPanel shows the mint available state when no active loan", () => {
    renderWithProviders(<ActiveLoanPanel active={[]} />);
    expect(screen.getByText(/available/i)).toBeInTheDocument();
  });

  it("LoanHistoryList lists returned loans", () => {
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
