import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { I18nProvider } from "@lingui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { i18n } from "@/lib/i18n";
import { ModalStackProvider } from "@/components/modal";
import { RetroToaster } from "@/components/retro";
import { server } from "@/test/msw/server";
import { AccountsPage } from "./AccountsPage";

// Phase 05 Plan 05 — AUTH-10. Connected Accounts: link/unlink Google + GitHub
// with the last-method lockout guard. The client guard (canUnlink) mirrors the
// backend's authoritative ErrCannotUnlinkLastAuth 409.

const ACCOUNTS_PATH = "/api/auth/oauth/accounts";
const ME_PATH = "/api/users/me";

const ME_WITH_PW = {
  id: "user-1",
  email: "seeder@test.local",
  full_name: "Seed Er",
  avatar_url: null,
  has_password: true,
};

function freshClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderPage() {
  return render(
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={freshClient()}>
        <ModalStackProvider>
          <AccountsPage />
          <RetroToaster />
        </ModalStackProvider>
      </QueryClientProvider>
    </I18nProvider>,
  );
}

// Replace window.location with a writable-href stand-in so the Link full-page
// nav is assertable. jsdom's real `location.href` is non-configurable, so we
// swap the whole object — but keep a VALID origin/href (MSW resolves relative
// `/api/...` URLs against location.href; a blanked-out href breaks request
// interception).
const ORIGIN = "http://localhost:5173";
let hrefValue = `${ORIGIN}/settings/accounts`;
const realLocation = window.location;

beforeEach(() => {
  hrefValue = `${ORIGIN}/settings/accounts`;
  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: {
      origin: ORIGIN,
      get href() {
        return hrefValue;
      },
      set href(v: string) {
        hrefValue = v;
      },
    },
  });
});

afterEach(() => {
  server.resetHandlers();
  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: realLocation,
  });
  vi.restoreAllMocks();
});

describe("AccountsPage — Connected Accounts (AUTH-10)", () => {
  it("renders LINKED row (Unlink) and NOT LINKED row (Link)", async () => {
    server.use(
      http.get(ME_PATH, () => HttpResponse.json(ME_WITH_PW)),
      http.get(ACCOUNTS_PATH, () =>
        HttpResponse.json({
          accounts: [{ provider: "google", email: "me@gmail.com" }],
        }),
      ),
    );

    renderPage();

    // Wait for the LINKED pill (the accounts query must resolve first).
    const linkedPill = await screen.findByText("LINKED");
    const googleRow = linkedPill.closest("li")!;
    expect(within(googleRow).getByText("Google")).toBeInTheDocument();
    expect(
      within(googleRow).getByRole("button", { name: /unlink/i }),
    ).toBeInTheDocument();
    expect(within(googleRow).getByText("me@gmail.com")).toBeInTheDocument();

    const githubRow = screen.getByText("GitHub").closest("li")!;
    expect(within(githubRow).getByText("NOT LINKED")).toBeInTheDocument();
    expect(
      within(githubRow).getByRole("button", { name: /link/i }),
    ).toBeInTheDocument();
  });

  it("Link navigates to the provider initiate path (full-page)", async () => {
    server.use(
      http.get(ME_PATH, () => HttpResponse.json(ME_WITH_PW)),
      http.get(ACCOUNTS_PATH, () => HttpResponse.json({ accounts: [] })),
    );

    renderPage();
    const githubRow = (await screen.findByText("GitHub")).closest("li")!;
    await userEvent.click(
      within(githubRow).getByRole("button", { name: /link/i }),
    );

    expect(hrefValue).toBe("/api/auth/oauth/github");
  });

  it("Unlink confirm → DELETE /auth/oauth/accounts/{provider} + refetch", async () => {
    let unlinked: string | null = null;
    server.use(
      http.get(ME_PATH, () => HttpResponse.json(ME_WITH_PW)),
      http.get(ACCOUNTS_PATH, () =>
        HttpResponse.json({
          accounts: [
            { provider: "google", email: "me@gmail.com" },
            { provider: "github", email: "me@gh.com" },
          ],
        }),
      ),
      http.delete("/api/auth/oauth/accounts/:provider", ({ params }) => {
        unlinked = params.provider as string;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderPage();
    // Two Unlink buttons (both linked); pick the one in the Google row.
    const googleRow = (await screen.findByText("Google")).closest("li")!;
    await waitFor(() =>
      expect(
        within(googleRow).getByRole("button", { name: /unlink/i }),
      ).toBeInTheDocument(),
    );
    await userEvent.click(
      within(googleRow).getByRole("button", { name: /unlink/i }),
    );

    const dialog = await screen.findByRole("dialog");
    await userEvent.click(
      within(dialog).getByRole("button", { name: /^unlink$/i }),
    );

    await waitFor(() => expect(unlinked).toBe("google"));
    expect(await screen.findByText("Google unlinked.")).toBeInTheDocument();
  });

  it("lockout guard: sole provider + no password disables Unlink with a butter note", async () => {
    server.use(
      http.get(ME_PATH, () =>
        HttpResponse.json({ ...ME_WITH_PW, has_password: false }),
      ),
      http.get(ACCOUNTS_PATH, () =>
        HttpResponse.json({
          accounts: [{ provider: "google", email: "me@gmail.com" }],
        }),
      ),
    );

    renderPage();
    const googleRow = (await screen.findByText("Google")).closest("li")!;
    const unlinkBtn = await within(googleRow).findByRole("button", {
      name: /unlink/i,
    });
    expect(unlinkBtn).toBeDisabled();
    // The butter note is associated via aria-describedby.
    const describedBy = unlinkBtn.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)).toHaveTextContent(
      /only way to sign in/i,
    );
  });

  it("backend 409 on unlink surfaces a danger toast", async () => {
    server.use(
      http.get(ME_PATH, () => HttpResponse.json(ME_WITH_PW)),
      http.get(ACCOUNTS_PATH, () =>
        HttpResponse.json({
          accounts: [
            { provider: "google", email: "me@gmail.com" },
            { provider: "github", email: "me@gh.com" },
          ],
        }),
      ),
      http.delete("/api/auth/oauth/accounts/:provider", () =>
        HttpResponse.json(
          { detail: "cannot unlink sole authentication method" },
          { status: 409 },
        ),
      ),
    );

    renderPage();
    const googleRow = (await screen.findByText("Google")).closest("li")!;
    const unlinkBtn = await within(googleRow).findByRole("button", {
      name: /unlink/i,
    });
    await userEvent.click(unlinkBtn);
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(
      within(dialog).getByRole("button", { name: /^unlink$/i }),
    );

    expect(
      await screen.findByText(/your only sign-in method/i),
    ).toBeInTheDocument();
  });
});
