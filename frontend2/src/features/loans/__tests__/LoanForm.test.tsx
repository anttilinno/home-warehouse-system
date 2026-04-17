import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor, act } from "@testing-library/react";
import { renderWithProviders, setupDialogMocks, makeLoan } from "./fixtures";

// Mock AuthContext so LoanForm's useAuth sees a workspace id.
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

// Mock items + borrowers APIs so the create-mode combobox data loads resolve.
vi.mock("@/lib/api/items", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/items")>();
  return {
    ...actual,
    itemsApi: {
      ...actual.itemsApi,
      list: vi.fn().mockResolvedValue({
        items: [
          {
            id: "11111111-1111-1111-1111-111111111111",
            workspace_id: "00000000-0000-0000-0000-000000000001",
            name: "Cordless Drill",
            sku: "ITEM-TEST-0001",
            short_code: "T",
            min_stock_level: 0,
            is_archived: false,
            created_at: "2026-04-16T00:00:00Z",
            updated_at: "2026-04-16T00:00:00Z",
          },
        ],
        total: 1,
        page: 1,
        total_pages: 1,
      }),
    },
  };
});

vi.mock("@/lib/api/borrowers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/borrowers")>();
  return {
    ...actual,
    borrowersApi: {
      ...actual.borrowersApi,
      list: vi.fn().mockResolvedValue({
        items: [
          {
            id: "44444444-4444-4444-4444-444444444444",
            workspace_id: "00000000-0000-0000-0000-000000000001",
            name: "Alice Example",
            email: "alice@example.com",
            phone: null,
            notes: null,
            is_archived: false,
            created_at: "2026-04-16T00:00:00Z",
            updated_at: "2026-04-16T00:00:00Z",
          },
        ],
      }),
    },
  };
});

import { LoanForm } from "../forms/LoanForm";

beforeEach(() => {
  setupDialogMocks();
  vi.clearAllMocks();
});

describe("LoanForm — create mode", () => {
  it("renders all create-mode fields (item, borrower, quantity, loaned_at, due_date, notes)", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(
      <LoanForm formId="lf-create-1" mode="create" onSubmit={onSubmit} />,
    );

    // ITEM + BORROWER comboboxes
    expect(await screen.findByText("ITEM")).toBeInTheDocument();
    expect(screen.getByText("BORROWER")).toBeInTheDocument();
    // QUANTITY + LOANED ON + DUE DATE + NOTES
    expect(screen.getByLabelText(/quantity/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/loaned on/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/due date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/notes/i)).toBeInTheDocument();
  });

  it("blocks submit on missing required fields (inventory_id and borrower_id)", async () => {
    const onSubmit = vi.fn();
    renderWithProviders(
      <>
        <LoanForm formId="lf-create-2" mode="create" onSubmit={onSubmit} />
        <button type="submit" form="lf-create-2">
          go
        </button>
      </>,
    );
    await act(async () => {
      fireEvent.click(screen.getByText("go"));
    });
    await waitFor(() => {
      // Either both message strings appear, or submit has been blocked.
      expect(onSubmit).not.toHaveBeenCalled();
    });
    // Specific error messages from the zod schema. RetroFormField renders the
    // error via its own <p>; RetroCombobox also surfaces the error via the
    // `error` prop bridged through cloneElement. Both are acceptable — use
    // queryAllByText so either path passes.
    await waitFor(() => {
      expect(screen.queryAllByText(/pick an item/i).length).toBeGreaterThan(0);
    });
    expect(screen.queryAllByText(/pick a borrower/i).length).toBeGreaterThan(0);
  });
});

describe("LoanForm — edit mode", () => {
  it("shows LOAN DETAILS (LOCKED) block with item + borrower names; no item combobox", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const loan = makeLoan({
      item: {
        id: "11111111-1111-1111-1111-111111111111",
        name: "Cordless Drill",
        primary_photo_thumbnail_url: null,
      },
      borrower: {
        id: "44444444-4444-4444-4444-444444444444",
        name: "Alice Example",
      },
    });

    renderWithProviders(
      <LoanForm
        formId="lf-edit-1"
        mode="edit"
        loan={loan}
        onSubmit={onSubmit}
      />,
    );

    // LOCKED block present
    expect(screen.getByText(/LOAN DETAILS \(LOCKED\)/i)).toBeInTheDocument();
    // Item + borrower names rendered as text
    expect(screen.getByText("Cordless Drill")).toBeInTheDocument();
    expect(screen.getByText("Alice Example")).toBeInTheDocument();
    // ITEM combobox NOT rendered (edit mode)
    // The label "BORROWER" in the LOCKED dl row is a <dt>, not a combobox label;
    // checking the absence of a textbox named ITEM ensures the combobox is gone.
    expect(screen.queryByPlaceholderText(/pick an item/i)).toBeNull();
    expect(screen.queryByPlaceholderText(/pick a borrower/i)).toBeNull();
  });

  it("submit sends only { due_date, notes } to onSubmit", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const loan = makeLoan({ loaned_at: "2026-04-15T10:00:00Z" });

    renderWithProviders(
      <>
        <LoanForm
          formId="lf-edit-2"
          mode="edit"
          loan={loan}
          onSubmit={onSubmit}
        />
        <button type="submit" form="lf-edit-2">
          go
        </button>
      </>,
    );

    const dueDateInput = screen.getByLabelText(/due date/i);
    fireEvent.change(dueDateInput, { target: { value: "2026-05-01" } });
    const notesInput = screen.getByLabelText(/notes/i);
    fireEvent.change(notesInput, { target: { value: "Handle with care" } });

    await act(async () => {
      fireEvent.click(screen.getByText("go"));
    });

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const payload = onSubmit.mock.calls[0][0];
    expect(payload).toEqual({
      due_date: "2026-05-01",
      notes: "Handle with care",
    });
    // No create-mode keys leaked
    expect(payload).not.toHaveProperty("inventory_id");
    expect(payload).not.toHaveProperty("borrower_id");
    expect(payload).not.toHaveProperty("quantity");
    expect(payload).not.toHaveProperty("loaned_at");
  });
});

describe("LoanForm — cross-field validation", () => {
  it("blocks submit when due_date < loaned_at (edit mode)", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    // loan loaned_at is 2026-04-15 -> due_date 2020-01-01 is BEFORE
    const loan = makeLoan({ loaned_at: "2026-04-15T00:00:00Z" });

    renderWithProviders(
      <>
        <LoanForm
          formId="lf-cross-1"
          mode="edit"
          loan={loan}
          onSubmit={onSubmit}
        />
        <button type="submit" form="lf-cross-1">
          go
        </button>
      </>,
    );

    const dueDateInput = screen.getByLabelText(/due date/i);
    fireEvent.change(dueDateInput, { target: { value: "2020-01-01" } });

    await act(async () => {
      fireEvent.click(screen.getByText("go"));
    });

    await waitFor(() => {
      expect(
        screen.queryAllByText(/can't be before the loaned-on date/i).length,
      ).toBeGreaterThan(0);
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe("LoanForm — onDirtyChange", () => {
  it("bubbles isDirty=true after typing into the notes field", async () => {
    const onDirtyChange = vi.fn();
    const loan = makeLoan();
    renderWithProviders(
      <LoanForm
        formId="lf-dirty-1"
        mode="edit"
        loan={loan}
        onSubmit={vi.fn()}
        onDirtyChange={onDirtyChange}
      />,
    );
    const notesInput = screen.getByLabelText(/notes/i);
    fireEvent.change(notesInput, { target: { value: "hi" } });
    await waitFor(() => {
      expect(onDirtyChange).toHaveBeenCalledWith(true);
    });
  });
});
