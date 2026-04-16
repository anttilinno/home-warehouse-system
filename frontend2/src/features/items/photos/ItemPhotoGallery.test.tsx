import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ItemPhotoGallery } from "./ItemPhotoGallery";
import { makeItemPhoto } from "../__tests__/fixtures";

i18n.load("en", {});
i18n.activate("en");

// Mock AuthContext so the hook can read workspaceId without a real provider.
vi.mock("@/features/auth/AuthContext", () => ({
  useAuth: () => ({
    workspaceId: "ws-1",
    user: { id: "u1" },
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
  }),
}));

// Spy mocks for each itemPhotosApi method
const listForItemMock = vi.fn();
const uploadMock = vi.fn();
const removeMock = vi.fn();
const setPrimaryMock = vi.fn();

vi.mock("@/lib/api/itemPhotos", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/itemPhotos")>();
  return {
    ...actual,
    itemPhotosApi: {
      listForItem: (...args: unknown[]) => listForItemMock(...args),
      upload: (...args: unknown[]) => uploadMock(...args),
      remove: (...args: unknown[]) => removeMock(...args),
      setPrimary: (...args: unknown[]) => setPrimaryMock(...args),
      get: vi.fn(),
    },
  };
});

// Capture toast messages — mock the retro barrel's useToast while leaving the
// rest of the barrel intact (RetroButton, RetroEmptyState, etc. still render).
const addToastMock = vi.fn();
vi.mock("@/components/retro", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/retro")>();
  return {
    ...actual,
    useToast: () => ({ addToast: addToastMock }),
  };
});

function renderGallery(
  props: { itemId?: string; itemName?: string; archived?: boolean } = {}
) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <I18nProvider i18n={i18n}>
        <ItemPhotoGallery
          itemId={props.itemId ?? "item-1"}
          itemName={props.itemName ?? "Drill"}
          archived={props.archived ?? false}
        />
      </I18nProvider>
    </QueryClientProvider>
  );
}

describe("ItemPhotoGallery", () => {
  beforeEach(() => {
    listForItemMock.mockReset();
    uploadMock.mockReset();
    removeMock.mockReset();
    setPrimaryMock.mockReset();
    addToastMock.mockReset();
  });

  it("renders the empty state when photos is empty", async () => {
    listForItemMock.mockResolvedValue([]);
    renderGallery();
    await waitFor(() =>
      expect(screen.getByText(/NO PHOTOS YET/i)).toBeTruthy()
    );
  });

  it("shows the ADD PHOTOS button when not archived", async () => {
    listForItemMock.mockResolvedValue([]);
    renderGallery({ archived: false });
    await waitFor(() =>
      expect(
        screen.getAllByRole("button", { name: /ADD PHOTOS/i }).length
      ).toBeGreaterThan(0)
    );
  });

  it("hides the ADD PHOTOS button when archived", async () => {
    listForItemMock.mockResolvedValue([]);
    renderGallery({ archived: true });
    await waitFor(() =>
      expect(screen.getByText(/NO PHOTOS YET/i)).toBeTruthy()
    );
    expect(
      screen.queryByRole("button", { name: /ADD PHOTOS/i })
    ).toBeNull();
  });

  it("rejects HEIC files with a clear error toast", async () => {
    listForItemMock.mockResolvedValue([makeItemPhoto({ id: "p1" })]);
    const { container } = renderGallery();
    await waitFor(() =>
      expect(
        screen.getAllByRole("button", { name: /ADD PHOTOS/i }).length
      ).toBeGreaterThan(0)
    );

    const heicFile = new File(["x"], "photo.heic", { type: "image/heic" });
    const input = container.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { files: [heicFile] } });
    });

    expect(addToastMock).toHaveBeenCalledWith(
      expect.stringContaining("HEIC not supported"),
      "error"
    );
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it("rejects oversized files with a per-file error toast", async () => {
    listForItemMock.mockResolvedValue([makeItemPhoto({ id: "p1" })]);
    const { container } = renderGallery();
    await waitFor(() =>
      expect(
        screen.getAllByRole("button", { name: /ADD PHOTOS/i }).length
      ).toBeGreaterThan(0)
    );

    const bigFile = new File([new Uint8Array(11 * 1024 * 1024)], "big.jpg", {
      type: "image/jpeg",
    });
    const input = container.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { files: [bigFile] } });
    });

    expect(addToastMock).toHaveBeenCalledWith(
      expect.stringContaining("over 10 MB"),
      "error"
    );
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it("uploads accepted files sequentially", async () => {
    listForItemMock.mockResolvedValue([]);
    uploadMock.mockResolvedValue(makeItemPhoto());
    const { container } = renderGallery();
    await waitFor(() =>
      expect(
        screen.getAllByRole("button", { name: /ADD PHOTOS/i }).length
      ).toBeGreaterThan(0)
    );

    const f1 = new File(["x"], "a.jpg", { type: "image/jpeg" });
    const f2 = new File(["y"], "b.png", { type: "image/png" });
    const input = container.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { files: [f1, f2] } });
    });

    await waitFor(() => expect(uploadMock).toHaveBeenCalledTimes(2));
    expect(uploadMock.mock.calls[0][2]).toBe(f1);
    expect(uploadMock.mock.calls[1][2]).toBe(f2);
  });

  it("opens the lightbox when a tile is clicked", async () => {
    listForItemMock.mockResolvedValue([
      makeItemPhoto({ id: "p1", is_primary: true, filename: "one.jpg" }),
      makeItemPhoto({ id: "p2", filename: "two.jpg" }),
    ]);
    renderGallery();
    await waitFor(() =>
      expect(
        screen.getAllByRole("button", { name: /Open photo/i }).length
      ).toBeGreaterThan(0)
    );
    const tiles = screen.getAllByRole("button", { name: /Open photo/i });
    fireEvent.click(tiles[1]);
    await waitFor(() => expect(screen.getByRole("dialog")).toBeTruthy());
    expect(screen.getByText("2 / 2")).toBeTruthy();
  });

  it("renders the error empty state when the photos query fails", async () => {
    listForItemMock.mockRejectedValue(new Error("boom"));
    renderGallery();
    await waitFor(() =>
      expect(screen.getByText(/COULD NOT LOAD PHOTOS/i)).toBeTruthy()
    );
  });
});
