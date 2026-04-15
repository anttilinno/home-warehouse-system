import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithProviders, setupDialogMocks } from "./fixtures";

// Mock AuthContext so useAuth() returns a stable workspace id
const mockUseAuth = vi.fn(() => ({
  workspaceId: "00000000-0000-0000-0000-000000000001",
  isLoading: false,
  isAuthenticated: true,
  user: null,
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  refreshUser: vi.fn(),
}));
vi.mock("@/features/auth/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock each API surface consumed by the three tabs
vi.mock("@/lib/api/categories", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/api/categories")>(
      "@/lib/api/categories",
    );
  return {
    ...actual,
    categoriesApi: {
      list: vi.fn().mockResolvedValue({ items: [] }),
      listRoot: vi.fn(),
      listChildren: vi.fn(),
      breadcrumb: vi.fn(),
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      archive: vi.fn(),
      restore: vi.fn(),
      remove: vi.fn(),
    },
  };
});
vi.mock("@/lib/api/locations", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/api/locations")>(
      "@/lib/api/locations",
    );
  return {
    ...actual,
    locationsApi: {
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
      remove: vi.fn(),
    },
  };
});
vi.mock("@/lib/api/containers", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/api/containers")>(
      "@/lib/api/containers",
    );
  return {
    ...actual,
    containersApi: {
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
      remove: vi.fn(),
    },
  };
});

import TaxonomyPage from "../TaxonomyPage";

describe("TaxonomyPage", () => {
  beforeEach(() => {
    window.location.hash = "";
    setupDialogMocks();
    vi.clearAllMocks();
  });

  it("renders the CATEGORIES tab by default and shows empty state after load", async () => {
    renderWithProviders(<TaxonomyPage />);
    expect(screen.getByText("TAXONOMY")).toBeInTheDocument();
    expect(screen.getByText("CATEGORIES")).toBeInTheDocument();
    expect(screen.getByText("LOCATIONS")).toBeInTheDocument();
    expect(screen.getByText("CONTAINERS")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText("NO CATEGORIES YET")).toBeInTheDocument(),
    );
  });

  it("clicking LOCATIONS tab updates window.location.hash", async () => {
    renderWithProviders(<TaxonomyPage />);
    await act(async () => {
      fireEvent.click(screen.getByText("LOCATIONS"));
    });
    expect(window.location.hash).toBe("#locations");
  });

  it("external hashchange event switches to CONTAINERS tab", async () => {
    renderWithProviders(<TaxonomyPage />);
    await act(async () => {
      window.location.hash = "#containers";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    await waitFor(() =>
      expect(screen.getByText("NO CONTAINERS YET")).toBeInTheDocument(),
    );
  });

  it("empty categories render the + NEW CATEGORY action button", async () => {
    renderWithProviders(<TaxonomyPage />);
    await waitFor(() =>
      expect(screen.getByText("NO CATEGORIES YET")).toBeInTheDocument(),
    );
    const newButtons = screen.getAllByText("+ NEW CATEGORY");
    // One in the header toolbar + one in the empty state action
    expect(newButtons.length).toBeGreaterThanOrEqual(1);
  });
});
