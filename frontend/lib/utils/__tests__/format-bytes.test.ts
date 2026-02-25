import { describe, it, expect } from "vitest";

import { formatBytes } from "../format-bytes";

describe("formatBytes", () => {
  it("returns '0 B' for zero bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
  });

  it("formats values in the bytes range", () => {
    expect(formatBytes(500)).toBe("500 B");
  });

  it("formats values at the KB boundary", () => {
    expect(formatBytes(1024)).toBe("1 KB");
  });

  it("formats values in the MB range", () => {
    expect(formatBytes(1048576)).toBe("1 MB");
    expect(formatBytes(1572864)).toBe("1.5 MB");
  });

  it("formats values in the GB range", () => {
    expect(formatBytes(1073741824)).toBe("1 GB");
  });

  it("respects custom decimal places", () => {
    // 1536 bytes = 1.5 KB; parseFloat strips trailing zeros
    expect(formatBytes(1536, 2)).toBe("1.5 KB");
    expect(formatBytes(1048576, 0)).toBe("1 MB");
  });

  it("caps at GB for values beyond the GB range", () => {
    // 1 TB = 1024 GB, should render as "1024 GB" since there is no TB unit
    expect(formatBytes(1099511627776)).toBe("1024 GB");
  });
});
