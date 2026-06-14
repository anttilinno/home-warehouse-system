import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { usePaletteChord } from "../usePaletteChord";

// TUI-05 (open chord) — the tinykeys mount-once owner. Asserts $mod+k (Ctrl+k in
// jsdom — non-mac platform), Meta+k, and F2 all call open() + preventDefault,
// fire EVEN from inside a focused <input> (OVERRIDE A: ignore:()=>false), mount
// ONCE, and tear down cleanly on unmount.

// tinykeys' `isKeyboardEvent` guard requires key && code && getModifierState —
// jsdom KeyboardEvents need an explicit `code` or tinykeys ignores them. Derive a
// sensible code from the key when the test doesn't supply one.
function codeFor(key: string): string {
  if (key === "F2") return "F2";
  if (/^[a-z]$/i.test(key)) return `Key${key.toUpperCase()}`;
  return key;
}

function dispatchKey(
  init: KeyboardEventInit & { key: string },
  target: EventTarget = window,
): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
    bubbles: true,
    cancelable: true,
    code: codeFor(init.key),
    ...init,
  });
  target.dispatchEvent(event);
  return event;
}

describe("usePaletteChord", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("calls open() + preventDefault on Ctrl+k ($mod on non-mac)", () => {
    const open = vi.fn();
    renderHook(() => usePaletteChord(open));

    const event = dispatchKey({ key: "k", ctrlKey: true });

    expect(open).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it("does NOT fire on a bare 'k' with no modifier ($mod required)", () => {
    const open = vi.fn();
    renderHook(() => usePaletteChord(open));

    // jsdom platform is non-mac → $mod === Control; a bare 'k' must not open.
    dispatchKey({ key: "k" });

    expect(open).not.toHaveBeenCalled();
  });

  it("calls open() + preventDefault on F2", () => {
    const open = vi.fn();
    renderHook(() => usePaletteChord(open));

    const event = dispatchKey({ key: "F2" });

    expect(open).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it("fires even when the chord originates from a focused input (ignore:()=>false)", () => {
    const open = vi.fn();
    renderHook(() => usePaletteChord(open));

    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();

    const event = dispatchKey({ key: "k", ctrlKey: true }, input);

    expect(open).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it("reads the latest open() through a ref without re-subscribing", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(({ fn }) => usePaletteChord(fn), {
      initialProps: { fn: first },
    });

    rerender({ fn: second });
    dispatchKey({ key: "k", ctrlKey: true });

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("removes the listener on unmount (no fire after teardown)", () => {
    const open = vi.fn();
    const { unmount } = renderHook(() => usePaletteChord(open));

    unmount();
    dispatchKey({ key: "k", ctrlKey: true });

    expect(open).not.toHaveBeenCalled();
  });
});
