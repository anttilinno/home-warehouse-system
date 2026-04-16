import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRef } from "react";
import { screen, fireEvent, waitFor, act } from "@testing-library/react";
import { renderWithProviders, setupDialogMocks, makeBorrower } from "./fixtures";

// Mock AuthContext so the mutation hooks inside BorrowerPanel see a workspace id.
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

// Mock the borrowers API module — spies on create/update.
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
import {
  BorrowerPanel,
  type BorrowerPanelHandle,
} from "../panel/BorrowerPanel";

const mockedApi = vi.mocked(borrowersApi);

describe("BorrowerPanel", () => {
  beforeEach(() => {
    setupDialogMocks();
    vi.clearAllMocks();
  });

  it("opens in create mode with blank fields and NEW BORROWER title", async () => {
    const ref = createRef<BorrowerPanelHandle>();
    renderWithProviders(<BorrowerPanel ref={ref} />);
    act(() => {
      ref.current!.open("create");
    });
    expect(await screen.findByText(/NEW BORROWER/i)).toBeVisible();
    const name = screen.getByLabelText(/name/i) as HTMLInputElement;
    expect(name.value).toBe("");
    expect(
      screen.getByRole("button", { name: /CREATE BORROWER/i }),
    ).toBeInTheDocument();
  });

  it("opens in edit mode and prefills fields (null mapped to empty string)", async () => {
    const ref = createRef<BorrowerPanelHandle>();
    const borrower = makeBorrower({
      name: "Bob",
      email: "bob@example.com",
      phone: null,
      notes: null,
    });
    renderWithProviders(<BorrowerPanel ref={ref} />);
    act(() => {
      ref.current!.open("edit", borrower);
    });
    expect(await screen.findByText(/EDIT BORROWER/i)).toBeVisible();
    const name = screen.getByLabelText(/name/i) as HTMLInputElement;
    const email = screen.getByLabelText(/email/i) as HTMLInputElement;
    const phone = screen.getByLabelText(/phone/i) as HTMLInputElement;
    const notes = screen.getByLabelText(/notes/i) as HTMLTextAreaElement;
    expect(name.value).toBe("Bob");
    expect(email.value).toBe("bob@example.com");
    expect(phone.value).toBe("");
    expect(notes.value).toBe("");
    expect(
      screen.getByRole("button", { name: /SAVE BORROWER/i }),
    ).toBeInTheDocument();
  });

  it("submitting create calls borrowersApi.create and closes panel on success", async () => {
    const createdBorrower = makeBorrower({ name: "Carol" });
    mockedApi.create.mockResolvedValueOnce(createdBorrower);

    const ref = createRef<BorrowerPanelHandle>();
    renderWithProviders(<BorrowerPanel ref={ref} />);
    act(() => {
      ref.current!.open("create");
    });

    const nameInput = await screen.findByLabelText(/name/i);
    fireEvent.change(nameInput, { target: { value: "Carol" } });

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /CREATE BORROWER/i }),
      );
    });

    await waitFor(() => {
      expect(mockedApi.create).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ name: "Carol" }),
      );
    });

    // Panel closes after mutation resolves
    await waitFor(() => {
      expect(screen.queryByText(/NEW BORROWER/i)).not.toBeInTheDocument();
    });
  });

  it("submitting edit calls borrowersApi.update with id and new values", async () => {
    mockedApi.update.mockResolvedValueOnce(
      makeBorrower({ id: "b-1", name: "Bob Updated" }),
    );

    const ref = createRef<BorrowerPanelHandle>();
    renderWithProviders(<BorrowerPanel ref={ref} />);
    const borrower = makeBorrower({ id: "b-1", name: "Bob" });
    act(() => {
      ref.current!.open("edit", borrower);
    });

    const nameInput = await screen.findByLabelText(/name/i);
    fireEvent.change(nameInput, { target: { value: "Bob Updated" } });

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /SAVE BORROWER/i }),
      );
    });

    await waitFor(() => {
      expect(mockedApi.update).toHaveBeenCalledWith(
        expect.any(String),
        "b-1",
        expect.objectContaining({ name: "Bob Updated" }),
      );
    });
  });
});
