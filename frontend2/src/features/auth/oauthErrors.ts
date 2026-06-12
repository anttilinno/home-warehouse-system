// OAuth `?error=` taxonomy → UI copy (05-UI-SPEC Error taxonomy table).
// The backend redirects to `${AppURL}/auth/callback?error=<code>` with EXACTLY
// these five codes (verified against oauth/handler.go); any other / unknown
// value falls back to the generic server_error copy so a surprise code never
// renders a blank band. Copy is verbatim from the UI-SPEC Copywriting Contract.
//
// Kept as a plain map (no JSX) so it is trivially unit-testable and importable
// from non-React code. The value here IS the English source copy; consuming
// components pass it through Lingui's runtime at render.

export type OAuthErrorCode =
  | "provider_unavailable"
  | "invalid_state"
  | "authorization_cancelled"
  | "email_not_verified"
  | "server_error";

// The five exact backend codes → copy. `server_error` is also the fallback.
const OAUTH_ERROR_COPY: Record<OAuthErrorCode, string> = {
  provider_unavailable:
    "That sign-in provider is temporarily unavailable. Try again shortly, or use email and password.",
  invalid_state:
    "That sign-in link expired or didn't match. Start again from the login page.",
  authorization_cancelled:
    "Sign-in was cancelled. Try again when you're ready.",
  email_not_verified:
    "Your provider email isn't verified. Verify it with the provider, then try again.",
  server_error:
    "Something went wrong signing you in. Try again, or use email and password.",
};

/**
 * Map an OAuth `?error=` code to its UI copy. Unknown / undefined codes fall
 * back to the `server_error` copy (never a blank band).
 */
export function oauthErrorMessage(code: string | null | undefined): string {
  if (code && code in OAUTH_ERROR_COPY) {
    return OAUTH_ERROR_COPY[code as OAuthErrorCode];
  }
  return OAUTH_ERROR_COPY.server_error;
}

export { OAUTH_ERROR_COPY };
