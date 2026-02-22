"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { authApi } from "@/lib/api/auth";

export default function OAuthCallbackPage() {
  const searchParams = useSearchParams();
  const exchanged = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get("code");
    const errorParam = searchParams.get("error");
    const redirectTo = searchParams.get("redirect_to");

    // Handle error from OAuth provider
    if (errorParam) {
      window.location.href = `/login?error=${encodeURIComponent(errorParam)}`;
      return;
    }

    // Handle missing code
    if (!code) {
      window.location.href = "/login?error=missing_code";
      return;
    }

    // Prevent double-exchange in React StrictMode
    if (exchanged.current) return;
    exchanged.current = true;

    const exchange = async () => {
      try {
        await authApi.exchangeOAuthCode(code);

        // Determine redirect destination
        let destination = redirectTo;
        if (!destination) {
          // Fallback: read from sessionStorage
          destination = sessionStorage.getItem("oauth_redirect_to");
          sessionStorage.removeItem("oauth_redirect_to");
        }

        // Full page redirect ensures AuthProvider picks up the new token
        window.location.href = destination || "/dashboard";
      } catch {
        setError("Failed to complete sign in. Please try again.");
        setTimeout(() => {
          window.location.href = "/login?error=exchange_failed";
        }, 2000);
      }
    };

    exchange();
  }, [searchParams]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">Completing sign in...</p>
    </div>
  );
}
