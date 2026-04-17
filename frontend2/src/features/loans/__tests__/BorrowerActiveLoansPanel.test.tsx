import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor, act } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import type { ReactElement } from "react";
import { renderWithProviders, setupDialogMocks, makeLoan } from "./fixtures";

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

vi.mock("../hooks/useLoansForBorrower", () => ({
  useLoansForBorrower: vi.fn(),
}));

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

import { useLoansForBorrower } from "../hooks/useLoansForBorrower";
import { BorrowerActiveLoansPanel } from "../panels/BorrowerActiveLoansPanel";

const mockHook = vi.mocked(useLoansForBorrower);

function renderWithRouter(ui: ReactElement) {
  return renderWithProviders(<MemoryRouter>{ui}</MemoryRouter>);
}

function baseReturn(
  overrides: Partial<ReturnType<typeof useLoansForBorrower>> = {},
) {
  return {
    activeLoans: [],
    history: [],
    isPending: false,
    isError: false,
    isSuccess: true,
    refetch: vi.fn(),
    data: { items: [] },
    ...overrides,
  } as unknown as ReturnType<typeof useLoansForBorrower>;
}

describe("BorrowerActiveLoansPanel", () => {
  beforeEach(() => {
    setupDialogMocks();
    vi.clearAllMocks();
  });

  it("renders NO ACTIVE LOANS empty state when activeLoans is empty", () => {
    mockHook.mockReturnValue(baseReturn({ activeLoans: [] }));
    renderWithRouter(<BorrowerActiveLoansPanel borrowerId="bor-1" />);
    expect(screen.getByText(/NO ACTIVE LOANS/i)).toBeInTheDocument();
    expect(
      screen.getByText(/This borrower isn't holding anything right now/i),
    ).toBeInTheDocument();
  });

  it("renders multiple rows when multiple active loans present", () => {
    const l1 = makeLoan({
      id: "loan-1",
      item: { id: "item-a", name: "Drill", primary_photo_thumbnail_url: null },
    });
    const l2 = makeLoan({
      id: "loan-2",
      item: { id: "item-b", name: "Saw", primary_photo_thumbnail_url: null },
    });
    mockHook.mockReturnValue(baseReturn({ activeLoans: [l1, l2] }));
    renderWithRouter(<BorrowerActiveLoansPanel borrowerId="bor-1" />);
    expect(screen.getByText("Drill")).toBeInTheDocument();
    expect(screen.getByText("Saw")).toBeInTheDocument();
    const buttons = screen.getAllByRole("button", {
      name: /Mark loan of .* as returned/i,
    });
    expect(buttons.length).toBe(2);
  });

  it("clicking MARK RETURNED on a row opens the confirm dialog", async () => {
    const loan = makeLoan({
      id: "loan-abc",
      item: {
        id: "item-a",
        name: "Cordless Drill",
        primary_photo_thumbnail_url: null,
      },
      borrower: { id: "bor-1", name: "Alice Example" },
      borrower_id: "bor-1",
    });
    mockHook.mockReturnValue(baseReturn({ activeLoans: [loan] }));
    renderWithRouter(<BorrowerActiveLoansPanel borrowerId="bor-1" />);
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
