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

vi.mock("../hooks/useLoansForBorrower", () => ({
  useLoansForBorrower: vi.fn(),
}));

import { useLoansForBorrower } from "../hooks/useLoansForBorrower";
import { BorrowerLoanHistoryPanel } from "../panels/BorrowerLoanHistoryPanel";

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

describe("BorrowerLoanHistoryPanel", () => {
  beforeEach(() => {
    setupDialogMocks();
    vi.clearAllMocks();
  });

  it("renders NO LOAN HISTORY empty state when history is empty", () => {
    mockHook.mockReturnValue(baseReturn({ history: [] }));
    renderWithRouter(<BorrowerLoanHistoryPanel borrowerId="bor-1" />);
    expect(screen.getByText(/NO LOAN HISTORY/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Past loans will appear here once anything is returned/i),
    ).toBeInTheDocument();
  });

  it("renders rows in the order supplied by the hook (most-recent-first)", () => {
    const l1 = makeLoan({
      id: "loan-new",
      returned_at: "2026-04-15T10:00:00Z",
      is_active: false,
      item: {
        id: "item-a",
        name: "Newer Item",
        primary_photo_thumbnail_url: null,
      },
    });
    const l2 = makeLoan({
      id: "loan-old",
      returned_at: "2026-03-15T10:00:00Z",
      is_active: false,
      item: {
        id: "item-b",
        name: "Older Item",
        primary_photo_thumbnail_url: null,
      },
    });
    mockHook.mockReturnValue(baseReturn({ history: [l1, l2] }));
    renderWithRouter(<BorrowerLoanHistoryPanel borrowerId="bor-1" />);
    const newer = screen.getByText("Newer Item");
    const older = screen.getByText("Older Item");
    expect(
      newer.compareDocumentPosition(older) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("item thumbnail cell is dimmed for history rows", () => {
    const loan = makeLoan({
      id: "loan-1",
      returned_at: "2026-04-15T10:00:00Z",
      is_active: false,
      item: {
        id: "item-a",
        name: "Drill",
        primary_photo_thumbnail_url: "http://example.com/thumb.jpg",
      },
    });
    mockHook.mockReturnValue(baseReturn({ history: [loan] }));
    const { container } = renderWithRouter(
      <BorrowerLoanHistoryPanel borrowerId="bor-1" />,
    );
    // ItemThumbnailCell applies opacity-50 when dimmed is true.
    const dimmed = container.querySelector(".opacity-50");
    expect(dimmed).toBeTruthy();
  });
});
