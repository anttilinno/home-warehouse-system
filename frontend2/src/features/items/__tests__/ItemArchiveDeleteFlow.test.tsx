import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRef } from "react";
import { screen, fireEvent, waitFor, act } from "@testing-library/react";
import { renderWithProviders, setupDialogMocks } from "./fixtures";
import {
  ItemArchiveDeleteFlow,
  type ItemArchiveDeleteFlowHandle,
} from "../actions/ItemArchiveDeleteFlow";

function dialogContaining(text: string | RegExp): HTMLDialogElement | null {
  const nodes = screen.queryAllByText(text);
  for (const n of nodes) {
    const d = n.closest("dialog") as HTMLDialogElement | null;
    if (d) return d;
  }
  return null;
}
function isVisibleDialog(text: string | RegExp): boolean {
  const d = dialogContaining(text);
  return !!d && d.hasAttribute("open");
}

describe("ItemArchiveDeleteFlow", () => {
  beforeEach(() => {
    setupDialogMocks();
    vi.clearAllMocks();
  });

  it("open() shows the ARCHIVE ITEM dialog with HIDES FROM DEFAULT VIEW badge", () => {
    const ref = createRef<ItemArchiveDeleteFlowHandle>();
    renderWithProviders(
      <ItemArchiveDeleteFlow
        ref={ref}
        nodeName="Cordless Drill"
        onArchive={vi.fn().mockResolvedValue(undefined)}
        onDelete={vi.fn().mockResolvedValue(undefined)}
      />,
    );
    act(() => {
      ref.current!.open();
    });
    expect(isVisibleDialog(/ARCHIVE ITEM/)).toBe(true);
    expect(screen.getByText(/HIDES FROM DEFAULT VIEW/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^archive item$/i }),
    ).toBeInTheDocument();
  });

  it("archive confirm calls onArchive and closes dialog on success", async () => {
    const onArchive = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn();
    const ref = createRef<ItemArchiveDeleteFlowHandle>();
    renderWithProviders(
      <ItemArchiveDeleteFlow
        ref={ref}
        nodeName="Drill"
        onArchive={onArchive}
        onDelete={onDelete}
      />,
    );
    act(() => {
      ref.current!.open();
    });
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /^archive item$/i }),
      );
    });
    expect(onArchive).toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(isVisibleDialog(/ARCHIVE ITEM/)).toBe(false);
    });
  });

  it("'delete permanently' link switches to hard-delete dialog", async () => {
    const ref = createRef<ItemArchiveDeleteFlowHandle>();
    renderWithProviders(
      <ItemArchiveDeleteFlow
        ref={ref}
        nodeName="Drill"
        onArchive={vi.fn().mockResolvedValue(undefined)}
        onDelete={vi.fn().mockResolvedValue(undefined)}
      />,
    );
    act(() => {
      ref.current!.open();
    });
    expect(isVisibleDialog(/ARCHIVE ITEM/)).toBe(true);
    await act(async () => {
      fireEvent.click(screen.getByText("delete permanently"));
    });
    await waitFor(() => {
      expect(isVisibleDialog(/CONFIRM DELETE/)).toBe(true);
    });
    expect(isVisibleDialog(/ARCHIVE ITEM/)).toBe(false);
    // Hard-delete dialog escapeLabel is "KEEP ITEM" (terminal confirmation),
    // not "← BACK" (two-step continuation).
    expect(screen.getByText(/KEEP ITEM/i)).toBeInTheDocument();
  });

  it("hard-delete confirm calls onDelete and closes the delete dialog", async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    const ref = createRef<ItemArchiveDeleteFlowHandle>();
    renderWithProviders(
      <ItemArchiveDeleteFlow
        ref={ref}
        nodeName="Drill"
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
      expect(isVisibleDialog(/CONFIRM DELETE/)).toBe(true);
    });
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /^delete item$/i }),
      );
    });
    expect(onDelete).toHaveBeenCalled();
    await waitFor(() => {
      expect(isVisibleDialog(/CONFIRM DELETE/)).toBe(false);
    });
  });

  it("delete error has no 400 active-loans branch for items", async () => {
    // Items have no HasActiveLoans-style server guard (D-04), so the flow
    // does NOT short-circuit on HttpError.status === 400. onDelete is called
    // exactly once; mutation's onError toast surfaces any failure.
    const onDelete = vi.fn().mockRejectedValue(new Error("server error"));
    const ref = createRef<ItemArchiveDeleteFlowHandle>();
    renderWithProviders(
      <ItemArchiveDeleteFlow
        ref={ref}
        nodeName="Drill"
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
      expect(isVisibleDialog(/CONFIRM DELETE/)).toBe(true);
    });
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /^delete item$/i }),
      );
    });
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
