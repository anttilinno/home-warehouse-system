import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleItemSynced, retryFailedPhotoUploads } from "../capture-photo-uploader";
import type { SyncEvent } from "../sync-manager";
import type { CapturePhoto } from "@/lib/db/types";
import { createMutationEntry } from "@/lib/test-utils/factories";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockGetAllFromIndex, mockDelete, mockPut, mockUploadItemPhoto } = vi.hoisted(() => ({
  mockGetAllFromIndex: vi.fn(),
  mockDelete: vi.fn().mockResolvedValue(undefined),
  mockPut: vi.fn().mockResolvedValue(undefined),
  mockUploadItemPhoto: vi.fn(),
}));

vi.mock("@/lib/db/offline-db", () => ({
  getDB: vi.fn(),
}));

vi.mock("@/lib/api/item-photos", () => ({
  itemPhotosApi: {
    uploadItemPhoto: (...args: unknown[]) => mockUploadItemPhoto(...args),
  },
}));

import { getDB } from "@/lib/db/offline-db";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCapturePhoto(overrides: Partial<CapturePhoto> = {}): CapturePhoto {
  return {
    id: 1,
    tempItemId: "temp-key-123",
    blob: new Blob(["fake-image-data"], { type: "image/jpeg" }),
    capturedAt: Date.now(),
    status: "pending",
    ...overrides,
  };
}

function makeSyncEvent(
  entity: string,
  operation: string,
  idempotencyKey: string,
  resolvedId?: string
): SyncEvent {
  return {
    type: "MUTATION_SYNCED",
    payload: {
      mutation: createMutationEntry({
        entity: entity as "items",
        operation: operation as "create",
        idempotencyKey,
      }),
      resolvedId,
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("capture-photo-uploader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDB).mockResolvedValue({
      getAllFromIndex: mockGetAllFromIndex,
      delete: mockDelete,
      put: mockPut,
    } as never);
  });

  // -------------------------------------------------------------------------
  // handleItemSynced — guard clauses (unchanged behaviour)
  // -------------------------------------------------------------------------

  it("ignores non-MUTATION_SYNCED events", async () => {
    await handleItemSynced({ type: "SYNC_COMPLETE" }, "ws-1");
    expect(mockGetAllFromIndex).not.toHaveBeenCalled();
  });

  it("ignores non-item mutations", async () => {
    const event = makeSyncEvent("categories", "create", "key-1");
    await handleItemSynced(event, "ws-1");
    expect(mockGetAllFromIndex).not.toHaveBeenCalled();
  });

  it("ignores item update mutations", async () => {
    const event = makeSyncEvent("items", "update", "key-1");
    await handleItemSynced(event, "ws-1");
    expect(mockGetAllFromIndex).not.toHaveBeenCalled();
  });

  it("does nothing when no photos exist for the temp ID", async () => {
    mockGetAllFromIndex.mockResolvedValue([]);
    const event = makeSyncEvent("items", "create", "temp-key-123", "real-id-456");

    await handleItemSynced(event, "ws-1");

    expect(mockGetAllFromIndex).toHaveBeenCalledWith(
      "quickCapturePhotos",
      "tempItemId",
      "temp-key-123"
    );
    expect(mockUploadItemPhoto).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // handleItemSynced — per-photo delete on success
  // -------------------------------------------------------------------------

  it("uploads photos using the resolved server ID", async () => {
    const photo = makeCapturePhoto({ id: 1, tempItemId: "temp-key-123" });
    mockGetAllFromIndex.mockResolvedValue([photo]);
    mockUploadItemPhoto.mockResolvedValue({ id: "photo-1" });

    const event = makeSyncEvent("items", "create", "temp-key-123", "real-id-456");
    await handleItemSynced(event, "ws-1");

    expect(mockUploadItemPhoto).toHaveBeenCalledTimes(1);
    expect(mockUploadItemPhoto).toHaveBeenCalledWith(
      "ws-1",
      "real-id-456",
      expect.any(File)
    );

    // Verify the File was constructed from the blob
    const uploadedFile = mockUploadItemPhoto.mock.calls[0][2] as File;
    expect(uploadedFile.type).toBe("image/jpeg");
    expect(uploadedFile.size).toBe(photo.blob.size);
  });

  it("falls back to idempotency key when no resolvedId", async () => {
    const photo = makeCapturePhoto({ id: 1, tempItemId: "temp-key-no-resolve" });
    mockGetAllFromIndex.mockResolvedValue([photo]);
    mockUploadItemPhoto.mockResolvedValue({ id: "photo-1" });

    const event = makeSyncEvent("items", "create", "temp-key-no-resolve");
    await handleItemSynced(event, "ws-1");

    expect(mockUploadItemPhoto).toHaveBeenCalledWith(
      "ws-1",
      "temp-key-no-resolve", // fallback to idempotency key
      expect.any(File)
    );
  });

  it("deletes each successfully uploaded photo individually from IndexedDB", async () => {
    const photos = [
      makeCapturePhoto({ id: 1, tempItemId: "temp-multi" }),
      makeCapturePhoto({ id: 2, tempItemId: "temp-multi" }),
      makeCapturePhoto({ id: 3, tempItemId: "temp-multi" }),
    ];
    mockGetAllFromIndex.mockResolvedValue(photos);
    mockUploadItemPhoto.mockResolvedValue({ id: "photo-x" });

    const event = makeSyncEvent("items", "create", "temp-multi", "server-id");
    await handleItemSynced(event, "ws-1");

    expect(mockUploadItemPhoto).toHaveBeenCalledTimes(3);

    // Each photo deleted individually
    expect(mockDelete).toHaveBeenCalledTimes(3);
    expect(mockDelete).toHaveBeenCalledWith("quickCapturePhotos", 1);
    expect(mockDelete).toHaveBeenCalledWith("quickCapturePhotos", 2);
    expect(mockDelete).toHaveBeenCalledWith("quickCapturePhotos", 3);

    // No put() calls when all succeed
    expect(mockPut).not.toHaveBeenCalledWith(expect.objectContaining({ status: "failed" }));
  });

  it("marks failed photo with status=failed and resolvedItemId, deletes successful ones", async () => {
    const photos = [
      makeCapturePhoto({ id: 1, tempItemId: "temp-partial" }),
      makeCapturePhoto({ id: 2, tempItemId: "temp-partial" }),
    ];
    mockGetAllFromIndex.mockResolvedValue(photos);
    // First upload fails, second succeeds
    mockUploadItemPhoto
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce({ id: "photo-2" });

    const event = makeSyncEvent("items", "create", "temp-partial", "real-id");
    await handleItemSynced(event, "ws-1");

    // Both uploads attempted
    expect(mockUploadItemPhoto).toHaveBeenCalledTimes(2);

    // Failed photo marked with status="failed" and resolvedItemId
    expect(mockPut).toHaveBeenCalledWith(
      "quickCapturePhotos",
      expect.objectContaining({ id: 1, status: "failed", resolvedItemId: "real-id" })
    );

    // Successful photo deleted individually
    expect(mockDelete).toHaveBeenCalledWith("quickCapturePhotos", 2);

    // Failed photo NOT deleted
    expect(mockDelete).not.toHaveBeenCalledWith("quickCapturePhotos", 1);
  });

  it("stores resolvedItemId on all photos before the upload loop via pre-write", async () => {
    const photos = [
      makeCapturePhoto({ id: 1, tempItemId: "temp-pre" }),
      makeCapturePhoto({ id: 2, tempItemId: "temp-pre" }),
    ];
    mockGetAllFromIndex.mockResolvedValue(photos);
    mockUploadItemPhoto.mockResolvedValue({ id: "photo-x" });

    const putOrder: number[] = [];
    const uploadOrder: number[] = [];

    mockPut.mockImplementation((_store: string, record: CapturePhoto) => {
      putOrder.push(record.id);
      return Promise.resolve();
    });
    mockUploadItemPhoto.mockImplementation(() => {
      uploadOrder.push(uploadOrder.length + 1);
      return Promise.resolve({ id: "photo-x" });
    });

    const event = makeSyncEvent("items", "create", "temp-pre", "server-pre");
    await handleItemSynced(event, "ws-1");

    // Both pre-writes happened before any upload
    expect(putOrder).toEqual([1, 2]);
    // Both uploads happened after pre-writes
    expect(uploadOrder).toEqual([1, 2]);
    // pre-write puts have resolvedItemId set
    expect(mockPut).toHaveBeenCalledWith(
      "quickCapturePhotos",
      expect.objectContaining({ resolvedItemId: "server-pre" })
    );
  });

  it("handles blob with missing type by defaulting to image/jpeg", async () => {
    const blobNoType = new Blob(["data"]); // type = ""
    const photo = makeCapturePhoto({ id: 1, tempItemId: "temp-notype", blob: blobNoType });
    mockGetAllFromIndex.mockResolvedValue([photo]);
    mockUploadItemPhoto.mockResolvedValue({ id: "photo-1" });

    const event = makeSyncEvent("items", "create", "temp-notype", "server-1");
    await handleItemSynced(event, "ws-1");

    const uploadedFile = mockUploadItemPhoto.mock.calls[0][2] as File;
    expect(uploadedFile.type).toBe("image/jpeg");
  });

  // -------------------------------------------------------------------------
  // retryFailedPhotoUploads
  // -------------------------------------------------------------------------

  it("retryFailedPhotoUploads — returns early when no failed photos", async () => {
    mockGetAllFromIndex.mockResolvedValue([]);
    await retryFailedPhotoUploads("ws-1");
    expect(mockUploadItemPhoto).not.toHaveBeenCalled();
  });

  it("retryFailedPhotoUploads — retries failed photos using resolvedItemId", async () => {
    const failedPhoto = makeCapturePhoto({ id: 5, status: "failed", resolvedItemId: "real-item-id" });
    mockGetAllFromIndex.mockResolvedValue([failedPhoto]);
    mockUploadItemPhoto.mockResolvedValue({ id: "photo-retry" });

    await retryFailedPhotoUploads("ws-1");

    expect(mockGetAllFromIndex).toHaveBeenCalledWith("quickCapturePhotos", "status", "failed");
    expect(mockUploadItemPhoto).toHaveBeenCalledWith("ws-1", "real-item-id", expect.any(File));
    expect(mockDelete).toHaveBeenCalledWith("quickCapturePhotos", 5);
  });

  it("retryFailedPhotoUploads — skips photos with no resolvedItemId", async () => {
    const noIdPhoto = makeCapturePhoto({ id: 6, status: "failed" }); // no resolvedItemId
    mockGetAllFromIndex.mockResolvedValue([noIdPhoto]);

    await retryFailedPhotoUploads("ws-1");

    expect(mockUploadItemPhoto).not.toHaveBeenCalled();
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("retryFailedPhotoUploads — handles retry upload failure gracefully without crashing", async () => {
    const failedPhoto = makeCapturePhoto({ id: 7, status: "failed", resolvedItemId: "item-id" });
    mockGetAllFromIndex.mockResolvedValue([failedPhoto]);
    mockUploadItemPhoto.mockRejectedValue(new Error("Still offline"));

    // Should not throw
    await expect(retryFailedPhotoUploads("ws-1")).resolves.toBeUndefined();

    // Upload was attempted
    expect(mockUploadItemPhoto).toHaveBeenCalledTimes(1);
    // Photo NOT deleted (stays as failed)
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("retryFailedPhotoUploads — retries multiple failed photos", async () => {
    const failedPhotos = [
      makeCapturePhoto({ id: 8, status: "failed", resolvedItemId: "item-a" }),
      makeCapturePhoto({ id: 9, status: "failed", resolvedItemId: "item-b" }),
    ];
    mockGetAllFromIndex.mockResolvedValue(failedPhotos);
    mockUploadItemPhoto.mockResolvedValue({ id: "photo-ok" });

    await retryFailedPhotoUploads("ws-1");

    expect(mockUploadItemPhoto).toHaveBeenCalledTimes(2);
    expect(mockDelete).toHaveBeenCalledWith("quickCapturePhotos", 8);
    expect(mockDelete).toHaveBeenCalledWith("quickCapturePhotos", 9);
  });
});
