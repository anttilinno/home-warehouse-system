"use client";

import { Suspense, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

import { useRouter } from "@/i18n/navigation";
import { authApi } from "@/lib/api/auth";
import { useAuth } from "@/lib/contexts/auth-context";

function OAuthCallbackInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { loadUserData } = useAuth();
  const exchanged = useRef(false);

  useEffect(() => {
    // Prevent React Strict Mode double-execution
    if (exchanged.current) return;
    exchanged.current = true;

    const error = searchParams.get("error");
    if (error) {
      router.replace(`/login?oauth_error=${encodeURIComponent(error)}`);
      return;
    }

    const code = searchParams.get("code");
    if (!code) {
      router.replace("/login");
      return;
    }

    async function handleExchange() {
      try {
        await authApi.exchangeOAuthCode(code!);
        await loadUserData();

        // Check if this is a link flow from settings
        const isLinking = sessionStorage.getItem("oauth_linking");
        if (isLinking === "true") {
          sessionStorage.removeItem("oauth_linking");
          router.replace("/dashboard/settings/security");
          return;
        }

        // Check for returnTo redirect
        const returnTo = sessionStorage.getItem("oauth_return_to");
        sessionStorage.removeItem("oauth_return_to");

        if (returnTo) {
          router.replace(returnTo);
        } else {
          router.replace("/dashboard");
        }
      } catch {
        router.replace("/login?oauth_error=server_error");
      }
    }

    handleExchange();
  }, [searchParams, router, loadUserData]);

  return (
    <div className="flex items-center justify-center min-h-[200px]">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[200px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <OAuthCallbackInner />
    </Suspense>
  );
}
