import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PixelIcon } from "./PixelIcon";
import { PIXEL_ICON_PATHS } from "./pixelIconPaths";

describe("PixelIcon", () => {
  it("renders an aria-hidden 24-grid svg at the requested size", () => {
    const { container } = render(<PixelIcon name="archive" size={20} />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("viewBox", "0 0 24 24");
    expect(svg).toHaveAttribute("width", "20");
    expect(svg?.getAttribute("fill")).toBe("currentColor");
  });

  it("emits one <path> per bundled path (multi-path icons included)", () => {
    // reload ships 3 paths — every one must render, not just the first.
    const { container } = render(<PixelIcon name="reload" />);
    expect(container.querySelectorAll("path")).toHaveLength(
      PIXEL_ICON_PATHS.reload.length,
    );
  });

  it("has a bundled path set for every mapped name (no empty icon)", () => {
    for (const paths of Object.values(PIXEL_ICON_PATHS)) {
      expect(paths.length).toBeGreaterThan(0);
    }
  });
});
