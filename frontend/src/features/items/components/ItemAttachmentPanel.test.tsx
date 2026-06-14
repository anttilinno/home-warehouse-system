import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { I18nProvider } from "@lingui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { i18n } from "@/lib/i18n";
import { ModalStackProvider } from "@/components/modal";
import { RetroToaster } from "@/components/retro";
import { server } from "@/test/msw/server";
import { ItemAttachmentPanel } from "./ItemAttachmentPanel";

// Phase 14b Plan 03 Task 3 (TDD) — the FILES panel. Lists attachment rows (badge +
// title/file_name + PRIMARY badge + download + SET PRIMARY + DELETE), an ADD FILE
// CTA opening AddAttachmentDialog, a NO FILES empty state, and a confirm-gated
// delete.

const WS = "ws-1";
const ITEM = "item-1";

const PRIMARY_ATTACHMENT = {
  id: "att-1",
  item_id: ITEM,
  file_id: "file-1",
  attachment_type: "RECEIPT" as const,
  title: "Parts receipt",
  is_primary: true,
  created_at: "2026-06-13T00:00:00Z",
  updated_at: "2026-06-13T00:00:00Z",
  file_name: "receipt.pdf",
  file_mime_type: "application/pdf",
  file_size_bytes: 20480,
};

const SECONDARY_ATTACHMENT = {
  ...PRIMARY_ATTACHMENT,
  id: "att-2",
  attachment_type: "MANUAL" as const,
  title: "User manual",
  is_primary: false,
  file_name: "manual.pdf",
};

function listHandler(items: unknown[]) {
  return http.get("/api/workspaces/:wsId/items/:itemId/attachments", () =>
    HttpResponse.json({ items }),
  );
}

function renderPanel() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <ModalStackProvider>
          {children}
          <RetroToaster />
        </ModalStackProvider>
      </QueryClientProvider>
    </I18nProvider>
  );
  return render(<ItemAttachmentPanel wsId={WS} itemId={ITEM} />, { wrapper });
}

describe("ItemAttachmentPanel", () => {
  it("renders rows with a type badge, title, a PRIMARY badge, and a download link", async () => {
    server.use(listHandler([PRIMARY_ATTACHMENT, SECONDARY_ATTACHMENT]));
    renderPanel();
    await waitFor(() =>
      expect(screen.getByText("Parts receipt")).toBeInTheDocument(),
    );
    expect(screen.getByText("RECEIPT")).toBeInTheDocument();
    expect(screen.getByText("User manual")).toBeInTheDocument();
    // The primary row shows a PRIMARY badge.
    expect(screen.getByText(/^primary$/i)).toBeInTheDocument();
    // Download anchors point at the serve route.
    const link = screen.getAllByRole("link")[0] as HTMLAnchorElement;
    expect(link.getAttribute("href")).toContain(
      `/api/workspaces/${WS}/attachments/att-1/file`,
    );
  });

  it("shows NO FILES empty state for an empty fixture", async () => {
    server.use(listHandler([]));
    renderPanel();
    await waitFor(() =>
      expect(screen.getByText("NO FILES")).toBeInTheDocument(),
    );
  });

  it("ADD FILE opens AddAttachmentDialog", async () => {
    server.use(listHandler([PRIMARY_ATTACHMENT]));
    renderPanel();
    await waitFor(() =>
      expect(screen.getByText("Parts receipt")).toBeInTheDocument(),
    );
    await userEvent.click(screen.getByRole("button", { name: /add file/i }));
    await waitFor(() =>
      expect(screen.getByLabelText(/type \*/i)).toBeInTheDocument(),
    );
    expect(screen.getByText("File *")).toBeInTheDocument();
  });

  it("DELETE is confirm-gated (opens a confirm before deleting)", async () => {
    server.use(listHandler([SECONDARY_ATTACHMENT]));
    let deleteCalled = false;
    server.use(
      http.delete("/api/workspaces/:wsId/attachments/:attId", () => {
        deleteCalled = true;
        return new HttpResponse(null, { status: 200 });
      }),
    );
    renderPanel();
    await waitFor(() =>
      expect(screen.getByText("User manual")).toBeInTheDocument(),
    );
    // Clicking the row DELETE (DOM text "DELETE") opens a confirm — no call yet.
    await userEvent.click(
      screen.getByRole("button", { name: "DELETE" }),
    );
    expect(screen.getByText(/delete file\?/i)).toBeInTheDocument();
    expect(deleteCalled).toBe(false);
    // The confirm-dialog button (DOM text "Delete", distinct from the row's
    // "DELETE") actually fires the network delete.
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(deleteCalled).toBe(true));
  });

  it("SET PRIMARY is offered only on a non-primary row", async () => {
    server.use(listHandler([PRIMARY_ATTACHMENT, SECONDARY_ATTACHMENT]));
    let setPrimaryId = "";
    server.use(
      http.post(
        "/api/workspaces/:wsId/items/:itemId/attachments/:attId/set-primary",
        ({ params }) => {
          setPrimaryId = String(params.attId);
          return new HttpResponse(null, { status: 200 });
        },
      ),
    );
    renderPanel();
    await waitFor(() =>
      expect(screen.getByText("User manual")).toBeInTheDocument(),
    );
    // Exactly one SET PRIMARY action (the non-primary att-2 row).
    const buttons = screen.getAllByRole("button", { name: /set primary/i });
    expect(buttons).toHaveLength(1);
    await userEvent.click(buttons[0]);
    await waitFor(() => expect(setPrimaryId).toBe("att-2"));
  });
});
