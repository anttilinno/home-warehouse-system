import { describe, expect, it } from "vitest";
import { OAUTH_ERROR_COPY, oauthErrorMessage } from "./oauthErrors";

// Phase-2 test-gap 2.4 — oauthErrorMessage is the sole entry point CallbackPage
// uses to render the ?error= band; guard the five backend codes plus the
// unknown/undefined fallback to server_error copy.

describe("oauthErrorMessage", () => {
  it("maps each of the five backend error codes to its copy", () => {
    for (const code of Object.keys(OAUTH_ERROR_COPY) as Array<
      keyof typeof OAUTH_ERROR_COPY
    >) {
      expect(oauthErrorMessage(code)).toBe(OAUTH_ERROR_COPY[code]);
    }
  });

  it("falls back to server_error copy for an unknown code", () => {
    expect(oauthErrorMessage("some_new_code")).toBe(
      OAUTH_ERROR_COPY.server_error,
    );
  });

  it("falls back to server_error copy for null/undefined", () => {
    expect(oauthErrorMessage(null)).toBe(OAUTH_ERROR_COPY.server_error);
    expect(oauthErrorMessage(undefined)).toBe(OAUTH_ERROR_COPY.server_error);
  });
});
