import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, setupDialogMocks, makeItem } from "./fixtures";

vi.mock("@/features/auth/AuthContext", () => ({
  useAuth: () => ({
    workspaceId: "00000000-0000-0000-0000-000000000001",
    isLoading: false,
    isAuthenticated: true,
    user: { id: "u1" },
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
  }),
}));

vi.mock("@/lib/api/items", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/items")>();
  return {
    ...actual,
    itemsApi: {
      ...actual.itemsApi,
      list: vi.fn().mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        total_pages: 1,
      }),
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      archive: vi.fn(),
      restore: vi.fn(),
      delete: vi.fn(),
    },
  };
});

vi.mock("@/lib/api/categories", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/api/categories")>();
  return {
    ...actual,
    categoriesApi: {
      ...actual.categoriesApi,
      list: vi.fn().mockResolvedValue({
        items: [
          {
            id: "cat-1",
            workspace_id: "00000000-0000-0000-0000-000000000001",
            name: "Power Tools",
            parent_category_id: null,
            description: null,
            is_archived: false,
            created_at: "2026-04-16T00:00:00Z",
            updated_at: "2026-04-16T00:00:00Z",
          },
        ],
      }),
    },
  };
});

// Stub ItemPhotoGallery so the detail-page tests don't need to mock the
// itemPhotosApi + React Query list fetch; the gallery is exercised by its own
// suite. We assert that the stub renders (i.e. the page wires it) + that the
// archived prop propagates correctly.
vi.mock("../photos/ItemPhotoGallery", () => ({
  ItemPhotoGallery: ({
    itemId,
    itemName,
    archived,
  }: {
    itemId: string;
    itemName: string;
    archived: boolean;
  }) => (
    <div
      data-testid="item-photo-gallery"
      data-item-id={itemId}
      data-item-name={itemName}
      data-archived={archived ? "true" : "false"}
    >
      GALLERY
    </div>
  ),
}));

import { itemsApi } from "@/lib/api/items";
import { ItemDetailPage } from "../ItemDetailPage";

const mockedApi = vi.mocked(itemsApi);

function renderDetail(id: string) {
  return renderWithProviders(
    <MemoryRouter initialEntries={[`/items/${id}`]}>
      <Routes>
        <Route path="/items" element={<div>LIST</div>} />
        <Route path="/items/:id" element={<ItemDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ItemDetailPage — states", () => {
  beforeEach(() => {
    setupDialogMocks();
    vi.clearAllMocks();
  });

  it("renders loading state", () => {
    mockedApi.get.mockImplementation(() => new Promise(() => {}));
    renderDetail("item-1");
    expect(screen.getByText(/Loading/i)).toBeVisible();
  });

  it("renders ITEM NOT FOUND on query error", async () => {
    mockedApi.get.mockRejectedValue(new Error("404"));
    renderDetail("item-missing");
    expect(await screen.findByText(/ITEM NOT FOUND/i)).toBeVisible();
    expect(screen.getByText(/BACK TO ITEMS/i)).toBeVisible();
  });

  it("renders populated detail with SKU / barcode / description / resolved category", async () => {
    const item = makeItem({
      id: "item-1",
      name: "Cordless Drill",
      sku: "ITEM-AAA-0001",
      barcode: "0123456789012",
      description: "18V cordless",
      category_id: "cat-1",
    });
    mockedApi.get.mockResolvedValue(item);
    renderDetail("item-1");
    expect(await screen.findByText("Cordless Drill")).toBeVisible();
    expect(screen.getByText("ITEM-AAA-0001")).toBeVisible();
    expect(screen.getByText("0123456789012")).toBeVisible();
    expect(screen.getByText("18V cordless")).toBeVisible();
    // Category name resolved via useCategoryNameMap.
    expect(await screen.findByText("Power Tools")).toBeVisible();
  });

  it("renders em-dash for missing optional fields", async () => {
    const item = makeItem({
      id: "item-1",
      barcode: null,
      description: null,
      category_id: null,
    });
    mockedApi.get.mockResolvedValue(item);
    renderDetail("item-1");
    await screen.findByText(/DETAILS/i);
    // Three em-dashes for barcode, category, description
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(3);
  });

  it("renders archived header treatment + RESTORE + DELETE actions", async () => {
    const item = makeItem({
      id: "item-1",
      name: "Old Saw",
      is_archived: true,
    });
    mockedApi.get.mockResolvedValue(item);
    renderDetail("item-1");
    // Header badge ARCHIVED
    expect(await screen.findByText(/ARCHIVED/i)).toBeVisible();
    expect(
      screen.getByRole("button", { name: /RESTORE ITEM/i }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: /^DELETE$/i }),
    ).toBeVisible();
  });
});

describe("ItemDetailPage — PHOTOS section wires ItemPhotoGallery (Phase 61)", () => {
  beforeEach(() => {
    setupDialogMocks();
    vi.clearAllMocks();
  });

  it("renders ItemPhotoGallery with itemId / itemName / archived=false", async () => {
    mockedApi.get.mockResolvedValue(
      makeItem({ id: "item-1", name: "Cordless Drill" }),
    );
    renderDetail("item-1");
    const gallery = await screen.findByTestId("item-photo-gallery");
    expect(gallery).toBeVisible();
    expect(gallery.getAttribute("data-item-id")).toBe("item-1");
    expect(gallery.getAttribute("data-item-name")).toBe("Cordless Drill");
    expect(gallery.getAttribute("data-archived")).toBe("false");
  });

  it("passes archived=true into the gallery for archived items", async () => {
    mockedApi.get.mockResolvedValue(
      makeItem({ id: "item-1", is_archived: true }),
    );
    renderDetail("item-1");
    const gallery = await screen.findByTestId("item-photo-gallery");
    expect(gallery.getAttribute("data-archived")).toBe("true");
  });

  it("no longer renders the old Phase 61 placeholder copy", async () => {
    mockedApi.get.mockResolvedValue(makeItem());
    renderDetail("item-1");
    await screen.findByTestId("item-photo-gallery");
    expect(screen.queryByText(/Photos will appear here after Phase 61/i))
      .toBeNull();
  });

  it("renders LOANS placeholder", async () => {
    mockedApi.get.mockResolvedValue(makeItem());
    renderDetail("item-1");
    expect(await screen.findByText(/NO LOANS/i)).toBeVisible();
  });
});

describe("ItemDetailPage — header thumbnail (Phase 61)", () => {
  beforeEach(() => {
    setupDialogMocks();
    vi.clearAllMocks();
  });

  it("renders ItemHeaderThumbnail with primary_photo_thumbnail_url as <img> when available", async () => {
    const item = makeItem({
      id: "item-1",
      name: "Cordless Drill",
      primary_photo_thumbnail_url: "https://x.test/thumb.jpg",
    });
    mockedApi.get.mockResolvedValue(item);
    renderDetail("item-1");
    await screen.findByText("Cordless Drill");
    // The thumbnail box renders an img with the thumbnail URL (decorative alt).
    const imgs = document.querySelectorAll('img[src="https://x.test/thumb.jpg"]');
    expect(imgs.length).toBeGreaterThan(0);
  });

  it("dims the header thumbnail for archived items", async () => {
    const item = makeItem({
      id: "item-1",
      name: "Old Saw",
      is_archived: true,
      primary_photo_thumbnail_url: "https://x.test/thumb.jpg",
    });
    mockedApi.get.mockResolvedValue(item);
    renderDetail("item-1");
    await screen.findByText("Old Saw");
    const img = document.querySelector('img[src="https://x.test/thumb.jpg"]');
    expect(img).not.toBeNull();
    // opacity-50 lives on the surrounding box wrapper.
    const wrapper = img?.closest("div");
    expect(wrapper?.className).toMatch(/opacity-50/);
  });
});

describe("ItemDetailPage — delete flow navigates to /items (Pitfall 9)", () => {
  beforeEach(() => {
    setupDialogMocks();
    vi.clearAllMocks();
  });

  it("successful delete navigates back to list", async () => {
    const user = userEvent.setup();
    const item = makeItem({
      id: "item-1",
      name: "Old Saw",
      is_archived: true,
    });
    mockedApi.get.mockResolvedValue(item);
    mockedApi.delete.mockResolvedValue(undefined);
    renderDetail("item-1");
    await screen.findByText("Old Saw");

    // Archived items surface DELETE directly in the action cluster.
    await user.click(screen.getByRole("button", { name: /^DELETE$/i }));

    // Archive-first dialog opens (reused for both paths). Click the
    // "delete permanently" secondary link to switch to the hard-delete dialog.
    const link = await screen.findByText(/delete permanently/i);
    await user.click(link);

    // The switchToDelete handoff uses setTimeout(..., 0); the destructive
    // dialog button "DELETE ITEM" should render after the tick.
    const deleteBtn = await screen.findByRole("button", {
      name: /DELETE ITEM/i,
    });
    await user.click(deleteBtn);

    // After successful delete, onAfterDelete runs navigate("/items") —
    // the LIST placeholder renders.
    expect(await screen.findByText("LIST")).toBeVisible();
  });
});

describe("ItemDetailPage — edit", () => {
  beforeEach(() => {
    setupDialogMocks();
    vi.clearAllMocks();
  });

  it("clicking EDIT ITEM opens the panel in edit mode", async () => {
    const user = userEvent.setup();
    const item = makeItem({ id: "item-1", name: "Drill" });
    mockedApi.get.mockResolvedValue(item);
    renderDetail("item-1");
    await screen.findByText("Drill");
    await user.click(
      screen.getByRole("button", { name: /^EDIT ITEM$/i }),
    );
    // Panel title "EDIT ITEM"
    expect(
      await screen.findByRole("heading", { name: /EDIT ITEM/i }),
    ).toBeVisible();
  });
});
