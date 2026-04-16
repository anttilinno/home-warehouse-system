import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { itemPhotosApi } from "./itemPhotos";

/**
 * itemPhotosApi unit tests (Wave 0 — 61-01)
 *
 * Asserts the two new contract invariants landed in this plan:
 *   1. setPrimary uses the correct PUT URL shape — backend expects
 *      PUT /workspaces/{wsId}/photos/{photoId}/primary (D-09).
 *   2. upload appends the file under the key "photo" (NOT "file") —
 *      backend HandleUpload reads r.FormFile("photo") (T-61-01 mitigation).
 */
describe("itemPhotosApi", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      // 204 No Content with NO content-type header — parseResponse in api.ts
      // short-circuits when content-type is absent, avoiding a parse error
      // on an empty body (setPrimary returns void; upload return value
      // isn't asserted in this file).
      return new Response(null, { status: 204 });
    });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  describe("setPrimary", () => {
    it("calls PUT /workspaces/{wsId}/photos/{photoId}/primary", async () => {
      await itemPhotosApi.setPrimary("ws-1", "photo-1");

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toContain("/api/workspaces/ws-1/photos/photo-1/primary");
      expect(init.method).toBe("PUT");
    });

    it("sends no request body (PUT with no data)", async () => {
      await itemPhotosApi.setPrimary("ws-1", "photo-1");

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      // put(endpoint) without data must leave body undefined.
      expect(init.body).toBeUndefined();
    });
  });

  describe("upload", () => {
    it("appends the file under the key 'photo' (not 'file')", async () => {
      const file = new File(["x"], "test.jpg", { type: "image/jpeg" });
      await itemPhotosApi.upload("ws-1", "item-1", file);

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const body = init.body as FormData;

      expect(body).toBeInstanceOf(FormData);
      expect(body.get("photo")).toBeInstanceOf(File);
      expect(body.get("file")).toBeNull();
    });

    it("posts to /workspaces/{wsId}/items/{itemId}/photos", async () => {
      const file = new File(["x"], "test.jpg", { type: "image/jpeg" });
      await itemPhotosApi.upload("ws-1", "item-1", file);

      const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toContain("/api/workspaces/ws-1/items/item-1/photos");
      expect(init.method).toBe("POST");
    });
  });
});
