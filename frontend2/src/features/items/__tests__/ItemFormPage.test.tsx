// Phase 65 Plan 05 Task 3 — ItemFormPage integration tests.
// Converts Plan 65-01's 18 it.todo scaffold entries into real user-event
// flows inside MemoryRouter + QueryClientProvider + mocked
// useCreateItem / useBarcodeEnrichment / useAuth.
//
// Groups:
//   A. Route + URL-state (D-01, D-02) — 4 tests
//   B. Chrome (D-03) — 6 tests
//   C. Create flow (D-04, D-05) — 3 tests
//   D. Enrichment integration (D-13..D-16) — 5 tests (one extra for found:false)
//
// Matches Plan 65-01 scaffold's 18 it.todo count (4 + 6 + 3 + 5).
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from "vitest";
import { MemoryRouter, Routes, Route } from "react-router";
import { screen, cleanup, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { ToastProvider } from "@/components/retro";
import { setupDialogMocks } from "./fixtures";

// Mock AuthContext so useAuth returns a workspace id.
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

// Mock categoriesApi so the form's combobox resolves immediately.
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

vi.mock("../hooks/useItemMutations");
vi.mock("../hooks/useBarcodeEnrichment");

// Spy on generateSku so Test 3 + Test 4 can count calls.
vi.mock("../forms/schemas", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../forms/schemas")>();
  return {
    ...actual,
    generateSku: vi.fn(() => "ITEM-TEST-0001"),
  };
});

import { useCreateItem } from "../hooks/useItemMutations";
import { useBarcodeEnrichment } from "../hooks/useBarcodeEnrichment";
import { generateSku } from "../forms/schemas";
import { ItemFormPage } from "../ItemFormPage";

i18n.load("en", {});
i18n.activate("en");

function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

interface RenderPageOpts {
  initial?: string;
  createSpy?: ReturnType<typeof vi.fn>;
  isPending?: boolean;
  enrichment?: {
    data?: unknown;
    isError?: boolean;
    isSuccess?: boolean;
  };
}

function renderPage(opts: RenderPageOpts = {}) {
  const initial = opts.initial ?? "/items/new?barcode=ABC-123";
  const createSpy =
    opts.createSpy ??
    vi.fn().mockResolvedValue({
      id: "new-item-42",
      workspace_id: "00000000-0000-0000-0000-000000000001",
      sku: "ITEM-TEST-0001",
      name: "Drill",
    });
  const isPending = opts.isPending ?? false;

  vi.mocked(useCreateItem).mockReturnValue({
    mutateAsync: createSpy,
    mutate: vi.fn(),
    isPending,
    isSuccess: false,
    isError: false,
    isIdle: true,
    error: null,
    data: undefined,
    variables: undefined,
    reset: vi.fn(),
    status: "idle",
    context: undefined,
    failureCount: 0,
    failureReason: null,
    submittedAt: 0,
    isPaused: false,
  } as never);

  vi.mocked(useBarcodeEnrichment).mockReturnValue({
    data: opts.enrichment?.data,
    isError: opts.enrichment?.isError ?? false,
    isSuccess: opts.enrichment?.isSuccess ?? false,
    isLoading: false,
    isPending: false,
    isFetching: false,
  } as never);

  const client = createTestQueryClient();
  const result = render(
    <MemoryRouter initialEntries={[initial]}>
      <QueryClientProvider client={client}>
        <I18nProvider i18n={i18n}>
          <ToastProvider>
            <Routes>
              <Route path="/items/new" element={<ItemFormPage />} />
              <Route
                path="/items/:id"
                element={<div data-testid="item-detail">detail</div>}
              />
            </Routes>
          </ToastProvider>
        </I18nProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
  return { ...result, createSpy, client };
}

// Wire react-router's useNavigate to a shared spy so Group B can assert on it.
const navigateSpy = vi.fn();
vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return {
    ...actual,
    useNavigate: () => navigateSpy,
  };
});

import { render } from "@testing-library/react";

beforeEach(() => {
  setupDialogMocks();
  vi.clearAllMocks();
  navigateSpy.mockClear();
  vi.mocked(generateSku).mockClear();
  vi.mocked(generateSku).mockReturnValue("ITEM-TEST-0001");
});

afterEach(() => cleanup());

describe("Group A — ItemFormPage route + URL-state (D-01, D-02)", () => {
  it("Test 1: mounts at /items/new?barcode=ABC-123 without throwing", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: /NEW ITEM/i })).toBeInTheDocument();
  });

  it("Test 2: BARCODE input reads ?barcode= query param (ABC-123)", () => {
    renderPage();
    const barcodeInput = screen.getByLabelText(/barcode/i) as HTMLInputElement;
    expect(barcodeInput.value).toBe("ABC-123");
  });

  it("Test 3: generateSku is called exactly once per mount", () => {
    renderPage();
    // ItemFormPage is expected to call generateSku lazily once (useState/useMemo).
    // Allow at most one call — multiple calls indicate render-loop regression.
    expect(vi.mocked(generateSku)).toHaveBeenCalledTimes(1);
  });

  it("Test 4: mounts at /items/new (no barcode param) with empty barcode + auto-generated SKU", () => {
    renderPage({ initial: "/items/new" });
    const barcodeInput = screen.getByLabelText(/barcode/i) as HTMLInputElement;
    expect(barcodeInput.value).toBe("");
    const skuInput = screen.getByLabelText(/sku/i) as HTMLInputElement;
    expect(skuInput.value).toBe("ITEM-TEST-0001");
  });
});

describe("Group B — ItemFormPage chrome (D-03)", () => {
  it("Test 5: heading is NEW ITEM at h1 level", () => {
    renderPage();
    const heading = screen.getByRole("heading", {
      name: /NEW ITEM/i,
      level: 1,
    });
    expect(heading).toBeInTheDocument();
  });

  it("Test 6a: submit button reads CREATE ITEM when idle", () => {
    renderPage();
    expect(
      screen.getByRole("button", { name: /CREATE ITEM/ }),
    ).toBeInTheDocument();
  });

  it("Test 6b: submit button reads WORKING… when mutation isPending", () => {
    renderPage({ isPending: true });
    expect(screen.getByRole("button", { name: /WORKING/ })).toBeInTheDocument();
  });

  it("Test 7: CANCEL on clean form calls navigate(-1)", async () => {
    renderPage();
    const cancelButton = screen.getByRole("button", { name: /CANCEL/i });
    await userEvent.click(cancelButton);
    expect(navigateSpy).toHaveBeenCalledWith(-1);
  });

  it("Test 8: CANCEL on dirty form opens the discard dialog", async () => {
    renderPage();
    const nameInput = screen.getByLabelText(/name/i);
    await userEvent.type(nameInput, "D");
    const cancelButton = screen.getByRole("button", { name: /^CANCEL$/i });
    await userEvent.click(cancelButton);
    expect(
      screen.getByRole("heading", { name: /DISCARD CHANGES\?/i }),
    ).toBeInTheDocument();
    expect(navigateSpy).not.toHaveBeenCalledWith(-1);
  });

  it("Test 9: DISCARD destructive button inside dialog calls navigate(-1)", async () => {
    renderPage();
    await userEvent.type(screen.getByLabelText(/name/i), "D");
    await userEvent.click(screen.getByRole("button", { name: /^CANCEL$/i }));
    // Dialog DISCARD button (destructive variant of RetroConfirmDialog).
    const discardButton = screen.getByRole("button", { name: /^DISCARD$/ });
    await userEvent.click(discardButton);
    expect(navigateSpy).toHaveBeenCalledWith(-1);
  });

  it("Test 10: ← BACK inside dialog closes without nav", async () => {
    renderPage();
    await userEvent.type(screen.getByLabelText(/name/i), "D");
    await userEvent.click(screen.getByRole("button", { name: /^CANCEL$/i }));
    const escapeButton = screen.getByRole("button", { name: /← BACK/ });
    await userEvent.click(escapeButton);
    expect(navigateSpy).not.toHaveBeenCalledWith(-1);
  });
});

describe("Group C — ItemFormPage create flow (D-04, D-05)", () => {
  it("Test 11: successful submit invalidates scanKeys.lookup(barcode)", async () => {
    const createSpy = vi.fn().mockResolvedValue({
      id: "new-item-42",
      workspace_id: "ws-1",
      sku: "ITEM-TEST-0001",
      name: "Drill",
    });
    const { client } = renderPage({ createSpy });
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");

    await userEvent.type(screen.getByLabelText(/name/i), "Drill");
    await act(async () => {
      await userEvent.click(
        screen.getByRole("button", { name: /CREATE ITEM/ }),
      );
    });

    // Find the scanKeys.lookup invalidation among all invalidation calls.
    const match = invalidateSpy.mock.calls.find((call) => {
      const key = call[0]?.queryKey;
      return (
        Array.isArray(key) &&
        key[0] === "scan" &&
        key[1] === "lookup" &&
        key[2] === "ABC-123"
      );
    });
    expect(match).toBeTruthy();
  });

  it("Test 12: successful submit navigates to /items/{created.id}", async () => {
    const createSpy = vi.fn().mockResolvedValue({
      id: "new-item-42",
      workspace_id: "ws-1",
      sku: "ITEM-TEST-0001",
      name: "Drill",
    });
    renderPage({ createSpy });

    await userEvent.type(screen.getByLabelText(/name/i), "Drill");
    await act(async () => {
      await userEvent.click(
        screen.getByRole("button", { name: /CREATE ITEM/ }),
      );
    });
    expect(navigateSpy).toHaveBeenCalledWith("/items/new-item-42");
  });

  it("Test 13: page imports useCreateItem (D-05 — no duplicate mutation logic)", async () => {
    const createSpy = vi.fn().mockResolvedValue({
      id: "new-item-42",
      workspace_id: "ws-1",
      sku: "ITEM-TEST-0001",
      name: "Drill",
    });
    renderPage({ createSpy });
    await userEvent.type(screen.getByLabelText(/name/i), "Drill");
    await act(async () => {
      await userEvent.click(
        screen.getByRole("button", { name: /CREATE ITEM/ }),
      );
    });
    // Page hits the shared useCreateItem hook, not a fresh in-line mutation.
    expect(createSpy).toHaveBeenCalled();
  });
});

describe("Group D — ItemFormPage + UpcSuggestionBanner integration (D-13..D-16)", () => {
  it("Test 14: enrichment.data.found === true renders SUGGESTIONS AVAILABLE banner", () => {
    renderPage({
      enrichment: {
        data: {
          found: true,
          barcode: "5449000000996",
          name: "Coca-Cola",
          brand: "The Coca-Cola Company",
          category: "beverages",
          image_url: null,
        },
      },
    });
    expect(
      screen.getByRole("heading", { name: /SUGGESTIONS AVAILABLE/i }),
    ).toBeInTheDocument();
  });

  it("Test 15: clicking NAME [USE] updates the form NAME field", async () => {
    renderPage({
      enrichment: {
        data: {
          found: true,
          barcode: "5449000000996",
          name: "Coca-Cola",
          brand: null,
          category: null,
          image_url: null,
        },
      },
    });
    const nameRow = screen.getByText("NAME").closest("div");
    const useButton = nameRow!.querySelector(
      "button",
    ) as HTMLButtonElement;
    expect(useButton.textContent).toMatch(/\[USE\]/);
    await userEvent.click(useButton);
    const nameField = screen.getByLabelText(/^name$/i) as HTMLInputElement;
    expect(nameField.value).toBe("Coca-Cola");
  });

  it("Test 16: enrichment.isError → banner does NOT render; form remains usable", () => {
    renderPage({
      enrichment: {
        data: undefined,
        isError: true,
      },
    });
    expect(
      screen.queryByText(/SUGGESTIONS AVAILABLE/i),
    ).not.toBeInTheDocument();
    // Form still renders fine.
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
  });

  it("Test 17: enrichment.data.found === false → banner does NOT render", () => {
    renderPage({
      enrichment: {
        data: {
          found: false,
          barcode: "5449000000996",
          name: "",
          brand: null,
          category: null,
          image_url: null,
        },
        isSuccess: true,
      },
    });
    expect(
      screen.queryByText(/SUGGESTIONS AVAILABLE/i),
    ).not.toBeInTheDocument();
  });

  it("Test 18: D-15 category hint renders but no [USE] chip on the helper row", () => {
    renderPage({
      enrichment: {
        data: {
          found: true,
          barcode: "5449000000996",
          name: "Coca-Cola",
          brand: null,
          category: "beverages",
          image_url: null,
        },
      },
    });
    const helper = screen.getByText(
      /Category hint: beverages — pick manually below\./,
    );
    expect(helper).toBeInTheDocument();
    // Helper <p> has no button children.
    const helperEl = helper.closest("p") as HTMLElement;
    expect(helperEl.querySelector("button")).toBeNull();
  });
});
