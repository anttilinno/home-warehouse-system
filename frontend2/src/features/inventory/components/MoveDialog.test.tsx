import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@/lib/i18n";
import { server } from "@/test/msw/server";
import { ModalStackProvider } from "@/components/modal";
import { RetroToaster } from "@/components/retro";
import type { Inventory } from "@/lib/types";
import { MoveDialog } from "./MoveDialog";

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

const ENTRY: Inventory = {
  id: "inv-1",
  workspace_id: "ws-A",
  item_id: "it-1",
  location_id: "loc-1",
  container_id: "cont-1",
  quantity: 3,
  condition: "GOOD",
  status: "AVAILABLE",
  is_archived: false,
  created_at: "2026-06-13T00:00:00Z",
  updated_at: "2026-06-13T00:00:00Z",
};

const LOCATION_OPTIONS = [
  { id: "loc-1", label: "Garage" },
  { id: "loc-2", label: "Attic" },
];
const CONTAINER_OPTIONS = [
  { id: "cont-1", label: "Bin A" },
  { id: "cont-2", label: "Bin B" },
];

function renderDialog(props?: { onClose?: () => void; entry?: Inventory }) {
  setWsId("ws-A");
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const onClose = props?.onClose ?? vi.fn();
  render(
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <ModalStackProvider>
          <RetroToaster />
          <MoveDialog
            open
            onClose={onClose}
            entry={props?.entry ?? ENTRY}
            locationOptions={LOCATION_OPTIONS}
            containerOptions={CONTAINER_OPTIONS}
          />
        </ModalStackProvider>
      </QueryClientProvider>
    </I18nProvider>,
  );
  return { client, onClose };
}

afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});

beforeAll(() => {
  i18n.load("en", {});
  i18n.activate("en");
});

describe("MoveDialog", () => {
  it("renders MOVE ENTRY with a current-location context line", () => {
    renderDialog();
    expect(
      screen.getByRole("heading", { name: /move entry/i }),
    ).toBeInTheDocument();
    // Context line names the current location/container path.
    const context = screen.getByText(/currently in/i);
    expect(context).toBeInTheDocument();
    expect(context).toHaveTextContent(/garage/i);
    expect(context).toHaveTextContent(/bin a/i);
  });

  it("disables MOVE on a no-op (same location + container) with a hint", () => {
    renderDialog();
    const moveBtn = screen.getByRole("button", { name: /^move$/i });
    expect(moveBtn).toBeDisabled();
    expect(
      screen.getByText(/pick a different location or container/i),
    ).toBeInTheDocument();
  });

  it("posts a location-only body (NO quantity) and invalidates inventory + movements", async () => {
    const user = userEvent.setup();
    let sentBody: Record<string, unknown> = {};
    server.use(
      http.post(
        "/api/workspaces/:wsId/inventory/:id/move",
        async ({ request }) => {
          sentBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ ...ENTRY, location_id: "loc-2" });
        },
      ),
    );
    const { client, onClose } = renderDialog();
    const spy = vi.spyOn(client, "invalidateQueries");

    await user.selectOptions(screen.getByLabelText(/to location/i), "loc-2");
    const moveBtn = screen.getByRole("button", { name: /^move$/i });
    await waitFor(() => expect(moveBtn).toBeEnabled());
    await user.click(moveBtn);

    await waitFor(() => expect("location_id" in sentBody).toBe(true));
    expect(sentBody.location_id).toBe("loc-2");
    expect("quantity" in sentBody).toBe(false);

    expect(spy).toHaveBeenCalledWith({ queryKey: ["inventory", "ws-A"] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ["movements", "ws-A"] });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("enables MOVE when only the container changes (distinct target)", async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.selectOptions(screen.getByLabelText(/to container/i), "cont-2");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /^move$/i })).toBeEnabled(),
    );
  });

  it("surfaces an error toast and stays open on a failed move", async () => {
    const user = userEvent.setup();
    server.use(
      http.post("/api/workspaces/:wsId/inventory/:id/move", () =>
        HttpResponse.json({ message: "boom" }, { status: 500 }),
      ),
    );
    const { onClose } = renderDialog();
    await user.selectOptions(screen.getByLabelText(/to location/i), "loc-2");
    await user.click(screen.getByRole("button", { name: /^move$/i }));

    // The copy appears in both the in-dialog banner AND the toast — at least
    // one must surface, and the dialog must NOT have closed.
    const matches = await screen.findAllByText(/couldn't move this entry/i);
    expect(matches.length).toBeGreaterThan(0);
    expect(onClose).not.toHaveBeenCalled();
  });
});
