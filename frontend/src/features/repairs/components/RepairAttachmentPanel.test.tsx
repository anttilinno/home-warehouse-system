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
import { repairHandlers } from "@/test/msw/repairHandlers";
import { RepairAttachmentPanel } from "./RepairAttachmentPanel";

// Phase 10b Plan 03 Task 2 (TDD) — the FILES tab. Lists attachment rows (badge +
// title/file_name + mime + DELETE), shows a NO FILES empty state, and ADD FILE
// opens AddAttachmentDialog.

const WS = "ws-1";
const REPAIR = "repair-completed";
const ITEM = "item-1";

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
  return render(
    <RepairAttachmentPanel wsId={WS} repairId={REPAIR} itemId={ITEM} />,
    { wrapper },
  );
}

describe("RepairAttachmentPanel", () => {
  it("renders attachment rows with a type badge, title, mime and DELETE", async () => {
    server.use(...repairHandlers);
    renderPanel();
    await waitFor(() =>
      expect(screen.getByText("Parts receipt")).toBeInTheDocument(),
    );
    expect(screen.getByText("RECEIPT")).toBeInTheDocument();
    expect(screen.getByText("application/pdf")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
  });

  it("shows NO FILES empty state for an empty fixture", async () => {
    server.use(
      http.get("/api/workspaces/:wsId/repairs/:id/attachments", () =>
        HttpResponse.json({ items: [], total: 0 }),
      ),
    );
    renderPanel();
    await waitFor(() =>
      expect(screen.getByText("NO FILES")).toBeInTheDocument(),
    );
  });

  it("ADD FILE opens AddAttachmentDialog", async () => {
    server.use(...repairHandlers);
    renderPanel();
    await waitFor(() =>
      expect(screen.getByText("Parts receipt")).toBeInTheDocument(),
    );
    await userEvent.click(screen.getByRole("button", { name: /add file/i }));
    // The dialog renders a File field + a type select unique to it. RetroSelect's
    // label IS associated (htmlFor), so getByLabelText finds the type picker.
    await waitFor(() =>
      expect(screen.getByLabelText(/type \*/i)).toBeInTheDocument(),
    );
    expect(screen.getByText("File *")).toBeInTheDocument();
  });
});
