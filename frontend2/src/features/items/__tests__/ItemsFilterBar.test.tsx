import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, fireEvent, act } from "@testing-library/react";
import { renderWithProviders, setupDialogMocks } from "./fixtures";

// Mock AuthContext so the bar's useQuery sees a workspace.
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

// Mock categoriesApi for the combobox options.
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

import { ItemsFilterBar } from "../filters/ItemsFilterBar";
import type { ItemsListUiState } from "../filters/useItemsListQueryParams";

const baseState: ItemsListUiState = {
  q: "",
  category: null,
  sort: "name",
  sortDir: "asc",
  archived: false,
  page: 1,
};

beforeEach(() => {
  setupDialogMocks();
  vi.clearAllMocks();
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ItemsFilterBar — search debounce", () => {
  it("delays search URL update by 300ms", async () => {
    const onUpdate = vi.fn();
    renderWithProviders(
      <ItemsFilterBar
        state={baseState}
        onUpdate={onUpdate}
        archivedCount={0}
      />,
    );
    const input = screen.getByRole("searchbox");
    // Type a value into the controlled search input. The chip/search bar
    // schedules a 300ms debounced update; we verify it has NOT fired yet.
    fireEvent.change(input, { target: { value: "drill" } });
    expect(onUpdate).not.toHaveBeenCalledWith({ q: "drill" });
    // Advance the fake timer past the 300ms debounce threshold.
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(onUpdate).toHaveBeenCalledWith({ q: "drill" });
  });
});

describe("ItemsFilterBar — chip toggle", () => {
  it("clicking chip flips archived", () => {
    const onUpdate = vi.fn();
    renderWithProviders(
      <ItemsFilterBar
        state={baseState}
        onUpdate={onUpdate}
        archivedCount={7}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /SHOW ARCHIVED/i }));
    expect(onUpdate).toHaveBeenCalledWith({ archived: true });
  });
});
