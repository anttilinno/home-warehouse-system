import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { I18nProvider } from "@lingui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { i18n } from "@/lib/i18n";
import { ModalStackProvider } from "@/components/modal";
import { RetroToaster } from "@/components/retro";
import { server } from "@/test/msw/server";
import { SecurityPage } from "./SecurityPage";

// Phase 05 Plan 05 — AUTH-07/08/09. SecurityPage = Sessions + Password + Danger
// Zone cards over the real backend endpoints. This spec drives MSW-mocked
// contracts. Commit A covers the Sessions card; commit B adds password + danger.

const SESSIONS_PATH = "/api/users/me/sessions";

const CURRENT = {
  id: "sess-current",
  device_info: "Chrome on Linux",
  ip_address: "127.0.0.1",
  last_active_at: new Date().toISOString(),
  created_at: "2026-06-12T09:00:00Z",
  is_current: true,
};
const OTHER = {
  id: "sess-other",
  device_info: "Safari on iOS",
  ip_address: "10.0.0.4",
  last_active_at: "2026-06-12T08:00:00Z",
  created_at: "2026-06-11T09:00:00Z",
  is_current: false,
};

function freshClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function renderPage() {
  return render(
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={freshClient()}>
        <ModalStackProvider>
          <SecurityPage />
          <RetroToaster />
        </ModalStackProvider>
      </QueryClientProvider>
    </I18nProvider>,
  );
}

beforeEach(() => {
  server.use(
    http.get(SESSIONS_PATH, () => HttpResponse.json([CURRENT, OTHER])),
  );
});

afterEach(() => {
  server.resetHandlers();
});

describe("SecurityPage — Sessions card (AUTH-07)", () => {
  it("renders sessions with a THIS DEVICE badge on the current row and no revoke there", async () => {
    renderPage();

    const currentRow = await screen.findByText("Chrome on Linux");
    const row = currentRow.closest("tr")!;
    expect(within(row).getByText("THIS DEVICE")).toBeInTheDocument();
    // The current session row has NO revoke action.
    expect(
      within(row).queryByRole("button", { name: /revoke/i }),
    ).not.toBeInTheDocument();

    // The OTHER row DOES have a revoke button.
    const otherRow = screen.getByText("Safari on iOS").closest("tr")!;
    expect(
      within(otherRow).getByRole("button", { name: /revoke session/i }),
    ).toBeInTheDocument();
  });

  it("revokes one session → DELETE /users/me/sessions/{id} + success toast + refetch", async () => {
    let deletedId: string | null = null;
    server.use(
      http.delete("/api/users/me/sessions/:id", ({ params }) => {
        deletedId = params.id as string;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderPage();
    const otherRow = (await screen.findByText("Safari on iOS")).closest("tr")!;
    await userEvent.click(
      within(otherRow).getByRole("button", { name: /revoke session/i }),
    );

    await waitFor(() => expect(deletedId).toBe("sess-other"));
    expect(await screen.findByText("Session revoked.")).toBeInTheDocument();
  });

  it("revoke-all-others opens a confirm dialog then DELETE /users/me/sessions", async () => {
    let revokeAllHit = false;
    server.use(
      http.delete("/api/users/me/sessions", () => {
        revokeAllHit = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderPage();
    await screen.findByText("Chrome on Linux");

    await userEvent.click(
      screen.getByRole("button", { name: /revoke all other sessions/i }),
    );
    // Confirm dialog appears (pink) — confirm with the danger "Revoke all" button.
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(
      within(dialog).getByRole("button", { name: /revoke all/i }),
    );

    await waitFor(() => expect(revokeAllHit).toBe(true));
    expect(
      await screen.findByText("All other sessions revoked."),
    ).toBeInTheDocument();
  });

  it("revoke-all-others is DISABLED when only the current session exists", async () => {
    server.use(http.get(SESSIONS_PATH, () => HttpResponse.json([CURRENT])));
    renderPage();
    await screen.findByText("Chrome on Linux");

    expect(
      screen.getByRole("button", { name: /revoke all other sessions/i }),
    ).toBeDisabled();
  });
});
