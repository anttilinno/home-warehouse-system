import { describe, it } from "vitest";

/**
 * Wave 0 scaffold (61-01). Subsequent plans (61-03) flip these it.todo
 * entries to real tests as the gallery component lands. Leaving them as
 * todos keeps `npx vitest run` green for this file from day one.
 */
describe("ItemPhotoGallery", () => {
  it.todo("renders empty state when no photos");
  it.todo("uploads files sequentially via itemPhotosApi.upload");
  it.todo("rejects HEIC files with inline error");
  it.todo("rejects oversized files with inline error");
  it.todo("revokes ObjectURLs on unmount");
  it.todo("opens lightbox when a tile is clicked");
});
