import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCapturePhotos } from "../use-capture-photos";

// ---------------------------------------------------------------------------
// Mock IndexedDB
// ---------------------------------------------------------------------------

const { mockAdd, mockGetAllFromIndex, mockDelete, mockTransaction } = vi.hoisted(() => ({
  mockAdd: vi.fn(),
  mockGetAllFromIndex: vi.fn(),
  mockDelete: vi.fn(),
  mockTransaction: vi.fn(),
}));

vi.mock("@/lib/db/offline-db", () => ({
  getDB: vi.fn(),
}));

import { getDB } from "@/lib/db/offline-db";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useCapturePhotos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDB).mockResolvedValue({
      add: mockAdd,
      getAllFromIndex: mockGetAllFromIndex,
      delete: mockDelete,
      transaction: mockTransaction,
    } as never);
  });

  describe("storePhoto", () => {
    it("stores a photo blob with the temp item ID and pending status", async () => {
      mockAdd.mockResolvedValue(42);

      const { result } = renderHook(() => useCapturePhotos());
      const blob = new Blob(["test-image"], { type: "image/jpeg" });

      let photoId: number;
      await act(async () => {
        photoId = await result.current.storePhoto("temp-id-1", blob);
      });

      expect(photoId!).toBe(42);
      expect(mockAdd).toHaveBeenCalledWith("quickCapturePhotos", {
        tempItemId: "temp-id-1",
        blob,
        capturedAt: expect.any(Number),
        status: "pending",
      });
    });

    it("stores multiple photos for the same temp item ID", async () => {
      mockAdd.mockResolvedValueOnce(1).mockResolvedValueOnce(2);

      const { result } = renderHook(() => useCapturePhotos());
      const blob1 = new Blob(["img1"], { type: "image/jpeg" });
      const blob2 = new Blob(["img2"], { type: "image/png" });

      await act(async () => {
        await result.current.storePhoto("temp-id-x", blob1);
        await result.current.storePhoto("temp-id-x", blob2);
      });

      expect(mockAdd).toHaveBeenCalledTimes(2);
      expect(mockAdd.mock.calls[0][1].tempItemId).toBe("temp-id-x");
      expect(mockAdd.mock.calls[1][1].tempItemId).toBe("temp-id-x");
    });
  });

  describe("getPhotosByTempItemId", () => {
    it("returns photos from the tempItemId index", async () => {
      const mockPhotos = [
        { id: 1, tempItemId: "temp-1", blob: new Blob(), capturedAt: 100, status: "pending" },
      ];
      mockGetAllFromIndex.mockResolvedValue(mockPhotos);

      const { result } = renderHook(() => useCapturePhotos());

      let photos: unknown[];
      await act(async () => {
        photos = await result.current.getPhotosByTempItemId("temp-1");
      });

      expect(photos!).toEqual(mockPhotos);
      expect(mockGetAllFromIndex).toHaveBeenCalledWith(
        "quickCapturePhotos",
        "tempItemId",
        "temp-1"
      );
    });

    it("returns empty array when no photos exist", async () => {
      mockGetAllFromIndex.mockResolvedValue([]);

      const { result } = renderHook(() => useCapturePhotos());

      let photos: unknown[];
      await act(async () => {
        photos = await result.current.getPhotosByTempItemId("nonexistent");
      });

      expect(photos!).toEqual([]);
    });
  });

  describe("deletePhotosByTempItemId", () => {
    it("deletes all photos with matching temp item ID via cursor", async () => {
      // Simulate cursor with 2 items
      let cursorCallCount = 0;
      const cursor = {
        delete: vi.fn().mockResolvedValue(undefined),
        continue: vi.fn().mockImplementation(async () => {
          cursorCallCount++;
          return cursorCallCount >= 2 ? null : cursor;
        }),
      };

      const mockIndex = {
        openCursor: vi.fn().mockResolvedValue(cursor),
      };
      const mockStore = {
        index: vi.fn().mockReturnValue(mockIndex),
      };
      mockTransaction.mockReturnValue({
        store: mockStore,
        done: Promise.resolve(),
      });

      const { result } = renderHook(() => useCapturePhotos());

      await act(async () => {
        await result.current.deletePhotosByTempItemId("temp-cleanup");
      });

      expect(mockTransaction).toHaveBeenCalledWith("quickCapturePhotos", "readwrite");
      expect(mockIndex.openCursor).toHaveBeenCalledWith("temp-cleanup");
      expect(cursor.delete).toHaveBeenCalled();
    });
  });

  describe("deletePhoto", () => {
    it("deletes a single photo by ID", async () => {
      mockDelete.mockResolvedValue(undefined);

      const { result } = renderHook(() => useCapturePhotos());

      await act(async () => {
        await result.current.deletePhoto(99);
      });

      expect(mockDelete).toHaveBeenCalledWith("quickCapturePhotos", 99);
    });
  });
});
