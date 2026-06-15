import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { I18nProvider } from "@lingui/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { i18n } from "@/lib/i18n";
import { server } from "@/test/msw/server";
import { setRefreshToken } from "@/lib/api";

// Phase 05 Plan 04 — AUTH-02. Register: valid submit → register call → toast +
// navigate("/"); inline validation (min-8 password, confirm mismatch); duplicate
// email → conflict band + Log in link. retroToast is mocked so no Toaster mount
// is needed (matches the WorkspaceSwitcher test convention).

const successToast = vi.fn();
vi.mock("@/components/retro", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/retro")>();
  return {
    ...actual,
    retroToast: Object.assign(() => undefined, actual.retroToast, {
      success: (...a: unknown[]) => successToast(...a),
    }),
  };
});

import { RegisterPage } from "./RegisterPage";

const REGISTER = "/api/auth/register";

function renderRegister() {
  return render(
    <I18nProvider i18n={i18n}>
      <MemoryRouter initialEntries={["/register"]}>
        <Routes>
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/login" element={<div>login sentinel</div>} />
          <Route path="/" element={<div>dashboard sentinel</div>} />
        </Routes>
      </MemoryRouter>
    </I18nProvider>,
  );
}

async function fillValid(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/full name/i), "Ada Lovelace");
  await user.type(screen.getByLabelText(/email/i), "ada@example.com");
  await user.type(screen.getByLabelText(/^password$/i), "supersecret");
  await user.type(screen.getByLabelText(/confirm password/i), "supersecret");
}

afterEach(() => {
  server.resetHandlers();
  setRefreshToken(null);
  successToast.mockClear();
});

describe("RegisterPage", () => {
  it("registers a valid user → toast + navigate to /", async () => {
    server.use(
      http.post(REGISTER, () =>
        HttpResponse.json({ token: "t", refresh_token: "r" }),
      ),
    );
    const user = userEvent.setup();
    renderRegister();
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByText("dashboard sentinel")).toBeInTheDocument();
    expect(successToast).toHaveBeenCalledTimes(1);
  });

  it("blocks submit with a short password (min-8 inline error)", async () => {
    let calls = 0;
    server.use(
      http.post(REGISTER, () => {
        calls += 1;
        return HttpResponse.json({ token: "t", refresh_token: "r" });
      }),
    );
    const user = userEvent.setup();
    renderRegister();
    await user.type(screen.getByLabelText(/full name/i), "Ada");
    await user.type(screen.getByLabelText(/email/i), "ada@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "short");
    await user.type(screen.getByLabelText(/confirm password/i), "short");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(
      await screen.findByText(/use at least 8 characters/i),
    ).toBeInTheDocument();
    expect(calls).toBe(0);
  });

  it("blocks submit when passwords don't match", async () => {
    let calls = 0;
    server.use(
      http.post(REGISTER, () => {
        calls += 1;
        return HttpResponse.json({ token: "t", refresh_token: "r" });
      }),
    );
    const user = userEvent.setup();
    renderRegister();
    await user.type(screen.getByLabelText(/full name/i), "Ada");
    await user.type(screen.getByLabelText(/email/i), "ada@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "supersecret");
    await user.type(screen.getByLabelText(/confirm password/i), "different123");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(
      await screen.findByText(/passwords don't match/i),
    ).toBeInTheDocument();
    expect(calls).toBe(0);
  });

  it("shows the duplicate-email band with a Log in link on 4xx", async () => {
    server.use(
      http.post(REGISTER, () =>
        HttpResponse.json({ detail: "email taken" }, { status: 409 }),
      ),
    );
    const user = userEvent.setup();
    renderRegister();
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: /create account/i }));

    const band = await screen.findByRole("alert");
    expect(band).toHaveTextContent(/already registered/i);
    // The band carries an inline Log in link to /login.
    const logInLink = within(band).getByRole("link", { name: /log in/i });
    await user.click(logInLink);
    await waitFor(() =>
      expect(screen.getByText("login sentinel")).toBeInTheDocument(),
    );
  });
});
