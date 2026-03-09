import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleItemSynced } from "../capture-photo-uploader";
import type { SyncEvent } from "../sync-manager";
import type { CapturePhoto } from "@/lib/db/types";
import { createMutationEntry } from "@/lib/test-utils/factories";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockGetAllFromIndex, mockTransaction, mockUploadItemPhoto } = vi.hoisted(() => ({
  mockGetAllFromIndex: vi.fn(),
  mockTransaction: vi.fn(),
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

function setupTransactionMock() {
  const deletedKeys: string[] = [];
  const mockCursor = {
    delete: vi.fn().mockImplementation(async () => {
      deletedKeys.push("deleted");
    }),
    continue: vi.fn().mockResolvedValueOnce(null),
  };
  const mockIndex = {
    openCursor: vi.fn().mockResolvedValue(mockCursor),
  };
  const mockStore = {
    index: vi.fn().mockReturnValue(mockIndex),
  };
  mockTransaction.mockReturnValue({
    store: mockStore,
    done: Promise.resolve(),
  });
  return { deletedKeys, mockCursor, mockIndex };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("capture-photo-uploader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDB).mockResolvedValue({
      getAllFromIndex: mockGetAllFromIndex,
      transaction: mockTransaction,
    } as never);
  });

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

  it("uploads photos using the resolved server ID", async () => {
    const photo = makeCapturePhoto({ tempItemId: "temp-key-123" });
    mockGetAllFromIndex.mockResolvedValue([photo]);
    mockUploadItemPhoto.mockResolvedValue({ id: "photo-1" });
    setupTransactionMock();

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
    const photo = makeCapturePhoto({ tempItemId: "temp-key-no-resolve" });
    mockGetAllFromIndex.mockResolvedValue([photo]);
    mockUploadItemPhoto.mockResolvedValue({ id: "photo-1" });
    setupTransactionMock();

    const event = makeSyncEvent("items", "create", "temp-key-no-resolve");
    await handleItemSynced(event, "ws-1");

    expect(mockUploadItemPhoto).toHaveBeenCalledWith(
      "ws-1",
      "temp-key-no-resolve", // fallback to idempotency key
      expect.any(File)
    );
  });

  it("uploads multiple photos and cleans up IndexedDB", async () => {
    const photos = [
      makeCapturePhoto({ id: 1, tempItemId: "temp-multi" }),
      makeCapturePhoto({ id: 2, tempItemId: "temp-multi" }),
      makeCapturePhoto({ id: 3, tempItemId: "temp-multi" }),
    ];
    mockGetAllFromIndex.mockResolvedValue(photos);
    mockUploadItemPhoto.mockResolvedValue({ id: "photo-x" });
    const { mockIndex } = setupTransactionMock();

    const event = makeSyncEvent("items", "create", "temp-multi", "server-id");
    await handleItemSynced(event, "ws-1");

    expect(mockUploadItemPhoto).toHaveBeenCalledTimes(3);

    // Verify cleanup was called
    expect(mockTransaction).toHaveBeenCalledWith("quickCapturePhotos", "readwrite");
    expect(mockIndex.openCursor).toHaveBeenCalledWith("temp-multi");
  });

  it("continues uploading remaining photos when one fails", async () => {
    const photos = [
      makeCapturePhoto({ id: 1, tempItemId: "temp-partial" }),
      makeCapturePhoto({ id: 2, tempItemId: "temp-partial" }),
    ];
    mockGetAllFromIndex.mockResolvedValue(photos);
    mockUploadItemPhoto
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce({ id: "photo-2" });
    setupTransactionMock();

    const event = makeSyncEvent("items", "create", "temp-partial", "server-id");

    // Should not throw
    await handleItemSynced(event, "ws-1");

    // Both uploads attempted
    expect(mockUploadItemPhoto).toHaveBeenCalledTimes(2);

    // Cleanup still happens
    expect(mockTransaction).toHaveBeenCalled();
  });

  it("handles blob with missing type by defaulting to image/jpeg", async () => {
    const blobNoType = new Blob(["data"]); // type = ""
    const photo = makeCapturePhoto({ tempItemId: "temp-notype", blob: blobNoType });
    mockGetAllFromIndex.mockResolvedValue([photo]);
    mockUploadItemPhoto.mockResolvedValue({ id: "photo-1" });
    setupTransactionMock();

    const event = makeSyncEvent("items", "create", "temp-notype", "server-1");
    await handleItemSynced(event, "ws-1");

    const uploadedFile = mockUploadItemPhoto.mock.calls[0][2] as File;
    expect(uploadedFile.type).toBe("image/jpeg");
  });
});
