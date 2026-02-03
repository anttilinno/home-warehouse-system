# Phase 29: Account Deletion - Research

**Researched:** 2026-02-03
**Domain:** User account deletion with safeguards, data cleanup
**Confidence:** HIGH

## Summary

This phase implements user account deletion functionality with appropriate safeguards. The codebase has strong foundations:

1. **Backend infrastructure exists**: The `auth.users` table has `ON DELETE CASCADE` relationships with `workspace_members`, `user_sessions`, `notifications`, `push_subscriptions`, `favorites`, and `pending_changes`. A `DeleteUser` query already exists in `users.sql`.

2. **Sole owner constraint is queryable**: The `CountWorkspaceOwners` query in `workspace_members.sql` can verify owner counts. Need a new query to find workspaces where user is sole owner.

3. **Frontend patterns established**: The settings page has the SecuritySettings component as a natural home for account deletion (dangerous zone). AlertDialog pattern with type-to-confirm can be implemented using existing shadcn/ui components.

**Primary recommendation:** Add account deletion to SecuritySettings with a "Danger Zone" section. Require typing "DELETE" to confirm. Backend validates sole ownership before deletion. Use database cascades for data cleanup.

## Standard Stack

The established libraries/tools for this domain:

### Core (Backend - Already in Use)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Chi router | v5 | HTTP routing | Already used for all API routes |
| sqlc | 1.30 | Type-safe SQL | Already generates all DB queries |
| Huma | v2 | OpenAPI/validation | Already handles all request/response DTOs |

### Core (Frontend - Already in Use)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19 | UI framework | Project standard |
| shadcn/ui | latest | Component library | Already provides AlertDialog, Input, Button |
| react-hook-form | latest | Form handling | Used throughout app for validation |
| next-intl | latest | i18n | Already handles all translations |
| sonner | latest | Toast notifications | Used for all user feedback |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @radix-ui/react-alert-dialog | latest | Confirmation dialog | Already installed via shadcn/ui |
| zod | latest | Schema validation | Already used for form validation |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Type "DELETE" | Two-step dialog | Type confirmation is more explicit, prevents accidental clicks |
| Soft delete | Hard delete | Hard delete respects user privacy (GDPR right to erasure), simpler data model |
| Email confirmation | Direct deletion | Extra friction may be appropriate for multi-user scenarios, but not required for MVP |

**Installation:** No new packages needed - all dependencies already exist.

## Architecture Patterns

### Recommended Project Structure

Backend additions:
```
backend/
├── db/
│   └── queries/
│       └── workspace_members.sql    # Add GetUserSoleOwnerWorkspaces query
│       └── users.sql                # DeleteUser query already exists
├── internal/
│   └── domain/auth/user/
│       ├── handler.go               # Add DELETE /users/me endpoint
│       ├── service.go               # Add Delete method with sole owner check
│       └── errors.go                # Add ErrSoleOwnerOfWorkspace error
```

Frontend additions:
```
frontend/
├── components/settings/
│   └── security-settings.tsx        # Add Danger Zone section
│   └── delete-account-dialog.tsx    # Type-to-confirm deletion dialog
├── lib/
│   └── api/auth.ts                  # Add deleteAccount method
├── messages/
│   └── *.json                       # Add account deletion translations
```

### Pattern 1: Sole Owner Validation
**What:** Prevent deletion if user is sole owner of any workspace
**When to use:** Before account deletion
**Example:**
```go
// Source: Pattern from existing workspace service
func (s *Service) CanDeleteAccount(ctx context.Context, userID uuid.UUID) (bool, []Workspace, error) {
    // Get workspaces where user is sole owner
    soleOwnerWorkspaces, err := s.repo.GetUserSoleOwnerWorkspaces(ctx, userID)
    if err != nil {
        return false, nil, err
    }

    // If user is sole owner of any workspace, cannot delete
    if len(soleOwnerWorkspaces) > 0 {
        return false, soleOwnerWorkspaces, nil
    }

    return true, nil, nil
}
```

### Pattern 2: Type-to-Confirm Dialog
**What:** Require user to type "DELETE" to confirm destructive action
**When to use:** Irreversible account deletion
**Example:**
```typescript
// Source: GitHub repository deletion pattern, adapted for React
const [confirmText, setConfirmText] = useState("");
const canDelete = confirmText.toUpperCase() === "DELETE";

<AlertDialog>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>{t("deleteAccount.title")}</AlertDialogTitle>
      <AlertDialogDescription>
        {t("deleteAccount.warning")}
      </AlertDialogDescription>
    </AlertDialogHeader>
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t("deleteAccount.typeConfirm", { word: "DELETE" })}
      </p>
      <Input
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        placeholder="DELETE"
        autoComplete="off"
      />
    </div>
    <AlertDialogFooter>
      <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
      <Button
        variant="destructive"
        onClick={handleDelete}
        disabled={!canDelete || isDeleting}
      >
        {isDeleting ? t("deleting") : t("deleteAccount.confirm")}
      </Button>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

### Pattern 3: Danger Zone UI
**What:** Visually separated section for destructive actions
**When to use:** Account deletion and other irreversible settings
**Example:**
```typescript
// Source: Common pattern in settings UIs (GitHub, Vercel)
<div className="border border-destructive/50 rounded-lg p-4">
  <h3 className="text-destructive font-medium flex items-center gap-2">
    <AlertTriangle className="h-4 w-4" />
    {t("dangerZone.title")}
  </h3>
  <p className="text-sm text-muted-foreground mt-2">
    {t("dangerZone.description")}
  </p>
  <Button variant="destructive" className="mt-4">
    {t("deleteAccount.button")}
  </Button>
</div>
```

### Anti-Patterns to Avoid
- **Deleting without confirmation:** Always require explicit action for irreversible operations
- **Immediate deletion after click:** Add type-to-confirm friction
- **Ignoring sole owner constraint:** Silently allowing deletion would orphan workspace data
- **Not logging user out:** After deletion, clear auth cookies and redirect to landing page

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Confirmation dialog | Custom modal | shadcn AlertDialog | Accessible, animated, keyboard support |
| Data cleanup | Manual CASCADE queries | PostgreSQL ON DELETE CASCADE | DB handles related data automatically |
| Session cleanup | Manual session deletion | Existing sessionSvc.RevokeAll | Already implemented, tested |
| Avatar cleanup | Manual file deletion | Existing avatarStorage.DeleteAvatar | Handles storage abstraction |

**Key insight:** The database schema's ON DELETE CASCADE handles most data cleanup automatically. The main work is validation (sole owner check) and UI (type-to-confirm dialog).

## Common Pitfalls

### Pitfall 1: Not Clearing Auth Cookies After Deletion
**What goes wrong:** User sees errors or is still "logged in" after account deletion
**Why it happens:** Only clearing frontend state, not HTTP-only cookies
**How to avoid:** Return clear cookie headers in DELETE response, same as logout
**Warning signs:** Browser dev tools show auth cookies still present after deletion

### Pitfall 2: Missing Sole Owner Edge Case - Personal Workspace
**What goes wrong:** Blocking deletion because user "owns" their personal workspace
**Why it happens:** Personal workspace auto-created at registration, always has user as owner
**How to avoid:** Check is_personal=false when counting sole-owner workspaces
**Warning signs:** No user can delete their account due to personal workspace

### Pitfall 3: Race Condition on Ownership Transfer
**What goes wrong:** User becomes sole owner between check and delete
**Why it happens:** Another owner leaves workspace after check
**How to avoid:** Use transaction, re-check just before delete, or accept minor edge case
**Warning signs:** Orphaned workspaces with no owners

### Pitfall 4: Not Cleaning Up Avatar Files
**What goes wrong:** Orphaned avatar files accumulate on storage
**Why it happens:** avatar_path column deleted with user, but file remains
**How to avoid:** Delete avatar file before deleting user record
**Warning signs:** Growing storage usage with no corresponding users

### Pitfall 5: Forgetting to Show Blocking Workspaces
**What goes wrong:** User sees "cannot delete" with no guidance
**Why it happens:** Only checking boolean, not returning details
**How to avoid:** Return list of blocking workspaces so user can transfer ownership
**Warning signs:** User frustration, support requests about deletion failure

## Code Examples

Verified patterns from existing codebase:

### SQL Query: Get Sole Owner Workspaces
```sql
-- Source: New query based on existing workspace_members patterns
-- name: GetUserSoleOwnerWorkspaces :many
-- Returns workspaces where the user is the ONLY owner (blocking account deletion)
SELECT w.id, w.name, w.slug, w.is_personal
FROM auth.workspaces w
JOIN auth.workspace_members wm ON w.id = wm.workspace_id
WHERE wm.user_id = $1
  AND wm.role = 'owner'
  AND w.is_personal = false  -- Exclude personal workspace
  AND (
    SELECT COUNT(*) FROM auth.workspace_members
    WHERE workspace_id = w.id AND role = 'owner'
  ) = 1;
```

### Backend Handler
```go
// Source: Pattern from existing user handler methods
func (h *Handler) deleteMe(ctx context.Context, input *DeleteMeInput) (*DeleteMeOutput, error) {
    authUser, ok := appMiddleware.GetAuthUser(ctx)
    if !ok {
        return nil, huma.Error401Unauthorized("not authenticated")
    }

    // Validate confirmation text
    if strings.ToUpper(input.Body.Confirmation) != "DELETE" {
        return nil, huma.Error400BadRequest("confirmation text must be 'DELETE'")
    }

    // Check if user can be deleted
    canDelete, blockingWorkspaces, err := h.svc.CanDelete(ctx, authUser.ID)
    if err != nil {
        return nil, huma.Error500InternalServerError("failed to check account status")
    }
    if !canDelete {
        return nil, huma.Error409Conflict("cannot delete account while sole owner of workspaces")
    }

    // Delete avatar file if exists
    user, _ := h.svc.GetByID(ctx, authUser.ID)
    if user != nil && user.AvatarPath() != nil && h.avatarStorage != nil {
        _ = h.avatarStorage.DeleteAvatar(ctx, *user.AvatarPath())
    }

    // Delete user (CASCADE handles related data)
    if err := h.svc.Delete(ctx, authUser.ID); err != nil {
        return nil, huma.Error500InternalServerError("failed to delete account")
    }

    // Return response with cookie clearing
    return &DeleteMeOutput{
        SetCookie: []http.Cookie{
            *clearAuthCookie(accessTokenCookie),
            *clearAuthCookie(refreshTokenCookie),
        },
    }, nil
}
```

### Frontend API Client
```typescript
// Source: Pattern from existing authApi methods
export const authApi = {
  // ... existing methods

  deleteAccount: async (confirmation: string): Promise<void> => {
    await apiClient.delete("/users/me", { confirmation });
    apiClient.setToken(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem("workspace_id");
    }
  },

  canDeleteAccount: async (): Promise<{
    can_delete: boolean;
    blocking_workspaces: Array<{ id: string; name: string; slug: string }>;
  }> => {
    return apiClient.get("/users/me/can-delete");
  },
};
```

### Frontend Delete Dialog Component
```typescript
// Source: Pattern combining existing AlertDialog usage with GitHub-style confirmation
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authApi } from "@/lib/api/auth";
import { useAuth } from "@/lib/contexts/auth-context";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function DeleteAccountDialog() {
  const t = useTranslations("settings.dangerZone");
  const { logout } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const canDelete = confirmText.toUpperCase() === "DELETE";

  const handleDelete = async () => {
    if (!canDelete) return;

    setIsDeleting(true);
    try {
      await authApi.deleteAccount(confirmText);
      toast.success(t("deleted"));
      logout();
      router.push("/");
    } catch (error) {
      toast.error(t("deleteError"));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive">{t("deleteButton")}</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            {t("deleteTitle")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t("deleteWarning")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-4 py-4">
          <p className="text-sm">
            {t("typeConfirm", { word: <strong>DELETE</strong> })}
          </p>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="DELETE"
            autoComplete="off"
            disabled={isDeleting}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>
            {t("cancel")}
          </AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!canDelete || isDeleting}
          >
            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isDeleting ? t("deleting") : t("confirmDelete")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Simple "Are you sure?" | Type-to-confirm | 2020+ | Prevents accidental deletion |
| Soft delete only | Hard delete (GDPR) | 2018 GDPR | Respects right to erasure |
| Immediate deletion | Confirmation friction | Best practice | Reduces user errors |

**Deprecated/outdated:**
- None - this is a new feature area

## Open Questions

Things that couldn't be fully resolved:

1. **Grace Period Before Permanent Deletion**
   - What we know: Some services allow 30-day recovery window
   - What's unclear: Whether to implement grace period for this phase
   - Recommendation: Implement immediate deletion for MVP. Grace period can be added later if users request it.

2. **Notification to Workspace Members**
   - What we know: When user is deleted, their contributions remain but user association is SET NULL
   - What's unclear: Whether to notify other workspace members about member departure
   - Recommendation: Not needed for MVP. User can inform their workspace members themselves.

3. **Export Data Before Deletion**
   - What we know: GDPR includes right to data portability
   - What's unclear: Whether to offer data export in deletion flow
   - Recommendation: Data export is tracked as ACCT-F02 (Future). Out of scope for this phase.

## Sources

### Primary (HIGH confidence)
- Existing codebase: `backend/db/migrations/001_initial_schema.sql` - CASCADE relationships verified
- Existing codebase: `backend/db/queries/users.sql` - DeleteUser query exists
- Existing codebase: `backend/db/queries/workspace_members.sql` - CountWorkspaceOwners query exists
- Existing codebase: `frontend/components/settings/security-settings.tsx` - Target component for UI
- Existing codebase: `frontend/components/ui/alert-dialog.tsx` - shadcn AlertDialog available

### Secondary (MEDIUM confidence)
- [Cloudscape Delete Confirmation Pattern](https://cloudscape.design/patterns/resource-management/delete/delete-with-additional-confirmation/) - Type-to-confirm best practices
- [UX Movement Delete Prevention](https://uxmovement.com/buttons/how-to-make-sure-users-dont-accidentally-delete/) - Type "DELETE" pattern
- [Apple Account Deletion Guidelines](https://developer.apple.com/support/offering-account-deletion-in-your-app/) - Compliance requirements

### Tertiary (LOW confidence)
- None - all patterns verified from existing codebase or authoritative sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already in use
- Architecture: HIGH - follows existing patterns exactly
- Pitfalls: HIGH - based on schema analysis and established best practices

**Research date:** 2026-02-03
**Valid until:** 2026-03-03 (30 days - stable feature area)
