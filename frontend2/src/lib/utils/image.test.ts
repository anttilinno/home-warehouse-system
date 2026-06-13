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

// ---------------------------------------------------------------------------
// compressImage — jsdom has no canvas/createImageBitmap, so we stub both and
// assert call shapes (orientation flag, downscale math, output MIME). The
// "imageOrientation: 'from-image'" assertion is the EXIF guard (Pitfall 3).
// ---------------------------------------------------------------------------

type BitmapStub = { width: number; height: number; close: ReturnType<typeof vi.fn> };

/** Install a createImageBitmap mock returning a bitmap of the given source dims. */
function stubBitmap(width: number, height: number) {
  const bitmap: BitmapStub = { width, height, close: vi.fn() };
  const createImageBitmap = vi.fn().mockResolvedValue(bitmap);
  vi.stubGlobal("createImageBitmap", createImageBitmap);
  return { bitmap, createImageBitmap };
}

/**
 * Spy canvas getContext + toBlob. Captures the canvas element so the test can
 * read the width/height the impl assigned. toBlob resolves a 1-byte Blob of the
 * requested MIME (or null to exercise the failure path).
 */
function stubCanvas(opts: { blob?: boolean } = {}) {
  const blob = opts.blob ?? true;
  const drawImage = vi.fn();
  const ctx = { drawImage } as unknown as CanvasRenderingContext2D;
  const canvases: HTMLCanvasElement[] = [];

  const getContextSpy = vi
    .spyOn(HTMLCanvasElement.prototype, "getContext")
    .mockImplementation(function (this: HTMLCanvasElement) {
      canvases.push(this);
      return ctx as unknown as RenderingContext;
    } as typeof HTMLCanvasElement.prototype.getContext);

  const toBlobSpy = vi
    .spyOn(HTMLCanvasElement.prototype, "toBlob")
    .mockImplementation(function (
      this: HTMLCanvasElement,
      cb: BlobCallback,
      type?: string,
    ) {
      cb(blob ? new Blob(["x"], { type: type ?? "image/jpeg" }) : null);
    } as typeof HTMLCanvasElement.prototype.toBlob);

  return { drawImage, getContextSpy, toBlobSpy, canvases };
}

describe("compressImage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("passes imageOrientation:'from-image' to createImageBitmap (EXIF guard)", async () => {
    const { createImageBitmap } = stubBitmap(800, 600);
    stubCanvas();
    const file = fileOf("image/jpeg", MB);

    await compressImage(file);

    expect(createImageBitmap).toHaveBeenCalledTimes(1);
    expect(createImageBitmap).toHaveBeenCalledWith(file, {
      imageOrientation: "from-image",
    });
  });

  it("downscales oversized dims to the canvas (3200x2400 → 1600x1200 @ maxDim 1600)", async () => {
    stubBitmap(3200, 2400);
    const { canvases } = stubCanvas();

    await compressImage(fileOf("image/jpeg", MB), 1600);

    expect(canvases).toHaveLength(1);
    expect(canvases[0].width).toBe(1600);
    expect(canvases[0].height).toBe(1200);
  });

  it("does NOT upscale images already under maxDim (scale clamped to 1)", async () => {
    stubBitmap(800, 600);
    const { canvases } = stubCanvas();

    await compressImage(fileOf("image/jpeg", MB), 1600);

    expect(canvases[0].width).toBe(800);
    expect(canvases[0].height).toBe(600);
  });

  it("preserves image/png type; everything else becomes image/jpeg", async () => {
    stubBitmap(400, 400);
    const { toBlobSpy } = stubCanvas();

    const png = await compressImage(fileOf("image/png", MB, "pic.png"));
    expect(png.type).toBe("image/png");
    expect(toBlobSpy).toHaveBeenLastCalledWith(expect.any(Function), "image/png", 0.85);

    const webp = await compressImage(fileOf("image/webp", MB, "pic.webp"));
    expect(webp.type).toBe("image/jpeg");
    expect(toBlobSpy).toHaveBeenLastCalledWith(expect.any(Function), "image/jpeg", 0.85);
  });

  it("returns a File preserving the source name", async () => {
    stubBitmap(400, 400);
    stubCanvas();
    const out = await compressImage(fileOf("image/jpeg", MB, "myphoto.jpg"));
    expect(out).toBeInstanceOf(File);
    expect(out.name).toBe("myphoto.jpg");
  });

  it("closes the bitmap after drawing", async () => {
    const { bitmap } = stubBitmap(400, 400);
    stubCanvas();
    await compressImage(fileOf("image/jpeg", MB));
    expect(bitmap.close).toHaveBeenCalledTimes(1);
  });

  it("forwards the quality arg to toBlob", async () => {
    stubBitmap(400, 400);
    const { toBlobSpy } = stubCanvas();
    await compressImage(fileOf("image/jpeg", MB), 1600, 0.5);
    expect(toBlobSpy).toHaveBeenCalledWith(expect.any(Function), "image/jpeg", 0.5);
  });

  it("rejects with Error('no canvas ctx') when getContext returns null", async () => {
    stubBitmap(400, 400);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    await expect(compressImage(fileOf("image/jpeg", MB))).rejects.toThrow(
      "no canvas ctx",
    );
  });

  it("rejects with Error('toBlob failed') when toBlob yields null", async () => {
    stubBitmap(400, 400);
    stubCanvas({ blob: false });
    await expect(compressImage(fileOf("image/jpeg", MB))).rejects.toThrow(
      "toBlob failed",
    );
  });
});
