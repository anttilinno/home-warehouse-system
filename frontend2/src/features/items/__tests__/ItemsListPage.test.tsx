import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, setupDialogMocks, makeItem } from "./fixtures";

// Mock AuthContext so the list/detail/mutation hooks see a workspace id.
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

// Mock the items API — we spy on list + archive + restore + delete + create + update + get.
vi.mock("@/lib/api/items", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/items")>();
  return {
    ...actual,
    itemsApi: {
      ...actual.itemsApi,
      list: vi.fn(),
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      archive: vi.fn(),
      restore: vi.fn(),
      delete: vi.fn(),
    },
  };
});

// Mock categories API for the category name resolver + filter bar.
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

import { itemsApi } from "@/lib/api/items";
import { ItemsListPage } from "../ItemsListPage";

const mockedApi = vi.mocked(itemsApi);

function renderList(initialUrl = "/items") {
  return renderWithProviders(
    <MemoryRouter initialEntries={[initialUrl]}>
      <Routes>
        <Route path="/items" element={<ItemsListPage />} />
        <Route path="/items/:id" element={<div>DETAIL</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

// Helper: route list calls to either the main query or the archived-count query.
function withArchivedCount(archivedCount: number, mainResult: {
  items: unknown[];
  total: number;
  page?: number;
  total_pages?: number;
}) {
  mockedApi.list.mockImplementation(((_ws: string, params?: {
    archived?: boolean;
    limit?: number;
  }) => {
    if (params?.archived === true && params?.limit === 1) {
      return Promise.resolve({
        items: [],
        total: archivedCount,
        page: 1,
        total_pages: 1,
      });
    }
    return Promise.resolve({
      page: 1,
      total_pages: 1,
      ...mainResult,
    });
  }) as typeof itemsApi.list);
}

describe("ItemsListPage — states", () => {
  beforeEach(() => {
    setupDialogMocks();
    vi.clearAllMocks();
    // Default: both queries return zero items.
    withArchivedCount(0, { items: [], total: 0 });
  });

  it("renders loading state initially", () => {
    mockedApi.list.mockImplementation(() => new Promise(() => {})); // never resolves
    renderList();
    expect(screen.getAllByText(/Loading/i).length).toBeGreaterThan(0);
  });

  it("renders NO ITEMS YET empty state when nothing exists", async () => {
    renderList();
    expect(await screen.findByText(/NO ITEMS YET/i)).toBeVisible();
    // Two + NEW ITEM buttons: one in header, one in empty-state action.
    expect(
      screen.getAllByRole("button", { name: /NEW ITEM/i }).length,
    ).toBeGreaterThan(0);
  });

  it("renders NO MATCHES when a filter is active and results are empty", async () => {
    renderList("/items?q=nothing");
    expect(await screen.findByText(/NO MATCHES/i)).toBeVisible();
    expect(
      screen.getByRole("button", { name: /CLEAR FILTERS/i }),
    ).toBeVisible();
  });

  it("renders NO ACTIVE ITEMS when only archived items exist", async () => {
    withArchivedCount(3, { items: [], total: 0 });
    renderList();
    expect(await screen.findByText(/NO ACTIVE ITEMS/i)).toBeVisible();
  });

  it("renders the table with NAME / SKU / CATEGORY / ACTIONS when items exist", async () => {
    const drill = makeItem({
      id: "item-1",
      name: "Cordless Drill",
      sku: "ITEM-AAA-0001",
      category_id: "cat-1",
    });
    withArchivedCount(0, { items: [drill], total: 1 });
    renderList();
    expect(await screen.findByText("Cordless Drill")).toBeVisible();
    expect(screen.getByText("ITEM-AAA-0001")).toBeVisible();
    // Category name resolved via useCategoryNameMap.
    expect(await screen.findByText("Power Tools")).toBeVisible();
  });

  it("renders COULD NOT LOAD ITEMS error with RETRY button on query error", async () => {
    mockedApi.list.mockImplementation(((_ws: string, params?: {
      archived?: boolean;
      limit?: number;
    }) => {
      if (params?.archived === true && params?.limit === 1) {
        return Promise.resolve({
          items: [],
          total: 0,
          page: 1,
          total_pages: 1,
        });
      }
      return Promise.reject(new Error("network"));
    }) as typeof itemsApi.list);
    renderList();
    expect(await screen.findByText(/COULD NOT LOAD ITEMS/i)).toBeVisible();
    expect(screen.getByRole("button", { name: /RETRY/i })).toBeVisible();
  });
});

describe("ItemsListPage — archived row styling (Pitfall 5 + chip on)", () => {
  beforeEach(() => {
    setupDialogMocks();
    vi.clearAllMocks();
  });

  it("archived row has font-sans class on name link and ARCHIVED badge", async () => {
    const archived = makeItem({
      id: "item-x",
      name: "Old Saw",
      is_archived: true,
    });
    withArchivedCount(1, { items: [archived], total: 1 });
    renderList("/items?archived=1");
    const link = await screen.findByRole("link", { name: /Old Saw/i });
    expect(link.className).toContain("font-sans");
    expect(link.className).toContain("line-through");
    // Badge text (ARCHIVED) appears within the archived row.
    expect(screen.getAllByText(/ARCHIVED/i).length).toBeGreaterThan(0);
  });

  it("category cell for item with no category renders em-dash", async () => {
    const bare = makeItem({
      id: "item-2",
      name: "Mystery Part",
      category_id: null,
    });
    withArchivedCount(0, { items: [bare], total: 1 });
    renderList();
    await screen.findByText("Mystery Part");
    // em-dash fallback for missing category
    expect(screen.getByText("—")).toBeVisible();
  });
});

describe("ItemsListPage — interactions", () => {
  beforeEach(() => {
    setupDialogMocks();
    vi.clearAllMocks();
    withArchivedCount(0, { items: [], total: 0 });
  });

  it("clicking + NEW ITEM opens the create panel", async () => {
    const user = userEvent.setup();
    renderList();
    await screen.findByText(/NO ITEMS YET/i);
    const btns = await screen.findAllByRole("button", {
      name: /\+ NEW ITEM/i,
    });
    await user.click(btns[0]);
    // Panel header title "NEW ITEM"
    expect(
      await screen.findByRole("heading", { name: /NEW ITEM/i }),
    ).toBeVisible();
  });

  it("clicking Edit on a row opens the panel in edit mode with prefilled fields", async () => {
    const drill = makeItem({
      id: "item-1",
      name: "Cordless Drill",
      sku: "ITEM-AAA-0001",
    });
    withArchivedCount(0, { items: [drill], total: 1 });
    const user = userEvent.setup();
    renderList();
    await screen.findByText("Cordless Drill");
    await user.click(
      screen.getByRole("button", { name: /Edit Cordless Drill/i }),
    );
    expect(
      await screen.findByRole("heading", { name: /EDIT ITEM/i }),
    ).toBeVisible();
    const nameInput = screen.getByLabelText(/NAME/i) as HTMLInputElement;
    expect(nameInput.value).toBe("Cordless Drill");
  });

  it("clicking Archive on a row opens the archive-first dialog", async () => {
    const drill = makeItem({
      id: "item-1",
      name: "Cordless Drill",
    });
    withArchivedCount(0, { items: [drill], total: 1 });
    const user = userEvent.setup();
    renderList();
    await screen.findByText("Cordless Drill");
    await user.click(
      screen.getByRole("button", { name: /Archive Cordless Drill/i }),
    );
    // Dialog title h2 + confirm button both carry "ARCHIVE ITEM" copy — dialog
    // is open when the dialog body with the unquoted nodeName interpolation is visible.
    expect(
      await screen.findByText(/This will hide Cordless Drill/i),
    ).toBeVisible();
  });

  it("renders the Show archived chip in the filter bar", async () => {
    renderList();
    expect(
      await screen.findByRole("button", { name: /SHOW ARCHIVED/i }),
    ).toBeVisible();
  });
});
