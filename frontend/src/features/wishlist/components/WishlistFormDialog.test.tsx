import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@lingui/react";
import { MemoryRouter } from "react-router";
import { i18n } from "@/lib/i18n";
import { server } from "@/test/msw/server";
import { ModalStackProvider } from "@/components/modal";
import { RetroToaster } from "@/components/retro";
import type { WishlistItem } from "@/lib/api/wishlist";
import { WishlistFormDialog } from "./WishlistFormDialog";

// Phase 14 Plan 03 Task 2 — WishlistFormDialog tests. useWorkspace mocked; MSW
// backs create/update. Asserts: required-name zod block; create POST body;
// edit-mode status transition PATCH {status}; 409 → calm form-level error.

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

const ITEM: WishlistItem = {
  id: "w-1",
  name: "Cordless Drill",
  priority: 3,
  status: "wanted",
  price_estimate: 4999,
  currency_code: "EUR",
  created_at: "2026-06-13T00:00:00Z",
};

function renderDialog(props: {
  mode: "create" | "edit";
  item?: WishlistItem;
  onClose?: () => void;
}) {
  setWsId("ws-1");
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <ModalStackProvider>
          <RetroToaster />
          <MemoryRouter>
            <WishlistFormDialog
              open
              mode={props.mode}
              item={props.item}
              onClose={props.onClose ?? vi.fn()}
            />
          </MemoryRouter>
        </ModalStackProvider>
      </QueryClientProvider>
    </I18nProvider>,
  );
}

afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});

describe("WishlistFormDialog", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("blocks submit with a required-name error when name is empty", async () => {
    const user = userEvent.setup();
    const created = vi.fn(() => HttpResponse.json(ITEM));
    server.use(http.post("/api/workspaces/:ws/wishlist", created));

    renderDialog({ mode: "create" });

    await user.click(screen.getByRole("button", { name: /add item/i }));

    expect(await screen.findByText(/name is required/i)).toBeInTheDocument();
    expect(created).not.toHaveBeenCalled();
  });

  it("create mode POSTs the typed body (name + priority + status)", async () => {
    const user = userEvent.setup();
    let body: Record<string, unknown> | null = null;
    server.use(
      http.post("/api/workspaces/:ws/wishlist", async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ...ITEM, id: "w-new" });
      }),
    );
    const onClose = vi.fn();

    renderDialog({ mode: "create", onClose });

    await user.type(screen.getByLabelText(/^name$/i), "Heat Gun");
    await user.click(screen.getByRole("button", { name: /add item/i }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(body).toMatchObject({
      name: "Heat Gun",
      priority: 3,
      status: "wanted",
    });
  });

  it("edit mode PATCHes { status: 'ordered' } on a status transition", async () => {
    const user = userEvent.setup();
    let body: Record<string, unknown> | null = null;
    server.use(
      http.patch("/api/workspaces/:ws/wishlist/:id", async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ...ITEM, status: "ordered" });
      }),
    );
    const onClose = vi.fn();

    renderDialog({ mode: "edit", item: ITEM, onClose });

    await user.selectOptions(screen.getByLabelText(/status/i), "ordered");
    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(body).toMatchObject({ status: "ordered" });
  });

  it("renders a calm form error on a 409 illegal transition (no crash)", async () => {
    const user = userEvent.setup();
    server.use(
      http.patch("/api/workspaces/:ws/wishlist/:id", () =>
        HttpResponse.json({ detail: "invalid transition" }, { status: 409 }),
      ),
    );
    const onClose = vi.fn();

    renderDialog({ mode: "edit", item: ITEM, onClose });

    await user.selectOptions(screen.getByLabelText(/status/i), "acquired");
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(
      await screen.findByText(/status change isn't allowed/i),
    ).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});
