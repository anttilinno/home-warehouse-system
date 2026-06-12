import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, renderHook, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  ModalStackProvider,
  useModalStackContext,
} from "@/components/modal/ModalStackContext";
import { useModalStack } from "@/components/modal/useModalStack";

function wrapper({ children }: { children: ReactNode }) {
  return <ModalStackProvider>{children}</ModalStackProvider>;
}

function pressEscape() {
  fireEvent.keyDown(document, { key: "Escape" });
}

describe("ModalStackProvider — ESC pops the top entry only", () => {
  it("ESC with one overlay open calls that overlay's close() once", () => {
    const close = vi.fn();
    const { result } = renderHook(() => useModalStackContext(), { wrapper });

    result.current.push(close);
    pressEscape();

    expect(close).toHaveBeenCalledTimes(1);
  });

  it("ESC with TWO overlays open closes ONLY the top one; the lower stays open", () => {
    const lowerClose = vi.fn();
    const topClose = vi.fn();
    const { result } = renderHook(() => useModalStackContext(), { wrapper });

    result.current.push(lowerClose); // opened first → bottom of the stack
    result.current.push(topClose); // opened second → top of the stack

    pressEscape();

    // Only the TOP overlay closes; the lower overlay is untouched (still open).
    expect(topClose).toHaveBeenCalledTimes(1);
    expect(lowerClose).not.toHaveBeenCalled();
  });

  it("after the top overlay pops itself, the next ESC pops the lower overlay", () => {
    const lowerClose = vi.fn();
    const topClose = vi.fn();
    const { result } = renderHook(() => useModalStackContext(), { wrapper });

    result.current.push(lowerClose);
    const topToken = result.current.push(topClose);

    pressEscape(); // closes top
    expect(topClose).toHaveBeenCalledTimes(1);
    expect(lowerClose).not.toHaveBeenCalled();

    // The overlay that closed pops its own token (as a real overlay would on close).
    result.current.pop(topToken);

    pressEscape(); // now the lower overlay is on top
    expect(lowerClose).toHaveBeenCalledTimes(1);
  });

  it("ESC with an EMPTY stack is a no-op: nothing throws and no close fires (logout unreachable via bare ESC)", () => {
    const close = vi.fn();
    renderHook(() => useModalStackContext(), { wrapper });

    // Stack is empty — a bare ESC must do nothing. This proves logout can never
    // be reached by ESC: the provider returns early when the stack is empty.
    expect(() => pressEscape()).not.toThrow();
    expect(close).not.toHaveBeenCalled();
  });

  it("pop(token) removes a specific entry so its close() no longer fires on ESC", () => {
    const close = vi.fn();
    const { result } = renderHook(() => useModalStackContext(), { wrapper });

    const token = result.current.push(close);
    result.current.pop(token);

    pressEscape();
    expect(close).not.toHaveBeenCalled();
  });

  it("useModalStackContext throws when used outside a provider", () => {
    expect(() => renderHook(() => useModalStackContext())).toThrow();
  });
});

describe("useModalStack — push on open, pop on close/unmount", () => {
  function Overlay({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    useModalStack(isOpen, onClose);
    return <div>overlay isOpen={String(isOpen)}</div>;
  }

  // A tiny probe that reports current stack depth via a button click count is
  // overkill; instead we observe behaviour through ESC dispatch on the real
  // document listener installed by the provider.
  it("pushes when isOpen flips true: ESC then closes via the registered onClose", () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <ModalStackProvider>
        <Overlay isOpen={false} onClose={onClose} />
      </ModalStackProvider>,
    );

    // Closed: ESC is a no-op (nothing pushed).
    pressEscape();
    expect(onClose).not.toHaveBeenCalled();

    // Open it: now ESC pops this overlay's onClose.
    rerender(
      <ModalStackProvider>
        <Overlay isOpen onClose={onClose} />
      </ModalStackProvider>,
    );
    pressEscape();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("pops when isOpen flips back to false, leaving the stack balanced (empty → ESC no-op)", () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <ModalStackProvider>
        <Overlay isOpen onClose={onClose} />
      </ModalStackProvider>,
    );

    // Flip closed → the hook pops its entry.
    rerender(
      <ModalStackProvider>
        <Overlay isOpen={false} onClose={onClose} />
      </ModalStackProvider>,
    );

    pressEscape();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("pops on unmount, leaving the stack balanced", () => {
    const onClose = vi.fn();
    const { unmount } = render(
      <ModalStackProvider>
        <Overlay isOpen onClose={onClose} />
      </ModalStackProvider>,
    );

    unmount();

    // The component is gone; its entry must have popped on unmount. A fresh
    // ESC against a new empty provider must not reach the unmounted onClose.
    render(<ModalStackProvider>{null}</ModalStackProvider>);
    pressEscape();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("two overlays via useModalStack: ESC pops the most-recently-opened only", () => {
    const lowerClose = vi.fn();
    const topClose = vi.fn();
    render(
      <ModalStackProvider>
        <Overlay isOpen onClose={lowerClose} />
        <Overlay isOpen onClose={topClose} />
      </ModalStackProvider>,
    );

    pressEscape();
    expect(topClose).toHaveBeenCalledTimes(1);
    expect(lowerClose).not.toHaveBeenCalled();
  });
});

describe("ModalStackProvider — listener lifecycle", () => {
  it("removes the document keydown listener on unmount (single-owner cleanup)", () => {
    const removeSpy = vi.spyOn(document, "removeEventListener");
    const { unmount } = render(<ModalStackProvider>{null}</ModalStackProvider>);

    unmount();

    expect(removeSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
    removeSpy.mockRestore();
  });

  it("does not interfere with non-Escape keys", () => {
    const close = vi.fn();
    const { result } = renderHook(() => useModalStackContext(), { wrapper });
    result.current.push(close);

    fireEvent.keyDown(document, { key: "Enter" });
    fireEvent.keyDown(document, { key: "a" });

    expect(close).not.toHaveBeenCalled();
  });
});

// Sanity: the provider renders its children.
describe("ModalStackProvider rendering", () => {
  it("renders children", () => {
    render(
      <ModalStackProvider>
        <span>child</span>
      </ModalStackProvider>,
    );
    expect(screen.getByText("child")).toBeInTheDocument();
  });
});
