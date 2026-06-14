import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { I18nProvider } from "@lingui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { i18n } from "@/lib/i18n";
import { RetroToaster } from "@/components/retro";
import { ModalStackProvider } from "@/components/modal";
import { server } from "@/test/msw/server";
import { PaperlessLinkDialog } from "./PaperlessLinkDialog";

// Phase 14b Plan 04 — PaperlessLinkDialog (PPL-03). Selecting a searched
// Paperless document + LINK posts the create-attachment endpoint with
// external_doc_id = String(doc.id), then invalidates the item's attachment list
// key (["items", wsId, itemId, "attachments"] — the 14b-03 hook's key).

const SEARCH_PATH = "/api/workspaces/ws-1/paperless/search";
const CREATE_PATH = "/api/workspaces/ws-1/items/item-1/attachments";

function freshClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderDialog(client: QueryClient, onClose = vi.fn()) {
  render(
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <ModalStackProvider>
          <PaperlessLinkDialog
            wsId="ws-1"
            itemId="item-1"
            open
            onClose={onClose}
          />
        </ModalStackProvider>
        <RetroToaster />
      </QueryClientProvider>
    </I18nProvider>,
  );
  return onClose;
}

beforeEach(() => {
  i18n.activate("en");
});

afterEach(() => {
  server.resetHandlers();
  vi.restoreAllMocks();
});

describe("PaperlessLinkDialog — link a document (PPL-03)", () => {
  it("links a selected doc: POSTs external_doc_id=String(id) and invalidates the item attachment list", async () => {
    let createdBody: Record<string, unknown> | null = null;
    server.use(
      http.get(SEARCH_PATH, () =>
        HttpResponse.json({
          count: 1,
          results: [{ id: 99, title: "Dishwasher manual" }],
        }),
      ),
      http.post(CREATE_PATH, async ({ request }) => {
        createdBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ id: "att-1" });
      }),
    );

    const client = freshClient();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    const onClose = renderDialog(client);

    await userEvent.type(
      await screen.findByLabelText(/search paperless/i),
      "dish",
    );
    await userEvent.click(screen.getByRole("button", { name: /^search$/i }));

    // Select the result, then LINK.
    await userEvent.click(await screen.findByText("Dishwasher manual"));
    await userEvent.click(screen.getByRole("button", { name: /^link$/i }));

    await waitFor(() => expect(createdBody).not.toBeNull());
    expect(createdBody).toMatchObject({
      attachment_type: "OTHER",
      title: "Dishwasher manual",
      external_doc_id: "99",
    });

    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["items", "ws-1", "item-1", "attachments"],
      }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
