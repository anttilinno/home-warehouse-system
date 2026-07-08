import type { ReactNode } from "react";
import { Trans } from "@lingui/react/macro";
import { BevelButton } from "@/components/retro";

// OAuth + Authelia SSO button group (05-UI-SPEC §1 OAuth group; sketch 007).
//
// CONTRACT (load-bearing, do not "improve"):
//  * OAuth initiate is a FULL-PAGE navigation (window.location.href), NOT a
//    fetch/api-client call — the provider needs a top-level redirect to set the
//    oauth_state cookie and bounce to its consent screen (Anti-Pattern: never
//    fetch the initiate endpoint). The initiate path goes through the same-origin
//    `/api` proxy: literal `/api/auth/oauth/{provider}`.
//  * Authelia routes to the BARE ingress path `/auth/authelia/login` — NOT
//    `/api/...` (commit 8e13faf: the ingress, not the SPA, owns Authelia trust).
//    Grep-gated to NOT be /api-prefixed.
//  * The Authelia button renders ONLY when import.meta.env.VITE_AUTHELIA_ENABLED
//    === "true" (build-time flag; tree-shaken/hidden otherwise).
//  * Provider tiles are 18px squares holding an inline brand SVG (aria-hidden).
//    Logos are inlined single-file — NO icon-pack dependency (UI-SPEC Icon
//    library still DEFERRED; these are hand-copied brand marks, not a lib).

export type SocialLoginMode = "login" | "register";

function ProviderTile({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <span
      aria-hidden="true"
      className="grid h-[18px] w-[18px] flex-none place-items-center border border-border-ink bg-bg-panel leading-none text-fg-ink"
    >
      {children}
    </span>
  );
}

// Official 4-colour Google "G".
function GoogleLogo() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" className="h-[13px] w-[13px]">
      <path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
      />
      <path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
      />
      <path
        fill="#FBBC05"
        d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"
      />
      <path
        fill="#EA4335"
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
      />
    </svg>
  );
}

// GitHub Octocat mark (monochrome, inherits ink colour).
function GitHubLogo() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-[14px] w-[14px]"
    >
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

// Generic SSO key (Authelia has no brand mark; inherits ink colour).
function SsoLogo() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[13px] w-[13px]"
    >
      <circle cx="7.5" cy="15.5" r="4.5" />
      <path d="M10.7 12.3 21 2M15 5l3 3M14 8l2 2" />
    </svg>
  );
}

function navigate(href: string): void {
  // Full-page redirect — OAuth/SSO cannot use the api client (needs a top-level
  // navigation, not an XHR). Assigning `.href` is the testable seam.
  globalThis.location.href = href;
}

export function SocialLoginButtons({
  mode,
}: Readonly<{ mode: SocialLoginMode }>) {
  const autheliaEnabled = import.meta.env.VITE_AUTHELIA_ENABLED === "true";

  return (
    <div className="grid gap-sp-2">
      <BevelButton
        className="w-full justify-center py-[9px] normal-case tracking-normal"
        onClick={() => navigate("/api/auth/oauth/google")}
      >
        <ProviderTile>
          <GoogleLogo />
        </ProviderTile>
        {mode === "register" ? (
          <Trans>Sign up with Google</Trans>
        ) : (
          <Trans>Sign in with Google</Trans>
        )}
      </BevelButton>

      <BevelButton
        className="w-full justify-center py-[9px] normal-case tracking-normal"
        onClick={() => navigate("/api/auth/oauth/github")}
      >
        <ProviderTile>
          <GitHubLogo />
        </ProviderTile>
        {mode === "register" ? (
          <Trans>Sign up with GitHub</Trans>
        ) : (
          <Trans>Sign in with GitHub</Trans>
        )}
      </BevelButton>

      {autheliaEnabled && (
        <BevelButton
          className="w-full justify-center py-[9px] normal-case tracking-normal"
          onClick={() => navigate("/auth/authelia/login")}
        >
          <ProviderTile>
            <SsoLogo />
          </ProviderTile>
          <Trans>Sign in with SSO</Trans>
        </BevelButton>
      )}
    </div>
  );
}
