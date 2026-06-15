import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyTheme,
  prefersDark,
  readStoredPref,
  resolveTheme,
  THEME_STORAGE_KEY,
  writeStoredPref,
} from "./theme";

// Dark Mode P1 — theme resolution + persistence contract.

function mockMatchMedia(matches: boolean) {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        matches,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  );
}

describe("theme resolution + persistence", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resolveTheme passes through explicit light/dark", () => {
    expect(resolveTheme("light")).toBe("light");
    expect(resolveTheme("dark")).toBe("dark");
  });

  it("resolveTheme('system') follows prefers-color-scheme", () => {
    mockMatchMedia(true);
    expect(resolveTheme("system")).toBe("dark");
    mockMatchMedia(false);
    expect(resolveTheme("system")).toBe("light");
  });

  it("prefersDark reflects the media query", () => {
    mockMatchMedia(true);
    expect(prefersDark()).toBe(true);
    mockMatchMedia(false);
    expect(prefersDark()).toBe(false);
  });

  it("applyTheme writes the resolved theme to <html data-theme>", () => {
    expect(applyTheme("dark")).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");

    mockMatchMedia(false);
    expect(applyTheme("system")).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("readStoredPref defaults to system and round-trips a written pref", () => {
    expect(readStoredPref()).toBe("system");

    writeStoredPref("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(readStoredPref()).toBe("dark");
  });

  it("readStoredPref ignores junk values", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "neon");
    expect(readStoredPref()).toBe("system");
  });
});
