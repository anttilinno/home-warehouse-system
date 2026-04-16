import { describe, expect, it, vi, beforeEach } from "vitest";
import { createRef } from "react";
import { screen, fireEvent, waitFor, act } from "@testing-library/react";
import { renderWithProviders, setupDialogMocks, makeItem } from "./fixtures";
import { HttpError } from "@/lib/api";

// Mock AuthContext so the mutation hooks inside ItemPanel see a workspace id.
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

// Mock the items API module — spies on create/update.
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

// Mock categoriesApi so ItemForm's combobox query resolves.
vi.mock("@/lib/api/categories", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/api/categories")>();
  return {
    ...actual,
    categoriesApi: {
      ...actual.categoriesApi,
      list: vi.fn().mockResolvedValue({ items: [] }),
    },
  };
});

import { itemsApi } from "@/lib/api/items";
import { ItemPanel, type ItemPanelHandle } from "../panel/ItemPanel";

const mockedApi = vi.mocked(itemsApi);

describe("ItemPanel", () => {
  beforeEach(() => {
    setupDialogMocks();
    vi.clearAllMocks();
  });

  it("open('create') renders NEW ITEM title and pre-filled SKU", async () => {
    const ref = createRef<ItemPanelHandle>();
    renderWithProviders(<ItemPanel ref={ref} />);
    act(() => {
      ref.current!.open("create");
    });
    expect(await screen.findByText(/NEW ITEM/i)).toBeVisible();
    const skuInput = screen.getByLabelText(/sku/i) as HTMLInputElement;
    // generateSku() returns "ITEM-<ts>-<rand>".
    expect(skuInput.value).toMatch(/^ITEM-/);
    expect(
      screen.getByRole("button", { name: /CREATE ITEM/i }),
    ).toBeInTheDocument();
  });

  it("open('edit', item) renders EDIT ITEM with populated fields", async () => {
    const ref = createRef<ItemPanelHandle>();
    renderWithProviders(<ItemPanel ref={ref} />);
    const item = makeItem({
      id: "abc-123",
      name: "Existing Drill",
      sku: "ITEM-EXIST-0001",
      barcode: "1234567890123",
    });
    act(() => {
      ref.current!.open("edit", item);
    });
    expect(await screen.findByText(/EDIT ITEM/i)).toBeVisible();
    expect(
      (screen.getByLabelText(/name/i) as HTMLInputElement).value,
    ).toBe("Existing Drill");
    expect((screen.getByLabelText(/sku/i) as HTMLInputElement).value).toBe(
      "ITEM-EXIST-0001",
    );
    expect(
      (screen.getByLabelText(/barcode/i) as HTMLInputElement).value,
    ).toBe("1234567890123");
    expect(
      screen.getByRole("button", { name: /SAVE ITEM/i }),
    ).toBeInTheDocument();
  });

  it("successful create closes the panel and calls itemsApi.create", async () => {
    mockedApi.create.mockResolvedValueOnce(
      makeItem({ name: "New Drill" }),
    );
    const ref = createRef<ItemPanelHandle>();
    renderWithProviders(<ItemPanel ref={ref} />);
    act(() => {
      ref.current!.open("create");
    });
    const nameInput = await screen.findByLabelText(/name/i);
    fireEvent.change(nameInput, { target: { value: "New Drill" } });

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /CREATE ITEM/i }),
      );
    });

    await waitFor(() =>
      expect(mockedApi.create).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ name: "New Drill" }),
      ),
    );
    // Panel closes after mutation resolves
    await waitFor(() => {
      expect(screen.queryByText(/NEW ITEM/i)).not.toBeInTheDocument();
    });
  });

  it("SKU collision (400) keeps the panel open for retry", async () => {
    mockedApi.create.mockRejectedValueOnce(
      new HttpError(400, "SKU already exists in workspace"),
    );
    const ref = createRef<ItemPanelHandle>();
    renderWithProviders(<ItemPanel ref={ref} />);
    act(() => {
      ref.current!.open("create");
    });
    const nameInput = await screen.findByLabelText(/name/i);
    fireEvent.change(nameInput, { target: { value: "Drill" } });

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /CREATE ITEM/i }),
      );
    });

    await waitFor(() => expect(mockedApi.create).toHaveBeenCalled());
    // Panel still open (title still visible)
    expect(screen.getByText(/NEW ITEM/i)).toBeVisible();
  });

  it("edit mode dispatches to itemsApi.update with item.id", async () => {
    mockedApi.update.mockResolvedValueOnce(
      makeItem({ id: "abc-123", name: "Updated Drill" }),
    );
    const ref = createRef<ItemPanelHandle>();
    renderWithProviders(<ItemPanel ref={ref} />);
    const item = makeItem({
      id: "abc-123",
      name: "Old Drill",
      sku: "ITEM-OLD-0001",
    });
    act(() => {
      ref.current!.open("edit", item);
    });
    const nameInput = await screen.findByLabelText(/name/i);
    fireEvent.change(nameInput, { target: { value: "Updated Drill" } });

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /SAVE ITEM/i }),
      );
    });

    await waitFor(() =>
      expect(mockedApi.update).toHaveBeenCalledWith(
        expect.any(String),
        "abc-123",
        expect.objectContaining({ name: "Updated Drill" }),
      ),
    );
  });
});
