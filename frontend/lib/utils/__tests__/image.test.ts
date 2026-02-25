import { describe, it, expect } from "vitest";

import {
  validateImageFile,
  getPhotoUrl,
  formatFileSize,
  getAspectRatio,
  isPortrait,
  isLandscape,
  isSquare,
} from "../image";

import type { ItemPhoto, PhotoSize } from "../../types/item-photo";

// ---------- validateImageFile ----------

describe("validateImageFile", () => {
  it("accepts valid JPEG files", () => {
    const file = new File(["x"], "photo.jpg", { type: "image/jpeg" });
    expect(validateImageFile(file)).toEqual({ valid: true });
  });

  it("accepts valid PNG, GIF, and WebP files", () => {
    const types = ["image/png", "image/gif", "image/webp"] as const;
    for (const type of types) {
      const file = new File(["x"], "img.test", { type });
      expect(validateImageFile(file)).toEqual({ valid: true });
    }
  });

  it("rejects files with disallowed MIME types", () => {
    const file = new File(["x"], "doc.pdf", { type: "application/pdf" });
    const result = validateImageFile(file);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Invalid file type");
  });

  it("rejects files exceeding the 10 MB size limit", () => {
    const file = new File(["x"], "big.jpg", { type: "image/jpeg" });
    Object.defineProperty(file, "size", { value: 15 * 1024 * 1024 });
    const result = validateImageFile(file);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("too large");
    expect(result.error).toContain("10");
  });

  it("accepts a file exactly at the 10 MB limit", () => {
    const file = new File(["x"], "edge.png", { type: "image/png" });
    Object.defineProperty(file, "size", { value: 10 * 1024 * 1024 });
    expect(validateImageFile(file)).toEqual({ valid: true });
  });
});

// ---------- getPhotoUrl ----------

describe("getPhotoUrl", () => {
  const photo = {
    urls: {
      original: "http://cdn/original.jpg",
      small: "http://cdn/small.jpg",
      medium: "http://cdn/medium.jpg",
      large: "http://cdn/large.jpg",
    },
  } as unknown as ItemPhoto;

  it("returns the medium URL by default", () => {
    expect(getPhotoUrl(photo)).toBe("http://cdn/medium.jpg");
  });

  it("returns the URL for the requested size", () => {
    const sizes: PhotoSize[] = ["original", "small", "medium", "large"];
    for (const size of sizes) {
      expect(getPhotoUrl(photo, size)).toBe(`http://cdn/${size}.jpg`);
    }
  });
});

// ---------- formatFileSize ----------

describe("formatFileSize", () => {
  it("returns '0 Bytes' for zero", () => {
    expect(formatFileSize(0)).toBe("0 Bytes");
  });

  it("formats byte values", () => {
    expect(formatFileSize(500)).toBe("500 Bytes");
  });

  it("formats KB values with 2 decimal places", () => {
    // 1536 bytes = 1.50 KB -> parseFloat strips trailing zero -> "1.5 KB"
    expect(formatFileSize(1536)).toBe("1.5 KB");
  });

  it("formats MB values", () => {
    expect(formatFileSize(1048576)).toBe("1 MB");
  });

  it("formats GB values", () => {
    expect(formatFileSize(1073741824)).toBe("1 GB");
  });
});

// ---------- getAspectRatio ----------

describe("getAspectRatio", () => {
  it("returns 16:9 for 1920x1080", () => {
    expect(getAspectRatio(1920, 1080)).toBe("16:9");
  });

  it("returns 4:3 for 1024x768", () => {
    expect(getAspectRatio(1024, 768)).toBe("4:3");
  });

  it("returns 1:1 for square dimensions", () => {
    expect(getAspectRatio(500, 500)).toBe("1:1");
  });
});

// ---------- Orientation helpers ----------

describe("orientation helpers", () => {
  it("isPortrait returns true when height exceeds width", () => {
    expect(isPortrait(600, 800)).toBe(true);
    expect(isPortrait(800, 600)).toBe(false);
    expect(isPortrait(500, 500)).toBe(false);
  });

  it("isLandscape returns true when width exceeds height", () => {
    expect(isLandscape(800, 600)).toBe(true);
    expect(isLandscape(600, 800)).toBe(false);
    expect(isLandscape(500, 500)).toBe(false);
  });

  it("isSquare returns true when width equals height", () => {
    expect(isSquare(500, 500)).toBe(true);
    expect(isSquare(500, 501)).toBe(false);
  });
});
