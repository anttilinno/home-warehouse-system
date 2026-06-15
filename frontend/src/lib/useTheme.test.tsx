import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { THEME_STORAGE_KEY } from "./theme";
import { ThemeProvider, useTheme } from "./useTheme";

// Dark Mode P1 — useTheme context: setPref persists + applies, and a `system`
// pref live-follows the OS via a matchMedia change listener.

type MediaListener = (e: MediaQueryListEvent) => void;

function installMatchMedia(initialDark: boolean) {
  let matches = initialDark;
  const listeners = new Set<MediaListener>();
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        get matches() {
          return matches;
        },
        media: query,
        onchange: null,
        addEventListener: (_: string, l: MediaListener) => listeners.add(l),
        removeEventListener: (_: string, l: MediaListener) =>
          listeners.delete(l),
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  );
  return {
    emitChange(nextDark: boolean) {
      matches = nextDark;
      for (const l of listeners) {
        l({ matches: nextDark } as MediaQueryListEvent);
      }
    },
  };
}

function Probe() {
  const { pref, resolved, setPref } = useTheme();
  return (
    <div>
      <span data-testid="pref">{pref}</span>
      <span data-testid="resolved">{resolved}</span>
      <button type="button" onClick={() => setPref("dark")}>
        go-dark
      </button>
    </div>
  );
}

describe("useTheme", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("setPref persists and applies the resolved theme", async () => {
    installMatchMedia(false);
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );

    await user.click(screen.getByText("go-dark"));

    expect(screen.getByTestId("pref")).toHaveTextContent("dark");
    expect(screen.getByTestId("resolved")).toHaveTextContent("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("re-applies live when the OS flips while pref is system", () => {
    const mm = installMatchMedia(false);
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );

    expect(screen.getByTestId("resolved")).toHaveTextContent("light");

    act(() => mm.emitChange(true));

    expect(screen.getByTestId("resolved")).toHaveTextContent("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });
});
