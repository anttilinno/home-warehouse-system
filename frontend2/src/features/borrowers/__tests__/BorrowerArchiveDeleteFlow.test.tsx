import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRef } from "react";
import { screen, fireEvent, waitFor, act } from "@testing-library/react";
import { renderWithProviders, setupDialogMocks } from "./fixtures";
import {
  BorrowerArchiveDeleteFlow,
  type BorrowerArchiveDeleteFlowHandle,
} from "../actions/BorrowerArchiveDeleteFlow";
import { HttpError } from "@/lib/api";

function dialogContaining(text: string): HTMLDialogElement | null {
  const nodes = screen.queryAllByText(text);
  for (const n of nodes) {
    const d = n.closest("dialog") as HTMLDialogElement | null;
    if (d) return d;
  }
  return null;
}
function isVisibleDialog(text: string): boolean {
  const d = dialogContaining(text);
  return !!d && d.hasAttribute("open");
}

describe("BorrowerArchiveDeleteFlow", () => {
  beforeEach(() => {
    setupDialogMocks();
    vi.clearAllMocks();
  });

  it("open() shows CONFIRM ARCHIVE dialog with ARCHIVE BORROWER button", () => {
    const ref = createRef<BorrowerArchiveDeleteFlowHandle>();
    renderWithProviders(
      <BorrowerArchiveDeleteFlow
        ref={ref}
        nodeName="Alice"
        onArchive={vi.fn().mockResolvedValue(undefined)}
        onDelete={vi.fn().mockResolvedValue(undefined)}
      />,
    );
    act(() => {
      ref.current!.open();
    });
    expect(isVisibleDialog("CONFIRM ARCHIVE")).toBe(true);
    expect(
      screen.getByRole("button", { name: /archive borrower/i }),
    ).toBeInTheDocument();
    // soft-variant header badge renders
    expect(screen.getByText(/HIDES FROM LOAN PICKERS/i)).toBeInTheDocument();
  });

  it("primary ARCHIVE BORROWER calls onArchive and closes dialog on success", async () => {
    const onArchive = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn();
    const ref = createRef<BorrowerArchiveDeleteFlowHandle>();
    renderWithProviders(
      <BorrowerArchiveDeleteFlow
        ref={ref}
        nodeName="Alice"
        onArchive={onArchive}
        onDelete={onDelete}
      />,
    );
    act(() => {
      ref.current!.open();
    });
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /archive borrower/i }),
      );
    });
    expect(onArchive).toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(isVisibleDialog("CONFIRM ARCHIVE")).toBe(false);
    });
  });

  it("secondary 'delete permanently' link switches to hard-delete dialog", async () => {
    const ref = createRef<BorrowerArchiveDeleteFlowHandle>();
    renderWithProviders(
      <BorrowerArchiveDeleteFlow
        ref={ref}
        nodeName="Alice"
        onArchive={vi.fn().mockResolvedValue(undefined)}
        onDelete={vi.fn().mockResolvedValue(undefined)}
      />,
    );
    act(() => {
      ref.current!.open();
    });
    expect(isVisibleDialog("CONFIRM ARCHIVE")).toBe(true);
    await act(async () => {
      fireEvent.click(screen.getByText("delete permanently"));
    });
    await waitFor(() => {
      expect(isVisibleDialog("CONFIRM DELETE")).toBe(true);
    });
    expect(isVisibleDialog("CONFIRM ARCHIVE")).toBe(false);
  });

  it("clicking DELETE BORROWER calls onDelete then closes the delete dialog", async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    const ref = createRef<BorrowerArchiveDeleteFlowHandle>();
    renderWithProviders(
      <BorrowerArchiveDeleteFlow
        ref={ref}
        nodeName="Alice"
        onArchive={vi.fn().mockResolvedValue(undefined)}
        onDelete={onDelete}
      />,
    );
    act(() => {
      ref.current!.open();
    });
    await act(async () => {
      fireEvent.click(screen.getByText("delete permanently"));
    });
    await waitFor(() => {
      expect(isVisibleDialog("CONFIRM DELETE")).toBe(true);
    });
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /^delete borrower$/i }),
      );
    });
    expect(onDelete).toHaveBeenCalled();
    await waitFor(() => {
      expect(isVisibleDialog("CONFIRM DELETE")).toBe(false);
    });
  });

  it("HttpError 400 from onDelete closes both dialogs (active-loans short-circuit)", async () => {
    const onDelete = vi
      .fn()
      .mockRejectedValue(new HttpError(400, "cannot delete borrower with active loans"));
    const ref = createRef<BorrowerArchiveDeleteFlowHandle>();
    renderWithProviders(
      <BorrowerArchiveDeleteFlow
        ref={ref}
        nodeName="Alice"
        onArchive={vi.fn().mockResolvedValue(undefined)}
        onDelete={onDelete}
      />,
    );
    act(() => {
      ref.current!.open();
    });
    await act(async () => {
      fireEvent.click(screen.getByText("delete permanently"));
    });
    await waitFor(() => {
      expect(isVisibleDialog("CONFIRM DELETE")).toBe(true);
    });
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /^delete borrower$/i }),
      );
    });
    expect(onDelete).toHaveBeenCalled();
    // both dialogs closed
    await waitFor(() => {
      expect(isVisibleDialog("CONFIRM DELETE")).toBe(false);
    });
    expect(isVisibleDialog("CONFIRM ARCHIVE")).toBe(false);
  });

  it("non-HTTP error on delete is swallowed (no unhandled rejection); hook toast conveys the failure", async () => {
    // Deviation from plan spec: the plan described "dialog stays open on non-HTTP
    // errors", but RetroConfirmDialog.handleConfirm rethrows any onConfirm rejection,
    // creating an unhandled promise rejection in production. To avoid that UX hazard
    // we swallow non-HTTP errors (matching taxonomy/ArchiveDeleteFlow). The useDeleteBorrower
    // hook still fires the connection-lost toast. This test documents the current
    // contract: onDelete is called, the Error does NOT propagate, and Vitest sees no
    // unhandled rejection.
    const onDelete = vi.fn().mockRejectedValue(new Error("network boom"));
    const ref = createRef<BorrowerArchiveDeleteFlowHandle>();
    renderWithProviders(
      <BorrowerArchiveDeleteFlow
        ref={ref}
        nodeName="Alice"
        onArchive={vi.fn().mockResolvedValue(undefined)}
        onDelete={onDelete}
      />,
    );
    act(() => {
      ref.current!.open();
    });
    await act(async () => {
      fireEvent.click(screen.getByText("delete permanently"));
    });
    await waitFor(() => {
      expect(isVisibleDialog("CONFIRM DELETE")).toBe(true);
    });
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /^delete borrower$/i }),
      );
    });
    expect(onDelete).toHaveBeenCalled();
    // Dialog closes because handleDelete resolved (error caught, not rethrown).
    // (Design parity with ArchiveDeleteFlow in taxonomy.)
    await waitFor(() => {
      expect(isVisibleDialog("CONFIRM DELETE")).toBe(false);
    });
  });
});
