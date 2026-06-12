import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { I18nProvider } from "@lingui/react";
import { MemoryRouter } from "react-router";
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
      <MemoryRouter>
        <QueryClientProvider client={freshClient()}>
          <ModalStackProvider>
            <SecurityPage />
            <RetroToaster />
          </ModalStackProvider>
        </QueryClientProvider>
      </MemoryRouter>
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

const ME_PATH = "/api/users/me";
const PASSWORD_PATH = "/api/users/me/password";
const ME_WITH_PW = {
  id: "user-1",
  email: "seeder@test.local",
  full_name: "Seed Er",
  avatar_url: null,
  has_password: true,
};

describe("SecurityPage — Password card (AUTH-08)", () => {
  it("change-password success → PATCH with current_password + success toast", async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      http.get(ME_PATH, () => HttpResponse.json(ME_WITH_PW)),
      http.patch(PASSWORD_PATH, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderPage();
    // The current-password field only renders when has_password=true.
    const current = await screen.findByLabelText(/current password/i);
    await userEvent.type(current, "oldpass1");
    await userEvent.type(screen.getByLabelText(/^new password$/i), "newpass12");
    await userEvent.type(
      screen.getByLabelText(/confirm new password/i),
      "newpass12",
    );
    await userEvent.click(
      screen.getByRole("button", { name: /change password/i }),
    );

    await waitFor(() => expect(body).not.toBeNull());
    expect(body).toMatchObject({
      current_password: "oldpass1",
      new_password: "newpass12",
    });
    expect(await screen.findByText("Password updated.")).toBeInTheDocument();
  });

  it("wrong current password (400) shows the inline band", async () => {
    server.use(
      http.get(ME_PATH, () => HttpResponse.json(ME_WITH_PW)),
      http.patch(PASSWORD_PATH, () =>
        HttpResponse.json(
          { detail: "current password is incorrect" },
          { status: 400 },
        ),
      ),
    );

    renderPage();
    await userEvent.type(
      await screen.findByLabelText(/current password/i),
      "wrongpass",
    );
    await userEvent.type(screen.getByLabelText(/^new password$/i), "newpass12");
    await userEvent.type(
      screen.getByLabelText(/confirm new password/i),
      "newpass12",
    );
    await userEvent.click(
      screen.getByRole("button", { name: /change password/i }),
    );

    expect(
      await screen.findByText("Current password is incorrect."),
    ).toBeInTheDocument();
  });

  it("set-password path (has_password=false) omits current_password and has no current field", async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      http.get(ME_PATH, () =>
        HttpResponse.json({ ...ME_WITH_PW, has_password: false }),
      ),
      http.patch(PASSWORD_PATH, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderPage();
    // Wait for the set-password explainer to confirm we're in the OAuth-only mode.
    await screen.findByText(/haven't set a password yet/i);
    // No current-password field in set mode.
    expect(screen.queryByLabelText(/current password/i)).not.toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/^new password$/i), "newpass12");
    await userEvent.type(
      screen.getByLabelText(/confirm new password/i),
      "newpass12",
    );
    await userEvent.click(screen.getByRole("button", { name: /set password/i }));

    await waitFor(() => expect(body).not.toBeNull());
    expect(body).toEqual({ new_password: "newpass12" });
    expect(body).not.toHaveProperty("current_password");
  });
});

describe("SecurityPage — Danger Zone (AUTH-09)", () => {
  it("type-DELETE confirm is disabled until the input is DELETE, then deletes", async () => {
    let deleteHit = false;
    server.use(
      http.get("/api/users/me/can-delete", () =>
        HttpResponse.json({ can_delete: true, blocking_workspaces: [] }),
      ),
      http.delete("/api/users/me", () => {
        deleteHit = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderPage();
    await userEvent.click(
      await screen.findByRole("button", { name: /delete my account/i }),
    );

    const dialog = await screen.findByRole("dialog");
    const confirm = within(dialog).getByRole("button", {
      name: /^delete account$/i,
    });
    // Disabled before typing DELETE.
    expect(confirm).toBeDisabled();

    await userEvent.type(
      within(dialog).getByLabelText(/type delete to confirm/i),
      "DELETE",
    );
    expect(confirm).toBeEnabled();

    await userEvent.click(confirm);
    await waitFor(() => expect(deleteHit).toBe(true));
  });

  it("can_delete=false disables the trigger and surfaces the blocking workspaces", async () => {
    server.use(
      http.get("/api/users/me/can-delete", () =>
        HttpResponse.json({
          can_delete: false,
          blocking_workspaces: [
            { id: "ws-1", name: "Personal", slug: "personal" },
          ],
        }),
      ),
    );

    renderPage();
    const trigger = await screen.findByRole("button", {
      name: /delete my account/i,
    });
    await waitFor(() => expect(trigger).toBeDisabled());
    expect(screen.getByText(/sole owner of: Personal/i)).toBeInTheDocument();
  });
});
