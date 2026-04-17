import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor, act } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import type { ReactElement } from "react";
import { renderWithProviders, setupDialogMocks, makeLoan } from "./fixtures";

// Mock AuthContext (for the nested useReturnLoan mutation).
vi.mock("@/features/auth/AuthContext", () => ({
  useAuth: () => ({
    workspaceId: "00000000-0000-0000-0000-000000000001",
    isLoading: false,
    isAuthenticated: true,
    user: { id: "u1" },
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
  }),
}));

// Mock the per-item loans hook directly.
vi.mock("../hooks/useLoansForItem", () => ({
  useLoansForItem: vi.fn(),
}));

// Keep loansApi mockable for the return mutation triggered via MARK RETURNED.
vi.mock("@/lib/api/loans", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/loans")>();
  return {
    ...actual,
    loansApi: {
      ...actual.loansApi,
      return: vi.fn().mockResolvedValue(undefined),
    },
  };
});

import { useLoansForItem } from "../hooks/useLoansForItem";
import { ItemActiveLoanPanel } from "../panels/ItemActiveLoanPanel";

const mockHook = vi.mocked(useLoansForItem);

function renderWithRouter(ui: ReactElement) {
  return renderWithProviders(<MemoryRouter>{ui}</MemoryRouter>);
}

function baseReturn(overrides: Partial<ReturnType<typeof useLoansForItem>> = {}) {
  return {
    activeLoan: null,
    history: [],
    isPending: false,
    isError: false,
    isSuccess: true,
    refetch: vi.fn(),
    data: { items: [] },
    ...overrides,
  } as unknown as ReturnType<typeof useLoansForItem>;
}

describe("ItemActiveLoanPanel", () => {
  beforeEach(() => {
    setupDialogMocks();
    vi.clearAllMocks();
  });

  it("renders NO ACTIVE LOAN empty state when activeLoan is null", () => {
    mockHook.mockReturnValue(baseReturn({ activeLoan: null }));
    renderWithRouter(<ItemActiveLoanPanel itemId="item-1" />);
    expect(screen.getByText(/NO ACTIVE LOAN/i)).toBeInTheDocument();
    expect(
      screen.getByText(/This item isn't currently out on loan/i),
    ).toBeInTheDocument();
  });

  it("renders loan details + MARK RETURNED button when activeLoan present", () => {
    const loan = makeLoan({
      id: "loan-1",
      quantity: 3,
      loaned_at: "2026-04-10T12:00:00Z",
      due_date: "2026-04-20T12:00:00Z",
      notes: "Delivered to porch",
      borrower: {
        id: "bor-1",
        name: "Alice Example",
      },
    });
    mockHook.mockReturnValue(baseReturn({ activeLoan: loan }));
    renderWithRouter(<ItemActiveLoanPanel itemId="item-1" />);
    expect(screen.getByText("Alice Example")).toBeInTheDocument();
    expect(screen.getByText(/×3/)).toBeInTheDocument();
    expect(screen.getByText("2026-04-10")).toBeInTheDocument();
    expect(screen.getByText("2026-04-20")).toBeInTheDocument();
    expect(screen.getByText("Delivered to porch")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Mark loan of .* as returned/i }),
    ).toBeInTheDocument();
  });

  it("clicking MARK RETURNED opens the confirm dialog", async () => {
    const loan = makeLoan({ id: "loan-abc" });
    mockHook.mockReturnValue(baseReturn({ activeLoan: loan }));
    renderWithRouter(<ItemActiveLoanPanel itemId="item-1" />);
    const btn = screen.getByRole("button", {
      name: /Mark loan of .* as returned/i,
    });
    await act(async () => {
      fireEvent.click(btn);
    });
    await waitFor(() => {
      expect(screen.getByText(/CONFIRM RETURN/i)).toBeInTheDocument();
    });
  });
});
