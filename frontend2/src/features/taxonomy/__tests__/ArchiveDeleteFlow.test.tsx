import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRef } from "react";
import { screen, fireEvent, waitFor, act } from "@testing-library/react";
import { renderWithProviders, setupDialogMocks } from "./fixtures";
import {
  ArchiveDeleteFlow,
  type ArchiveDeleteFlowHandle,
} from "../actions/ArchiveDeleteFlow";
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

describe("ArchiveDeleteFlow", () => {
  beforeEach(() => {
    setupDialogMocks();
    vi.clearAllMocks();
  });

  it("open() shows CONFIRM ARCHIVE dialog with archive button", () => {
    const ref = createRef<ArchiveDeleteFlowHandle>();
    renderWithProviders(
      <ArchiveDeleteFlow
        ref={ref}
        entityKind="category"
        nodeName="Tools"
        onArchive={vi.fn().mockResolvedValue(undefined)}
        onDelete={vi.fn().mockResolvedValue(undefined)}
      />,
    );
    act(() => {
      ref.current!.open();
    });
    expect(isVisibleDialog("CONFIRM ARCHIVE")).toBe(true);
    expect(
      screen.getByRole("button", { name: /archive category/i }),
    ).toBeInTheDocument();
  });

  it("clicking archive button calls onArchive then closes dialog", async () => {
    const onArchive = vi.fn().mockResolvedValue(undefined);
    const ref = createRef<ArchiveDeleteFlowHandle>();
    renderWithProviders(
      <ArchiveDeleteFlow
        ref={ref}
        entityKind="category"
        nodeName="Tools"
        onArchive={onArchive}
        onDelete={vi.fn().mockResolvedValue(undefined)}
      />,
    );
    act(() => {
      ref.current!.open();
    });
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /archive category/i }),
      );
    });
    expect(onArchive).toHaveBeenCalled();
    await waitFor(() => {
      expect(isVisibleDialog("CONFIRM ARCHIVE")).toBe(false);
    });
  });

  it("clicking 'delete permanently' closes archive and opens delete", async () => {
    const ref = createRef<ArchiveDeleteFlowHandle>();
    renderWithProviders(
      <ArchiveDeleteFlow
        ref={ref}
        entityKind="category"
        nodeName="Tools"
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

  it("clicking DELETE CATEGORY calls onDelete then closes", async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    const ref = createRef<ArchiveDeleteFlowHandle>();
    renderWithProviders(
      <ArchiveDeleteFlow
        ref={ref}
        entityKind="category"
        nodeName="Tools"
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
        screen.getByRole("button", { name: /^delete category$/i }),
      );
    });
    expect(onDelete).toHaveBeenCalled();
    await waitFor(() => {
      expect(isVisibleDialog("CONFIRM DELETE")).toBe(false);
    });
  });

  it("HttpError 409 from onDelete closes the delete dialog", async () => {
    const onDelete = vi
      .fn()
      .mockRejectedValue(new HttpError(409, "conflict"));
    const ref = createRef<ArchiveDeleteFlowHandle>();
    renderWithProviders(
      <ArchiveDeleteFlow
        ref={ref}
        entityKind="category"
        nodeName="Tools"
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
        screen.getByRole("button", { name: /^delete category$/i }),
      );
    });
    await waitFor(() => {
      expect(isVisibleDialog("CONFIRM DELETE")).toBe(false);
    });
    expect(onDelete).toHaveBeenCalled();
  });
});
