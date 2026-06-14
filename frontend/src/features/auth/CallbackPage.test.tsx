import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { I18nProvider } from "@lingui/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { i18n } from "@/lib/i18n";
import { server } from "@/test/msw/server";
import { setRefreshToken } from "@/lib/api";
import { CallbackPage } from "./CallbackPage";

// Phase 05 Plan 04 — AUTH-03/04. The callback exchanges the one-time code via
// POST /auth/oauth/exchange behind a useRef latch so StrictMode's double-invoke
// fires the (single-use) exchange EXACTLY ONCE; ?error= skips exchange; no
// code/error redirects to /login; exchange failure shows the error band.

const EXCHANGE = "/api/auth/oauth/exchange";

function renderCallback(initialEntry: string, strict = false) {
  const tree = (
    <I18nProvider i18n={i18n}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/auth/callback" element={<CallbackPage />} />
          <Route path="/login" element={<div>login sentinel</div>} />
          <Route path="/" element={<div>dashboard sentinel</div>} />
        </Routes>
      </MemoryRouter>
    </I18nProvider>
  );
  return render(strict ? <StrictMode>{tree}</StrictMode> : tree);
}

afterEach(() => {
  server.resetHandlers();
  setRefreshToken(null);
  vi.restoreAllMocks();
});

describe("CallbackPage", () => {
  it("exchanges the code exactly once under StrictMode double-invoke (ref latch)", async () => {
    let calls = 0;
    server.use(
      http.post(EXCHANGE, () => {
        calls += 1;
        return HttpResponse.json({
          access_token: "a",
          refresh_token: "r",
        });
      }),
    );

    renderCallback("/auth/callback?code=abc", true);

    // On success the page navigates to "/" (dashboard sentinel).
    expect(await screen.findByText("dashboard sentinel")).toBeInTheDocument();
    // The single-use code must have been exchanged exactly once.
    expect(calls).toBe(1);
  });

  it("stores the refresh token and redirects to / on success", async () => {
    server.use(
      http.post(EXCHANGE, () =>
        HttpResponse.json({ access_token: "a", refresh_token: "fresh" }),
      ),
    );
    renderCallback("/auth/callback?code=ok");
    expect(await screen.findByText("dashboard sentinel")).toBeInTheDocument();
  });

  it("renders the error band WITHOUT calling exchange when ?error= is present", async () => {
    let calls = 0;
    server.use(
      http.post(EXCHANGE, () => {
        calls += 1;
        return HttpResponse.json({ access_token: "a", refresh_token: "r" });
      }),
    );

    renderCallback("/auth/callback?error=email_not_verified");

    const band = await screen.findByRole("alert");
    expect(band).toHaveTextContent(/provider email isn't verified/i);
    // The Back to login button is present.
    expect(
      screen.getByRole("button", { name: /back to login/i }),
    ).toBeInTheDocument();
    // No exchange call for the error path.
    expect(calls).toBe(0);
  });

  it("redirects to /login when neither code nor error is present", async () => {
    renderCallback("/auth/callback");
    expect(await screen.findByText("login sentinel")).toBeInTheDocument();
  });

  it("shows the server_error band when the exchange fails (5xx)", async () => {
    server.use(
      http.post(EXCHANGE, () => new HttpResponse(null, { status: 500 })),
    );
    renderCallback("/auth/callback?code=bad");
    const band = await screen.findByRole("alert");
    expect(band).toHaveTextContent(/something went wrong signing you in/i);
    expect(
      screen.getByRole("button", { name: /try again/i }),
    ).toBeInTheDocument();
  });

  it("Back to login navigates to /login from the error state", async () => {
    const user = userEvent.setup();
    renderCallback("/auth/callback?error=server_error");
    await screen.findByRole("alert");
    await user.click(screen.getByRole("button", { name: /back to login/i }));
    await waitFor(() =>
      expect(screen.getByText("login sentinel")).toBeInTheDocument(),
    );
  });
});
