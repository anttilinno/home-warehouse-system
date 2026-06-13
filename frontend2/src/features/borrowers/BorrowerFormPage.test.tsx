import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@lingui/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router";
import { i18n } from "@/lib/i18n";
import { server } from "@/test/msw/server";
import { borrowerHandlers } from "@/test/msw/borrowerHandlers";
import { ModalStackProvider } from "@/components/modal";
import { RetroToaster } from "@/components/retro";
import { BorrowerFormPage } from "./BorrowerFormPage";

const useWorkspaceMock = vi.fn();
vi.mock("@/features/workspace/useWorkspace", () => ({
  useWorkspace: () => useWorkspaceMock(),
}));

function setWsId(currentWorkspaceId: string | null) {
  useWorkspaceMock.mockReturnValue({
    currentWorkspaceId,
    setWorkspace: vi.fn(),
    workspaces: [{ id: "ws-1", name: "Home" }],
    isLoading: false,
  });
}

let lastPath = "";
function Probe() {
  const loc = useLocation();
  lastPath = loc.pathname;
  return null;
}

function renderForm(
  initialEntries: string[],
  // Per-test overrides registered AFTER the base handlers so they win.
  overrides: Parameters<typeof server.use> = [],
) {
  setWsId("ws-1");
  server.use(...borrowerHandlers);
  if (overrides.length) server.use(...overrides);
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
              <Route path="/borrowers/new" element={<BorrowerFormPage />} />
              <Route
                path="/borrowers/:id/edit"
                element={<BorrowerFormPage />}
              />
              <Route
                path="/borrowers/:id"
                element={<div>BORROWER DETAIL</div>}
              />
              <Route path="/borrowers" element={<div>BORROWERS LIST</div>} />
            </Routes>
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

beforeAll(() => {
  i18n.load("en", {});
  i18n.activate("en");
});

describe("BorrowerFormPage", () => {
  it("renders NEW BORROWER for the create route", () => {
    renderForm(["/borrowers/new"]);
    expect(
      screen.getByRole("heading", { name: /new borrower/i }),
    ).toBeInTheDocument();
  });

  it("create with name only POSTs { name } — no email/phone/notes keys", async () => {
    const user = userEvent.setup();
    let sentBody: Record<string, unknown> | undefined;
    renderForm(
      ["/borrowers/new"],
      [
        http.post("/api/workspaces/:wsId/borrowers", async ({ request }) => {
          sentBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({
            id: "bor-new",
            workspace_id: "ws-1",
            name: String(sentBody.name),
            is_archived: false,
            created_at: "2026-06-13T00:00:00Z",
            updated_at: "2026-06-13T00:00:00Z",
          });
        }),
      ],
    );

    await user.type(screen.getByLabelText(/name/i), "Alex Carter");
    await user.click(screen.getByRole("button", { name: /save borrower/i }));

    await waitFor(() => expect(sentBody).toBeDefined());
    expect(sentBody).toEqual({ name: "Alex Carter" });
    // The load-bearing assertion: NO empty optional keys on the wire.
    expect("email" in (sentBody as object)).toBe(false);
    expect("phone" in (sentBody as object)).toBe(false);
    expect("notes" in (sentBody as object)).toBe(false);
    await waitFor(() => expect(lastPath).toBe("/borrowers/bor-new"));
  });

  it("create with all fields POSTs name + email + phone + notes", async () => {
    const user = userEvent.setup();
    let sentBody: Record<string, unknown> | undefined;
    renderForm(
      ["/borrowers/new"],
      [
        http.post("/api/workspaces/:wsId/borrowers", async ({ request }) => {
          sentBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({
            id: "bor-new",
            workspace_id: "ws-1",
            name: String(sentBody.name),
            is_archived: false,
            created_at: "2026-06-13T00:00:00Z",
            updated_at: "2026-06-13T00:00:00Z",
          });
        }),
      ],
    );

    await user.type(screen.getByLabelText(/name/i), "Sam Diaz");
    await user.type(screen.getByLabelText(/email/i), "sam@example.io");
    await user.type(screen.getByLabelText(/phone/i), "+1 555 0100");
    await user.type(screen.getByLabelText(/notes/i), "lives next door");
    await user.click(screen.getByRole("button", { name: /save borrower/i }));

    await waitFor(() => expect(sentBody).toBeDefined());
    expect(sentBody).toEqual({
      name: "Sam Diaz",
      email: "sam@example.io",
      phone: "+1 555 0100",
      notes: "lives next door",
    });
  });

  it("blocks submit with the required error when name is empty", async () => {
    const user = userEvent.setup();
    let posted = false;
    renderForm(
      ["/borrowers/new"],
      [
        http.post("/api/workspaces/:wsId/borrowers", () => {
          posted = true;
          return HttpResponse.json({});
        }),
      ],
    );

    await user.click(screen.getByRole("button", { name: /save borrower/i }));

    expect(await screen.findByText(/name is required\./i)).toBeInTheDocument();
    expect(posted).toBe(false);
  });

  it("blocks submit with the email error when the email is malformed", async () => {
    const user = userEvent.setup();
    let posted = false;
    renderForm(
      ["/borrowers/new"],
      [
        http.post("/api/workspaces/:wsId/borrowers", () => {
          posted = true;
          return HttpResponse.json({});
        }),
      ],
    );

    await user.type(screen.getByLabelText(/name/i), "Alex Carter");
    await user.type(screen.getByLabelText(/email/i), "not-an-email");
    await user.click(screen.getByRole("button", { name: /save borrower/i }));

    expect(
      await screen.findByText(/enter a valid email address\./i),
    ).toBeInTheDocument();
    expect(posted).toBe(false);
  });

  it("edit mode prefills from borrowersApi.get and PATCHes the change", async () => {
    const user = userEvent.setup();
    let patchBody: Record<string, unknown> | undefined;
    renderForm(
      ["/borrowers/bor-1/edit"],
      [
        http.get("/api/workspaces/:wsId/borrowers/:id", ({ params }) =>
          HttpResponse.json({
            id: String(params.id),
            workspace_id: "ws-1",
            name: "Alex Carter",
            email: "alex@example.io",
            phone: "+1 555 0100",
            notes: "lives next door",
            is_archived: false,
            created_at: "2026-06-01T00:00:00Z",
            updated_at: "2026-06-01T00:00:00Z",
          }),
        ),
        http.patch(
          "/api/workspaces/:wsId/borrowers/:id",
          async ({ params, request }) => {
            patchBody = (await request.json()) as Record<string, unknown>;
            return HttpResponse.json({
              id: String(params.id),
              workspace_id: "ws-1",
              name: String(patchBody.name),
              is_archived: false,
              created_at: "2026-06-01T00:00:00Z",
              updated_at: "2026-06-13T00:00:00Z",
            });
          },
        ),
      ],
    );

    expect(
      screen.getByRole("heading", { name: /edit borrower/i }),
    ).toBeInTheDocument();
    // Prefilled from the GET.
    const nameField = (await screen.findByLabelText(
      /name/i,
    )) as HTMLInputElement;
    await waitFor(() => expect(nameField.value).toBe("Alex Carter"));

    await user.clear(nameField);
    await user.type(nameField, "Alex C.");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(patchBody).toBeDefined());
    expect(patchBody).toMatchObject({ name: "Alex C." });
    await waitFor(() => expect(lastPath).toBe("/borrowers/bor-1"));
  });
});
