import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ScanViewfinderOverlay } from "../ScanViewfinderOverlay";

describe("ScanViewfinderOverlay", () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    // Default: no reduced-motion preference
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    cleanup();
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: originalMatchMedia,
    });
  });

  it("renders 4 corner bracket elements (Test 1)", () => {
    render(<ScanViewfinderOverlay />);
    const corners = screen.getAllByTestId("viewfinder-corner");
    expect(corners.length).toBe(4);
  });

  it("renders a scanline element (Test 2)", () => {
    render(<ScanViewfinderOverlay />);
    const scanline = screen.getByTestId("viewfinder-scanline");
    expect(scanline).toBeInTheDocument();
  });

  it("scanline has the scan-sweep animation class when motion is allowed (Test 3)", () => {
    render(<ScanViewfinderOverlay />);
    const scanline = screen.getByTestId("viewfinder-scanline");
    // Class indicating active animation (scoped to scan-sweep keyframe)
    expect(scanline.className).toContain("animate-scan-sweep");
  });

  it("respects prefers-reduced-motion: reduce (Test 4)", () => {
    // Override matchMedia to match reduced-motion
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes("prefers-reduced-motion"),
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    render(<ScanViewfinderOverlay />);
    const scanline = screen.getByTestId("viewfinder-scanline");
    // No animation class when reduced-motion is active
    expect(scanline.className).not.toContain("animate-scan-sweep");
    // Overlay root flags reduced motion
    const overlay = screen.getByTestId("scan-viewfinder-overlay");
    expect(overlay.getAttribute("data-reduced-motion")).toBe("true");
  });

  it("takes no props — zero-prop invocation compiles & renders (Test 5)", () => {
    // Type-only assertion: if the component required props, this call would
    // be a TS compile error. Presence of this test is the compile-time check.
    expect(() => render(<ScanViewfinderOverlay />)).not.toThrow();
  });
});
