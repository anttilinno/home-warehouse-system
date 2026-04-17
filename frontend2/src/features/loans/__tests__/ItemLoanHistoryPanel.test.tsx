import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
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

vi.mock("../hooks/useLoansForItem", () => ({
  useLoansForItem: vi.fn(),
}));

import { useLoansForItem } from "../hooks/useLoansForItem";
import { ItemLoanHistoryPanel } from "../panels/ItemLoanHistoryPanel";

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

describe("ItemLoanHistoryPanel", () => {
  beforeEach(() => {
    setupDialogMocks();
    vi.clearAllMocks();
  });

  it("renders NO LOAN HISTORY empty state when history is empty", () => {
    mockHook.mockReturnValue(baseReturn({ history: [] }));
    renderWithRouter(<ItemLoanHistoryPanel itemId="item-1" />);
    expect(screen.getByText(/NO LOAN HISTORY/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Past loans will appear here once anything is returned/i),
    ).toBeInTheDocument();
  });

  it("renders rows in the order supplied by the hook (most-recent-first)", () => {
    const l1 = makeLoan({
      id: "loan-newer",
      returned_at: "2026-04-15T10:00:00Z",
      is_active: false,
      borrower: { id: "b-new", name: "Newer Borrower" },
    });
    const l2 = makeLoan({
      id: "loan-older",
      returned_at: "2026-03-15T10:00:00Z",
      is_active: false,
      borrower: { id: "b-old", name: "Older Borrower" },
    });
    mockHook.mockReturnValue(baseReturn({ history: [l1, l2] }));
    renderWithRouter(<ItemLoanHistoryPanel itemId="item-1" />);
    const newer = screen.getByText("Newer Borrower");
    const older = screen.getByText("Older Borrower");
    expect(newer).toBeInTheDocument();
    expect(older).toBeInTheDocument();
    // Newer should appear before older in document order
    expect(
      newer.compareDocumentPosition(older) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("shows borrower name linking to /borrowers/{id}", () => {
    const loan = makeLoan({
      id: "loan-1",
      returned_at: "2026-04-15T10:00:00Z",
      is_active: false,
      borrower_id: "bor-xyz",
      borrower: { id: "bor-xyz", name: "Carol Sample" },
    });
    mockHook.mockReturnValue(baseReturn({ history: [loan] }));
    renderWithRouter(<ItemLoanHistoryPanel itemId="item-1" />);
    const link = screen.getByRole("link", { name: "Carol Sample" });
    expect(link).toHaveAttribute("href", "/borrowers/bor-xyz");
  });
});
