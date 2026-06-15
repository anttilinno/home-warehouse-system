import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Trans } from "@lingui/react/macro";
import { post, setRefreshToken } from "@/lib/api";
import type { AuthTokenResponse } from "@/lib/types";
import { BevelButton, Window } from "@/components/retro";
import { oauthErrorMessage } from "./oauthErrors";

// `/auth/callback` — the single landing route for every SSO flow (Google /
// GitHub / Authelia). The backend redirects here with `?code=` (success) or
// `?error=<code>` (failure). On `?code=` we exchange the ONE-TIME code via
// POST /auth/oauth/exchange (Redis GetDel — single use).
//
// CONTRACT (load-bearing):
//  * StrictMode ref latch (Pitfall 5): React 19 dev double-invokes effects; a
//    second exchange would hit a consumed code and show a false error. `useRef`
//    guarantees the exchange fires EXACTLY ONCE.
//  * The one-time code is read from the URL, passed straight to exchange, and
//    NEVER stored or logged (T-05-15); navigate(replace) drops it from history.
//  * No AppShell — the user is not authenticated until exchange succeeds.

type CallbackState = "exchanging" | "error";

export function CallbackPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const exchanged = useRef(false);
  const [state, setState] = useState<CallbackState>("exchanging");
  const [errorMessage, setErrorMessage] = useState<string>("");

  // biome-ignore lint/correctness/useExhaustiveDependencies: single-run by design — the exchanged ref latches the one-time OAuth exchange; navigate/params are read once on mount.
  useEffect(() => {
    // StrictMode double-invoke guard — exchange must fire exactly once.
    if (exchanged.current) return;
    exchanged.current = true;

    const error = params.get("error");
    if (error) {
      // Backend bounced with a taxonomy error — no exchange, show the band.
      setErrorMessage(oauthErrorMessage(error));
      setState("error");
      return;
    }

    const code = params.get("code");
    if (!code) {
      // Neither code nor error — not a real callback. Bounce to login.
      navigate("/login", { replace: true });
      return;
    }

    post<AuthTokenResponse>("/auth/oauth/exchange", { code })
      .then((data) => {
        setRefreshToken(data.refresh_token);
        // Replace so the consumed ?code never sits in history.
        navigate("/", { replace: true });
      })
      .catch(() => {
        setErrorMessage(oauthErrorMessage("server_error"));
        setState("error");
      });
    // Empty deps + ref latch — intentional single run.
  }, []);

  if (state === "error") {
    return (
      <main className="grid min-h-screen place-items-center p-sp-4">
        <Window
          title={<Trans>Sign-in failed</Trans>}
          titlebarVariant="pink"
          className="w-full max-w-[400px]"
          bodyClassName="grid gap-sp-4 p-sp-5"
        >
          <p
            role="alert"
            className="border-2 border-danger bg-danger-bg px-sp-3 py-sp-2 text-13 font-semibold text-danger"
          >
            {errorMessage}
          </p>
          <div className="grid gap-sp-2">
            <BevelButton
              variant="primary"
              className="w-full justify-center py-[9px]"
              onClick={() => navigate("/login", { replace: true })}
            >
              <Trans>Back to login</Trans>
            </BevelButton>
            <BevelButton
              className="w-full justify-center py-[9px]"
              onClick={() => navigate("/login", { replace: true })}
            >
              <Trans>Try again</Trans>
            </BevelButton>
          </div>
        </Window>
      </main>
    );
  }

  // Exchanging — the retro stepped-progress loading idiom (UI-SPEC §3).
  return (
    <main className="grid min-h-screen place-items-center p-sp-4">
      <Window
        title={<Trans>Signing in</Trans>}
        className="w-full max-w-[400px]"
        bodyClassName="grid place-items-center gap-sp-4 p-sp-5"
      >
        <div
          aria-busy="true"
          className="grid h-[32px] w-[32px] place-items-center border-2 border-border-ink bg-bg-panel-2 bevel-sunken"
        >
          {/* Hard stepped block march — no eased spin (System 7 motion). The
              prefers-reduced-motion guard holds it solid. */}
          <span
            aria-hidden="true"
            className="retro-progress h-[10px] w-[10px] bg-fg-ink"
          />
        </div>
        <div role="status" className="text-center">
          <p className="text-14 text-fg-muted">
            <Trans>Completing sign-in…</Trans>
          </p>
          <p className="mt-sp-1 font-mono text-12 tabular-nums text-fg-faint">
            <Trans>exchanging credentials</Trans>
          </p>
        </div>
      </Window>
    </main>
  );
}
