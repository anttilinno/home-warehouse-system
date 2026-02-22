# Phase 41: Frontend OAuth Flow and Connected Accounts - Research

**Researched:** 2026-02-22
**Domain:** Next.js 16 frontend OAuth callback, social login wiring, security settings extensions, and backend password-set endpoint
**Confidence:** HIGH

## Summary

Phase 41 bridges the fully-implemented backend OAuth infrastructure (Phase 40) to the frontend, enabling users to complete the full Google/GitHub login/signup flow and manage connected accounts from Security settings. The backend already provides all necessary API endpoints: `GET /auth/oauth/{provider}` (initiate), `GET /auth/oauth/{provider}/callback` (provider callback), `POST /auth/oauth/exchange` (one-time code exchange), `GET /auth/oauth/accounts` (list linked accounts), and `DELETE /auth/oauth/accounts/{provider}` (unlink). The frontend currently has visual-only social login buttons with no click handlers, and no `/auth/callback` page to handle the redirect from the backend.

The implementation divides into four workstreams: (1) Creating the `/auth/callback` page that exchanges the one-time code for tokens and handles error redirects, (2) Wiring the SocialLogin buttons to initiate OAuth by navigating to the backend's initiate URL, (3) Extending the Security settings page with a Connected Accounts section for viewing/linking/unlinking providers, and (4) Adding a "set password" capability for OAuth-only users. The frontend `User` type currently lacks the `has_password` field even though the backend already returns it -- this must be added first, as it gates the conditional UI for password-setting and the lockout guard.

A critical finding is that the backend's `UpdatePassword` service method always validates the current password, which returns false for OAuth-only users (empty hash). A new backend endpoint `POST /users/me/password` (or modifying the existing `PATCH /users/me/password` to accept empty `current_password` when `has_password=false`) is needed for ACCT-05.

**Primary recommendation:** Start with the callback page and SocialLogin button wiring (enables the core flow), then add `has_password` to the frontend User type, then build the Connected Accounts section and password-set form.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| OAUTH-07 | Social login redirects user back to intended page after OAuth flow completes | Callback page stores `returnTo` in sessionStorage before initiating OAuth, reads it after code exchange, and navigates there. Falls back to `/dashboard`. |
| OAUTH-08 | Social login pre-fills full_name from provider profile on first signup | Backend already stores `full_name` from provider profile during `CreateOAuthUser`. The `/users/me` endpoint returns it. Auth context's `loadUserData` fetches the user after code exchange, so the name is immediately available. No frontend changes needed beyond ensuring the callback page triggers `loadUserData`. |
| SEC-02 | OAuth sessions appear in active sessions list and are revocable | Backend already creates sessions during OAuth callback (line 237 of handler.go). The `GET /users/me/sessions` and `DELETE /users/me/sessions/{id}` endpoints already work for OAuth sessions. The existing `ActiveSessions` component displays all sessions -- OAuth sessions appear automatically. Only verification needed. |
| ACCT-01 | User can view connected OAuth providers in Security settings | New `ConnectedAccounts` component calls `GET /auth/oauth/accounts`. Displays each provider with email, display name, linked date. Add to `SecuritySettings` between password and sessions sections. |
| ACCT-02 | User can link additional Google or GitHub account from Security settings | "Link" button navigates to `GET /auth/oauth/{provider}` (same initiate flow). Callback page detects user is already authenticated and refreshes account list instead of full login flow. |
| ACCT-03 | User can unlink an OAuth provider from Security settings | "Unlink" button calls `DELETE /auth/oauth/accounts/{provider}`. Handles 409 Conflict (lockout guard) with error toast. Refreshes account list on success. |
| ACCT-04 | System prevents unlinking last auth method when user has no password (lockout guard) | Backend already returns 409 with message "cannot unlink sole authentication method when no password is set". Frontend displays this as an error toast. UI can also proactively show warning/disable unlink when `accounts.length === 1 && !user.has_password`. |
| ACCT-05 | OAuth-only user can set a password from Security settings (no current password required) | Requires backend modification: `PATCH /users/me/password` must skip current password check when `has_password=false`. Frontend `PasswordChange` component conditionally hides "Current Password" field when `user.has_password === false`. |
| ACCT-06 | User profile includes `has_password` field to enable correct UI for OAuth-only users | Backend already returns `has_password` in `UserResponse`. Frontend `User` type needs `has_password: boolean` added. Auth context passes it through. |
</phase_requirements>

## Standard Stack

### Core (Already in Project -- No New Dependencies)

| Library | Version | Purpose | How Used |
|---------|---------|---------|----------|
| next | 16 | App Router, page routing, client/server components | `/auth/callback` page, settings pages |
| react | 19 | UI components, hooks | SocialLogin onClick, ConnectedAccounts, PasswordChange |
| next-intl | ^4.7.0 | i18n translations | New keys for connected accounts, password set |
| sonner | (existing) | Toast notifications | Success/error feedback for link/unlink/password |
| react-hook-form + zod | (existing) | Form validation | Password set form |
| lucide-react | (existing) | Icons | Link, Unlink, Shield icons |
| shadcn/ui | (existing) | UI components | Card, Button, Badge, Skeleton, AlertDialog |

### Supporting (Existing Patterns)

| Library/Pattern | Purpose | How Reused |
|----------------|---------|------------|
| `apiClient` (`lib/api/client.ts`) | HTTP calls to backend | New auth API functions for OAuth endpoints |
| `useAuth` context | Auth state management | `user.has_password`, `refreshUser()` after linking |
| `useNetworkStatus` | Offline detection | Already used in SocialLogin for disable state |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Direct `window.location.href` for OAuth initiate | `useRouter().push()` | Router push would try client-side navigation. OAuth initiate is a full-page backend redirect -- `window.location.href` is correct. |
| SWR/React Query for accounts list | Manual `useState + useEffect` fetch | Accounts list is small, rarely changes, only on settings page. Manual fetch matches existing pattern (see `ActiveSessions`). |

**Installation:**
```bash
# No new packages needed
```

## Architecture Patterns

### Recommended Changes

```
frontend/
├── app/[locale]/
│   ├── (auth)/
│   │   ├── auth/callback/       # NEW: OAuth callback page
│   │   │   └── page.tsx         # Exchanges code, handles errors, redirects
│   │   ├── login/page.tsx       # UNCHANGED (OAuthErrorHandler already present)
│   │   └── register/page.tsx    # UNCHANGED (SocialLogin already present)
│   └── (dashboard)/dashboard/settings/security/
│       └── page.tsx             # UNCHANGED (SecuritySettings already imported)
├── features/auth/components/
│   ├── social-login.tsx         # MODIFIED: Add onClick handlers to buttons
│   └── oauth-error-handler.tsx  # UNCHANGED (already handles error display)
├── components/settings/
│   ├── security-settings.tsx    # MODIFIED: Add ConnectedAccounts section
│   ├── connected-accounts.tsx   # NEW: View/link/unlink OAuth providers
│   └── password-change.tsx      # MODIFIED: Conditional current password field
└── lib/
    └── api/
        └── auth.ts              # MODIFIED: Add has_password to User type, OAuth API functions
```

### Pattern 1: OAuth Callback Page (Code Exchange)

**What:** A client-side page at `/auth/callback` that receives the one-time code from the backend redirect, exchanges it for JWT tokens, stores them, loads user data, and redirects to the dashboard (or intended page).

**When to use:** Always -- this is the bridge between backend OAuth callback and frontend authentication state.

**Example:**
```tsx
// app/[locale]/(auth)/auth/callback/page.tsx
"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { apiClient } from "@/lib/api/client";

export default function OAuthCallbackPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const exchanged = useRef(false);

  useEffect(() => {
    if (exchanged.current) return;
    exchanged.current = true;

    const code = searchParams.get("code");
    const error = searchParams.get("error");

    if (error) {
      // Redirect to login with error code
      router.replace(`/login?oauth_error=${error}`);
      return;
    }

    if (!code) {
      router.replace("/login");
      return;
    }

    // Exchange one-time code for tokens
    apiClient.post<{ token: string; refresh_token: string }>(
      "/auth/oauth/exchange",
      { code }
    ).then((response) => {
      apiClient.setToken(response.token);
      // Redirect to intended page or dashboard
      const returnTo = sessionStorage.getItem("oauth_return_to");
      sessionStorage.removeItem("oauth_return_to");
      router.replace(returnTo || "/dashboard");
    }).catch(() => {
      router.replace("/login?oauth_error=server_error");
    });
  }, [searchParams, router]);

  return (
    <div className="flex items-center justify-center min-h-[200px]">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}
```

### Pattern 2: SocialLogin Button Click Handler

**What:** Buttons navigate to backend OAuth initiate URL. Before navigating, store the current intended page in sessionStorage for post-login redirect.

**When to use:** For the "Continue with Google" and "Continue with GitHub" buttons.

**Example:**
```tsx
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function handleOAuthLogin(provider: "google" | "github") {
  // Store return URL for post-login redirect (OAUTH-07)
  const returnTo = new URLSearchParams(window.location.search).get("returnTo");
  if (returnTo) {
    sessionStorage.setItem("oauth_return_to", returnTo);
  }
  // Navigate to backend initiate endpoint (full page redirect)
  window.location.href = `${API_URL}/auth/oauth/${provider}`;
}
```

### Pattern 3: Connected Accounts Section

**What:** A card in Security settings showing linked OAuth providers with link/unlink actions.

**When to use:** In the SecuritySettings component, between Password and Sessions sections.

**Example:**
```tsx
// Fetch: GET /auth/oauth/accounts
// Response: { accounts: [{ provider, email, display_name, avatar_url, created_at }] }

// Unlink: DELETE /auth/oauth/accounts/{provider}
// Success: 204, Error: 409 (lockout guard)

// Link: window.location.href = `${API_URL}/auth/oauth/{provider}`
// (Same initiate flow, but user is already authenticated)
```

### Pattern 4: Conditional Password Form for OAuth-Only Users

**What:** The PasswordChange component checks `user.has_password` to determine whether to show the "Current Password" field.

**When to use:** Always render the password section, but adapt the form based on `has_password`.

**Example:**
```tsx
const { user } = useAuth();

// If user has no password, show "Set Password" instead of "Change Password"
// and don't require current_password
const passwordSchema = user?.has_password
  ? z.object({
      current_password: z.string().min(1),
      new_password: z.string().min(8),
      confirm_password: z.string(),
    })
  : z.object({
      new_password: z.string().min(8),
      confirm_password: z.string(),
    });
```

### Anti-Patterns to Avoid

- **Using `useRouter().push()` for OAuth initiate:** This would try client-side navigation to the backend URL. OAuth initiate is a full-page redirect to the backend, which then redirects to the provider. Use `window.location.href`.
- **Storing tokens in URL hash/fragment:** The backend uses a one-time code pattern specifically to avoid this. Never pass JWT tokens in URLs.
- **Calling `loadUserData()` before code exchange completes:** The auth context's `loadUserData` requires a valid token. Call it after `apiClient.setToken()` in the callback page.
- **Showing ConnectedAccounts for all users identically:** OAuth-only users without a password need a warning before unlinking their last provider. Proactively check `has_password` and account count.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OAuth token exchange | Custom fetch with headers | `apiClient.post("/auth/oauth/exchange", { code })` | Consistent error handling, auth headers, credentials include |
| Post-login redirect persistence | Custom URL state tracking | `sessionStorage.getItem/setItem("oauth_return_to")` | Survives the full redirect chain (browser -> backend -> provider -> backend -> frontend). localStorage would persist across sessions. |
| Provider icons (Google, GitHub) | New icon library or downloads | Existing inline SVGs in SocialLogin component | Already present and correctly styled |
| Error display after failed OAuth | New error component | Existing `OAuthErrorHandler` on login page | Already maps error codes to translated messages and displays toasts (Phase 42 complete) |

**Key insight:** The backend handles all OAuth protocol complexity. The frontend's job is purely (1) initiating the redirect, (2) exchanging the code, (3) storing the token, and (4) displaying account management UI. No OAuth-specific library is needed on the frontend.

## Common Pitfalls

### Pitfall 1: Callback Page in Wrong Route Group

**What goes wrong:** The `/auth/callback` page is placed inside the `(dashboard)` layout, which requires authentication. But the callback page runs BEFORE the user is authenticated (it's receiving the code to BECOME authenticated).
**Why it happens:** Developer sees "auth" in the path and places it under the dashboard.
**How to avoid:** Place `/auth/callback` under the `(auth)` layout group (same as login/register). This layout has no auth guard.
**Warning signs:** Infinite redirect loop (callback page requires auth, redirects to login, OAuth redirects back to callback).

### Pitfall 2: React Strict Mode Double-Executing Code Exchange

**What goes wrong:** In development, React Strict Mode runs effects twice. The one-time code exchange is called twice -- the second call fails because Redis `GetDel` already consumed the code.
**Why it happens:** React 19 strict mode behavior.
**How to avoid:** Use a `useRef` flag to ensure the exchange only runs once. Set `exchanged.current = true` before the async call.
**Warning signs:** OAuth works intermittently in development -- succeeds on first attempt, fails with "invalid or expired code" on retry.

### Pitfall 3: Frontend User Type Missing has_password

**What goes wrong:** The `User` interface in `lib/api/auth.ts` does not include `has_password`. Conditional UI for OAuth-only users cannot function.
**Why it happens:** The field was added to the backend in Phase 40 but the frontend type was not updated (Phase 40 was backend-only).
**How to avoid:** Add `has_password: boolean` to the `User` interface before building any conditional UI. The backend already returns it in `/users/me`.
**Warning signs:** TypeScript errors when accessing `user.has_password`, or undefined behavior in password form.

### Pitfall 4: Backend UpdatePassword Rejects OAuth-Only Users

**What goes wrong:** OAuth-only user tries to set a password. The backend's `UpdatePassword` calls `CheckPassword(currentPassword)` which returns false (empty hash). Returns 400 "current password is incorrect".
**Why it happens:** The password update endpoint was designed for users who already have a password.
**How to avoid:** Modify the backend `UpdatePassword` service method to skip the current password check when `user.HasPassword() == false`. Or create a separate `SetPassword` endpoint. The handler already has access to `has_password` via the user entity.
**Warning signs:** 400 error when OAuth-only user submits the set-password form.

### Pitfall 5: OAuth Link While Already Authenticated Creates Duplicate Session

**What goes wrong:** User clicks "Link Google" from Security settings. The OAuth flow creates a new user session (the backend callback always creates a session). Now there are duplicate sessions.
**Why it happens:** The backend OAuth callback treats every flow as a login attempt, always creating a session.
**How to avoid:** This is acceptable behavior -- the new session replaces the current one effectively (user gets new tokens). The frontend should call `refreshUser()` after the callback to reload user data and connected accounts. The old session will be naturally superseded.
**Warning signs:** Multiple "current session" entries in the session list (minor UX issue, not a bug).

### Pitfall 6: Callback Page Suspense Boundary for useSearchParams

**What goes wrong:** `useSearchParams()` in a Next.js App Router page requires a Suspense boundary. Without it, the entire page tree must be client-rendered.
**Why it happens:** Next.js 14+ requirement for client-side search params access.
**How to avoid:** Either wrap the component using `useSearchParams()` in a Suspense boundary (same pattern as `OAuthErrorHandler`), or make the callback page a client component with `"use client"` directive (acceptable since it has no server-rendered content).
**Warning signs:** Build warning about missing Suspense boundary. Hydration errors in production.

## Code Examples

### Frontend User Type Update (ACCT-06)

```typescript
// lib/api/auth.ts -- Add has_password to User interface
export interface User {
  id: string;
  email: string;
  full_name: string;
  has_password: boolean;  // NEW: enables conditional UI for OAuth-only users
  is_active: boolean;
  date_format: string;
  time_format: string;
  thousand_separator: string;
  decimal_separator: string;
  language: string;
  theme: string;
  notification_preferences: NotificationPreferences;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}
```

### OAuth API Functions

```typescript
// lib/api/auth.ts -- Add OAuth account management functions
export interface OAuthAccount {
  provider: string;
  provider_user_id: string;
  email: string;
  display_name: string;
  avatar_url: string;
  created_at: string;
}

export const authApi = {
  // ... existing methods ...

  exchangeOAuthCode: async (code: string): Promise<AuthTokenResponse> => {
    const response = await apiClient.post<AuthTokenResponse>(
      "/auth/oauth/exchange",
      { code }
    );
    apiClient.setToken(response.token);
    return response;
  },

  getConnectedAccounts: async (): Promise<OAuthAccount[]> => {
    const response = await apiClient.get<{ accounts: OAuthAccount[] }>(
      "/auth/oauth/accounts"
    );
    return response.accounts;
  },

  unlinkAccount: async (provider: string): Promise<void> => {
    await apiClient.delete(`/auth/oauth/accounts/${provider}`);
  },

  setPassword: async (newPassword: string): Promise<void> => {
    await apiClient.patch("/users/me/password", {
      current_password: "",
      new_password: newPassword,
    });
  },
};
```

### Backend Password Update Fix (ACCT-05)

```go
// backend/internal/domain/auth/user/service.go
// Modify UpdatePassword to allow setting password for OAuth-only users
func (s *Service) UpdatePassword(ctx context.Context, id uuid.UUID, currentPassword, newPassword string) error {
    user, err := s.GetByID(ctx, id)
    if err != nil {
        return err
    }

    // For OAuth-only users (no password set), allow setting password
    // without verifying current password
    if user.HasPassword() {
        if !user.CheckPassword(currentPassword) {
            return ErrInvalidPassword
        }
    }

    if err := user.UpdatePassword(newPassword); err != nil {
        return err
    }

    return s.repo.Save(ctx, user)
}
```

### SocialLogin with Click Handlers

```tsx
// features/auth/components/social-login.tsx
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function handleOAuthLogin(provider: "google" | "github") {
  // Store intended destination for post-login redirect (OAUTH-07)
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    const returnTo = params.get("returnTo") || params.get("redirect");
    if (returnTo) {
      sessionStorage.setItem("oauth_return_to", returnTo);
    }
  }
  window.location.href = `${API_URL}/auth/oauth/${provider}`;
}

// In the component:
<Button onClick={() => handleOAuthLogin("google")} disabled={showOffline}>
  {/* Google SVG icon */}
  {t("oauth.continueWithGoogle")}
</Button>
```

### Connected Accounts Component

```tsx
// components/settings/connected-accounts.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/contexts/auth-context";
import { authApi, OAuthAccount } from "@/lib/api/auth";

export function ConnectedAccounts() {
  const { user, refreshUser } = useAuth();
  const [accounts, setAccounts] = useState<OAuthAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadAccounts = useCallback(async () => {
    try {
      const data = await authApi.getConnectedAccounts();
      setAccounts(data);
    } catch {
      // Handle error
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);

  const handleUnlink = async (provider: string) => {
    try {
      await authApi.unlinkAccount(provider);
      setAccounts(prev => prev.filter(a => a.provider !== provider));
      await refreshUser(); // Refresh has_password state
      toast.success("Provider unlinked");
    } catch (error) {
      // 409 = lockout guard
      if (error instanceof Error && error.message.includes("cannot unlink")) {
        toast.error("Cannot unlink", {
          description: "Set a password first before unlinking your only sign-in method."
        });
      }
    }
  };

  const handleLink = (provider: string) => {
    window.location.href = `${API_URL}/auth/oauth/${provider}`;
  };

  // Render: show linked providers with unlink button,
  // show available providers (not yet linked) with link button
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| NextAuth.js for OAuth in Next.js | Custom backend-driven OAuth with simple callback page | Project decision (v1.8) | No extra dependency. Backend owns all auth logic. Frontend is thin. |
| Token in URL fragment (#access_token=...) | One-time code exchange pattern | OAuth 2.1 BCP (2024) | Tokens never exposed in browser history or server logs |
| Popup-based OAuth flow | Full-page redirect flow | Project decision (v1.8) | Works in PWA standalone mode, no popup blockers |
| Separate "Link Account" API endpoint | Reuse same initiate flow (already-authenticated user) | Common pattern | No additional backend endpoint needed for linking |

## Open Questions

1. **Callback page routing: `(auth)/auth/callback` or top-level `/auth/callback`?**
   - What we know: The backend redirects to `{APP_URL}/auth/callback?code=...`. The `(auth)` layout has no auth guard (correct for callback). The `[locale]` prefix uses `localePrefix: "as-needed"` so default locale has no prefix.
   - What's unclear: Whether Next.js i18n routing will match `/auth/callback` correctly under `app/[locale]/(auth)/auth/callback/page.tsx`.
   - Recommendation: Test the route. The `APP_URL` config in the backend must point to the frontend's base URL. With `localePrefix: "as-needed"`, the default locale URL will be `/auth/callback` which maps to `app/[locale]/(auth)/auth/callback/page.tsx`.

2. **Should linking an additional provider while already authenticated behave differently?**
   - What we know: The same initiate flow works for linking (backend creates OAuth account link if user already exists). The callback creates a new session. The frontend needs to detect "I was already logged in" vs "I'm completing initial login".
   - What's unclear: How to differentiate in the callback page.
   - Recommendation: Check `localStorage.getItem("auth_token")` in the callback page. If a token exists, this is a "link" flow -- exchange the code, then redirect back to `/dashboard/settings/security` (not `/dashboard`). Store a flag in sessionStorage like `oauth_linking=true` before the link initiation.

3. **Backend password update modification scope**
   - What we know: ACCT-05 requires OAuth-only users to set a password without providing current password. The current `UpdatePassword` always validates current password.
   - What's unclear: Whether to modify the existing endpoint or create a new one.
   - Recommendation: Modify the existing `UpdatePassword` service method to skip current password validation when `has_password=false`. This is the minimal change and keeps the API surface small. The handler remains the same -- it passes `current_password` (which will be empty string) and the service decides whether to check it.

## Sources

### Primary (HIGH confidence)

- Codebase: `backend/internal/domain/auth/oauth/handler.go` -- All OAuth endpoints verified: initiate (line 90), callback (line 130), exchange (line 279), list accounts (line 351), unlink (line 389), redirect patterns
- Codebase: `backend/internal/domain/auth/user/handler.go` -- `UserResponse` includes `HasPassword` (line 349, 1022). `UpdatePassword` handler at line 446.
- Codebase: `backend/internal/domain/auth/user/service.go` -- `UpdatePassword` method at line 172 always checks current password
- Codebase: `backend/internal/domain/auth/user/entity.go` -- `CheckPassword` returns false for empty hash (line 193), `UpdatePassword` sets `hasPassword = true` (line 222)
- Codebase: `frontend/lib/api/auth.ts` -- `User` type at line 26 (missing `has_password`). Auth API methods.
- Codebase: `frontend/lib/api/client.ts` -- `apiClient` with `setToken`, `post`, `get`, `delete` methods
- Codebase: `frontend/lib/contexts/auth-context.tsx` -- `loadUserData`, `refreshUser`, `login` methods
- Codebase: `frontend/features/auth/components/social-login.tsx` -- Buttons exist but have no onClick handlers
- Codebase: `frontend/features/auth/components/oauth-error-handler.tsx` -- Already handles `?oauth_error=` on login page
- Codebase: `frontend/components/settings/security-settings.tsx` -- Current structure: Password + Sessions + Danger Zone
- Codebase: `frontend/components/settings/password-change.tsx` -- Current form always requires current password
- Codebase: `frontend/components/settings/active-sessions.tsx` -- Fetch pattern to follow for connected accounts
- Codebase: `frontend/messages/en.json` -- Existing auth.oauth and settings.security translation keys

### Secondary (MEDIUM confidence)

- Phase 40 research (`.planning/phases/40-*/40-RESEARCH.md`) -- Backend architecture decisions, one-time code exchange pattern
- Phase 42 research (`.planning/phases/42-*/42-RESEARCH.md`) -- Error handling pattern, confirms callback page needed in Phase 41
- Project research (`.planning/research/ARCHITECTURE.md`) -- OAuth callback page architecture, frontend route plan

### Tertiary (LOW confidence)

- OAuth link flow behavior when user is already authenticated -- needs testing to confirm backend handles re-authentication gracefully
- PWA standalone mode behavior during OAuth redirect chain on iOS -- flagged in STATE.md as needing physical device testing

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- No new dependencies. All existing libraries and patterns verified in codebase.
- Architecture: HIGH -- Backend endpoints fully implemented and verified. Frontend patterns follow existing codebase conventions (ActiveSessions, PasswordChange). Route structure clear.
- Pitfalls: HIGH -- All pitfalls derived from direct codebase analysis. React Strict Mode double-execution is a well-known Next.js pattern. Backend password update gap confirmed by reading service code.

**Research date:** 2026-02-22
**Valid until:** 2026-03-22 (stable domain, existing codebase, 30-day validity)
