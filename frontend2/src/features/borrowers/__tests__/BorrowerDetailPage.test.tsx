import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router";
import { screen } from "@testing-library/react";
import {
  renderWithProviders,
  setupDialogMocks,
  makeBorrower,
} from "./fixtures";

// Mock AuthContext so the detail hook sees a workspace id.
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

vi.mock("@/lib/api/borrowers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/borrowers")>();
  return {
    ...actual,
    borrowersApi: {
      ...actual.borrowersApi,
      list: vi.fn(),
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      archive: vi.fn(),
      restore: vi.fn(),
      remove: vi.fn(),
    },
  };
});

// Stub the Phase 62 loan panels so the borrower-detail-page tests don't need
// to mock loansApi / the useLoansForBorrower hook; both panels are exercised
// by their own suites. We assert that the section structure renders.
vi.mock("@/features/loans/panels/BorrowerActiveLoansPanel", () => ({
  BorrowerActiveLoansPanel: ({ borrowerId }: { borrowerId: string }) => (
    <div
      data-testid="borrower-active-loans-panel"
      data-borrower-id={borrowerId}
    >
      NO ACTIVE LOANS
    </div>
  ),
}));
vi.mock("@/features/loans/panels/BorrowerLoanHistoryPanel", () => ({
  BorrowerLoanHistoryPanel: ({ borrowerId }: { borrowerId: string }) => (
    <div
      data-testid="borrower-loan-history-panel"
      data-borrower-id={borrowerId}
    >
      NO LOAN HISTORY
    </div>
  ),
}));

import { borrowersApi } from "@/lib/api/borrowers";
import { BorrowerDetailPage } from "../BorrowerDetailPage";

const mockedApi = vi.mocked(borrowersApi);

function renderDetail(id: string) {
  return renderWithProviders(
    <MemoryRouter initialEntries={[`/borrowers/${id}`]}>
      <Routes>
        <Route path="/borrowers" element={<div>LIST</div>} />
        <Route path="/borrowers/:id" element={<BorrowerDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("BorrowerDetailPage", () => {
  beforeEach(() => {
    setupDialogMocks();
    vi.clearAllMocks();
  });

  it("renders borrower name, contact fields, and two empty loan sections", async () => {
    mockedApi.get.mockResolvedValue(
      makeBorrower({
        id: "b-1",
        name: "Alice",
        email: "alice@example.com",
        phone: null,
        notes: "Weekend pickups only",
      }),
    );
    renderDetail("b-1");
    expect(await screen.findByText("Alice")).toBeVisible();
    expect(screen.getByText("alice@example.com")).toBeVisible();
    expect(screen.getByText("Weekend pickups only")).toBeVisible();
    // Missing phone → em-dash
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/NO ACTIVE LOANS/i)).toBeVisible();
    expect(screen.getByText(/NO LOAN HISTORY/i)).toBeVisible();
  });

  it("renders not-found state when the borrower query errors", async () => {
    mockedApi.get.mockRejectedValue(new Error("404"));
    renderDetail("missing-id");
    expect(
      await screen.findByText(/BORROWER NOT FOUND/i),
    ).toBeVisible();
    expect(screen.getByText(/BACK TO BORROWERS/i)).toBeVisible();
  });

  it("shows loading state initially", () => {
    mockedApi.get.mockReturnValue(new Promise(() => {}));
    renderDetail("b-1");
    expect(screen.getByText(/Loading…/i)).toBeVisible();
  });
});
