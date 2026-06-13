import { afterEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { I18nProvider } from "@lingui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { i18n } from "@/lib/i18n";
import { ModalStackProvider } from "@/components/modal";
import { RetroToaster } from "@/components/retro";
import { server } from "@/test/msw/server";
import { ProfilePage } from "./ProfilePage";

// Phase 12 Plan 03 — ProfilePage (SETT-02). Name/email RHF+zod form with a
// PARTIAL PATCH (only dirty fields cross the wire — CONTEXT constraint 3) over
// PATCH /users/me, plus the AvatarUploader block on top. Email conflict
// (409/400) surfaces an inline danger band, not a toast.

const ME_PATH = "/api/users/me";

const ME = {
  id: "user-1",
  email: "seeder@test.local",
  full_name: "Seed Er",
  avatar_url: null,
  has_password: true,
};

function freshClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function renderPage() {
  return render(
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={freshClient()}>
        <ModalStackProvider>
          <ProfilePage />
          <RetroToaster />
        </ModalStackProvider>
      </QueryClientProvider>
    </I18nProvider>,
  );
}

afterEach(() => {
  server.resetHandlers();
});

describe("ProfilePage (SETT-02)", () => {
  it("pre-fills from ['me'] and renders the avatar block", async () => {
    server.use(http.get(ME_PATH, () => HttpResponse.json(ME)));

    renderPage();

    // Name field pre-filled.
    expect(await screen.findByDisplayValue("Seed Er")).toBeInTheDocument();
    expect(screen.getByDisplayValue("seeder@test.local")).toBeInTheDocument();
    // Avatar block present (no-avatar → initials placeholder).
    expect(screen.getByText("SE")).toBeInTheDocument();
  });

  it("partial PATCH: changing only the name sends full_name and NOT email", async () => {
    let patchBody: Record<string, unknown> | null = null;
    server.use(
      http.get(ME_PATH, () => HttpResponse.json(ME)),
      http.patch(ME_PATH, async ({ request }) => {
        patchBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ...ME, full_name: "Seed Two" });
      }),
    );

    renderPage();

    const nameInput = await screen.findByDisplayValue("Seed Er");
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Seed Two");
    await userEvent.click(
      screen.getByRole("button", { name: /save changes/i }),
    );

    await waitFor(() => expect(patchBody).not.toBeNull());
    expect(patchBody).toHaveProperty("full_name", "Seed Two");
    expect(patchBody).not.toHaveProperty("email");
  });

  it("409 on email conflict surfaces an inline danger band", async () => {
    server.use(
      http.get(ME_PATH, () => HttpResponse.json(ME)),
      http.patch(ME_PATH, () =>
        HttpResponse.json(
          { detail: "email already in use" },
          { status: 409 },
        ),
      ),
    );

    renderPage();

    const emailInput = await screen.findByDisplayValue("seeder@test.local");
    await userEvent.clear(emailInput);
    await userEvent.type(emailInput, "taken@test.local");
    await userEvent.click(
      screen.getByRole("button", { name: /save changes/i }),
    );

    const band = await screen.findByRole("alert");
    expect(band).toHaveTextContent(/already in use/i);
  });
});
