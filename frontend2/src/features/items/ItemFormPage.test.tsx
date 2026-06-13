import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@lingui/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router";
import { i18n } from "@/lib/i18n";
import { server } from "@/test/msw/server";
import { ModalStackProvider } from "@/components/modal";
import { RetroToaster } from "@/components/retro";
import { ItemFormPage } from "./ItemFormPage";

const useWorkspaceMock = vi.fn();
vi.mock("@/features/workspace/useWorkspace", () => ({
  useWorkspace: () => useWorkspaceMock(),
}));

function setWsId(currentWorkspaceId: string | null) {
  useWorkspaceMock.mockReturnValue({
    currentWorkspaceId,
    setWorkspace: vi.fn(),
    workspaces: [],
    isLoading: false,
  });
}

// Probe the live pathname so navigation assertions can read where we landed.
let lastPath = "";
function Probe() {
  lastPath = useLocation().pathname;
  return null;
}

function renderForm(initialEntries: string[]) {
  setWsId("ws-A");
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <ModalStackProvider>
          <RetroToaster />
          <MemoryRouter initialEntries={initialEntries}>
            <Probe />
            <Routes>
              <Route path="/items/new" element={<ItemFormPage />} />
              <Route path="/items/:id/edit" element={<ItemFormPage />} />
              <Route path="/items/:id" element={<div>DETAIL PAGE</div>} />
              <Route path="/items" element={<div>LIST PAGE</div>} />
            </Routes>
          </MemoryRouter>
        </ModalStackProvider>
      </QueryClientProvider>
    </I18nProvider>,
  );
}

const NEW_ITEM = {
  id: "new-1",
  workspace_id: "ws-A",
  sku: "SKU-NEW",
  name: "Cordless Drill",
  min_stock_level: 0,
  short_code: "new123",
  created_at: "2026-06-13T00:00:00Z",
  updated_at: "2026-06-13T00:00:00Z",
};

const EDIT_ITEM = {
  ...NEW_ITEM,
  id: "it-9",
  name: "Existing Drill",
  description: "old notes",
  barcode: "BC-9",
};

afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});

beforeAll(() => {
  i18n.load("en", {});
  i18n.activate("en");
});

describe("ItemFormPage — create", () => {
  it("renders an empty ADD ITEM form", () => {
    renderForm(["/items/new"]);
    expect(
      screen.getByRole("heading", { name: /add item/i }),
    ).toBeInTheDocument();
    const name = screen.getByLabelText(/name/i) as HTMLInputElement;
    expect(name.value).toBe("");
  });

  it("?barcode= prefills the Barcode field and shows FROM SCAN", () => {
    renderForm(["/items/new?barcode=ABC123"]);
    const barcode = screen.getByLabelText(/barcode/i) as HTMLInputElement;
    expect(barcode.value).toBe("ABC123");
    expect(screen.getByText(/^from scan$/i)).toBeInTheDocument();
    expect(
      screen.getByText(/prefilled from scan/i),
    ).toBeInTheDocument();
  });

  it("?name= prefills the Name field alongside ?barcode= (SCAN-10 USE ALL)", () => {
    renderForm(["/items/new?barcode=ABC123&name=Cordless%20Drill"]);
    const name = screen.getByLabelText(/name/i) as HTMLInputElement;
    expect(name.value).toBe("Cordless Drill");
    // barcode + FROM SCAN affordance stay intact.
    const barcode = screen.getByLabelText(/barcode/i) as HTMLInputElement;
    expect(barcode.value).toBe("ABC123");
    expect(screen.getByText(/^from scan$/i)).toBeInTheDocument();
  });

  it("threads ?brand= into the create POST body (SCAN-10 USE ALL)", async () => {
    const user = userEvent.setup();
    let sentBody: Record<string, unknown> | undefined;
    server.use(
      http.post("/api/workspaces/:wsId/items", async ({ request }) => {
        sentBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(NEW_ITEM);
      }),
    );
    renderForm([
      "/items/new?barcode=ABC123&name=Cordless%20Drill&brand=Makita",
    ]);
    await user.type(screen.getByLabelText(/^sku/i), "SKU-NEW");
    await user.click(screen.getByRole("button", { name: /save item/i }));

    await waitFor(() => expect(sentBody).toBeDefined());
    // Name is the guaranteed USE-ALL contract; brand rides along in the create
    // body (the backend item entity owns `brand` — types.ts:120).
    expect(sentBody).toMatchObject({ name: "Cordless Drill", brand: "Makita" });
  });

  it("ignores a stray ?brand= without ?name= (no spurious payload)", async () => {
    const user = userEvent.setup();
    let sentBody: Record<string, unknown> | undefined;
    server.use(
      http.post("/api/workspaces/:wsId/items", async ({ request }) => {
        sentBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(NEW_ITEM);
      }),
    );
    renderForm(["/items/new"]);
    await user.type(screen.getByLabelText(/^sku/i), "SKU-NEW");
    await user.type(screen.getByLabelText(/name/i), "Hand Typed");
    await user.click(screen.getByRole("button", { name: /save item/i }));

    await waitFor(() => expect(sentBody).toBeDefined());
    // No ?brand= in the URL → no brand key in the create body.
    expect("brand" in (sentBody as object)).toBe(false);
  });

  it("ignores ?name= / ?brand= in edit mode (prefill is create-only)", async () => {
    server.use(
      http.get("/api/workspaces/:wsId/items/:id", () =>
        HttpResponse.json(EDIT_ITEM),
      ),
    );
    renderForm(["/items/it-9/edit?name=Should%20Ignore&brand=Nope"]);
    await waitFor(() =>
      expect((screen.getByLabelText(/name/i) as HTMLInputElement).value).toBe(
        "Existing Drill",
      ),
    );
    // The ?name= param did NOT override the loaded item's name.
    expect((screen.getByLabelText(/name/i) as HTMLInputElement).value).not.toBe(
      "Should Ignore",
    );
  });

  it("submits create and navigates to the new detail route", async () => {
    const user = userEvent.setup();
    let posted = false;
    server.use(
      http.post("/api/workspaces/:wsId/items", async () => {
        posted = true;
        return HttpResponse.json(NEW_ITEM);
      }),
    );
    renderForm(["/items/new"]);
    await user.type(screen.getByLabelText(/^sku/i), "SKU-NEW");
    await user.type(screen.getByLabelText(/name/i), "Cordless Drill");
    await user.click(screen.getByRole("button", { name: /save item/i }));

    await waitFor(() => expect(posted).toBe(true));
    await waitFor(() => expect(lastPath).toBe("/items/new-1"));
  });

  it("includes the typed sku in the create POST body", async () => {
    const user = userEvent.setup();
    let sentBody: Record<string, unknown> | undefined;
    server.use(
      http.post("/api/workspaces/:wsId/items", async ({ request }) => {
        sentBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(NEW_ITEM);
      }),
    );
    renderForm(["/items/new"]);
    await user.type(screen.getByLabelText(/^sku/i), "SKU-XYZ");
    await user.type(screen.getByLabelText(/name/i), "Cordless Drill");
    await user.click(screen.getByRole("button", { name: /save item/i }));

    await waitFor(() => expect(sentBody).toBeDefined());
    expect(sentBody).toMatchObject({ sku: "SKU-XYZ", name: "Cordless Drill" });
  });

  it("blocks submit with a zod error when sku is empty (no 422 round-trip)", async () => {
    const user = userEvent.setup();
    let posted = false;
    server.use(
      http.post("/api/workspaces/:wsId/items", () => {
        posted = true;
        return HttpResponse.json(NEW_ITEM);
      }),
    );
    renderForm(["/items/new"]);
    // Name filled, SKU left empty — submit must be blocked client-side.
    await user.type(screen.getByLabelText(/name/i), "Cordless Drill");
    await user.click(screen.getByRole("button", { name: /save item/i }));

    expect(await screen.findByText(/sku is required/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^sku/i)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(posted).toBe(false);
  });

  it("blocks submit with an in-window error when name is empty", async () => {
    const user = userEvent.setup();
    let posted = false;
    server.use(
      http.post("/api/workspaces/:wsId/items", () => {
        posted = true;
        return HttpResponse.json(NEW_ITEM);
      }),
    );
    renderForm(["/items/new"]);
    await user.click(screen.getByRole("button", { name: /save item/i }));

    expect(await screen.findByText(/name is required/i)).toBeInTheDocument();
    const name = screen.getByLabelText(/name/i);
    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(posted).toBe(false);
  });

  it("opens the DISCARD CHANGES? confirm when cancelling a dirty form", async () => {
    const user = userEvent.setup();
    renderForm(["/items/new"]);
    await user.type(screen.getByLabelText(/name/i), "Half-typed");
    await user.click(screen.getByRole("button", { name: /^cancel$/i }));

    expect(
      await screen.findByText(/discard changes\?/i),
    ).toBeInTheDocument();
    // Still on the form — the guard intercepted the navigation.
    expect(lastPath).toBe("/items/new");

    // Discard proceeds to the list.
    await user.click(screen.getByRole("button", { name: /^discard$/i }));
    await waitFor(() => expect(lastPath).toBe("/items"));
  });
});

describe("ItemFormPage — edit", () => {
  it("loads the item and resets the form (EDIT ITEM)", async () => {
    server.use(
      http.get("/api/workspaces/:wsId/items/:id", () =>
        HttpResponse.json(EDIT_ITEM),
      ),
    );
    renderForm(["/items/it-9/edit"]);
    expect(
      screen.getByRole("heading", { name: /edit item/i }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect((screen.getByLabelText(/name/i) as HTMLInputElement).value).toBe(
        "Existing Drill",
      ),
    );
    expect((screen.getByLabelText(/barcode/i) as HTMLInputElement).value).toBe(
      "BC-9",
    );
    // SKU is prefilled but read-only (immutable after create).
    const sku = screen.getByLabelText(/^sku/i) as HTMLInputElement;
    expect(sku.value).toBe("SKU-NEW");
    expect(sku).toBeDisabled();
    expect(
      screen.getByText(/sku can't be changed after an item is created/i),
    ).toBeInTheDocument();
  });

  it("omits sku from the PATCH body even when other fields change", async () => {
    const user = userEvent.setup();
    let sentBody: Record<string, unknown> | undefined;
    server.use(
      http.get("/api/workspaces/:wsId/items/:id", () =>
        HttpResponse.json(EDIT_ITEM),
      ),
      http.patch("/api/workspaces/:wsId/items/:id", async ({ request }) => {
        sentBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(EDIT_ITEM);
      }),
    );
    renderForm(["/items/it-9/edit"]);
    await waitFor(() =>
      expect((screen.getByLabelText(/name/i) as HTMLInputElement).value).toBe(
        "Existing Drill",
      ),
    );
    await user.clear(screen.getByLabelText(/name/i));
    await user.type(screen.getByLabelText(/name/i), "Renamed Drill");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(sentBody).toBeDefined());
    expect(sentBody).toEqual({ name: "Renamed Drill" });
    expect("sku" in (sentBody as object)).toBe(false);
  });

  it("sends '' for a cleared description on PATCH (Pitfall 4)", async () => {
    const user = userEvent.setup();
    let sentBody: Record<string, unknown> | undefined;
    server.use(
      http.get("/api/workspaces/:wsId/items/:id", () =>
        HttpResponse.json(EDIT_ITEM),
      ),
      http.patch("/api/workspaces/:wsId/items/:id", async ({ request }) => {
        sentBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ...EDIT_ITEM, description: undefined });
      }),
    );
    renderForm(["/items/it-9/edit"]);
    await waitFor(() =>
      expect(
        (screen.getByLabelText(/description/i) as HTMLTextAreaElement).value,
      ).toBe("old notes"),
    );

    await user.clear(screen.getByLabelText(/description/i));
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(sentBody).toBeDefined());
    // Cleared description sent as "" (not omitted); untouched name OMITTED.
    expect(sentBody).toEqual({ description: "" });
    await waitFor(() => expect(lastPath).toBe("/items/it-9"));
  });
});
