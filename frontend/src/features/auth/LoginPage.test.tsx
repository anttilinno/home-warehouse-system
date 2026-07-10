import { afterEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { I18nProvider } from "@lingui/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { i18n } from "@/lib/i18n";
import { server } from "@/test/msw/server";
import { setRefreshToken } from "@/lib/api";
import { LoginPage } from "./LoginPage";

// Phase-2 test-gap 2.4 — entry-point coverage for LoginPage (app's real front
// door). Mirrors RegisterPage.test.tsx: valid submit → token stored + navigate
// to "/"; inline zod validation (invalid email, empty password); 401 → the
// "Wrong email or password" alert band, no navigation.

const LOGIN = "/api/auth/login";

function renderLogin() {
  return render(
    <I18nProvider i18n={i18n}>
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<div>dashboard sentinel</div>} />
        </Routes>
      </MemoryRouter>
    </I18nProvider>,
  );
}

afterEach(() => {
  server.resetHandlers();
  setRefreshToken(null);
});

describe("LoginPage", () => {
  it("logs in a valid user → navigate to /", async () => {
    server.use(
      http.post(LOGIN, () =>
        HttpResponse.json({ token: "t", refresh_token: "r" }),
      ),
    );
    const user = userEvent.setup();
    renderLogin();
    await user.type(screen.getByLabelText(/email/i), "ada@example.com");
    await user.type(screen.getByLabelText(/password/i), "supersecret");
    await user.click(screen.getByRole("button", { name: /^log in$/i }));

    expect(await screen.findByText("dashboard sentinel")).toBeInTheDocument();
  });

  it("blocks submit with an invalid email (inline validation)", async () => {
    let calls = 0;
    server.use(
      http.post(LOGIN, () => {
        calls += 1;
        return HttpResponse.json({ token: "t", refresh_token: "r" });
      }),
    );
    const user = userEvent.setup();
    renderLogin();
    await user.type(screen.getByLabelText(/email/i), "not-an-email");
    await user.type(screen.getByLabelText(/password/i), "supersecret");
    await user.click(screen.getByRole("button", { name: /^log in$/i }));

    expect(
      await screen.findByText(/enter a valid email address/i),
    ).toBeInTheDocument();
    expect(calls).toBe(0);
  });

  it("blocks submit with an empty password (inline validation)", async () => {
    let calls = 0;
    server.use(
      http.post(LOGIN, () => {
        calls += 1;
        return HttpResponse.json({ token: "t", refresh_token: "r" });
      }),
    );
    const user = userEvent.setup();
    renderLogin();
    await user.type(screen.getByLabelText(/email/i), "ada@example.com");
    await user.click(screen.getByRole("button", { name: /^log in$/i }));

    expect(
      await screen.findByText(/password is required/i),
    ).toBeInTheDocument();
    expect(calls).toBe(0);
  });

  it("shows the wrong-credentials band on a 401, does not navigate", async () => {
    server.use(
      http.post(LOGIN, () =>
        HttpResponse.json({ detail: "invalid credentials" }, { status: 401 }),
      ),
    );
    const user = userEvent.setup();
    renderLogin();
    await user.type(screen.getByLabelText(/email/i), "ada@example.com");
    await user.type(screen.getByLabelText(/password/i), "wrong");
    await user.click(screen.getByRole("button", { name: /^log in$/i }));

    const band = await screen.findByRole("alert");
    expect(band).toHaveTextContent(/wrong email or password/i);
    expect(screen.queryByText("dashboard sentinel")).not.toBeInTheDocument();
  });
});
