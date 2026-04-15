import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithProviders, setupDialogMocks, makeContainer, makeLocation } from "./fixtures";

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

const locationsListMock = vi.fn();
const containersListMock = vi.fn();

vi.mock("@/lib/api/locations", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/api/locations")>(
      "@/lib/api/locations",
    );
  return {
    ...actual,
    locationsApi: {
      list: (...args: unknown[]) => locationsListMock(...args),
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
      list: (...args: unknown[]) => containersListMock(...args),
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      archive: vi.fn(),
      restore: vi.fn(),
      remove: vi.fn(),
    },
  };
});

import { ContainersTab } from "../tabs/ContainersTab";

const LOC_A = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
const LOC_B = "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb";

describe("ContainersTab", () => {
  beforeEach(() => {
    setupDialogMocks();
    vi.clearAllMocks();
  });

  it("renders group headers and container rows per location", async () => {
    locationsListMock.mockResolvedValue({
      items: [
        makeLocation({ id: LOC_A, name: "Garage", short_code: "GAR-001" }),
        makeLocation({ id: LOC_B, name: "Attic", short_code: "ATT-001" }),
      ],
      total: 2,
      page: 1,
      total_pages: 1,
    });
    containersListMock.mockResolvedValue({
      items: [
        makeContainer({
          id: "c1",
          name: "Red bin",
          location_id: LOC_A,
          short_code: "GAR-001",
        }),
        makeContainer({
          id: "c2",
          name: "Green bin",
          location_id: LOC_A,
          short_code: "GAR-002",
        }),
        makeContainer({
          id: "c3",
          name: "Old crate",
          location_id: LOC_B,
          short_code: "ATT-001",
        }),
      ],
      total: 3,
      page: 1,
      total_pages: 1,
    });

    renderWithProviders(<ContainersTab />);

    await waitFor(() => {
      expect(screen.getByText("Garage")).toBeInTheDocument();
      expect(screen.getByText("Attic")).toBeInTheDocument();
    });
    expect(screen.getByText("Red bin")).toBeInTheDocument();
    expect(screen.getByText("Green bin")).toBeInTheDocument();
    expect(screen.getByText("Old crate")).toBeInTheDocument();
  });

  it("shows empty state + disabled CTA when zero locations exist", async () => {
    locationsListMock.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      total_pages: 1,
    });
    containersListMock.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      total_pages: 1,
    });

    renderWithProviders(<ContainersTab />);

    await waitFor(() =>
      expect(screen.getByText("NO CONTAINERS YET")).toBeInTheDocument(),
    );
    expect(screen.getByText("Create a location first.")).toBeInTheDocument();
    const newButtons = screen.getAllByText("+ NEW CONTAINER");
    // All instances should be disabled when no locations exist
    for (const btn of newButtons) {
      expect(btn.closest("button")).toBeDisabled();
    }
  });

  it("clicking + NEW CONTAINER when locations exist opens the panel (NEW CONTAINER title visible)", async () => {
    locationsListMock.mockResolvedValue({
      items: [makeLocation({ id: LOC_A, name: "Garage" })],
      total: 1,
      page: 1,
      total_pages: 1,
    });
    containersListMock.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      total_pages: 1,
    });

    renderWithProviders(<ContainersTab />);

    // wait for locations to load so CTA is enabled
    await waitFor(() => {
      const btn = screen
        .getAllByText("+ NEW CONTAINER")
        .map((el) => el.closest("button"))
        .find((b) => b && !b.hasAttribute("disabled"));
      expect(btn).toBeTruthy();
    });
    const enabled = screen
      .getAllByText("+ NEW CONTAINER")
      .map((el) => el.closest("button"))
      .find((b) => b && !b.hasAttribute("disabled"))!;
    await act(async () => {
      fireEvent.click(enabled);
    });

    await waitFor(() =>
      expect(screen.getByText("NEW CONTAINER")).toBeInTheDocument(),
    );
  });
});
