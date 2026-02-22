"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

const OAUTH_ERROR_KEYS: Record<string, string> = {
  authorization_cancelled: "oauth.errors.cancelled",
  email_not_verified: "oauth.errors.emailNotVerified",
  invalid_state: "oauth.errors.invalidState",
  server_error: "oauth.errors.serverError",
  provider_unavailable: "oauth.errors.providerUnavailable",
};

function OAuthErrorHandlerInner() {
  const searchParams = useSearchParams();
  const t = useTranslations("auth");

  useEffect(() => {
    const errorCode = searchParams.get("oauth_error");
    if (errorCode) {
      const messageKey = OAUTH_ERROR_KEYS[errorCode];
      if (messageKey) {
        toast.error(t("oauth.errors.title"), {
          description: t(messageKey),
          duration: 8000,
        });
      }
      // Clean up URL without triggering navigation
      const url = new URL(window.location.href);
      url.searchParams.delete("oauth_error");
      window.history.replaceState({}, "", url.toString());
    }
  }, [searchParams, t]);

  return null;
}

export function OAuthErrorHandler() {
  return (
    <Suspense fallback={null}>
      <OAuthErrorHandlerInner />
    </Suspense>
  );
}
