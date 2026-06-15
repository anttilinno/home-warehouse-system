import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@/lib/i18n";
import { server } from "@/test/msw/server";
import { ModalStackProvider } from "@/components/modal";
import { RetroToaster } from "@/components/retro";
import { labelsApi } from "@/lib/api/labels";
import { LabelsTab } from "./LabelsTab";

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

function renderTab() {
  setWsId("ws-1");
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <ModalStackProvider>
          <RetroToaster />
          <LabelsTab />
        </ModalStackProvider>
      </QueryClientProvider>
    </I18nProvider>,
  );
}

afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});

describe("LabelsTab", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("renders label rows with swatch + name from the BARE { items } list", async () => {
    renderTab();
    // The default MSW fixture is a single label "Power Tools".
    expect(await screen.findByText("Power Tools")).toBeInTheDocument();
  });

  it("⊕ ADD LABEL opens the inline create dialog", async () => {
    const user = userEvent.setup();
    renderTab();
    await screen.findByText("Power Tools");
    await user.click(screen.getByRole("button", { name: /add label/i }));
    // The inline RetroDialog renders the NEW LABEL title.
    expect(await screen.findByText(/NEW LABEL/i)).toBeInTheDocument();
  });

  it("creating a label persists via labelsApi.create then closes the dialog", async () => {
    const user = userEvent.setup();
    const createSpy = vi.spyOn(labelsApi, "create");
    renderTab();
    await screen.findByText("Power Tools");
    await user.click(screen.getByRole("button", { name: /add label/i }));

    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(/name/i), "Fragile");
    // Pick an on-palette swatch (Deep pink).
    await user.click(
      within(dialog).getByRole("button", { name: /deep pink/i }),
    );
    await user.click(
      within(dialog).getByRole("button", { name: /save label/i }),
    );

    await waitFor(() =>
      expect(createSpy).toHaveBeenCalledWith(
        "ws-1",
        expect.objectContaining({ name: "Fragile", color: "#a8334f" }),
      ),
    );
  });

  it("EDIT opens the dialog pre-filled with the label's values", async () => {
    const user = userEvent.setup();
    renderTab();
    const row = (await screen.findByText("Power Tools")).closest(
      "li",
    ) as HTMLElement;
    await user.click(
      within(row).getByRole("button", { name: /edit power tools/i }),
    );

    expect(await screen.findByText(/EDIT LABEL/i)).toBeInTheDocument();
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByLabelText(/name/i)).toHaveValue("Power Tools");
  });

  it("delete opens the pink confirm then calls labelsApi.del", async () => {
    const user = userEvent.setup();
    const delSpy = vi.spyOn(labelsApi, "del");
    renderTab();
    const row = (await screen.findByText("Power Tools")).closest(
      "li",
    ) as HTMLElement;
    await user.click(
      within(row).getByRole("button", { name: /delete power tools/i }),
    );

    expect(await screen.findByText(/DELETE LABEL/i)).toBeInTheDocument();
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /^delete$/i }));

    await waitFor(() => expect(delSpy).toHaveBeenCalledWith("ws-1", "lbl-1"));
  });

  it("archive on an active row calls labelsApi.archive", async () => {
    const user = userEvent.setup();
    const archiveSpy = vi.spyOn(labelsApi, "archive");
    renderTab();
    const row = (await screen.findByText("Power Tools")).closest(
      "li",
    ) as HTMLElement;
    await user.click(
      within(row).getByRole("button", { name: /archive power tools/i }),
    );
    await waitFor(() =>
      expect(archiveSpy).toHaveBeenCalledWith("ws-1", "lbl-1"),
    );
  });

  it("an archived row shows the ARCHIVED badge + RESTORE which calls restore", async () => {
    const user = userEvent.setup();
    server.use(
      http.get("/api/workspaces/:wsId/labels", () =>
        HttpResponse.json({
          items: [
            {
              id: "lbl-archived",
              workspace_id: "ws-1",
              name: "Old Label",
              color: "#b8e0c8",
              is_archived: true,
              created_at: "2026-06-13T00:00:00Z",
              updated_at: "2026-06-13T00:00:00Z",
            },
          ],
        }),
      ),
    );
    const restoreSpy = vi.spyOn(labelsApi, "restore");
    renderTab();
    const row = (await screen.findByText("Old Label")).closest(
      "li",
    ) as HTMLElement;
    expect(within(row).getByText(/ARCHIVED/i)).toBeInTheDocument();
    await user.click(within(row).getByRole("button", { name: /restore/i }));
    await waitFor(() =>
      expect(restoreSpy).toHaveBeenCalledWith("ws-1", "lbl-archived"),
    );
  });

  it("renders the empty state when there are no labels", async () => {
    server.use(
      http.get("/api/workspaces/:wsId/labels", () =>
        HttpResponse.json({ items: [] }),
      ),
    );
    renderTab();
    expect(await screen.findByText(/NO LABELS YET/i)).toBeInTheDocument();
  });

  it("renders the error state with a RETRY action on a load failure", async () => {
    server.use(
      http.get("/api/workspaces/:wsId/labels", () =>
        HttpResponse.json({ message: "boom" }, { status: 500 }),
      ),
    );
    renderTab();
    expect(
      await screen.findByText(/COULDN'T LOAD LABELS/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });
});
