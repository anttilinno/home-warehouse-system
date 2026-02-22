# Phase 41: Frontend OAuth Flow and Connected Accounts - Research

**Researched:** 2026-02-22
**Domain:** Frontend OAuth callback handling, social login UX, connected accounts management, password UX for OAuth-only users
**Confidence:** HIGH

## Summary

Phase 41 is entirely frontend-focused, building on the backend OAuth infrastructure that Phase 40 delivers. The codebase is well-prepared: the `SocialLogin` component already renders Google and GitHub buttons on login/register pages (currently non-functional), the Security settings page already has password change and active sessions sections, and the auth context manages token storage and user data loading.

The core work breaks into four areas: (1) a new `/auth/callback` page that receives a one-time code from the backend OAuth callback, exchanges it for JWT tokens, and redirects to the intended page; (2) wiring the existing `SocialLogin` buttons to initiate OAuth by redirecting to the backend; (3) a new Connected Accounts section in Security settings showing linked providers with link/unlink capabilities; and (4) adapting the password change form to support OAuth-only users who need to set a password without providing a current one.

No new npm dependencies are required. All new UI uses existing shadcn/ui components (Card, Button, Badge, Skeleton), react-hook-form for the password form, next-intl for translations, and sonner for toasts. The project's established patterns for settings subpages, API client usage, and auth context integration apply directly.

**Primary recommendation:** Build the callback page first (it unblocks testing the full OAuth flow from Phase 40), then wire social buttons, then connected accounts UI, then password UX changes. All components follow existing project patterns -- no architectural innovation needed.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| OAUTH-07 | Social login redirects user back to intended page after OAuth flow completes | Callback page reads `redirect_to` from URL params (backend encodes original destination in the one-time code exchange response or as a separate query param); falls back to `/dashboard` |
| OAUTH-08 | Social login pre-fills full_name from provider profile on first signup | Backend handles this in Phase 40 (stores provider display_name as user full_name). Frontend sees it via `/users/me` response after callback. No frontend work beyond normal user data loading |
| SEC-02 | OAuth sessions appear in active sessions list and are revocable | Backend creates session records during OAuth login (Phase 40). Existing `ActiveSessions` component already displays and revokes sessions. May need to show login method (OAuth vs password) per session if backend includes it |
| ACCT-01 | User can view connected OAuth providers in Security settings | New `ConnectedAccounts` component fetching `GET /auth/oauth/accounts` and displaying provider cards with status |
| ACCT-02 | User can link additional Google or GitHub account from Security settings | "Connect" button redirects to `{BACKEND_URL}/auth/oauth/{provider}?action=link`; backend handles the linking flow and redirects back to settings with `?linked={provider}` |
| ACCT-03 | User can unlink an OAuth provider from Security settings | "Disconnect" button calls `DELETE /auth/oauth/accounts/{provider}`; refreshes connected accounts list |
| ACCT-04 | System prevents unlinking last auth method when user has no password (lockout guard) | Frontend checks `user.has_password` and connected account count; disables disconnect button with explanation when it would lock user out. Backend also enforces this server-side |
| ACCT-05 | OAuth-only user can set a password from Security settings without being asked for a current password | Modified password section detects `has_password === false` and shows "Set Password" form (new + confirm only, no current password field) |
| ACCT-06 | User profile includes `has_password` field to enable correct UI for OAuth-only users | Frontend `User` type in `auth.ts` needs `has_password: boolean` field. Backend adds this in Phase 40 |
</phase_requirements>

## Standard Stack

### Core (Already in Use)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.1.1 | App Router with locale groups | Project framework, all pages follow `app/[locale]/` pattern |
| React | 19.2.3 | UI rendering | Project standard |
| next-intl | 4.7.0 | i18n with `useTranslations` | All UI text uses translation keys |
| shadcn/ui | latest | Card, Button, Badge, Skeleton, Input, Label, Separator | Every settings component uses these |
| react-hook-form | 7.70.0 | Form handling with zodResolver | Used by LoginForm, SignupForm, PasswordChange |
| zod | 4.3.5 | Schema validation | Paired with react-hook-form |
| lucide-react | 0.562.0 | Icons (Shield, Link, Unlink, Loader2, etc.) | Project icon library |
| sonner | 2.0.7 | Toast notifications | Used for success/error feedback throughout |
| date-fns | 4.1.0 | Date formatting | Used in ActiveSessions for `formatDistanceToNow` |

### Supporting (Already in Use)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@/lib/api/client` | internal | API client with token management | All API calls go through `apiClient` |
| `@/lib/contexts/auth-context` | internal | Auth state (user, workspaces, login/logout) | OAuth callback must integrate with existing auth flow |
| `@/i18n/navigation` | internal | Locale-aware routing | All navigation uses `useRouter` and `Link` from here |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual callback page | NextAuth.js | NextAuth creates parallel auth system conflicting with existing JWT/cookie flow -- rejected per STATE.md decisions |
| Direct token in URL | One-time code exchange | One-time code is locked decision in STATE.md -- more secure, avoids token exposure in URL/logs |

**Installation:**
```bash
# No new packages needed
```

## Architecture Patterns

### Recommended Project Structure

```
frontend/
├── app/
│   └── [locale]/
│       └── (auth)/
│           └── callback/
│               └── page.tsx              # NEW: OAuth callback handler page
├── features/
│   └── auth/
│       └── components/
│           └── social-login.tsx          # MODIFIED: Add OAuth initiation handlers
├── components/
│   └── settings/
│       ├── security-settings.tsx         # MODIFIED: Add Connected Accounts section
│       ├── connected-accounts.tsx        # NEW: Provider cards with link/unlink
│       ├── password-change.tsx           # MODIFIED: Support has_password=false
│       └── set-password.tsx              # NEW: Set password form (no current pw)
└── lib/
    └── api/
        └── auth.ts                       # MODIFIED: Add OAuth types and methods
```

### Pattern 1: OAuth Callback Page (One-Time Code Exchange)

**What:** A client-side page at `/auth/callback` that receives a one-time code from the backend, exchanges it for JWT tokens via an API call, and redirects to the dashboard or intended page.

**When to use:** After the backend OAuth callback redirects here with `?code=ONETIME_CODE`.

**Why one-time code:** Locked decision in STATE.md -- avoids cross-origin cookie issues and prevents token exposure in URLs.

**Example:**
```typescript
// frontend/app/[locale]/(auth)/callback/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { apiClient } from "@/lib/api/client";

export default function OAuthCallbackPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get("code");
    const errorParam = searchParams.get("error");

    if (errorParam) {
      router.push(`/login?error=${encodeURIComponent(errorParam)}`);
      return;
    }

    if (!code) {
      router.push("/login?error=missing_code");
      return;
    }

    // Exchange one-time code for tokens
    async function exchangeCode() {
      try {
        const response = await apiClient.post<{ token: string; refresh_token: string }>(
          "/auth/oauth/exchange",
          { code }
        );
        apiClient.setToken(response.token);

        // Get redirect_to from params or default to dashboard
        const redirectTo = searchParams.get("redirect_to") || "/dashboard";
        router.push(redirectTo);
      } catch (err) {
        setError("Failed to complete sign in");
        router.push("/login?error=exchange_failed");
      }
    }

    exchangeCode();
  }, [searchParams, router]);

  if (error) {
    return <div className="text-center text-destructive">{error}</div>;
  }

  return (
    <div className="flex items-center justify-center min-h-[200px]">
      <Loader2 className="h-8 w-8 animate-spin" />
      <span className="ml-2">Completing sign in...</span>
    </div>
  );
}
```

### Pattern 2: Social Login Button Initiation

**What:** Transform existing non-functional social buttons into OAuth flow initiators by redirecting to the backend OAuth endpoint.

**When to use:** On login and register pages.

**Key detail:** Use `window.location.href` (full page redirect), NOT `fetch()` or `router.push()`. The OAuth flow is a multi-step redirect chain that starts at the backend.

**Example:**
```typescript
// Modified social-login.tsx
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function handleOAuthLogin(provider: "google" | "github") {
  // Store current path for redirect after OAuth
  const currentPath = window.location.pathname;
  if (currentPath !== "/login" && currentPath !== "/register") {
    sessionStorage.setItem("oauth_redirect_to", currentPath);
  }
  window.location.href = `${API_URL}/auth/oauth/${provider}`;
}
```

### Pattern 3: Connected Accounts in Settings

**What:** A settings section showing linked OAuth providers with connect/disconnect capabilities and lockout guard.

**When to use:** In Security settings, between Sessions and Danger Zone.

**Follows existing pattern:** Same structure as `ActiveSessions` component -- fetch data on mount, loading skeleton, list items, action buttons.

**Example:**
```typescript
// connected-accounts.tsx
interface OAuthAccount {
  provider: string;
  email: string;
  display_name: string | null;
  created_at: string;
}

// Fetch: GET /auth/oauth/accounts
// Connect: window.location.href = `${API_URL}/auth/oauth/${provider}?action=link`
// Disconnect: DELETE /auth/oauth/accounts/${provider}
// Lockout guard: disable disconnect when !user.has_password && accounts.length <= 1
```

### Pattern 4: Conditional Password Form

**What:** Show different password forms based on whether the user has a password set.

**When to use:** In Security settings password section.

**Decision logic:**
- `user.has_password === true` -> Show existing `PasswordChange` (current + new + confirm)
- `user.has_password === false` -> Show new `SetPassword` (new + confirm only)

**Backend contract:** The `PATCH /users/me/password` endpoint (Phase 40 modification) accepts requests without `current_password` when user has no password.

### Anti-Patterns to Avoid

- **Using `router.push()` for OAuth initiation:** The OAuth flow is a full browser redirect to an external provider. `router.push()` does client-side navigation within Next.js. Use `window.location.href` instead.
- **Storing OAuth state in frontend:** All OAuth state (CSRF, PKCE) is managed by the backend. The frontend just redirects to the backend URL and handles the result.
- **Polling for callback completion:** The callback page receives the one-time code synchronously as a URL parameter. No polling needed -- just exchange it once.
- **Separate routes for link vs login callback:** Use the same `/auth/callback` page. The backend encodes the action in the response. For account linking, the backend redirects to `/dashboard/settings/security?linked={provider}` directly.
- **Creating a new AuthProvider or context:** Integrate with the existing `useAuth()` context. After token exchange, the existing `loadUserData()` handles everything.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OAuth state management | Custom state tracking in frontend | Backend handles all state (CSRF cookies, PKCE) | Frontend has no business managing OAuth security state |
| Token exchange timing | Retry/polling logic | Single POST to `/auth/oauth/exchange` | One-time codes either work or fail; no retry makes sense |
| Provider icon SVGs | New icon components | Existing SVGs from `SocialLogin` component | Google and GitHub brand SVGs already exist |
| Loading skeletons | Custom skeleton UI | shadcn `Skeleton` component | Already used in `ActiveSessions` |
| Toast notifications | Custom notification system | `sonner` toast | Project standard for all user feedback |

**Key insight:** The entire OAuth security flow (CSRF, PKCE, token exchange, email verification, auto-linking) is handled by the backend. The frontend's job is purely UX: redirect user, show loading state, handle the result, and display connected accounts.

## Common Pitfalls

### Pitfall 1: Callback Page Not Handling Race with Auth Context
**What goes wrong:** The callback page sets the token via `apiClient.setToken()` and immediately navigates to `/dashboard`. But the `AuthProvider` in `auth-context.tsx` initializes on mount by checking `localStorage.getItem("auth_token")`. If the dashboard mounts before the auth context re-initializes, the user appears unauthenticated.
**Why it happens:** The `AuthProvider` runs `loadUserData()` on initial mount. After OAuth callback sets the token, navigating to dashboard creates a new page render. The auth context may already be in its "no token" initial state.
**How to avoid:** After setting the token in the callback page, call `window.location.href = "/dashboard"` (full page reload) instead of `router.push("/dashboard")`. This ensures the `AuthProvider` mounts fresh and finds the token in localStorage. Alternatively, add a method to `useAuth()` that triggers `loadUserData()` explicitly.
**Warning signs:** User completes OAuth but sees the login page briefly before redirecting to dashboard, or gets stuck on login.

### Pitfall 2: Connected Account Link Flow Losing Auth State
**What goes wrong:** When a logged-in user clicks "Connect Google" in settings, they redirect to `{BACKEND_URL}/auth/oauth/google?action=link`. The backend needs to know WHO is linking -- but the redirect goes to the backend origin, so the auth cookie may not be sent if backend and frontend are on different origins.
**Why it happens:** In the current architecture, auth is via both cookies (same-origin) and Authorization header. The redirect to the backend for linking is a top-level navigation, and `SameSite=Lax` cookies ARE sent on top-level GET navigations.
**How to avoid:** The backend reads the auth cookie (which is sent on the top-level GET redirect because `SameSite=Lax` allows this). The backend knows who the user is from the cookie JWT. No special frontend handling needed beyond the redirect URL. If cookies fail, the backend can accept a `token` query parameter as fallback (though this is less secure).
**Warning signs:** "Connect" button redirects but backend says "not authenticated" in the linking flow.

### Pitfall 3: Lockout Guard Only Checked Client-Side
**What goes wrong:** The frontend disables the "Disconnect" button when it would lock the user out, but a determined user could call the API directly. The backend must also enforce the lockout guard.
**Why it happens:** Frontend-only validation is a UX convenience, not a security measure.
**How to avoid:** Backend `DELETE /auth/oauth/accounts/{provider}` must return 409 if unlinking would leave zero auth methods. Frontend disables button as a UX hint but never relies on it as the sole guard. Phase 40 backend handles this.
**Warning signs:** API directly callable to unlink last provider despite frontend guard.

### Pitfall 4: Password Change Form Not Refreshing After Setting Password
**What goes wrong:** OAuth-only user sets a password via the "Set Password" form. The form succeeds, but the Security settings still shows "Set Password" instead of "Change Password" because the `user.has_password` value is cached in the auth context.
**Why it happens:** `useAuth()` caches the user object. Setting a password changes `has_password` on the server but the frontend still has the old value.
**How to avoid:** After successfully setting a password, call `refreshUser()` from the auth context to re-fetch `/users/me` with the updated `has_password` value. The connected accounts section should also re-render to enable disconnect buttons.
**Warning signs:** "Set Password" form stays visible after successfully setting a password.

### Pitfall 5: OAuth Redirect in PWA Standalone Mode on iOS
**What goes wrong:** On iOS, PWA standalone mode may open the OAuth redirect in Safari instead of the in-app browser, and the callback redirect back doesn't return to the PWA.
**Why it happens:** iOS PWA standalone mode handles external redirects differently than regular browser tabs.
**How to avoid:** Ensure the callback URL is within the PWA's scope (same origin as the frontend). The one-time code exchange pattern helps here because the backend redirects to `{APP_URL}/auth/callback?code=xxx` which is the PWA's own domain. Test specifically in PWA standalone mode on iOS.
**Warning signs:** OAuth works in browser but users report being stuck in Safari after completing consent.

### Pitfall 6: Not Handling the `?linked=` Query Parameter in Settings
**What goes wrong:** After successfully linking an account, the backend redirects to `/dashboard/settings/security?linked=google`. The Security settings page ignores the query parameter and shows no feedback. User doesn't know if linking succeeded.
**Why it happens:** The settings page doesn't read URL search params.
**How to avoid:** Read `linked` query param in the Security page or `ConnectedAccounts` component. Show a success toast on mount when `?linked=` is present. Clear the param from the URL after showing the toast.
**Warning signs:** User completes OAuth linking flow but sees no confirmation in settings.

## Code Examples

### OAuth Callback Page (Complete)

```typescript
// frontend/app/[locale]/(auth)/callback/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api/client";

export default function OAuthCallbackPage() {
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const exchanged = useRef(false); // Prevent double-exchange in React StrictMode

  useEffect(() => {
    if (exchanged.current) return;

    const code = searchParams.get("code");
    const errorParam = searchParams.get("error");
    const redirectTo = searchParams.get("redirect_to");

    if (errorParam) {
      window.location.href = `/login?error=${encodeURIComponent(errorParam)}`;
      return;
    }

    if (!code) {
      window.location.href = "/login?error=missing_code";
      return;
    }

    exchanged.current = true;

    async function exchangeCode() {
      try {
        const response = await apiClient.post<{
          token: string;
          refresh_token: string;
        }>("/auth/oauth/exchange", { code });
        apiClient.setToken(response.token);
        // Full page reload to ensure AuthProvider picks up new token
        window.location.href = redirectTo || "/dashboard";
      } catch {
        setError("Failed to complete sign in. Please try again.");
        setTimeout(() => {
          window.location.href = "/login?error=exchange_failed";
        }, 2000);
      }
    }

    exchangeCode();
  }, [searchParams]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[200px] gap-4">
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : (
        <>
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Completing sign in...</p>
        </>
      )}
    </div>
  );
}
```

### Social Login Button Wiring

```typescript
// Modified social-login.tsx
"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export function SocialLogin() {
  const t = useTranslations("auth");

  const handleOAuth = (provider: "google" | "github") => {
    window.location.href = `${API_URL}/auth/oauth/${provider}`;
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      <Button
        variant="outline"
        type="button"
        className="w-full"
        onClick={() => handleOAuth("google")}
      >
        {/* existing Google SVG */}
        Google
      </Button>
      <Button
        variant="outline"
        type="button"
        className="w-full"
        onClick={() => handleOAuth("github")}
      >
        {/* existing GitHub SVG */}
        GitHub
      </Button>
    </div>
  );
}
```

### Connected Accounts Component

```typescript
// frontend/components/settings/connected-accounts.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Link2, Unlink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { authApi, OAuthAccount } from "@/lib/api/auth";
import { useAuth } from "@/lib/contexts/auth-context";
import { toast } from "sonner";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const PROVIDERS = ["google", "github"] as const;

export function ConnectedAccounts() {
  const t = useTranslations("settings.security.connectedAccounts");
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [accounts, setAccounts] = useState<OAuthAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [unlinkingProvider, setUnlinkingProvider] = useState<string | null>(null);

  const loadAccounts = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await authApi.getConnectedAccounts();
      setAccounts(data);
    } catch {
      // Silently fail -- empty list shown
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  // Handle ?linked= query param for success feedback
  useEffect(() => {
    const linked = searchParams.get("linked");
    if (linked) {
      toast.success(t("linkSuccess", { provider: linked }));
      // Clean URL
      const url = new URL(window.location.href);
      url.searchParams.delete("linked");
      window.history.replaceState({}, "", url.toString());
      loadAccounts(); // Refresh list
    }
  }, [searchParams, t, loadAccounts]);

  const handleConnect = (provider: string) => {
    window.location.href = `${API_URL}/auth/oauth/${provider}?action=link`;
  };

  const handleDisconnect = async (provider: string) => {
    setUnlinkingProvider(provider);
    try {
      await authApi.unlinkAccount(provider);
      setAccounts((prev) => prev.filter((a) => a.provider !== provider));
      toast.success(t("unlinkSuccess", { provider }));
    } catch {
      toast.error(t("unlinkError"));
    } finally {
      setUnlinkingProvider(null);
    }
  };

  const canDisconnect = (provider: string) => {
    // User must have password OR another provider after unlinking
    const otherProviders = accounts.filter((a) => a.provider !== provider);
    return (user?.has_password ?? false) || otherProviders.length > 0;
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {PROVIDERS.map((provider) => {
        const account = accounts.find((a) => a.provider === provider);
        const isConnected = !!account;

        return (
          <div key={provider} className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-3">
              <ProviderIcon provider={provider} />
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm capitalize">{provider}</p>
                  {isConnected && (
                    <Badge variant="secondary" className="text-xs">
                      {t("connected")}
                    </Badge>
                  )}
                </div>
                {account && (
                  <p className="text-xs text-muted-foreground">{account.email}</p>
                )}
              </div>
            </div>
            {isConnected ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDisconnect(provider)}
                disabled={!canDisconnect(provider) || unlinkingProvider === provider}
                title={!canDisconnect(provider) ? t("setPasswordFirst") : t("disconnect")}
              >
                {unlinkingProvider === provider ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Unlink className="h-4 w-4" />
                )}
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={() => handleConnect(provider)}>
                <Link2 className="h-4 w-4 mr-1" />
                {t("connect")}
              </Button>
            )}
          </div>
        );
      })}
      {/* Lockout warning */}
      {!user?.has_password && accounts.length <= 1 && accounts.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {t("setPasswordWarning")}
        </p>
      )}
    </div>
  );
}
```

### Auth API Additions

```typescript
// Additions to frontend/lib/api/auth.ts

export interface OAuthAccount {
  provider: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

// Add to User interface:
// has_password: boolean;

// Add to authApi object:
export const authApi = {
  // ... existing methods ...

  exchangeOAuthCode: async (code: string): Promise<AuthTokenResponse> => {
    const response = await apiClient.post<AuthTokenResponse>("/auth/oauth/exchange", { code });
    apiClient.setToken(response.token);
    return response;
  },

  getConnectedAccounts: async (): Promise<OAuthAccount[]> => {
    return apiClient.get<OAuthAccount[]>("/auth/oauth/accounts");
  },

  unlinkAccount: async (provider: string): Promise<void> => {
    await apiClient.delete(`/auth/oauth/accounts/${provider}`);
  },

  setPassword: async (newPassword: string): Promise<void> => {
    await apiClient.patch("/users/me/password", {
      new_password: newPassword,
    });
  },
};
```

### Set Password Form (OAuth-Only Users)

```typescript
// frontend/components/settings/set-password.tsx
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { authApi } from "@/lib/api/auth";
import { useAuth } from "@/lib/contexts/auth-context";
import { toast } from "sonner";

export function SetPassword() {
  const t = useTranslations("settings.security.password");
  const { refreshUser } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const schema = z
    .object({
      new_password: z.string().min(8, t("validationMinLength")),
      confirm_password: z.string(),
    })
    .refine((data) => data.new_password === data.confirm_password, {
      message: t("validationMismatch"),
      path: ["confirm_password"],
    });

  type FormValues = z.infer<typeof schema>;

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true);
    try {
      await authApi.setPassword(data.new_password);
      reset();
      await refreshUser(); // Refresh user to update has_password
      toast.success(t("setSuccessMessage"));
    } catch {
      toast.error(t("errorFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("noPasswordSet")}</p>
      <div className="space-y-2">
        <Label htmlFor="new_password">{t("newPassword")}</Label>
        <Input
          id="new_password"
          type="password"
          autoComplete="new-password"
          {...register("new_password")}
          className={errors.new_password ? "border-destructive min-h-[44px]" : "min-h-[44px]"}
          disabled={isSubmitting}
        />
        {errors.new_password && (
          <p className="text-sm text-destructive">{errors.new_password.message}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm_password">{t("confirmPassword")}</Label>
        <Input
          id="confirm_password"
          type="password"
          autoComplete="new-password"
          {...register("confirm_password")}
          className={errors.confirm_password ? "border-destructive min-h-[44px]" : "min-h-[44px]"}
          disabled={isSubmitting}
        />
        {errors.confirm_password && (
          <p className="text-sm text-destructive">{errors.confirm_password.message}</p>
        )}
      </div>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {t("setButton")}
      </Button>
    </form>
  );
}
```

### Modified Security Settings

```typescript
// Modified security-settings.tsx - adding Connected Accounts section
export function SecuritySettings() {
  const t = useTranslations("settings.security");
  const { user } = useAuth();

  return (
    <Card>
      {/* ... existing header ... */}
      <CardContent className="space-y-6">
        {/* Password Section - conditional rendering */}
        <div className="space-y-4">
          <h3>...</h3>
          {user?.has_password ? <PasswordChange /> : <SetPassword />}
        </div>

        {/* Connected Accounts Section - NEW */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            {t("connectedAccounts.title")}
          </h3>
          <ConnectedAccounts />
        </div>

        {/* Sessions Section - existing */}
        <div className="space-y-4">...</div>

        {/* Danger Zone - existing */}
        <div className="space-y-4 border-t pt-6">...</div>
      </CardContent>
    </Card>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Token directly in callback URL | One-time code exchange | Locked decision for v1.8 | Frontend exchanges code for token via POST, preventing token exposure in URLs/logs |
| NextAuth.js for OAuth | Backend-driven OAuth with custom frontend | Locked decision for v1.8 | No new frontend dependencies; existing auth context handles all state |
| Popup-based OAuth | Redirect-based OAuth | Industry shift away from popups | Better PWA compatibility, fewer browser compatibility issues |

**Deprecated/outdated:**
- NextAuth.js approach: Rejected because it creates parallel auth system
- Frontend OAuth SDKs (Google Sign-In JS, etc.): Not needed; backend drives the flow

## Open Questions

1. **Exact API contract for one-time code exchange**
   - What we know: Backend generates a one-time code, frontend calls `POST /auth/oauth/exchange` with the code
   - What's unclear: Exact response shape (does it include `redirect_to`? Does it return the same `{ token, refresh_token }` as login?), TTL of the code, whether refresh_token is in the response body or only in cookies
   - Recommendation: Assume same response shape as `POST /auth/login` (`{ token, refresh_token }`). The redirect_to destination can be a URL parameter on the callback redirect rather than part of the code exchange response. This aligns with how the existing auth flow works.

2. **Session login_method field**
   - What we know: SEC-02 requires OAuth sessions to appear in the active sessions list
   - What's unclear: Whether Phase 40 adds a `login_method` field to `auth.user_sessions` (e.g., "password", "google", "github") for display in the UI
   - Recommendation: If Phase 40 adds this field, display it in the session list as a badge. If not, sessions from OAuth logins will still appear (they have the same session structure) but won't indicate HOW the user logged in. This is acceptable for v1.8 and can be enhanced later.

3. **Redirect-to preservation across OAuth flow**
   - What we know: OAUTH-07 requires returning user to their intended page after OAuth
   - What's unclear: Whether the backend encodes `redirect_to` in the state parameter or as a separate mechanism
   - Recommendation: Frontend stores intended path in `sessionStorage` before initiating OAuth redirect. After callback completes, read from `sessionStorage` and navigate there. This is simpler and more reliable than encoding in the OAuth state (which the backend controls).

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `frontend/features/auth/components/social-login.tsx`, `frontend/lib/contexts/auth-context.tsx`, `frontend/lib/api/auth.ts`, `frontend/lib/api/client.ts`, `frontend/components/settings/security-settings.tsx`, `frontend/components/settings/password-change.tsx`, `frontend/components/settings/active-sessions.tsx`
- Codebase analysis: `frontend/app/[locale]/(auth)/login/page.tsx`, `frontend/app/[locale]/(auth)/register/page.tsx`, `frontend/app/[locale]/(auth)/layout.tsx`
- Codebase analysis: `backend/internal/domain/auth/user/handler.go`, `backend/internal/domain/auth/user/entity.go`, `backend/internal/config/config.go`, `backend/internal/api/router.go`
- Codebase analysis: `backend/db/migrations/001_initial_schema.sql` (auth.user_oauth_accounts table), `backend/db/migrations/009_user_sessions.sql`
- v1.8 milestone research: `.planning/research/ARCHITECTURE.md`, `.planning/research/FEATURES.md`, `.planning/research/PITFALLS.md`, `.planning/research/STACK.md`

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` locked decisions: backend-driven flow, one-time code exchange, no provider token storage
- `.planning/REQUIREMENTS.md` requirement definitions for OAUTH-07, OAUTH-08, SEC-02, ACCT-01 through ACCT-06
- Phase 28 research (`.planning/phases/28-security-settings/28-RESEARCH.md`) for security settings patterns

### Tertiary (LOW confidence)
- PWA standalone mode behavior on iOS with OAuth redirects -- needs physical device testing (flagged as Pitfall 8-J in milestone research)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already in use, zero new dependencies
- Architecture: HIGH - follows existing patterns exactly (settings components, auth context, API client), callback page is the only new pattern and is well-documented in milestone research
- Pitfalls: HIGH - comprehensive milestone research already catalogs all OAuth pitfalls; frontend-specific pitfalls (auth context race, PWA mode) are documented above
- API contract: MEDIUM - exact response shapes from Phase 40 backend endpoints are not yet implemented; assumptions based on existing patterns are reasonable

**Research date:** 2026-02-22
**Valid until:** 2026-03-22 (stable -- no fast-moving dependencies)
