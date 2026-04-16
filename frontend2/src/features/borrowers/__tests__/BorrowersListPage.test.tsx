import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  renderWithProviders,
  setupDialogMocks,
  makeBorrower,
} from "./fixtures";

// Mock AuthContext so hooks see a workspace id.
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

// Mock the borrowers API module — spies on list/get/archive/restore/remove/create/update.
vi.mock("@/lib/api/borrowers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/borrowers")>();
  return {
    ...actual,
    borrowersApi: {
      ...actual.borrowersApi,
      list: vi.fn(),
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      archive: vi.fn(),
      restore: vi.fn(),
      remove: vi.fn(),
    },
  };
});

import { borrowersApi } from "@/lib/api/borrowers";
import { BorrowersListPage } from "../BorrowersListPage";

const mockedApi = vi.mocked(borrowersApi);

function renderList() {
  return renderWithProviders(
    <MemoryRouter initialEntries={["/borrowers"]}>
      <Routes>
        <Route path="/borrowers" element={<BorrowersListPage />} />
        <Route path="/borrowers/:id" element={<div>DETAIL</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("BorrowersListPage", () => {
  beforeEach(() => {
    setupDialogMocks();
    vi.clearAllMocks();
  });

  it("renders loading then populated rows from api", async () => {
    mockedApi.list.mockResolvedValue({
      items: [
        makeBorrower({
          id: "b-1",
          name: "Alice",
          email: "alice@example.com",
          phone: "+372 555 0101",
        }),
        makeBorrower({ id: "b-2", name: "Bob" }),
      ],
    });
    renderList();
    expect(await screen.findByText("Alice")).toBeVisible();
    expect(screen.getByText("alice@example.com")).toBeVisible();
    expect(screen.getByText("+372 555 0101")).toBeVisible();
    // Bob has no email/phone → em-dash appears at least twice
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });

  it("shows empty state when list is empty", async () => {
    mockedApi.list.mockResolvedValue({ items: [] });
    renderList();
    expect(await screen.findByText(/NO BORROWERS YET/i)).toBeVisible();
  });

  it("shows error state on list failure with Retry button", async () => {
    mockedApi.list.mockRejectedValue(new Error("boom"));
    renderList();
    expect(
      await screen.findByText(/Could not load borrowers/i),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: /Retry/i })).toBeVisible();
  });

  it("+ NEW BORROWER opens the panel in create mode", async () => {
    mockedApi.list.mockResolvedValue({ items: [] });
    const user = userEvent.setup();
    renderList();
    await screen.findByText(/NO BORROWERS YET/i);
    await user.click(
      screen.getAllByRole("button", { name: /\+ NEW BORROWER/i })[0],
    );
    expect(
      await screen.findByRole("heading", { name: /NEW BORROWER/i }),
    ).toBeVisible();
  });

  it("archived toggle filters rows and reveals RESTORE + DELETE actions on archived rows", async () => {
    mockedApi.list.mockImplementation(((_wsId: string, params?: { archived?: boolean }) => {
      const includeArchived = params?.archived === true;
      const items = includeArchived
        ? [
            makeBorrower({ id: "a1", name: "Alive" }),
            makeBorrower({ id: "a2", name: "Zoe", is_archived: true }),
          ]
        : [makeBorrower({ id: "a1", name: "Alive" })];
      return Promise.resolve({ items });
    }) as typeof borrowersApi.list);

    const user = userEvent.setup();
    renderList();
    await screen.findByText("Alive");
    expect(screen.queryByText("Zoe")).not.toBeInTheDocument();
    await user.click(screen.getByLabelText(/Show archived/i));
    expect(await screen.findByText("Zoe")).toBeVisible();
    expect(
      screen.getByRole("button", { name: /Restore Zoe/i }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: /Delete Zoe/i }),
    ).toBeVisible();
  });

  it("clicking EDIT opens panel in edit mode with prefilled name", async () => {
    mockedApi.list.mockResolvedValue({
      items: [
        makeBorrower({ id: "b-1", name: "Alice", email: "a@x.com" }),
      ],
    });
    const user = userEvent.setup();
    renderList();
    await screen.findByText("Alice");
    await user.click(
      screen.getByRole("button", { name: /Edit Alice/i }),
    );
    expect(await screen.findByText(/EDIT BORROWER/i)).toBeVisible();
    const nameInput = screen.getByLabelText(/NAME/i) as HTMLInputElement;
    expect(nameInput.value).toBe("Alice");
  });

  it("clicking ARCHIVE opens the archive-first dialog", async () => {
    mockedApi.list.mockResolvedValue({
      items: [makeBorrower({ id: "b-1", name: "Alice" })],
    });
    const user = userEvent.setup();
    renderList();
    await screen.findByText("Alice");
    await user.click(
      screen.getByRole("button", { name: /Archive Alice/i }),
    );
    expect(await screen.findByRole("heading", { name: /ARCHIVE BORROWER/i })).toBeVisible();
  });
});
