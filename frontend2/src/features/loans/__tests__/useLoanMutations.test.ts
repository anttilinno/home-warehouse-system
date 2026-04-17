import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import type { ReactNode } from "react";
import React from "react";

// Lingui — load + activate once per test process. Matches pattern in
// `src/features/items/__tests__/useItemMutations.test.ts`.
i18n.load("en", {});
i18n.activate("en");

// Auth mock — hooks read workspaceId from useAuth()
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

// Hoist mock fns so vi.mock factories can reference them (vi.mock is hoisted
// above the imports).
const { addToast, loansApiMock } = vi.hoisted(() => ({
  addToast: vi.fn(),
  loansApiMock: {
    create: vi.fn(),
    update: vi.fn(),
    return: vi.fn(),
  },
}));

vi.mock("@/components/retro", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/retro")>();
  return { ...actual, useToast: () => ({ addToast }) };
});

vi.mock("@/lib/api/loans", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/loans")>();
  return {
    ...actual,
    loansApi: { ...actual.loansApi, ...loansApiMock },
  };
});

import {
  useCreateLoan,
  useUpdateLoan,
  useReturnLoan,
} from "../hooks/useLoanMutations";
import { HttpError } from "@/lib/api";
import { loanKeys } from "@/lib/api/loans";
import { itemKeys } from "@/lib/api/items";
import { borrowerKeys } from "@/lib/api/borrowers";
import { makeLoan } from "./fixtures";

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
  const Wrapper = ({ children }: { children: ReactNode }) =>
    React.createElement(
      I18nProvider,
      { i18n },
      React.createElement(QueryClientProvider, { client: qc }, children),
    );
  return { Wrapper, invalidateSpy };
}

beforeEach(() => {
  addToast.mockReset();
  Object.values(loansApiMock).forEach((fn) => fn.mockReset());
});

describe("useCreateLoan", () => {
  it("invalidates loanKeys.all + itemKeys.detail + borrowerKeys.detail + list keys on success", async () => {
    const { Wrapper, invalidateSpy } = makeWrapper();
    const loan = makeLoan({ inventory_id: "inv-A", borrower_id: "bor-B" });
    loansApiMock.create.mockResolvedValue(loan);
    const { result } = renderHook(() => useCreateLoan(), { wrapper: Wrapper });
    await act(async () => {
      await result.current.mutateAsync({
        inventory_id: "inv-A",
        borrower_id: "bor-B",
        quantity: 1,
      });
    });
    // All 5 invalidation sets fired
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: loanKeys.all });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: itemKeys.detail("inv-A"),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: borrowerKeys.detail("bor-B"),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: itemKeys.lists() });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: borrowerKeys.lists(),
    });
    expect(addToast).toHaveBeenCalledWith(
      expect.stringContaining("created"),
      "success",
    );
  });

  it("fires specific toast on 400 'already has an active loan'", async () => {
    const { Wrapper } = makeWrapper();
    loansApiMock.create.mockRejectedValue(
      new HttpError(400, "inventory already has an active loan"),
    );
    const { result } = renderHook(() => useCreateLoan(), { wrapper: Wrapper });
    await act(async () => {
      try {
        await result.current.mutateAsync({
          inventory_id: "x",
          borrower_id: "y",
          quantity: 1,
        });
      } catch {
        /* expected */
      }
    });
    expect(addToast).toHaveBeenCalledWith(
      expect.stringMatching(/already on loan/i),
      "error",
    );
  });

  it("fires specific toast on 400 'is not available'", async () => {
    const { Wrapper } = makeWrapper();
    loansApiMock.create.mockRejectedValue(
      new HttpError(400, "inventory is not available for loan"),
    );
    const { result } = renderHook(() => useCreateLoan(), { wrapper: Wrapper });
    await act(async () => {
      try {
        await result.current.mutateAsync({
          inventory_id: "x",
          borrower_id: "y",
          quantity: 1,
        });
      } catch {
        /* expected */
      }
    });
    expect(addToast).toHaveBeenCalledWith(
      expect.stringMatching(/not available/i),
      "error",
    );
  });

  it("fires specific toast on 400 'exceeds available quantity'", async () => {
    const { Wrapper } = makeWrapper();
    loansApiMock.create.mockRejectedValue(
      new HttpError(400, "requested quantity exceeds available quantity"),
    );
    const { result } = renderHook(() => useCreateLoan(), { wrapper: Wrapper });
    await act(async () => {
      try {
        await result.current.mutateAsync({
          inventory_id: "x",
          borrower_id: "y",
          quantity: 99,
        });
      } catch {
        /* expected */
      }
    });
    expect(addToast).toHaveBeenCalledWith(
      expect.stringMatching(/not enough/i),
      "error",
    );
  });

  it("falls back to generic toast on non-400 errors", async () => {
    const { Wrapper } = makeWrapper();
    loansApiMock.create.mockRejectedValue(new Error("network boom"));
    const { result } = renderHook(() => useCreateLoan(), { wrapper: Wrapper });
    await act(async () => {
      try {
        await result.current.mutateAsync({
          inventory_id: "x",
          borrower_id: "y",
          quantity: 1,
        });
      } catch {
        /* expected */
      }
    });
    expect(addToast).toHaveBeenCalledWith(
      expect.stringMatching(/could not create loan/i),
      "error",
    );
  });
});

describe("useUpdateLoan", () => {
  it("invalidates loanKeys.all ONLY on success (no item/borrower detail invalidation)", async () => {
    const { Wrapper, invalidateSpy } = makeWrapper();
    loansApiMock.update.mockResolvedValue(makeLoan());
    const { result } = renderHook(() => useUpdateLoan(), { wrapper: Wrapper });
    await act(async () => {
      await result.current.mutateAsync({ id: "loan-1", input: { notes: "x" } });
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: loanKeys.all });
    // explicitly NOT itemKeys / borrowerKeys — see UI-SPEC Interaction Contracts
    const keys = invalidateSpy.mock.calls.map((c) => c[0]?.queryKey);
    const stringified = keys.map((k) => JSON.stringify(k));
    expect(stringified.some((s) => s?.includes('"items"'))).toBe(false);
    expect(stringified.some((s) => s?.includes('"borrowers"'))).toBe(false);
    expect(addToast).toHaveBeenCalledWith(
      expect.stringMatching(/updated/i),
      "success",
    );
  });

  it("fires specific toast on 400 'cannot edit returned'", async () => {
    const { Wrapper } = makeWrapper();
    loansApiMock.update.mockRejectedValue(
      new HttpError(400, "cannot edit returned loan"),
    );
    const { result } = renderHook(() => useUpdateLoan(), { wrapper: Wrapper });
    await act(async () => {
      try {
        await result.current.mutateAsync({
          id: "loan-1",
          input: { notes: "x" },
        });
      } catch {
        /* expected */
      }
    });
    expect(addToast).toHaveBeenCalledWith(
      expect.stringMatching(/already been returned/i),
      "error",
    );
  });

  it("fires specific toast on 400 'must be after loaned date'", async () => {
    const { Wrapper } = makeWrapper();
    loansApiMock.update.mockRejectedValue(
      new HttpError(400, "due date must be after loaned date"),
    );
    const { result } = renderHook(() => useUpdateLoan(), { wrapper: Wrapper });
    await act(async () => {
      try {
        await result.current.mutateAsync({
          id: "loan-1",
          input: { due_date: "2020-01-01" },
        });
      } catch {
        /* expected */
      }
    });
    expect(addToast).toHaveBeenCalledWith(
      expect.stringMatching(/can't be before/i),
      "error",
    );
  });

  it("falls back to generic toast on non-400 errors", async () => {
    const { Wrapper } = makeWrapper();
    loansApiMock.update.mockRejectedValue(new Error("network boom"));
    const { result } = renderHook(() => useUpdateLoan(), { wrapper: Wrapper });
    await act(async () => {
      try {
        await result.current.mutateAsync({
          id: "loan-1",
          input: { notes: "x" },
        });
      } catch {
        /* expected */
      }
    });
    expect(addToast).toHaveBeenCalledWith(
      expect.stringMatching(/could not update loan/i),
      "error",
    );
  });
});

describe("useReturnLoan", () => {
  it("invalidates loanKeys.all + loanKeys.detail(id) + itemKeys.detail(inv) + borrowerKeys.detail(bor) on success", async () => {
    const { Wrapper, invalidateSpy } = makeWrapper();
    loansApiMock.return.mockResolvedValue(undefined);
    const { result } = renderHook(() => useReturnLoan(), { wrapper: Wrapper });
    await act(async () => {
      await result.current.mutateAsync({
        id: "loan-1",
        inventoryId: "inv-A",
        borrowerId: "bor-B",
      });
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: loanKeys.all });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: loanKeys.detail("loan-1"),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: itemKeys.detail("inv-A"),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: borrowerKeys.detail("bor-B"),
    });
    expect(addToast).toHaveBeenCalledWith(
      expect.stringMatching(/returned/i),
      "success",
    );
  });

  it("fires specific toast on 400 'already been returned'", async () => {
    const { Wrapper } = makeWrapper();
    loansApiMock.return.mockRejectedValue(
      new HttpError(400, "loan has already been returned"),
    );
    const { result } = renderHook(() => useReturnLoan(), { wrapper: Wrapper });
    await act(async () => {
      try {
        await result.current.mutateAsync({
          id: "loan-1",
          inventoryId: "inv-A",
          borrowerId: "bor-B",
        });
      } catch {
        /* expected */
      }
    });
    expect(addToast).toHaveBeenCalledWith(
      expect.stringMatching(/already been returned/i),
      "error",
    );
  });

  it("falls back to generic toast on non-400 errors", async () => {
    const { Wrapper } = makeWrapper();
    loansApiMock.return.mockRejectedValue(new Error("network boom"));
    const { result } = renderHook(() => useReturnLoan(), { wrapper: Wrapper });
    await act(async () => {
      try {
        await result.current.mutateAsync({
          id: "loan-1",
          inventoryId: "inv-A",
          borrowerId: "bor-B",
        });
      } catch {
        /* expected */
      }
    });
    expect(addToast).toHaveBeenCalledWith(
      expect.stringMatching(/could not return loan/i),
      "error",
    );
  });
});
