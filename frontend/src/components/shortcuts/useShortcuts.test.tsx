import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { type ReactNode } from "react";
import {
  ShortcutsProvider,
  useShortcutsContext,
  type Shortcut,
} from "./ShortcutsContext";
import { useShortcuts } from "./useShortcuts";

/** Renders the merged shortcut keys so tests can assert the registry contents. */
function MergedKeys() {
  const { shortcuts } = useShortcutsContext();
  return (
    <span data-testid="merged">{shortcuts.map((s) => s.key).join(",")}</span>
  );
}

/** A component that registers a group under a (stable) id. */
function Register({ id, bindings }: { id?: string; bindings: Shortcut[] }) {
  useShortcuts(id, bindings);
  return null;
}

const wrapper = (ui: ReactNode) =>
  render(<ShortcutsProvider>{ui}</ShortcutsProvider>);

function dispatchKey(
  key: string,
  target?: EventTarget,
  modifiers: Partial<KeyboardEventInit> = {},
) {
  const event = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
    ...modifiers,
  });
  if (target) {
    target.dispatchEvent(event);
  } else {
    document.dispatchEvent(event);
  }
  return event;
}

describe("useShortcuts / ShortcutsProvider", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("registers on mount and unregisters on unmount", () => {
    const bindings: Shortcut[] = [{ key: "N", label: "New", action: () => {} }];
    const { rerender } = wrapper(
      <>
        <Register id="items" bindings={bindings} />
        <MergedKeys />
      </>,
    );
    expect(screen.getByTestId("merged")).toHaveTextContent("N");

    // Unmount the registering component → merged list empties.
    rerender(
      <ShortcutsProvider>
        <MergedKeys />
      </ShortcutsProvider>,
    );
    // New provider instance: registry starts empty.
    expect(screen.getByTestId("merged")).toHaveTextContent("");
  });

  it("merges distinct ids into the union of all groups", () => {
    wrapper(
      <>
        <Register
          id="a"
          bindings={[{ key: "N", label: "New", action: () => {} }]}
        />
        <Register
          id="b"
          bindings={[{ key: "E", label: "Edit", action: () => {} }]}
        />
        <MergedKeys />
      </>,
    );
    const text = screen.getByTestId("merged").textContent ?? "";
    expect(text.split(",").sort()).toEqual(["E", "N"]);
  });

  it("replaces (not appends) when the same id re-registers new bindings", () => {
    const { rerender } = wrapper(
      <>
        <Register
          id="items"
          bindings={[{ key: "N", label: "New", action: () => {} }]}
        />
        <MergedKeys />
      </>,
    );
    expect(screen.getByTestId("merged")).toHaveTextContent("N");

    rerender(
      <ShortcutsProvider>
        <Register
          id="items"
          bindings={[{ key: "E", label: "Edit", action: () => {} }]}
        />
        <MergedKeys />
      </ShortcutsProvider>,
    );
    // Same id → group replaced, not appended (no "N,E").
    expect(screen.getByTestId("merged")).toHaveTextContent("E");
    expect(screen.getByTestId("merged")).not.toHaveTextContent("N");
  });

  it("fires a matching single-letter shortcut EXACTLY ONCE", () => {
    const action = vi.fn();
    wrapper(
      <Register id="items" bindings={[{ key: "N", label: "New", action }]} />,
    );
    act(() => {
      dispatchKey("n");
    });
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("does NOT fire while focus is in an <input> (guard wired into dispatcher)", () => {
    const action = vi.fn();
    wrapper(
      <Register id="items" bindings={[{ key: "N", label: "New", action }]} />,
    );
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();
    act(() => {
      dispatchKey("n", input);
    });
    expect(action).not.toHaveBeenCalled();
  });

  it("does NOT fire single-letter shortcuts when a modifier is held", () => {
    const action = vi.fn();
    wrapper(
      <Register id="items" bindings={[{ key: "N", label: "New", action }]} />,
    );
    act(() => {
      dispatchKey("n", undefined, { metaKey: true });
      dispatchKey("n", undefined, { ctrlKey: true });
      dispatchKey("n", undefined, { altKey: true });
    });
    expect(action).not.toHaveBeenCalled();
  });

  it("matches case-insensitively", () => {
    const action = vi.fn();
    wrapper(
      <Register id="items" bindings={[{ key: "n", label: "New", action }]} />,
    );
    act(() => {
      dispatchKey("N");
    });
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("useShortcuts falls back to a useId() id when none is supplied", () => {
    // No id passed → hook self-assigns a stable id; group still merges.
    wrapper(
      <>
        <Register bindings={[{ key: "Q", label: "Quit", action: () => {} }]} />
        <MergedKeys />
      </>,
    );
    expect(screen.getByTestId("merged")).toHaveTextContent("Q");
  });

  it("useShortcutsContext throws outside a provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<MergedKeys />)).toThrow();
    spy.mockRestore();
  });
});
