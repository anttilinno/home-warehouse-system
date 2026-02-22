# Phase 42: Error Handling, Internationalization, and Offline Polish - Research

**Researched:** 2026-02-22
**Domain:** Frontend error UX for OAuth flows, next-intl translation keys, offline-aware social login buttons
**Confidence:** HIGH

## Summary

Phase 42 is a frontend-only polish phase that builds on the backend error codes already emitted by Phase 40 and the UI components expected from Phase 41. The backend OAuth callback handler (`handler.go`) already redirects with specific error codes (`authorization_cancelled`, `email_not_verified`, `invalid_state`, `server_error`, `provider_unavailable`) via the `redirectWithError` function. Phase 41 should create the `/auth/callback` page that receives these codes and the code exchange flow. Phase 42's job is to (1) map those error codes to user-friendly, translated messages displayed on the login page, (2) add all OAuth-related UI strings to the three existing message files (en.json, et.json, ru.json) using the established next-intl pattern, and (3) disable the social login buttons when offline using the existing `useNetworkStatus` hook or `useOffline` context.

The project already has a mature i18n system (next-intl ^4.7.0 with `useTranslations` hooks), three complete translation files (~1100 keys each), and robust offline detection infrastructure (`useNetworkStatus` hook, `OfflineProvider` context, `OfflineIndicator` component). No new libraries or dependencies are needed. The work is purely additive: new translation keys, conditional rendering logic, and error display components.

**Primary recommendation:** Structure as two plans: (1) Error handling with i18n -- add all OAuth translation keys to all three locale files and implement error code-to-message mapping on the callback/login pages; (2) Offline polish -- wire `useNetworkStatus`/`useOffline` into the `SocialLogin` component to show disabled state with translated tooltip when offline.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ERR-01 | User sees specific error message when OAuth authorization is cancelled | Backend already sends `error=authorization_cancelled` query param to `/auth/callback`. Frontend must map this to translated message key `auth.oauth.errors.cancelled` and display it on the login page. |
| ERR-02 | User sees specific error message when provider email is not verified | Backend sends `error=email_not_verified`. Frontend maps to `auth.oauth.errors.emailNotVerified` with explanation that only verified emails can be linked. |
| ERR-03 | User sees specific error message when OAuth state is expired or invalid | Backend sends `error=invalid_state`. Frontend maps to `auth.oauth.errors.invalidState` with suggestion to try again. |
| ERR-04 | User sees specific error message when provider is temporarily unavailable | Backend sends `error=provider_unavailable` or `error=server_error`. Frontend maps to `auth.oauth.errors.providerUnavailable` / `auth.oauth.errors.serverError` with retry suggestion. |
| I18N-01 | All new OAuth UI strings have translation keys for all 3 supported languages | Add `auth.oauth` namespace with all button labels, error messages, connected accounts UI text, and set-password form text to en.json, et.json, ru.json. Existing pattern: flat JSON with dot-notation namespaces. |
| OFFL-01 | Social login buttons show disabled state or "Requires internet" message when offline | Use existing `useNetworkStatus` hook in `SocialLogin` component. When `isOffline`, render buttons with `disabled` prop and tooltip/message showing `auth.oauth.offlineRequired` translation key. |
</phase_requirements>

## Standard Stack

### Core (Already in Project)

| Library | Version | Purpose | How Reused |
|---------|---------|---------|------------|
| next-intl | ^4.7.0 | i18n translations with `useTranslations` hook | Add new keys to existing `messages/{en,et,ru}.json` files. Use `useTranslations("auth")` in OAuth components. |
| sonner | ^2.0.7 | Toast notifications for error messages | Display OAuth error toasts on the callback/login page using `toast.error()`. |
| lucide-react | ^0.562.0 | Icons for error states and offline indicator | `AlertCircle`, `WifiOff`, `CloudOff` icons in error/offline UI. |
| shadcn/ui (Button, Tooltip) | N/A (local components) | Disabled button states, tooltip for offline message | `Button disabled` prop + `Tooltip` wrapping social buttons when offline. |

### Supporting (Already in Project)

| Library | Version | Purpose | How Reused |
|---------|---------|---------|------------|
| next (useSearchParams) | 16.1.1 | Read `?error=` query parameter from OAuth redirect | `useSearchParams()` in callback page to extract error code. |

### Alternatives Considered

None needed. This phase uses exclusively existing project infrastructure.

## Architecture Patterns

### Recommended Project Structure

No new files beyond what Phase 41 creates. Phase 42 modifies existing files:

```
frontend/
├── messages/
│   ├── en.json              # MODIFIED: add auth.oauth.* keys
│   ├── et.json              # MODIFIED: add auth.oauth.* keys
│   └── ru.json              # MODIFIED: add auth.oauth.* keys
├── features/auth/components/
│   └── social-login.tsx     # MODIFIED: add offline-aware disabled state
├── app/[locale]/(auth)/
│   └── callback/            # CREATED by Phase 41; MODIFIED: add error display
│       └── page.tsx
└── app/[locale]/(auth)/
    └── login/
        └── page.tsx         # MODIFIED: display OAuth error from redirect
```

### Pattern 1: Error Code to Translated Message Mapping

**What:** Map backend error codes (URL query params) to user-friendly translated messages using a lookup object and `useTranslations`.

**When to use:** On the auth callback page and login page after OAuth redirect.

**Example:**
```typescript
// Error code mapping in callback or login page
const ERROR_KEYS: Record<string, string> = {
  authorization_cancelled: "auth.oauth.errors.cancelled",
  email_not_verified: "auth.oauth.errors.emailNotVerified",
  invalid_state: "auth.oauth.errors.invalidState",
  server_error: "auth.oauth.errors.serverError",
  provider_unavailable: "auth.oauth.errors.providerUnavailable",
};

// In component:
const searchParams = useSearchParams();
const oauthError = searchParams.get("error");
const t = useTranslations();

if (oauthError && ERROR_KEYS[oauthError]) {
  toast.error(t("auth.oauth.errors.title"), {
    description: t(ERROR_KEYS[oauthError]),
  });
}
```

### Pattern 2: Existing i18n Key Structure

**What:** Follow the existing flat JSON namespace pattern used throughout the project. OAuth keys go under the `auth.oauth` namespace.

**When to use:** For all new OAuth-related translation keys.

**Example:**
```json
{
  "auth": {
    "signIn": "Sign in",
    "orContinueWith": "or continue with",
    "oauth": {
      "continueWithGoogle": "Continue with Google",
      "continueWithGithub": "Continue with GitHub",
      "offlineRequired": "Internet connection required for social login",
      "errors": {
        "title": "Login failed",
        "cancelled": "You cancelled the login process. Please try again if you'd like to sign in with this provider.",
        "emailNotVerified": "Your email address with this provider is not verified. Please verify your email and try again.",
        "invalidState": "The login session has expired or was invalid. Please try again.",
        "serverError": "Something went wrong during login. Please try again later.",
        "providerUnavailable": "This login provider is currently unavailable. Please try again later or use a different method."
      },
      "connectedAccounts": {
        "title": "Connected Accounts",
        "description": "Manage your linked social login providers",
        "link": "Link Account",
        "unlink": "Unlink",
        "unlinkConfirm": "Are you sure you want to unlink this provider?",
        "unlinkLastWarning": "You must set a password before unlinking your only login method.",
        "linked": "Linked {date}",
        "noAccounts": "No connected accounts"
      },
      "setPassword": {
        "title": "Set Password",
        "description": "Set a password to enable email login alongside social login",
        "newPassword": "New Password",
        "confirmPassword": "Confirm Password",
        "setButton": "Set Password",
        "success": "Password set successfully"
      }
    }
  }
}
```

### Pattern 3: Offline-Aware Social Login Buttons

**What:** Use the existing `useNetworkStatus` hook to conditionally disable social login buttons and show an offline message.

**When to use:** In the `SocialLogin` component on login and register pages.

**Example:**
```typescript
"use client";

import { useTranslations } from "next-intl";
import { useNetworkStatus } from "@/lib/hooks/use-network-status";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { WifiOff } from "lucide-react";

export function SocialLogin() {
  const t = useTranslations("auth");
  const { isOffline } = useNetworkStatus();

  const handleGoogleLogin = () => {
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL}/auth/oauth/google`;
  };

  if (isOffline) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" type="button" className="w-full" disabled>
                {/* Google SVG */} Google
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("oauth.offlineRequired")}</TooltipContent>
          </Tooltip>
          {/* Same for GitHub */}
        </div>
        <p className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1">
          <WifiOff className="h-3 w-3" />
          {t("oauth.offlineRequired")}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      <Button variant="outline" type="button" className="w-full" onClick={handleGoogleLogin}>
        {/* Google SVG */} Google
      </Button>
      {/* GitHub button */}
    </div>
  );
}
```

### Anti-Patterns to Avoid

- **Generic error messages:** "Login failed" without context. Each error code must map to a specific, actionable user message that tells the user what happened and what to do next.
- **Hardcoded English strings in components:** All text must use `useTranslations()`. Do not mix hardcoded strings with translation keys.
- **Missing translations:** Every key in en.json must also exist in et.json and ru.json. The app does not fall back gracefully -- missing keys show the key path itself.
- **Offline detection in auth layout:** The `OfflineProvider` wraps the `(dashboard)` layout but NOT the `(auth)` layout. Use `useNetworkStatus` hook directly in the `SocialLogin` component instead of `useOffline()` context.
- **Blocking offline form submission:** Only social login should be disabled offline. Email/password login form should remain enabled (it will fail with a network error, but that is acceptable and expected behavior).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Offline detection | Custom `navigator.onLine` wrappers | Existing `useNetworkStatus` hook from `lib/hooks/use-network-status.ts` | Already handles SSR hydration, event listeners, wasOffline recovery state. |
| Translation management | i18next, react-i18next, or custom | Existing `next-intl` setup with `useTranslations` | Already configured with 3 locales, server component support, locale-prefixed routing. |
| Error toast display | Custom error banner components | `sonner` toast via `toast.error()` | Already used project-wide for form errors. Consistent UX. |
| Disabled button with tooltip | Custom disabled state overlay | shadcn `Button disabled` + `Tooltip` | Already in project component library. |

**Key insight:** This entire phase uses only existing infrastructure. No new dependencies, no new patterns. The work is purely additive: translation keys and conditional rendering logic.

## Common Pitfalls

### Pitfall 1: OAuth Error Displayed But User Stays on Callback Page

**What goes wrong:** Error code is read on `/auth/callback` but user sees a blank callback page instead of being redirected to login with the error displayed there.
**Why it happens:** Phase 41 callback page handles success (code exchange) but error case just shows a message on the callback page without redirecting.
**How to avoid:** The callback page should detect `?error=` param and redirect to `/login?oauth_error={code}`. The login page reads `oauth_error` and displays the translated error message via toast. This ensures the user lands on a familiar page with clear next actions.
**Warning signs:** User sees a blank page with just an error message and no login form.

### Pitfall 2: Missing Translation Keys Cause Runtime Key Display

**What goes wrong:** User sees raw translation key paths like `auth.oauth.errors.cancelled` instead of translated text.
**Why it happens:** Key added to en.json but forgotten in et.json or ru.json.
**How to avoid:** Always add keys to ALL three files simultaneously. Consider writing a simple validation check that all three files have identical key structures.
**Warning signs:** UI shows dot-separated paths instead of human-readable text.

### Pitfall 3: OfflineProvider Not Available in Auth Layout

**What goes wrong:** Calling `useOffline()` in the `SocialLogin` component throws "useOffline must be used within an OfflineProvider" because the auth layout does not wrap children in `OfflineProvider`.
**Why it happens:** The `OfflineProvider` is only used in the `(dashboard)` layout tree, not the `(auth)` layout.
**How to avoid:** Use `useNetworkStatus` hook directly instead of `useOffline()` context. The hook works anywhere -- it only needs browser `navigator.onLine` and window events.
**Warning signs:** Runtime error on login/register page: "useOffline must be used within an OfflineProvider".

### Pitfall 4: SSR Hydration Mismatch with Offline State

**What goes wrong:** Server renders social buttons as enabled (server has no `navigator.onLine`), client hydrates as disabled (browser is offline). React throws hydration mismatch warning.
**Why it happens:** `useNetworkStatus` defaults to `isOnline: true` on server, but browser may be offline during hydration.
**How to avoid:** The existing `useNetworkStatus` hook already handles this by initializing to `true` and updating in `useEffect`. The disabled state should only apply after client-side mount. Use a `mounted` state guard similar to `OfflineIndicator` component pattern.
**Warning signs:** Console warning about hydration mismatch on login page when browser is offline.

### Pitfall 5: Estonian and Russian Translation Quality

**What goes wrong:** Machine-translated text reads unnaturally or uses incorrect technical terminology.
**Why it happens:** OAuth terminology (provider, link, unlink) may not have direct equivalents.
**How to avoid:** Follow existing translation patterns in the codebase. Estonian file already uses terms like "Logi sisse" (sign in), "Registreeru" (sign up). Russian file uses "Войти" (sign in). Keep OAuth-specific terms simple: "Google konto" (Estonian), "аккаунт Google" (Russian).
**Warning signs:** Estonian speakers report unnatural phrasing. Russian translations use anglicisms unnecessarily.

## Code Examples

### Backend Error Codes (Already Implemented in Phase 40)

The backend `handler.go` `redirectWithError` function sends these error codes as query params:

```go
// handler.go - Already implemented
func redirectWithError(w http.ResponseWriter, r *http.Request, appURL, errorCode string) {
    redirectURL := fmt.Sprintf("%s/auth/callback?error=%s", appURL, errorCode)
    http.Redirect(w, r, redirectURL, http.StatusTemporaryRedirect)
}

// Error codes used in Callback handler:
// - "authorization_cancelled" -- user denied/cancelled OAuth consent
// - "email_not_verified" -- provider email not verified (security gate)
// - "invalid_state" -- CSRF state mismatch or expired cookie
// - "server_error" -- token exchange, profile fetch, or JWT generation failure
// - "provider_unavailable" -- unknown/unsupported provider
```

### Translation Key Structure (to add to en.json)

```json
{
  "auth": {
    "oauth": {
      "continueWithGoogle": "Continue with Google",
      "continueWithGithub": "Continue with GitHub",
      "offlineRequired": "Internet connection required for social login",
      "errors": {
        "title": "Sign in failed",
        "cancelled": "You cancelled the sign in. You can try again anytime.",
        "emailNotVerified": "Your email with this provider isn't verified. Please verify your email first, then try again.",
        "invalidState": "Your sign in session expired. Please try again.",
        "serverError": "Something went wrong. Please try again later.",
        "providerUnavailable": "This sign in method is temporarily unavailable. Please try another method."
      },
      "connectedAccounts": {
        "title": "Connected Accounts",
        "description": "Manage your linked social login providers",
        "link": "Link Account",
        "unlink": "Unlink",
        "unlinkConfirm": "Are you sure you want to unlink {provider}?",
        "unlinkLastWarning": "Set a password first before unlinking your only sign in method.",
        "unlinkSuccess": "Account unlinked successfully",
        "unlinkError": "Failed to unlink account",
        "linkSuccess": "Account linked successfully",
        "noAccounts": "No connected accounts",
        "linkedOn": "Linked {date}"
      },
      "setPassword": {
        "title": "Set Password",
        "description": "Add a password to sign in with email too",
        "newPassword": "New Password",
        "confirmPassword": "Confirm Password",
        "setButton": "Set Password",
        "setting": "Setting...",
        "success": "Password set successfully",
        "error": "Failed to set password"
      }
    }
  }
}
```

### Offline-Aware SocialLogin Component

```typescript
"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useNetworkStatus } from "@/lib/hooks/use-network-status";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export function SocialLogin() {
  const t = useTranslations("auth");
  const { isOffline } = useNetworkStatus();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // SSR-safe: don't show offline state until mounted
  const showOffline = mounted && isOffline;

  const googleButton = (
    <Button
      variant="outline"
      type="button"
      className="w-full"
      disabled={showOffline}
      onClick={() => {
        if (!showOffline) window.location.href = `${API_URL}/auth/oauth/google`;
      }}
    >
      {/* Google SVG icon */}
      Google
    </Button>
  );

  const githubButton = (
    <Button
      variant="outline"
      type="button"
      className="w-full"
      disabled={showOffline}
      onClick={() => {
        if (!showOffline) window.location.href = `${API_URL}/auth/oauth/github`;
      }}
    >
      {/* GitHub SVG icon */}
      GitHub
    </Button>
  );

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-3">
        {showOffline ? (
          <>
            <Tooltip>
              <TooltipTrigger asChild>{googleButton}</TooltipTrigger>
              <TooltipContent>{t("oauth.offlineRequired")}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>{githubButton}</TooltipTrigger>
              <TooltipContent>{t("oauth.offlineRequired")}</TooltipContent>
            </Tooltip>
          </>
        ) : (
          <>
            {googleButton}
            {githubButton}
          </>
        )}
      </div>
      {showOffline && (
        <p className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1">
          <WifiOff className="h-3 w-3" />
          {t("oauth.offlineRequired")}
        </p>
      )}
    </div>
  );
}
```

### Error Display on Login Page

```typescript
// In login page component or a wrapper
"use client";

import { useEffect } from "react";
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

export function OAuthErrorHandler() {
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
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| next-intl v3 with `createTranslator` | next-intl v4 with `useTranslations` + `getTranslations` | 2025 | v4 supports React Server Components natively. This project is already on v4. |
| ICU MessageFormat for all plurals | next-intl built-in ICU support | Always | Project already uses `{count, plural, ...}` syntax in messages. |
| navigator.onLine only | navigator.onLine + online/offline events | Standard | The `useNetworkStatus` hook already combines both for reliable detection. |

**Deprecated/outdated:**
- None relevant to this phase.

## Open Questions

1. **Whether Phase 41 creates the callback page or this phase needs to**
   - What we know: Phase 41's success criteria include "User clicks Continue with Google... and completes the full OAuth flow, landing on the dashboard." This implies Phase 41 creates the `/auth/callback` page with the code exchange logic.
   - What's unclear: Whether Phase 41 also handles the error query param case or leaves that entirely to Phase 42.
   - Recommendation: Assume Phase 41 creates the callback page with success-path code exchange. Phase 42 adds the error-path handling (redirect to login with error param, display toast). If Phase 41 already handles errors, Phase 42 refines the messages and adds i18n.

2. **Exact set of OAuth-related strings that Phase 41 introduces**
   - What we know: Phase 41 builds the social login button click handlers, callback page, connected accounts UI, and set-password form. These will have English strings initially.
   - What's unclear: Whether Phase 41 uses hardcoded strings or translation keys from the start.
   - Recommendation: Phase 42 should audit all OAuth-related components for hardcoded strings and migrate them to translation keys. If Phase 41 already uses keys, Phase 42 adds the et.json and ru.json translations.

3. **Connected accounts and set-password UI strings**
   - What we know: Requirements ACCT-01 through ACCT-06 are in Phase 41. The UI for these features will have text that needs i18n.
   - What's unclear: The exact component structure Phase 41 creates.
   - Recommendation: Include placeholder translation keys for connected accounts and set-password UI in the research. Phase 42 planner should audit Phase 41 output and adjust keys as needed.

## Sources

### Primary (HIGH confidence)

- Codebase: `backend/internal/domain/auth/oauth/handler.go` -- error codes confirmed: `authorization_cancelled`, `email_not_verified`, `invalid_state`, `server_error`, `provider_unavailable`
- Codebase: `frontend/messages/en.json`, `et.json`, `ru.json` -- existing i18n key structure (~1100 keys per file), flat JSON with dot-notation namespaces
- Codebase: `frontend/i18n/config.ts` -- locales: en, et, ru; default: en; localePrefix: "as-needed"
- Codebase: `frontend/i18n/request.ts` -- next-intl `getRequestConfig` with dynamic `import(`../messages/${locale}.json`)`
- Codebase: `frontend/lib/hooks/use-network-status.ts` -- `useNetworkStatus` hook returns `{ isOnline, isOffline, wasOffline }`
- Codebase: `frontend/lib/contexts/offline-context.tsx` -- `OfflineProvider` wraps dashboard layout only (NOT auth layout)
- Codebase: `frontend/components/pwa/offline-indicator.tsx` -- existing offline indicator pattern with `mounted` state guard for SSR
- Codebase: `frontend/features/auth/components/social-login.tsx` -- current social login component (placeholder, no click handlers yet)
- Codebase: `frontend/app/[locale]/(auth)/layout.tsx` -- auth layout (no OfflineProvider, no TooltipProvider)
- Codebase: `frontend/app/[locale]/(auth)/login/page.tsx` -- login page using SocialLogin + LoginForm
- Codebase: `frontend/lib/api/client.ts` -- API client pattern, `NEXT_PUBLIC_API_URL`
- Codebase: `frontend/lib/api/auth.ts` -- `authApi.login`, token storage in localStorage
- Codebase: `frontend/package.json` -- next-intl ^4.7.0, next 16.1.1, sonner ^2.0.7, lucide-react ^0.562.0

### Secondary (MEDIUM confidence)

- Phase 40 research: `.planning/phases/40-database-migration-and-backend-oauth-core/40-RESEARCH.md` -- backend error flow design, one-time code exchange pattern
- Roadmap: `.planning/ROADMAP.md` -- Phase 41 creates callback page and connected accounts UI; Phase 42 adds error handling, i18n, offline polish

### Tertiary (LOW confidence)

- Exact Phase 41 component structure not yet known (Phase 41 not started). Translation key names may need adjustment based on Phase 41 output.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All libraries already in project. No new dependencies needed. i18n pattern verified against 1100+ existing keys.
- Architecture: HIGH -- Error code flow verified from backend handler.go through to frontend rendering path. Offline detection pattern verified from existing OfflineIndicator component. Auth layout constraints verified (no OfflineProvider).
- Pitfalls: HIGH -- SSR hydration, missing translations, OfflineProvider scope -- all verified against actual codebase structure.

**Research date:** 2026-02-22
**Valid until:** 2026-03-22 (stable domain, 30-day validity)
