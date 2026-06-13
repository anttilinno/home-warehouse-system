import { afterEach, describe, expect, it, vi } from "vitest";
import { compressImage, validateUploadFile } from "./image";

// Phase 07 Plan 02 — image utils.
//
// jsdom canvas-mock strategy (VALIDATION Wave 0 gap):
//   jsdom has NO canvas/2d-context and NO createImageBitmap. The compressImage
//   tests therefore stub `globalThis.createImageBitmap` and
//   `HTMLCanvasElement.prototype.getContext` / `.toBlob` so we assert CALL SHAPES
//   (orientation flag, downscale math, output MIME) rather than real pixels. No
//   raster ever leaves the mock. validateUploadFile is pure (no canvas) and runs
//   un-shimmed.

function fileOf(type: string, size: number, name = "photo"): File {
  // Construct a File whose `.size` reports `size` without allocating bytes.
  const f = new File([], name, { type });
  Object.defineProperty(f, "size", { value: size, configurable: true });
  return f;
}

const MB = 1024 * 1024;

describe("validateUploadFile", () => {
  it.each([
    ["image/jpeg"],
    ["image/png"],
    ["image/webp"],
  ])("accepts %s within the size cap", (type) => {
    expect(validateUploadFile(fileOf(type, MB))).toEqual({ ok: true });
  });

  it.each([
    ["image/heic"],
    ["image/heif"],
  ])("rejects HEIC family (%s) with the exact UI-SPEC type message", (type) => {
    expect(validateUploadFile(fileOf(type, MB))).toEqual({
      ok: false,
      reason: "That file type isn't allowed.",
    });
  });

  it("rejects a non-image MIME with the type message", () => {
    expect(validateUploadFile(fileOf("application/pdf", MB))).toEqual({
      ok: false,
      reason: "That file type isn't allowed.",
    });
  });

  it("rejects an oversized (>10MB) file with the exact UI-SPEC size message", () => {
    expect(validateUploadFile(fileOf("image/jpeg", 10 * MB + 1))).toEqual({
      ok: false,
      reason: "File is too large (max 10.0 MB).",
    });
  });

  it("accepts a file exactly at the 10MB boundary", () => {
    expect(validateUploadFile(fileOf("image/jpeg", 10 * MB))).toEqual({ ok: true });
  });

  it("rejects an empty / zero-byte file with the type message (no MIME)", () => {
    expect(validateUploadFile(fileOf("", 0))).toEqual({
      ok: false,
      reason: "That file type isn't allowed.",
    });
  });
});
