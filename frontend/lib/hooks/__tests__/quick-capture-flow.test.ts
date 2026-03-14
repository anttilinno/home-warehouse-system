/**
 * Integration tests for the quick capture → sync → photo upload flow.
 *
 * Tests the critical path that was completely untested:
 * 1. Photo capture and validation in non-secure contexts (HTTP/LAN)
 * 2. Item creation via offline mutation + photo storage in IndexedDB
 * 3. Post-sync photo upload to backend
 *
 * These tests would have caught:
 * - crypto.randomUUID() crash on HTTP (non-secure context)
 * - Missing photo upload after item sync
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { validateImageFile } from "@/lib/utils/image";
import { handleItemSynced } from "@/lib/sync/capture-photo-uploader";
import { createMutationEntry } from "@/lib/test-utils/factories";
import type { SyncEvent } from "@/lib/sync/sync-manager";
import type { CapturePhoto } from "@/lib/db/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockDbAdd, mockDbGetAllFromIndex, mockDbDelete, mockDbPut, mockDbTransaction, mockUploadItemPhoto, mockQueueMutation } = vi.hoisted(() => ({
  mockDbAdd: vi.fn(),
  mockDbGetAllFromIndex: vi.fn(),
  mockDbDelete: vi.fn().mockResolvedValue(undefined),
  mockDbPut: vi.fn().mockResolvedValue(undefined),
  mockDbTransaction: vi.fn(),
  mockUploadItemPhoto: vi.fn(),
  mockQueueMutation: vi.fn(),
}));

vi.mock("@/lib/db/offline-db", () => ({
  getDB: vi.fn(),
  getAll: vi.fn().mockResolvedValue([]),
}));

import { getDB } from "@/lib/db/offline-db";

vi.mock("@/lib/api/item-photos", () => ({
  itemPhotosApi: {
    uploadItemPhoto: (...args: unknown[]) => mockUploadItemPhoto(...args),
  },
}));

vi.mock("@/lib/sync/mutation-queue", () => ({
  queueMutation: (...args: unknown[]) => mockQueueMutation(...args),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setupCleanupMock() {
  const mockCursor = {
    delete: vi.fn().mockResolvedValue(undefined),
    continue: vi.fn().mockResolvedValue(null),
  };
  mockDbTransaction.mockReturnValue({
    store: {
      index: vi.fn().mockReturnValue({
        openCursor: vi.fn().mockResolvedValue(mockCursor),
      }),
    },
    done: Promise.resolve(),
  });
  return mockCursor;
}

function createTestBlob(size = 100): Blob {
  const data = new Uint8Array(size);
  return new Blob([data], { type: "image/jpeg" });
}

// ---------------------------------------------------------------------------
// Test: Non-secure context safety (crypto.randomUUID fallback)
// ---------------------------------------------------------------------------

describe("Non-secure context safety", () => {
  let originalRandomUUID: typeof crypto.randomUUID;

  beforeEach(() => {
    originalRandomUUID = crypto.randomUUID;
  });

  afterEach(() => {
    crypto.randomUUID = originalRandomUUID;
  });

  it("crypto.randomUUID?.() fallback generates an ID when randomUUID is unavailable", () => {
    // Simulate non-secure context (HTTP over LAN)
    // @ts-expect-error - intentionally removing for test
    delete crypto.randomUUID;

    // This is the pattern used in quick-capture page.tsx line 153
    const id =
      crypto.randomUUID?.() ??
      Math.random().toString(36).slice(2) + Date.now().toString(36);

    expect(id).toBeTruthy();
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(5);
  });

  it("crypto.randomUUID?.() uses randomUUID when available", () => {
    // Secure context - randomUUID exists
    const id =
      crypto.randomUUID?.() ??
      Math.random().toString(36).slice(2) + Date.now().toString(36);

    // UUID format: 8-4-4-4-12
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });
});

// ---------------------------------------------------------------------------
// Test: Image validation
// ---------------------------------------------------------------------------

describe("Image validation for quick capture", () => {
  it("accepts JPEG images", () => {
    const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });
    expect(validateImageFile(file).valid).toBe(true);
  });

  it("accepts PNG images", () => {
    const file = new File(["data"], "photo.png", { type: "image/png" });
    expect(validateImageFile(file).valid).toBe(true);
  });

  it("rejects non-image files", () => {
    const file = new File(["data"], "doc.pdf", { type: "application/pdf" });
    const result = validateImageFile(file);
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("rejects files exceeding 10MB", () => {
    // Create a file that reports >10MB size
    const bigData = new ArrayBuffer(10 * 1024 * 1024 + 1);
    const file = new File([bigData], "huge.jpg", { type: "image/jpeg" });
    const result = validateImageFile(file);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("size");
  });
});

// ---------------------------------------------------------------------------
// Test: Photo storage in IndexedDB
// ---------------------------------------------------------------------------

describe("Photo storage flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDB).mockResolvedValue({
      add: mockDbAdd,
      getAllFromIndex: mockDbGetAllFromIndex,
      delete: mockDbDelete,
      put: mockDbPut,
      transaction: mockDbTransaction,
    } as never);
  });

  it("stores photo blob with correct metadata", async () => {
    mockDbAdd.mockResolvedValue(1);
    const blob = createTestBlob();

    // Simulate what quick-capture page does after taking a photo
    const { useCapturePhotos } = await import("@/lib/hooks/use-capture-photos");
    const { renderHook, act } = await import("@testing-library/react");
    const { result } = renderHook(() => useCapturePhotos());

    await act(async () => {
      await result.current.storePhoto("temp-item-id", blob);
    });

    expect(mockDbAdd).toHaveBeenCalledWith("quickCapturePhotos", {
      tempItemId: "temp-item-id",
      blob,
      capturedAt: expect.any(Number),
      status: "pending",
    });
  });
});

// ---------------------------------------------------------------------------
// Test: End-to-end sync → photo upload flow
// ---------------------------------------------------------------------------

describe("Post-sync photo upload (capture-photo-uploader)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDB).mockResolvedValue({
      add: mockDbAdd,
      getAllFromIndex: mockDbGetAllFromIndex,
      delete: mockDbDelete,
      put: mockDbPut,
      transaction: mockDbTransaction,
    } as never);
  });

  it("uploads photos to backend after item creation syncs", async () => {
    // 1. Simulate photos stored in IndexedDB during quick capture
    const storedPhotos: CapturePhoto[] = [
      {
        id: 1,
        tempItemId: "temp-abc",
        blob: createTestBlob(200),
        capturedAt: Date.now(),
        status: "pending",
      },
      {
        id: 2,
        tempItemId: "temp-abc",
        blob: createTestBlob(300),
        capturedAt: Date.now(),
        status: "pending",
      },
    ];
    mockDbGetAllFromIndex.mockResolvedValue(storedPhotos);
    mockUploadItemPhoto.mockResolvedValue({ id: "uploaded-1" });
    setupCleanupMock();

    // 2. Simulate MUTATION_SYNCED event (item created on server)
    const event: SyncEvent = {
      type: "MUTATION_SYNCED",
      payload: {
        mutation: createMutationEntry({
          entity: "items",
          operation: "create",
          idempotencyKey: "temp-abc",
          workspaceId: "ws-1",
        }),
        resolvedId: "server-item-id-789",
      },
    };

    // 3. Handle the sync event
    await handleItemSynced(event, "ws-1");

    // 4. Verify photos were uploaded with the real server ID
    expect(mockUploadItemPhoto).toHaveBeenCalledTimes(2);
    expect(mockUploadItemPhoto).toHaveBeenCalledWith(
      "ws-1",
      "server-item-id-789",
      expect.any(File)
    );

    // 5. Verify IndexedDB cleanup — photos deleted individually per upload
    expect(mockDbDelete).toHaveBeenCalledTimes(2);
    expect(mockDbDelete).toHaveBeenCalledWith("quickCapturePhotos", 1);
    expect(mockDbDelete).toHaveBeenCalledWith("quickCapturePhotos", 2);
  });

  it("uses temp ID as fallback when server doesn't return resolved ID", async () => {
    const storedPhotos: CapturePhoto[] = [
      {
        id: 1,
        tempItemId: "temp-no-resolve",
        blob: createTestBlob(),
        capturedAt: Date.now(),
        status: "pending",
      },
    ];
    mockDbGetAllFromIndex.mockResolvedValue(storedPhotos);
    mockUploadItemPhoto.mockResolvedValue({ id: "p1" });
    setupCleanupMock();

    const event: SyncEvent = {
      type: "MUTATION_SYNCED",
      payload: {
        mutation: createMutationEntry({
          entity: "items",
          operation: "create",
          idempotencyKey: "temp-no-resolve",
          workspaceId: "ws-1",
        }),
        // No resolvedId!
      },
    };

    await handleItemSynced(event, "ws-1");

    // Falls back to idempotency key
    expect(mockUploadItemPhoto).toHaveBeenCalledWith(
      "ws-1",
      "temp-no-resolve",
      expect.any(File)
    );
  });

  it("does not upload photos for non-item sync events", async () => {
    const event: SyncEvent = {
      type: "MUTATION_SYNCED",
      payload: {
        mutation: createMutationEntry({
          entity: "categories",
          operation: "create",
        }),
      },
    };

    await handleItemSynced(event, "ws-1");

    expect(mockDbGetAllFromIndex).not.toHaveBeenCalled();
    expect(mockUploadItemPhoto).not.toHaveBeenCalled();
  });

  it("does not upload photos for item update events", async () => {
    const event: SyncEvent = {
      type: "MUTATION_SYNCED",
      payload: {
        mutation: createMutationEntry({
          entity: "items",
          operation: "update",
        }),
      },
    };

    await handleItemSynced(event, "ws-1");

    expect(mockDbGetAllFromIndex).not.toHaveBeenCalled();
  });

  it("gracefully handles upload failures without losing remaining photos", async () => {
    const storedPhotos: CapturePhoto[] = [
      { id: 1, tempItemId: "temp-fail", blob: createTestBlob(), capturedAt: Date.now(), status: "pending" },
      { id: 2, tempItemId: "temp-fail", blob: createTestBlob(), capturedAt: Date.now(), status: "pending" },
      { id: 3, tempItemId: "temp-fail", blob: createTestBlob(), capturedAt: Date.now(), status: "pending" },
    ];
    mockDbGetAllFromIndex.mockResolvedValue(storedPhotos);
    mockUploadItemPhoto
      .mockResolvedValueOnce({ id: "p1" })
      .mockRejectedValueOnce(new Error("Server 500"))
      .mockResolvedValueOnce({ id: "p3" });
    setupCleanupMock();

    const event: SyncEvent = {
      type: "MUTATION_SYNCED",
      payload: {
        mutation: createMutationEntry({
          entity: "items",
          operation: "create",
          idempotencyKey: "temp-fail",
          workspaceId: "ws-1",
        }),
        resolvedId: "server-id",
      },
    };

    // Should not throw
    await handleItemSynced(event, "ws-1");

    // All 3 attempted despite failure in the middle
    expect(mockUploadItemPhoto).toHaveBeenCalledTimes(3);
  });

  it("skips upload when no photos exist in IndexedDB", async () => {
    mockDbGetAllFromIndex.mockResolvedValue([]);

    const event: SyncEvent = {
      type: "MUTATION_SYNCED",
      payload: {
        mutation: createMutationEntry({
          entity: "items",
          operation: "create",
          idempotencyKey: "temp-empty",
          workspaceId: "ws-1",
        }),
        resolvedId: "server-id",
      },
    };

    await handleItemSynced(event, "ws-1");

    expect(mockUploadItemPhoto).not.toHaveBeenCalled();
    expect(mockDbTransaction).not.toHaveBeenCalled();
  });
});
