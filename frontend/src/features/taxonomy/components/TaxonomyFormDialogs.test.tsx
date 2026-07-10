import type { ReactElement } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@lingui/react";
import { MemoryRouter, Routes, Route } from "react-router";
import { i18n } from "@/lib/i18n";
import { server } from "@/test/msw/server";
import { ModalStackProvider } from "@/components/modal";
import { registerMutationDefaults } from "@/lib/offline/mutationDefaults";
import type { Container } from "@/lib/api/container";
import { CategoryFormDialog } from "./CategoryFormDialog";
import { ContainerFormDialog } from "./ContainerFormDialog";
import { LabelFormDialog } from "./LabelFormDialog";
import { LocationFormDialog } from "./LocationFormDialog";

// Phase 4 Plan 4.4 (test-gap PLAN-test-gaps.md) — taxonomy FormDialogs. Submit +
// validation-error path only, no visual assertions. Mirrors
// WishlistFormDialog.test.tsx: mocked useWorkspace, MSW-backed create/update,
// zod required-name block asserted via the shared "Name is required." message
// (schema.ts). CategoryFormDialog is the routed form (Window, not RetroDialog);
// the other three are inline RetroDialogs driven by open/onClose props.

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

const CONTAINER: Container = {
  id: "cont-1",
  workspace_id: "ws-1",
  name: "Toolbox A",
  location_id: "loc-1",
  short_code: "TBXA",
  is_archived: false,
  created_at: "2026-06-13T00:00:00Z",
  updated_at: "2026-06-13T00:00:00Z",
};

function renderWithClient(ui: ReactElement) {
  setWsId("ws-1");
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  registerMutationDefaults(client);
  return render(
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <ModalStackProvider>{ui}</ModalStackProvider>
      </QueryClientProvider>
    </I18nProvider>,
  );
}

function renderCategoryDialog(mode: "create" | "edit") {
  return renderWithClient(
    <MemoryRouter
      initialEntries={[
        mode === "create"
          ? "/taxonomy/categories/new"
          : "/taxonomy/categories/cat-tools/edit",
      ]}
    >
      <Routes>
        <Route
          path="/taxonomy/categories/new"
          element={<CategoryFormDialog mode="create" />}
        />
        <Route
          path="/taxonomy/categories/:id/edit"
          element={<CategoryFormDialog mode="edit" />}
        />
        <Route path="/taxonomy" element={<div>TAXONOMY PAGE</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});

describe("CategoryFormDialog", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("blocks submit with a required-name error when name is empty", async () => {
    const user = userEvent.setup();
    const created = vi.fn(() => HttpResponse.json({ id: "cat-new" }));
    server.use(http.post("/api/workspaces/:wsId/categories", created));

    renderCategoryDialog("create");

    await user.click(screen.getByRole("button", { name: /save category/i }));

    expect(await screen.findByText(/name is required/i)).toBeInTheDocument();
    expect(created).not.toHaveBeenCalled();
  });

  it("create mode POSTs the typed name and navigates back to the tab", async () => {
    const user = userEvent.setup();
    let body: Record<string, unknown> | null = null;
    server.use(
      http.post("/api/workspaces/:wsId/categories", async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ id: "cat-new" });
      }),
    );

    renderCategoryDialog("create");

    await user.type(screen.getByLabelText(/^name$/i), "Fasteners");
    await user.click(screen.getByRole("button", { name: /save category/i }));

    expect(await screen.findByText("TAXONOMY PAGE")).toBeInTheDocument();
    expect(body).toMatchObject({ name: "Fasteners" });
  });
});

describe("ContainerFormDialog", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("blocks submit with a required-name error when name is empty", async () => {
    const user = userEvent.setup();
    const created = vi.fn(() => HttpResponse.json(CONTAINER));
    server.use(http.post("/api/workspaces/:wsId/containers", created));

    renderWithClient(<ContainerFormDialog open onClose={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /save container/i }));

    expect(await screen.findByText(/name is required/i)).toBeInTheDocument();
    expect(created).not.toHaveBeenCalled();
  });

  it("edit mode PATCHes the typed body and closes", async () => {
    const user = userEvent.setup();
    let body: Record<string, unknown> | null = null;
    server.use(
      http.patch(
        "/api/workspaces/:wsId/containers/:id",
        async ({ request }) => {
          body = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json(CONTAINER);
        },
      ),
    );
    const onClose = vi.fn();

    renderWithClient(
      <ContainerFormDialog open container={CONTAINER} onClose={onClose} />,
    );

    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(body).toMatchObject({ name: "Toolbox A", location_id: "loc-1" });
  });
});

describe("LabelFormDialog", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("blocks submit with a required-name error when name is empty", async () => {
    const user = userEvent.setup();
    const created = vi.fn(() => HttpResponse.json({ id: "lbl-new", name: "" }));
    server.use(http.post("/api/workspaces/:wsId/labels", created));

    renderWithClient(<LabelFormDialog open onClose={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /save label/i }));

    expect(await screen.findByText(/name is required/i)).toBeInTheDocument();
    expect(created).not.toHaveBeenCalled();
  });

  it("create mode POSTs the typed name and closes", async () => {
    const user = userEvent.setup();
    let body: Record<string, unknown> | null = null;
    const onClose = vi.fn();
    server.use(
      http.post("/api/workspaces/:wsId/labels", async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ id: "lbl-new", name: "Fragile" });
      }),
    );

    renderWithClient(<LabelFormDialog open onClose={onClose} />);

    await user.type(screen.getByLabelText(/^name$/i), "Fragile");
    await user.click(screen.getByRole("button", { name: /save label/i }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(body).toMatchObject({ name: "Fragile" });
  });
});

describe("LocationFormDialog", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("blocks submit with a required-name error when name is empty", async () => {
    const user = userEvent.setup();
    const created = vi.fn(() => HttpResponse.json({ id: "loc-new" }));
    server.use(http.post("/api/workspaces/:wsId/locations", created));

    renderWithClient(<LocationFormDialog open onClose={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /save location/i }));

    expect(await screen.findByText(/name is required/i)).toBeInTheDocument();
    expect(created).not.toHaveBeenCalled();
  });

  it("create mode POSTs the typed name and closes", async () => {
    const user = userEvent.setup();
    let body: Record<string, unknown> | null = null;
    const onClose = vi.fn();
    server.use(
      http.post("/api/workspaces/:wsId/locations", async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ id: "loc-new" });
      }),
    );

    renderWithClient(<LocationFormDialog open onClose={onClose} />);

    await user.type(screen.getByLabelText(/^name$/i), "Attic");
    await user.click(screen.getByRole("button", { name: /save location/i }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(body).toMatchObject({ name: "Attic" });
  });
});
