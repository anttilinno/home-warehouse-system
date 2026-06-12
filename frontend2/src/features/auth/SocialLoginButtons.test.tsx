import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@/lib/i18n";
import { SocialLoginButtons } from "./SocialLoginButtons";
import { oauthErrorMessage, OAUTH_ERROR_COPY } from "./oauthErrors";

// Phase 05 Plan 04 — AUTH-03/04/11. The OAuth/SSO buttons perform a FULL-PAGE
// navigation (window.location.href), the Authelia button is env-gated and routes
// to the BARE ingress path, and oauthErrors maps the exact five backend codes.

function renderButtons(mode: "login" | "register" = "login") {
  return render(
    <I18nProvider i18n={i18n}>
      <SocialLoginButtons mode={mode} />
    </I18nProvider>,
  );
}

// A settable href spy: jsdom's window.location.href is not assignable by
// default, so redefine it as a plain getter/setter capturing the last value.
let hrefSpy: string;
const originalLocation = window.location;

beforeEach(() => {
  hrefSpy = "";
  Object.defineProperty(window, "location", {
    configurable: true,
    value: {
      ...originalLocation,
      get href() {
        return hrefSpy;
      },
      set href(v: string) {
        hrefSpy = v;
      },
    },
  });
});

afterEach(() => {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: originalLocation,
  });
  vi.unstubAllEnvs();
});

describe("oauthErrorMessage", () => {
  it("maps all five backend codes to non-empty copy", () => {
    const codes = [
      "provider_unavailable",
      "invalid_state",
      "authorization_cancelled",
      "email_not_verified",
      "server_error",
    ] as const;
    for (const code of codes) {
      expect(oauthErrorMessage(code)).toBe(OAUTH_ERROR_COPY[code]);
      expect(oauthErrorMessage(code).length).toBeGreaterThan(0);
    }
  });

  it("falls back to server_error copy for an unknown code", () => {
    expect(oauthErrorMessage("totally_unknown")).toBe(
      OAUTH_ERROR_COPY.server_error,
    );
    expect(oauthErrorMessage(null)).toBe(OAUTH_ERROR_COPY.server_error);
    expect(oauthErrorMessage(undefined)).toBe(OAUTH_ERROR_COPY.server_error);
  });
});

describe("SocialLoginButtons", () => {
  it("navigates to the /api OAuth initiate path for Google (full-page nav)", async () => {
    const user = userEvent.setup();
    renderButtons("login");
    await user.click(screen.getByRole("button", { name: /google/i }));
    expect(hrefSpy).toBe("/api/auth/oauth/google");
  });

  it("navigates to the /api OAuth initiate path for GitHub", async () => {
    const user = userEvent.setup();
    renderButtons("login");
    await user.click(screen.getByRole("button", { name: /github/i }));
    expect(hrefSpy).toBe("/api/auth/oauth/github");
  });

  it("does NOT render the Authelia/SSO button when the flag is unset", () => {
    renderButtons("login");
    expect(screen.queryByRole("button", { name: /sso/i })).toBeNull();
  });

  it("does NOT render the Authelia/SSO button when the flag is 'false'", () => {
    vi.stubEnv("VITE_AUTHELIA_ENABLED", "false");
    renderButtons("login");
    expect(screen.queryByRole("button", { name: /sso/i })).toBeNull();
  });

  it("renders the Authelia button when enabled and navigates to the BARE path", async () => {
    vi.stubEnv("VITE_AUTHELIA_ENABLED", "true");
    const user = userEvent.setup();
    renderButtons("login");
    const sso = screen.getByRole("button", { name: /sso/i });
    await user.click(sso);
    // BARE ingress path — NOT /api-prefixed (commit 8e13faf).
    expect(hrefSpy).toBe("/auth/authelia/login");
    expect(hrefSpy.startsWith("/api/")).toBe(false);
  });

  it("switches copy by mode (register → Sign up with…)", () => {
    renderButtons("register");
    expect(
      screen.getByRole("button", { name: /sign up with google/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /sign up with github/i }),
    ).toBeInTheDocument();
  });
});
