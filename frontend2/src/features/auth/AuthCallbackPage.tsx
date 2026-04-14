import { useEffect, useRef, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router";
import { useLingui } from "@lingui/react/macro";
import { HazardStripe } from "@/components/retro";
import { post, setRefreshToken } from "@/lib/api";
import type { AuthTokenResponse } from "@/lib/types";
import { useAuth } from "./AuthContext";

export function AuthCallbackPage() {
  const { t } = useLingui();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const exchangedRef = useRef(false);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (exchangedRef.current) return;
    exchangedRef.current = true;

    const errorParam = searchParams.get("error");
    if (errorParam) {
      setError(t`Authentication failed. Try a different sign-in method.`);
      return;
    }

    const code = searchParams.get("code");
    if (!code) {
      setError(t`Authentication failed. Try a different sign-in method.`);
      return;
    }

    (async () => {
      try {
        const res = await post<AuthTokenResponse>("/auth/oauth/exchange", {
          code,
        });
        setRefreshToken(res.refresh_token);
        await refreshUser();
        navigate("/", { replace: true });
      } catch {
        setError(t`Authentication failed. Try a different sign-in method.`);
      }
    })();
  }, [searchParams, navigate, refreshUser, t]);

  return (
    <div className="min-h-screen bg-retro-charcoal flex items-center justify-center p-lg">
      <div className="bg-retro-cream border-retro-thick border-retro-ink shadow-retro-raised p-lg max-w-[420px] w-full max-sm:mx-md text-center">
        <HazardStripe className="mb-md" />

        {error ? (
          <div>
            <h1 className="text-retro-red text-[20px] font-bold uppercase mb-md">
              {t`AUTHENTICATION FAILED`}
            </h1>
            <p className="text-retro-red text-[14px] mb-md">{error}</p>
            <Link
              to="/login"
              className="inline-block w-full h-[44px] leading-[44px] border-retro-thick border-retro-ink bg-retro-cream text-retro-ink text-[14px] font-bold uppercase shadow-retro-raised hover:bg-retro-amber hover:cursor-pointer active:shadow-retro-pressed"
            >
              {t`RETURN TO LOGIN`}
            </Link>
          </div>
        ) : (
          <div>
            <p className="text-retro-ink text-[14px] font-bold uppercase font-mono mb-md">
              {t`AUTHENTICATING...`}
            </p>
            <div className="flex justify-center gap-xs">
              <span
                className="w-[8px] h-[8px] bg-retro-ink rounded-full animate-[blink_1.4s_infinite_both]"
                style={{ animationDelay: "0s" }}
              />
              <span
                className="w-[8px] h-[8px] bg-retro-ink rounded-full animate-[blink_1.4s_infinite_both]"
                style={{ animationDelay: "0.2s" }}
              />
              <span
                className="w-[8px] h-[8px] bg-retro-ink rounded-full animate-[blink_1.4s_infinite_both]"
                style={{ animationDelay: "0.4s" }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
