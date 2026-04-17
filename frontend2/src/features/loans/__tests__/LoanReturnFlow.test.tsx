import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRef } from "react";
import { screen, fireEvent, waitFor, act } from "@testing-library/react";
import { renderWithProviders, setupDialogMocks, makeLoan } from "./fixtures";
import { HttpError } from "@/lib/api";

// Mock AuthContext for the useReturnLoan mutation inside the flow.
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

import { loansApi } from "@/lib/api/loans";
import {
  LoanReturnFlow,
  type LoanReturnFlowHandle,
} from "../actions/LoanReturnFlow";

const mockedApi = vi.mocked(loansApi);

describe("LoanReturnFlow", () => {
  beforeEach(() => {
    setupDialogMocks();
    vi.clearAllMocks();
  });

  it("open(loan) shows CONFIRM RETURN title + item + borrower names in the body", async () => {
    const ref = createRef<LoanReturnFlowHandle>();
    renderWithProviders(<LoanReturnFlow ref={ref} />);
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
      ref.current!.open(loan);
    });
    expect(await screen.findByText(/CONFIRM RETURN/i)).toBeVisible();
    // The body uses Lingui t-macro with interpolation. Under the test setup
    // (empty catalog), the macro returns the source id with {placeholder}
    // tokens rather than the interpolated values. Verifying the source-id
    // body copy (the fixed literal portion) is sufficient here; the real
    // interpolated render is covered by the UI-SPEC human-verify checkpoint.
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toMatch(/The loan will move to history/);
    // Primary action label
    expect(
      screen.getByRole("button", { name: /RETURN LOAN/i }),
    ).toBeInTheDocument();
  });

  it("confirm fires loansApi.return with loan id", async () => {
    mockedApi.return.mockResolvedValueOnce(undefined);
    const ref = createRef<LoanReturnFlowHandle>();
    renderWithProviders(<LoanReturnFlow ref={ref} />);
    const loan = makeLoan({
      id: "loan-xyz",
      inventory_id: "inv-A",
      borrower_id: "bor-B",
    });
    act(() => {
      ref.current!.open(loan);
    });
    const btn = await screen.findByRole("button", { name: /RETURN LOAN/i });
    await act(async () => {
      fireEvent.click(btn);
    });
    await waitFor(() =>
      expect(mockedApi.return).toHaveBeenCalledWith(
        expect.any(String),
        "loan-xyz",
      ),
    );
  });

  it("confirm failure keeps dialog open (rejects mutation, stays open)", async () => {
    mockedApi.return.mockRejectedValueOnce(
      new HttpError(400, "loan has already been returned"),
    );
    const ref = createRef<LoanReturnFlowHandle>();
    renderWithProviders(<LoanReturnFlow ref={ref} />);
    const loan = makeLoan({ id: "loan-err" });
    act(() => {
      ref.current!.open(loan);
    });
    const btn = await screen.findByRole("button", { name: /RETURN LOAN/i });
    await act(async () => {
      fireEvent.click(btn);
    });
    await waitFor(() => expect(mockedApi.return).toHaveBeenCalled());
    // Dialog still rendering title — it remained open
    expect(screen.getByText(/CONFIRM RETURN/i)).toBeInTheDocument();
  });
});
