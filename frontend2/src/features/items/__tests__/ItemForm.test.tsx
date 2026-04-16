import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor, act } from "@testing-library/react";
import { renderWithProviders, setupDialogMocks } from "./fixtures";

// Mock AuthContext so the form's useAuth sees a workspace id.
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

// Mock categoriesApi.list so the combobox has an empty resolved list.
vi.mock("@/lib/api/categories", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/api/categories")>();
  return {
    ...actual,
    categoriesApi: {
      ...actual.categoriesApi,
      list: vi.fn().mockResolvedValue({
        items: [
          { id: "11111111-1111-1111-1111-111111111111", name: "Power Tools" },
        ],
      }),
    },
  };
});

import { ItemForm } from "../forms/ItemForm";

beforeEach(() => {
  setupDialogMocks();
  vi.clearAllMocks();
});

describe("ItemForm — validation", () => {
  it("shows 'Name is required.' when name is empty", async () => {
    const onSubmit = vi.fn();
    renderWithProviders(
      <>
        <ItemForm formId="if1" onSubmit={onSubmit} />
        <button type="submit" form="if1">
          go
        </button>
      </>,
    );
    const skuInput = screen.getByLabelText(/sku/i);
    fireEvent.change(skuInput, { target: { value: "ITEM-TEST-0001" } });
    await act(async () => {
      fireEvent.click(screen.getByText("go"));
    });
    await waitFor(() => {
      const errs = screen.queryAllByText("Name is required.");
      expect(errs.length).toBeGreaterThanOrEqual(1);
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows 'SKU is required.' when sku is empty", async () => {
    const onSubmit = vi.fn();
    renderWithProviders(
      <>
        <ItemForm formId="if2" onSubmit={onSubmit} />
        <button type="submit" form="if2">
          go
        </button>
      </>,
    );
    // Field is auto-generated in normal usage, but tests do not pre-fill —
    // simulate the user clearing it.
    const nameInput = screen.getByLabelText(/name/i);
    fireEvent.change(nameInput, { target: { value: "Drill" } });
    await act(async () => {
      fireEvent.click(screen.getByText("go"));
    });
    await waitFor(() => {
      const errs = screen.queryAllByText("SKU is required.");
      expect(errs.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("rejects SKU containing whitespace (pattern)", async () => {
    const onSubmit = vi.fn();
    renderWithProviders(
      <>
        <ItemForm formId="if3" onSubmit={onSubmit} />
        <button type="submit" form="if3">
          go
        </button>
      </>,
    );
    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: "Drill" },
    });
    fireEvent.change(screen.getByLabelText(/sku/i), {
      target: { value: "ITEM 001" },
    });
    await act(async () => {
      fireEvent.click(screen.getByText("go"));
    });
    await waitFor(() => {
      const errs = screen.queryAllByText(
        /letters, numbers, hyphens, or underscores/i,
      );
      expect(errs.length).toBeGreaterThanOrEqual(1);
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("accepts empty barcode (optional) — coerces '' to undefined in payload", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(
      <>
        <ItemForm formId="if4" onSubmit={onSubmit} />
        <button type="submit" form="if4">
          go
        </button>
      </>,
    );
    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: "Drill" },
    });
    fireEvent.change(screen.getByLabelText(/sku/i), {
      target: { value: "ITEM-TEST-0001" },
    });
    await act(async () => {
      fireEvent.click(screen.getByText("go"));
    });
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const payload = onSubmit.mock.calls[0][0];
    expect(payload.barcode).toBeUndefined();
  });
});

describe("ItemForm — edit mode pre-population", () => {
  it("pre-populates fields from defaultValues", () => {
    renderWithProviders(
      <ItemForm
        formId="if5"
        onSubmit={vi.fn()}
        defaultValues={{
          name: "Existing Drill",
          sku: "ITEM-EXIST-0001",
          barcode: "1234567890123",
          description: "A power tool",
        }}
      />,
    );
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
      (screen.getByLabelText(/description/i) as HTMLTextAreaElement).value,
    ).toBe("A power tool");
  });
});

describe("ItemForm — submit payload coercion", () => {
  it("converts empty optional fields to undefined", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(
      <>
        <ItemForm formId="if6" onSubmit={onSubmit} />
        <button type="submit" form="if6">
          go
        </button>
      </>,
    );
    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: "Drill" },
    });
    fireEvent.change(screen.getByLabelText(/sku/i), {
      target: { value: "ITEM-TEST-0001" },
    });
    await act(async () => {
      fireEvent.click(screen.getByText("go"));
    });
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const payload = onSubmit.mock.calls[0][0];
    expect(payload.name).toBe("Drill");
    expect(payload.sku).toBe("ITEM-TEST-0001");
    expect(payload.barcode).toBeUndefined();
    expect(payload.description).toBeUndefined();
    expect(payload.category_id).toBeUndefined();
  });
});

describe("ItemForm — dirty propagation", () => {
  it("calls onDirtyChange(true) after typing into name", async () => {
    const onDirtyChange = vi.fn();
    renderWithProviders(
      <ItemForm
        formId="if7"
        onSubmit={vi.fn()}
        onDirtyChange={onDirtyChange}
      />,
    );
    const nameInput = screen.getByLabelText(/name/i);
    fireEvent.change(nameInput, { target: { value: "A" } });
    await waitFor(() => {
      expect(onDirtyChange).toHaveBeenCalledWith(true);
    });
  });
});
