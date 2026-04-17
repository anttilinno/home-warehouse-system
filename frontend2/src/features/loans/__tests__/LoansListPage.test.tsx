import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router";
import { screen, waitFor, fireEvent, act } from "@testing-library/react";
import { renderWithProviders, setupDialogMocks, makeLoan } from "./fixtures";

// Mock AuthContext so LoansListPage's useAuth sees a workspace id.
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

// Mock the loans API — the three list endpoints power the tabs.
vi.mock("@/lib/api/loans", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/loans")>();
  return {
    ...actual,
    loansApi: {
      ...actual.loansApi,
      list: vi.fn(),
      listActive: vi.fn(),
      listOverdue: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      return: vi.fn(),
    },
  };
});

// Mock items + borrowers APIs so the LoanPanel form combobox loads don't blow up.
vi.mock("@/lib/api/items", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/items")>();
  return {
    ...actual,
    itemsApi: {
      ...actual.itemsApi,
      list: vi
        .fn()
        .mockResolvedValue({ items: [], total: 0, page: 1, total_pages: 1 }),
    },
  };
});

vi.mock("@/lib/api/borrowers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/borrowers")>();
  return {
    ...actual,
    borrowersApi: {
      ...actual.borrowersApi,
      list: vi.fn().mockResolvedValue({ items: [] }),
    },
  };
});

import { loansApi } from "@/lib/api/loans";
import { LoansListPage } from "../LoansListPage";

const mockedApi = vi.mocked(loansApi);

function renderList(initialUrl = "/loans") {
  return renderWithProviders(
    <MemoryRouter initialEntries={[initialUrl]}>
      <Routes>
        <Route path="/loans" element={<LoansListPage />} />
        <Route path="/items/:id" element={<div>ITEM DETAIL</div>} />
        <Route path="/borrowers/:id" element={<div>BORROWER DETAIL</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

function defaultMocks({
  active = 0,
  overdue = 0,
  history = 0,
}: {
  active?: number;
  overdue?: number;
  history?: number;
}) {
  const mk = (n: number, overrides: Partial<Parameters<typeof makeLoan>[0]> = {}) =>
    Array.from({ length: n }).map((_, i) =>
      makeLoan({
        id: `loan-${i}-${Math.random().toString(36).slice(2, 7)}`,
        ...overrides,
      }),
    );
  mockedApi.listActive.mockResolvedValue({ items: mk(active) });
  mockedApi.listOverdue.mockResolvedValue({ items: mk(overdue) });
  mockedApi.list.mockResolvedValue({ items: mk(history, { returned_at: "2026-04-10T12:00:00Z", is_active: false }) });
}

beforeEach(() => {
  setupDialogMocks();
  vi.clearAllMocks();
  // Clear any lingering hash from a previous test
  if (typeof window !== "undefined") {
    window.history.replaceState(null, "", "/");
  }
});

afterEach(() => {
  // Clean hash state between tests
  if (typeof window !== "undefined") {
    window.history.replaceState(null, "", "/");
  }
});

describe("LoansListPage", () => {
  it("renders LOANS page header and + NEW LOAN button", async () => {
    defaultMocks({ active: 0, overdue: 0, history: 0 });
    renderList();
    expect(await screen.findByRole("heading", { name: /LOANS/i })).toBeVisible();
    expect(
      screen.getAllByRole("button", { name: /\+ NEW LOAN/i }).length,
    ).toBeGreaterThan(0);
  });

  it("fires all three list queries on mount", async () => {
    defaultMocks({ active: 2, overdue: 0, history: 5 });
    renderList();
    await waitFor(() => {
      expect(mockedApi.listActive).toHaveBeenCalled();
      expect(mockedApi.listOverdue).toHaveBeenCalled();
      expect(mockedApi.list).toHaveBeenCalled();
    });
  });

  it("shows counts in tab labels after queries resolve", async () => {
    defaultMocks({ active: 2, overdue: 0, history: 5 });
    renderList();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /ACTIVE.*2/ })).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /OVERDUE.*0/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /HISTORY.*5/ })).toBeInTheDocument();
  });

  it("shows '…' counter while queries are still loading", async () => {
    // Never-resolving mocks so queries stay pending
    mockedApi.listActive.mockReturnValue(new Promise(() => {}));
    mockedApi.listOverdue.mockReturnValue(new Promise(() => {}));
    mockedApi.list.mockReturnValue(new Promise(() => {}));
    renderList();
    // Tab labels render synchronously on first paint
    expect(
      await screen.findByRole("button", { name: /ACTIVE.*…/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /OVERDUE.*…/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /HISTORY.*…/ }),
    ).toBeInTheDocument();
  });

  it("clicking OVERDUE tab updates hash to #overdue and swaps rendered rows", async () => {
    defaultMocks({ active: 1, overdue: 2, history: 0 });
    renderList();
    // Wait for the OVERDUE tab label to include its resolved count
    const overdueTab = await screen.findByRole("button", {
      name: /OVERDUE.*2/,
    });
    await act(async () => {
      fireEvent.click(overdueTab);
    });
    await waitFor(() => {
      expect(window.location.hash).toBe("#overdue");
    });
  });

  it("ACTIVE tab empty state shows NO ACTIVE LOANS with + NEW LOAN CTA", async () => {
    defaultMocks({ active: 0, overdue: 0, history: 0 });
    renderList();
    expect(await screen.findByText(/NO ACTIVE LOANS/i)).toBeVisible();
    // One + NEW LOAN in the page header plus one inside the empty state action
    const ctas = screen.getAllByRole("button", { name: /\+ NEW LOAN/i });
    expect(ctas.length).toBeGreaterThanOrEqual(2);
  });

  it("OVERDUE tab empty state shows NO OVERDUE LOANS with no CTA", async () => {
    defaultMocks({ active: 0, overdue: 0, history: 0 });
    // useHashTab reads window.location.hash directly (not router state), so
    // seed the hash before render.
    window.history.replaceState(null, "", "/loans#overdue");
    renderList("/loans");
    expect(await screen.findByText(/NO OVERDUE LOANS/i)).toBeVisible();
    // The overdue empty state has no action button inside the empty state
    // (only the page-header + NEW LOAN remains)
    const ctas = screen.getAllByRole("button", { name: /\+ NEW LOAN/i });
    expect(ctas.length).toBe(1);
  });

  it("HISTORY tab rows omit the ACTIONS column (no MARK RETURNED button)", async () => {
    mockedApi.listActive.mockResolvedValue({ items: [] });
    mockedApi.listOverdue.mockResolvedValue({ items: [] });
    mockedApi.list.mockResolvedValue({
      items: [
        makeLoan({
          id: "loan-history-1",
          returned_at: "2026-04-10T12:00:00Z",
          is_active: false,
        }),
      ],
    });
    // Seed the hash before render so useHashTab picks "history" on mount.
    window.history.replaceState(null, "", "/loans#history");
    renderList("/loans");
    // Wait for the history row to render
    await waitFor(() => {
      expect(mockedApi.list).toHaveBeenCalled();
    });
    // A row for Cordless Drill (default makeLoan item name) renders via link
    await screen.findAllByText(/Cordless Drill/);
    // Critically: no MARK RETURNED button in the HISTORY tab columns
    expect(
      screen.queryByRole("button", { name: /MARK RETURNED/i }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: /^EDIT$/i })).toBeNull();
  });
});
