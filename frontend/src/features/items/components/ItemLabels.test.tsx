import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { I18nProvider } from "@lingui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { i18n } from "@/lib/i18n";
import { ModalStackProvider } from "@/components/modal";
import { RetroToaster } from "@/components/retro";
import { server } from "@/test/msw/server";
import type { Label } from "@/lib/types";
import { ItemLabels } from "./ItemLabels";

const WS = "ws-1";
const IT = "it-1";

function label(id: string, name: string): Label {
  // Phase 10 Plan 01 added is_archived/created_at/updated_at to Label (TAX-07
  // manager fields). The attach/detach popover ignores them; fixed values keep
  // this fixture compiling.
  return {
    id,
    workspace_id: WS,
    name,
    is_archived: false,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

function renderLabels() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <ModalStackProvider>
          <RetroToaster />
          <ItemLabels wsId={WS} itemId={IT} />
        </ModalStackProvider>
      </QueryClientProvider>
    </I18nProvider>,
  );
}

afterEach(() => server.resetHandlers());

describe("ItemLabels", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("renders the attached label chips with detach buttons", async () => {
    server.use(
      http.get("/api/workspaces/:wsId/items/:itemId/labels", () =>
        HttpResponse.json({ label_ids: ["lab-1"] }),
      ),
      http.get("/api/workspaces/:wsId/labels", () =>
        HttpResponse.json({
          items: [label("lab-1", "Tools"), label("lab-2", "Garage")],
        }),
      ),
    );
    renderLabels();
    expect(await screen.findByText("Tools")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /detach tools/i }),
    ).toBeInTheDocument();
  });

  it("detaching a chip calls the detach endpoint", async () => {
    const user = userEvent.setup();
    let detachHit = false;
    server.use(
      http.get("/api/workspaces/:wsId/items/:itemId/labels", () =>
        HttpResponse.json({ label_ids: ["lab-1"] }),
      ),
      http.get("/api/workspaces/:wsId/labels", () =>
        HttpResponse.json({ items: [label("lab-1", "Tools")] }),
      ),
      http.delete("/api/workspaces/:wsId/items/:itemId/labels/:labelId", () => {
        detachHit = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderLabels();
    await user.click(
      await screen.findByRole("button", { name: /detach tools/i }),
    );
    await waitFor(() => expect(detachHit).toBe(true));
  });

  it("attaching an unselected workspace label calls the attach endpoint", async () => {
    const user = userEvent.setup();
    let attachHit = false;
    server.use(
      http.get("/api/workspaces/:wsId/items/:itemId/labels", () =>
        HttpResponse.json({ label_ids: [] }),
      ),
      http.get("/api/workspaces/:wsId/labels", () =>
        HttpResponse.json({ items: [label("lab-2", "Garage")] }),
      ),
      http.post("/api/workspaces/:wsId/items/:itemId/labels/:labelId", () => {
        attachHit = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderLabels();
    await user.click(await screen.findByRole("button", { name: /add label/i }));
    await user.click(await screen.findByRole("checkbox", { name: /garage/i }));
    await waitFor(() => expect(attachHit).toBe(true));
  });

  it("shows the Phase 10 empty hint when the workspace has no labels", async () => {
    server.use(
      http.get("/api/workspaces/:wsId/items/:itemId/labels", () =>
        HttpResponse.json({ label_ids: [] }),
      ),
      http.get("/api/workspaces/:wsId/labels", () =>
        HttpResponse.json({ items: [] }),
      ),
    );
    const user = userEvent.setup();
    renderLabels();
    await user.click(await screen.findByRole("button", { name: /add label/i }));
    expect(
      await screen.findByText(/manage labels in phase 10/i),
    ).toBeInTheDocument();
  });
});
