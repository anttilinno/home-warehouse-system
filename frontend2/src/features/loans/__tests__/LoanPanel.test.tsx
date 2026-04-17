import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRef } from "react";
import { screen, fireEvent, waitFor, act } from "@testing-library/react";
import { renderWithProviders, setupDialogMocks, makeLoan } from "./fixtures";
import { HttpError } from "@/lib/api";

// Mock AuthContext so the mutation hooks + LoanForm see a workspace id.
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

// Mock the loans API — spies on create/update.
vi.mock("@/lib/api/loans", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/loans")>();
  return {
    ...actual,
    loansApi: {
      ...actual.loansApi,
      create: vi.fn(),
      update: vi.fn(),
      return: vi.fn(),
    },
  };
});

// Mock items + borrowers APIs so LoanForm's create-mode combobox loads resolve.
vi.mock("@/lib/api/items", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/items")>();
  return {
    ...actual,
    itemsApi: {
      ...actual.itemsApi,
      list: vi.fn().mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        total_pages: 1,
      }),
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
import { LoanPanel, type LoanPanelHandle } from "../panel/LoanPanel";

const mockedApi = vi.mocked(loansApi);

describe("LoanPanel", () => {
  beforeEach(() => {
    setupDialogMocks();
    vi.clearAllMocks();
  });

  it("open('create') renders NEW LOAN title and CREATE LOAN submit button", async () => {
    const ref = createRef<LoanPanelHandle>();
    renderWithProviders(<LoanPanel ref={ref} />);
    act(() => {
      ref.current!.open("create");
    });
    expect(await screen.findByText(/NEW LOAN/i)).toBeVisible();
    expect(
      screen.getByRole("button", { name: /CREATE LOAN/i }),
    ).toBeInTheDocument();
  });

  it("open('edit', loan) renders EDIT LOAN title, SAVE LOAN submit, and LOAN DETAILS (LOCKED) with item + borrower names", async () => {
    const ref = createRef<LoanPanelHandle>();
    renderWithProviders(<LoanPanel ref={ref} />);
    const loan = makeLoan({
      item: {
        id: "11111111-1111-1111-1111-111111111111",
        name: "Cordless Drill",
        primary_photo_thumbnail_url: null,
      },
      borrower: {
        id: "44444444-4444-4444-4444-444444444444",
        name: "Alice Example",
      },
    });
    act(() => {
      ref.current!.open("edit", loan);
    });
    expect(await screen.findByText(/EDIT LOAN/i)).toBeVisible();
    expect(
      screen.getByRole("button", { name: /SAVE LOAN/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/LOAN DETAILS \(LOCKED\)/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Cordless Drill")).toBeInTheDocument();
    expect(screen.getByText("Alice Example")).toBeInTheDocument();
  });

  it("successful edit-mode save closes the panel and calls loansApi.update with due_date+notes", async () => {
    const loan = makeLoan({ id: "loan-1", loaned_at: "2026-04-15T00:00:00Z" });
    mockedApi.update.mockResolvedValueOnce(loan);

    const ref = createRef<LoanPanelHandle>();
    renderWithProviders(<LoanPanel ref={ref} />);
    act(() => {
      ref.current!.open("edit", loan);
    });
    const notesInput = await screen.findByLabelText(/notes/i);
    fireEvent.change(notesInput, { target: { value: "Delivered to porch" } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /SAVE LOAN/i }));
    });

    await waitFor(() =>
      expect(mockedApi.update).toHaveBeenCalledWith(
        expect.any(String),
        "loan-1",
        expect.objectContaining({ notes: "Delivered to porch" }),
      ),
    );
    // Panel closes after mutation resolves
    await waitFor(() => {
      expect(screen.queryByText(/EDIT LOAN/i)).not.toBeInTheDocument();
    });
  });

  it("400 error on update keeps panel open for retry", async () => {
    mockedApi.update.mockRejectedValueOnce(
      new HttpError(400, "cannot edit returned loan"),
    );
    const ref = createRef<LoanPanelHandle>();
    renderWithProviders(<LoanPanel ref={ref} />);
    const loan = makeLoan({ id: "loan-x" });
    act(() => {
      ref.current!.open("edit", loan);
    });
    const notesInput = await screen.findByLabelText(/notes/i);
    fireEvent.change(notesInput, { target: { value: "anything" } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /SAVE LOAN/i }));
    });

    await waitFor(() => expect(mockedApi.update).toHaveBeenCalled());
    // Panel still open (title still visible)
    expect(screen.getByText(/EDIT LOAN/i)).toBeVisible();
  });
});
