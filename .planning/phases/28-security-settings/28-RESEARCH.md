# Phase 28: Security Settings - Research

**Researched:** 2026-02-03
**Domain:** Password management, session tracking, session revocation
**Confidence:** HIGH

## Summary

This phase implements security settings functionality: password change (requiring current password) and multi-device session management with view, revoke, and "logout all other" capabilities. The research reveals:

1. **Password change already exists**: The backend has a working `PATCH /users/me/password` endpoint that requires current password verification. The frontend needs to add a UI component for this existing functionality.

2. **Sessions require new infrastructure**: The current JWT implementation is stateless with no server-side session tracking. To support SEC-02/03/04 (session listing and revocation), we need to add a database-backed session table and modify the auth flow to track sessions.

3. **Two approaches for session management**:
   - **Database-only**: Store sessions in PostgreSQL with a sessions table
   - **Hybrid (Redis + PostgreSQL)**: Use Redis for fast token validation/revocation, PostgreSQL for session metadata

**Primary recommendation:** Implement database-backed sessions in PostgreSQL (not Redis-only) to ensure session data persists across deployments and provides audit capability. Use the existing bcrypt password hashing and JWT infrastructure. Add a `sessions` table to track active sessions with device metadata.

## Standard Stack

### Core (Backend - Already in Use)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| golang-jwt/jwt/v5 | v5 | JWT handling | Already used for access/refresh tokens |
| golang.org/x/crypto/bcrypt | latest | Password hashing | Already used in user entity |
| redis/go-redis/v9 | v9 | Redis client | Already used for job queues |
| jackc/pgx/v5 | v5 | PostgreSQL driver | Already used via sqlc |

### Core (Frontend - Already in Use)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19 | UI framework | Project standard |
| shadcn/ui | latest | Components | Card, Button, Input, Dialog, Table |
| react-hook-form | latest | Form handling | Already used in AccountSettings |
| lucide-react | latest | Icons | Shield, Smartphone, Monitor, LogOut |
| next-intl | latest | i18n | All text needs translation |

### Supporting (New)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| mssola/useragent | latest | User agent parsing | Extract device/browser info from User-Agent header |

**Installation (Backend only):**
```bash
go get github.com/mssola/useragent
```

## Architecture Patterns

### Recommended Project Structure

Backend additions:
```
backend/
├── db/
│   └── migrations/
│       └── 009_user_sessions.sql       # Sessions table
│   └── queries/
│       └── sessions.sql                # Session CRUD queries
├── internal/
│   └── domain/auth/
│       └── session/
│           ├── entity.go               # Session entity
│           ├── service.go              # Session business logic
│           ├── handler.go              # HTTP handlers
│           └── repository.go           # Repository interface
```

Frontend additions:
```
frontend/
├── components/settings/
│   ├── security-settings.tsx           # Main security card (container)
│   ├── password-change.tsx             # Password change form
│   └── active-sessions.tsx             # Sessions list with revoke
├── lib/api/
│   └── auth.ts                         # Add changePassword, getSessions, revokeSession
```

### Pattern 1: Session Entity Design
**What:** Database-backed session tracking with device metadata
**When to use:** For viewing active sessions and enabling revocation
**Example:**
```go
// Source: Standard session management pattern
type Session struct {
    id           uuid.UUID
    userID       uuid.UUID
    refreshToken string     // Hash of the refresh token
    deviceInfo   string     // Parsed device description (e.g., "Chrome on Windows")
    ipAddress    string     // IP at login time
    userAgent    string     // Raw user agent string
    lastActiveAt time.Time  // Updated on token refresh
    expiresAt    time.Time  // When session expires (matches refresh token)
    createdAt    time.Time
}
```

### Pattern 2: Session-Aware Token Flow
**What:** Modify login/refresh to create/update sessions
**When to use:** On every authentication event
**Example:**
```go
// Login flow modification
func (h *Handler) login(ctx context.Context, input *LoginInput) (*LoginOutput, error) {
    // 1. Authenticate user (existing)
    user, err := h.svc.Authenticate(ctx, input.Body.Email, input.Body.Password)

    // 2. Generate tokens (existing)
    token, _ := h.jwtService.GenerateToken(...)
    refreshToken, _ := h.jwtService.GenerateRefreshToken(user.ID())

    // 3. NEW: Create session record
    session, err := h.sessionSvc.Create(ctx, session.CreateInput{
        UserID:       user.ID(),
        RefreshToken: refreshToken, // Will be hashed before storage
        UserAgent:    r.Header.Get("User-Agent"),
        IPAddress:    getClientIP(r),
    })

    return &LoginOutput{...}
}
```

### Pattern 3: Token Revocation via Session Deletion
**What:** Invalidate tokens by deleting session record
**When to use:** When revoking individual or all sessions
**Example:**
```go
func (s *Service) RevokeSession(ctx context.Context, userID, sessionID uuid.UUID) error {
    // Get session and verify ownership
    session, err := s.repo.FindByID(ctx, sessionID)
    if err != nil || session.UserID != userID {
        return ErrSessionNotFound
    }

    // Delete session - token becomes invalid on next validation
    return s.repo.Delete(ctx, sessionID)
}

func (s *Service) RevokeAllOtherSessions(ctx context.Context, userID, currentSessionID uuid.UUID) error {
    // Delete all sessions except the current one
    return s.repo.DeleteAllExcept(ctx, userID, currentSessionID)
}
```

### Pattern 4: Refresh Token Validation with Session Check
**What:** Validate refresh tokens against session table
**When to use:** On every token refresh request
**Example:**
```go
func (h *Handler) refreshToken(ctx context.Context, input *RefreshTokenInput) (*RefreshTokenOutput, error) {
    // 1. Validate JWT refresh token (existing)
    userID, err := h.jwtService.ValidateRefreshToken(input.Body.RefreshToken)

    // 2. NEW: Verify session exists and is not revoked
    session, err := h.sessionSvc.FindByRefreshToken(ctx, input.Body.RefreshToken)
    if err != nil {
        return nil, huma.Error401Unauthorized("session has been revoked")
    }

    // 3. Generate new tokens (existing)
    // 4. Update session with new refresh token and lastActiveAt
    // 5. Return response
}
```

### Anti-Patterns to Avoid
- **Storing plain refresh tokens**: Always hash refresh tokens in database (use SHA-256)
- **No session limits**: Set reasonable max sessions per user (e.g., 10)
- **Missing current session marker**: Always identify which session is "this device" in the list
- **Blocking revocation**: Use async notification if session owner should be notified

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| User agent parsing | Regex matching | mssola/useragent | Handles thousands of UA variants |
| Password hashing | Custom crypto | bcrypt (existing) | Already implemented, proven secure |
| Token generation | Custom random | JWT (existing) | Already implemented with proper claims |
| Session storage | In-memory map | PostgreSQL table | Needs persistence, multi-instance support |

**Key insight:** This phase extends existing auth infrastructure rather than building from scratch. The main new work is the sessions table and UI components.

## Common Pitfalls

### Pitfall 1: Race Condition on Session Limit
**What goes wrong:** User logs in from multiple tabs simultaneously, exceeding session limit
**Why it happens:** No transaction isolation on session count check
**How to avoid:** Use database transaction with row-level locking or accept slight over-limit
**Warning signs:** Session count occasionally exceeds configured maximum

### Pitfall 2: Refresh Token Not Invalidated on Password Change
**What goes wrong:** User changes password but old sessions stay active
**Why it happens:** Password change doesn't revoke sessions
**How to avoid:** Option to revoke all other sessions on password change (user choice or automatic)
**Warning signs:** "I changed my password but I'm still logged in on my old phone"

### Pitfall 3: Session ID Leaked to Other Users
**What goes wrong:** User A can see or revoke User B's session IDs
**Why it happens:** Missing authorization check on session endpoints
**How to avoid:** Always verify `session.userID == authenticatedUser.ID` before any operation
**Warning signs:** 403 errors not being returned for cross-user access

### Pitfall 4: Current Session Revoked
**What goes wrong:** User revokes their own current session and gets logged out unexpectedly
**Why it happens:** "Revoke" button shown for current session, or "logout all" includes current
**How to avoid:** Mark current session clearly, exclude from "revoke all others"
**Warning signs:** User confusion when clicking "revoke" on current session

### Pitfall 5: Stale Session List
**What goes wrong:** Revoked session still shows as active in UI
**Why it happens:** React Query cache not invalidated after revoke
**How to avoid:** Invalidate sessions query after any revoke mutation
**Warning signs:** Sessions reappearing after page refresh

## Code Examples

### Database Migration
```sql
-- migrate:up
CREATE TABLE auth.user_sessions (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    refresh_token_hash VARCHAR(64) NOT NULL,
    device_info VARCHAR(200),
    ip_address INET,
    user_agent TEXT,
    last_active_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sessions_user ON auth.user_sessions(user_id);
CREATE INDEX idx_sessions_token ON auth.user_sessions(refresh_token_hash);
CREATE INDEX idx_sessions_expires ON auth.user_sessions(expires_at);

COMMENT ON TABLE auth.user_sessions IS
'Tracks active user sessions for multi-device management and token revocation.';

COMMENT ON COLUMN auth.user_sessions.refresh_token_hash IS
'SHA-256 hash of the refresh token. Never store plain tokens.';

COMMENT ON COLUMN auth.user_sessions.device_info IS
'Human-readable device description parsed from user agent (e.g., Chrome on Windows).';

-- migrate:down
DROP TABLE IF EXISTS auth.user_sessions;
```

### sqlc Queries
```sql
-- name: CreateSession :one
INSERT INTO auth.user_sessions (
    user_id, refresh_token_hash, device_info, ip_address, user_agent, expires_at
) VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: GetSessionByTokenHash :one
SELECT * FROM auth.user_sessions
WHERE refresh_token_hash = $1 AND expires_at > now();

-- name: GetUserSessions :many
SELECT id, device_info, ip_address, last_active_at, created_at
FROM auth.user_sessions
WHERE user_id = $1 AND expires_at > now()
ORDER BY last_active_at DESC;

-- name: UpdateSessionActivity :exec
UPDATE auth.user_sessions
SET last_active_at = now(), refresh_token_hash = $2
WHERE id = $1;

-- name: DeleteSession :exec
DELETE FROM auth.user_sessions WHERE id = $1 AND user_id = $2;

-- name: DeleteAllSessionsExcept :exec
DELETE FROM auth.user_sessions
WHERE user_id = $1 AND id != $2;

-- name: DeleteExpiredSessions :exec
DELETE FROM auth.user_sessions WHERE expires_at < now();

-- name: CountUserSessions :one
SELECT COUNT(*) FROM auth.user_sessions
WHERE user_id = $1 AND expires_at > now();
```

### User Agent Parsing
```go
// Source: github.com/mssola/useragent
import "github.com/mssola/useragent"

func parseDeviceInfo(userAgentString string) string {
    ua := useragent.New(userAgentString)

    browser, browserVersion := ua.Browser()
    os := ua.OS()

    // Build human-readable description
    if ua.Mobile() {
        if os == "iOS" {
            return fmt.Sprintf("%s on iPhone", browser)
        }
        return fmt.Sprintf("%s on Android", browser)
    }

    return fmt.Sprintf("%s %s on %s", browser, browserVersion, os)
}
```

### Frontend Security Settings Component
```typescript
// Source: Pattern from AccountSettings
"use client";

import { useTranslations } from "next-intl";
import { Shield, KeyRound, Smartphone } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PasswordChange } from "./password-change";
import { ActiveSessions } from "./active-sessions";

export function SecuritySettings() {
  const t = useTranslations("settings.security");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          {t("title")}
        </CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Password Section */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <KeyRound className="h-4 w-4" />
            {t("password.title")}
          </h3>
          <PasswordChange />
        </div>

        {/* Sessions Section */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <Smartphone className="h-4 w-4" />
            {t("sessions.title")}
          </h3>
          <ActiveSessions />
        </div>
      </CardContent>
    </Card>
  );
}
```

### Password Change Component
```typescript
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authApi } from "@/lib/api/auth";
import { toast } from "sonner";

const passwordSchema = z.object({
  current_password: z.string().min(1, "Current password is required"),
  new_password: z.string().min(8, "Password must be at least 8 characters"),
  confirm_password: z.string(),
}).refine((data) => data.new_password === data.confirm_password, {
  message: "Passwords don't match",
  path: ["confirm_password"],
});

export function PasswordChange() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(passwordSchema),
  });

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    try {
      await authApi.changePassword(data.current_password, data.new_password);
      reset();
      toast.success("Password changed successfully");
    } catch (error) {
      if (error.status === 400) {
        toast.error("Current password is incorrect");
      } else {
        toast.error("Failed to change password");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Form fields... */}
    </form>
  );
}
```

### Active Sessions List
```typescript
"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Monitor, Smartphone, LogOut, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { authApi } from "@/lib/api/auth";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export function ActiveSessions() {
  const queryClient = useQueryClient();

  const { data: sessions, isLoading } = useQuery({
    queryKey: ["sessions"],
    queryFn: () => authApi.getSessions(),
  });

  const revokeMutation = useMutation({
    mutationFn: (sessionId: string) => authApi.revokeSession(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      toast.success("Session revoked");
    },
  });

  const revokeAllMutation = useMutation({
    mutationFn: () => authApi.revokeAllOtherSessions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      toast.success("All other sessions revoked");
    },
  });

  return (
    <div className="space-y-4">
      {sessions?.map((session) => (
        <div key={session.id} className="flex items-center justify-between p-3 border rounded-lg">
          <div className="flex items-center gap-3">
            {session.device_info?.includes("Mobile") ? (
              <Smartphone className="h-5 w-5 text-muted-foreground" />
            ) : (
              <Monitor className="h-5 w-5 text-muted-foreground" />
            )}
            <div>
              <p className="font-medium">{session.device_info || "Unknown device"}</p>
              <p className="text-sm text-muted-foreground">
                {formatDistanceToNow(new Date(session.last_active_at), { addSuffix: true })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {session.is_current && (
              <Badge variant="secondary">Current</Badge>
            )}
            {!session.is_current && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => revokeMutation.mutate(session.id)}
                disabled={revokeMutation.isPending}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      ))}

      {sessions?.length > 1 && (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => revokeAllMutation.mutate()}
          disabled={revokeAllMutation.isPending}
        >
          {revokeAllMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Sign out all other sessions
        </Button>
      )}
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Stateless JWT only | JWT + database sessions | Standard for revocable sessions | Enables session management |
| Long-lived access tokens | Short access + longer refresh | Security best practice | Better security, manageable UX |
| IP-only tracking | Device fingerprinting | Modern browsers | Better session identification |

**Deprecated/outdated:**
- Storing session data in cookies (size limits, security concerns)
- Using HMAC for refresh tokens without server-side validation (no revocation possible)

## Open Questions

1. **Session Limit**
   - What we know: Should limit max sessions per user
   - What's unclear: Exact number (5? 10? unlimited?)
   - Recommendation: Start with 10 sessions, configurable via environment variable

2. **Auto-revoke on Password Change**
   - What we know: Security best practice to revoke sessions on password change
   - What's unclear: Should this be optional (checkbox) or automatic?
   - Recommendation: Automatic with option to keep current session

3. **Session Cleanup Job**
   - What we know: Expired sessions should be cleaned up
   - What's unclear: Frequency (hourly? daily?)
   - Recommendation: Daily cleanup job using existing Asynq scheduler

4. **Geographic Location**
   - What we know: IP address is captured
   - What's unclear: Whether to add IP geolocation for "Location" display
   - Recommendation: Defer to future enhancement (requires external service)

## Sources

### Primary (HIGH confidence)
- Existing codebase: `backend/internal/domain/auth/user/handler.go` - existing password change and token flow
- Existing codebase: `backend/internal/shared/jwt/jwt.go` - JWT service implementation
- Existing codebase: `backend/internal/domain/auth/user/entity.go` - bcrypt password handling
- Existing codebase: `frontend/components/settings/account-settings.tsx` - settings UI pattern

### Secondary (MEDIUM confidence)
- mssola/useragent library - widely used Go user agent parser
- Session management patterns - standard industry practice

### Tertiary (LOW confidence)
- None - patterns verified from existing codebase and established security practices

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - most libraries already in use
- Architecture: HIGH - extends existing patterns
- Pitfalls: HIGH - based on common security mistakes and codebase patterns

**Research date:** 2026-02-03
**Valid until:** 2026-03-03 (30 days - stable security feature area)
