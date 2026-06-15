import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { I18nProvider } from "@lingui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { i18n } from "@/lib/i18n";
import { RetroToaster } from "@/components/retro";
import { server } from "@/test/msw/server";
import { NotificationsPage } from "./NotificationsPage";

// Phase 12 Plan 04 — SETT-07. Notifications: five RetroCheckbox rows over the
// notification_preferences map. Absent key → ON (opt-out). Save sends the FULL
// map (the backend replaces it wholesale — Pitfall 2).

const ME_PATH = "/api/users/me";
const PREFS_PATH = "/api/users/me/preferences";

// ME with an EMPTY notification_preferences map: every key absent → all checked.
const ME = {
  id: "user-1",
  email: "seeder@test.local",
  full_name: "Seed Er",
  avatar_url: null,
  has_password: true,
  notification_preferences: {},
};

function freshClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderPage() {
  return render(
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={freshClient()}>
        <NotificationsPage />
        <RetroToaster />
      </QueryClientProvider>
    </I18nProvider>,
  );
}

afterEach(() => {
  server.resetHandlers();
  vi.restoreAllMocks();
});

describe("NotificationsPage — preferences (SETT-07)", () => {
  it("defaults all five rows to checked when keys are absent (opt-out)", async () => {
    server.use(http.get(ME_PATH, () => HttpResponse.json(ME)));

    renderPage();
    const boxes = await screen.findAllByRole("checkbox");
    expect(boxes).toHaveLength(5);
    boxes.forEach((b) => {
      expect(b).toBeChecked();
    });
  });

  it("unchecking Low stock and saving sends the FULL map with low_stock=false", async () => {
    let patchedBody: Record<string, unknown> | null = null;
    server.use(
      http.get(ME_PATH, () => HttpResponse.json(ME)),
      http.patch(PREFS_PATH, async ({ request }) => {
        patchedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(ME);
      }),
    );

    renderPage();
    const lowStock = await screen.findByRole("checkbox", {
      name: /low stock/i,
    });
    await userEvent.click(lowStock);
    await userEvent.click(
      screen.getByRole("button", { name: /save changes/i }),
    );

    await waitFor(() => expect(patchedBody).not.toBeNull());
    expect(patchedBody).toEqual({
      notification_preferences: {
        loan_alerts: true,
        expiry_alerts: true,
        maintenance_alerts: true,
        low_stock: false,
        workspace_activity: true,
      },
    });
    expect(
      await screen.findByText("Notification settings saved."),
    ).toBeInTheDocument();
  });
});
