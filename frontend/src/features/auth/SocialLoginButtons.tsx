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
//  * Provider tiles are 18px ink squares with a Silkscreen initial (G / GH / A),
//    aria-hidden — NO icon packs (UI-SPEC Icon library DEFERRED).

export type SocialLoginMode = "login" | "register";

function ProviderTile({ initial }: Readonly<{ initial: string }>) {
  return (
    <span
      aria-hidden="true"
      className="grid h-[18px] w-[18px] flex-none place-items-center border border-border-ink bg-bg-panel font-display text-10 uppercase leading-none text-fg-ink"
    >
      {initial}
    </span>
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
        <ProviderTile initial="G" />
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
        <ProviderTile initial="GH" />
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
          <ProviderTile initial="A" />
          <Trans>Sign in with SSO</Trans>
        </BevelButton>
      )}
    </div>
  );
}
