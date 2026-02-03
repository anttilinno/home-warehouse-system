# Phase 27: Account Settings - Research

**Researched:** 2026-02-03
**Domain:** User profile management, avatar upload, user preferences
**Confidence:** HIGH

## Summary

This phase implements account settings functionality: profile editing (name, email), avatar upload, and date format preferences. The codebase already has strong foundations for this work:

1. **Backend infrastructure exists**: The `auth.users` table already has `date_format`, `language`, and `theme` columns. API endpoints `/users/me` (GET/PATCH) and `/users/me/preferences` (PATCH) already exist with full implementation.

2. **Photo upload infrastructure exists**: The `itemphoto` package provides a complete photo upload pipeline with storage, image processing, and thumbnail generation via Asynq workers. This can be adapted for avatar uploads.

3. **Frontend patterns established**: The settings page already exists at `/dashboard/settings` with placeholder cards for "Account" and "Security" sections. The existing `NotificationSettings` component provides the pattern for settings cards.

**Primary recommendation:** Extend the existing user entity with an `avatar_path` column, reuse the photo infrastructure for avatar upload, and implement the settings UI following established patterns in the settings page.

## Standard Stack

The established libraries/tools for this domain:

### Core (Backend - Already in Use)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Chi router | v5 | HTTP routing | Already used for all API routes |
| sqlc | 1.30 | Type-safe SQL | Already generates all DB queries |
| Huma | v2 | OpenAPI/validation | Already handles all request/response DTOs |
| disintegration/imaging | latest | Image processing | Already used for item photo thumbnails |

### Core (Frontend - Already in Use)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19 | UI framework | Project standard |
| shadcn/ui | latest | Component library | Already provides Card, Input, Button, Avatar |
| react-hook-form | latest | Form handling | Already used throughout app |
| next-intl | latest | i18n | Already handles all translations |
| date-fns | latest | Date formatting | Already in use for loan dates |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @radix-ui/react-avatar | latest | Avatar component | Already installed via shadcn/ui |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Local storage for avatars | S3/Cloud storage | Local is simpler, already works for item photos |
| Gravatar | Custom avatars | Custom gives users more control |

**Installation:** No new packages needed - all dependencies already exist.

## Architecture Patterns

### Recommended Project Structure

Backend additions:
```
backend/
├── db/
│   └── migrations/
│       └── 009_user_avatar.sql           # Add avatar_path column
│   └── queries/
│       └── users.sql                     # Add UpdateUserAvatar query
├── internal/
│   └── domain/auth/user/
│       ├── entity.go                     # Add avatarPath field
│       ├── handler.go                    # Add avatar upload endpoint
│       ├── service.go                    # Add UpdateAvatar method
│       └── repository.go                 # Add avatar persistence
```

Frontend additions:
```
frontend/
├── app/[locale]/(dashboard)/dashboard/
│   └── settings/
│       └── page.tsx                      # Update with real account settings
├── components/settings/
│   ├── account-settings.tsx              # Profile form component
│   ├── avatar-upload.tsx                 # Avatar upload component
│   └── date-format-settings.tsx          # Date format selector
├── lib/
│   ├── api/auth.ts                       # Add updateProfile, uploadAvatar APIs
│   └── hooks/use-date-format.ts          # Hook for formatting dates
```

### Pattern 1: User Entity Extension
**What:** Add avatar_path to existing user entity
**When to use:** When extending user profile data
**Example:**
```go
// Source: Existing pattern in backend/internal/domain/auth/user/entity.go
type User struct {
    id           uuid.UUID
    email        string
    fullName     string
    passwordHash string
    avatarPath   *string  // NEW: nullable for users without avatar
    // ... existing fields
}

func (u *User) AvatarPath() *string { return u.avatarPath }

func (u *User) UpdateAvatar(path *string) {
    u.avatarPath = path
    u.updatedAt = time.Now()
}
```

### Pattern 2: Avatar Upload Handler
**What:** Reuse itemphoto patterns for avatar upload
**When to use:** File upload with image processing
**Example:**
```go
// Source: Pattern from backend/internal/domain/warehouse/itemphoto/handler.go
func (h *Handler) uploadAvatar(ctx context.Context, input *UploadAvatarInput) (*UploadAvatarOutput, error) {
    authUser, ok := appMiddleware.GetAuthUser(ctx)
    if !ok {
        return nil, huma.Error401Unauthorized("not authenticated")
    }

    // Validate file size (2MB for avatars)
    if input.Body.Size > MaxAvatarSize {
        return nil, huma.Error400BadRequest("file too large")
    }

    // Save avatar using existing storage interface
    path, err := h.storage.Save(ctx, "avatars", authUser.ID.String(), filename, input.Body.File)
    if err != nil {
        return nil, huma.Error500InternalServerError("failed to save avatar")
    }

    // Generate thumbnail (square crop for avatars)
    thumbPath := strings.TrimSuffix(path, filepath.Ext(path)) + "_thumb.webp"
    if err := h.processor.GenerateThumbnail(ctx, path, thumbPath, 150, 150); err != nil {
        // Log but don't fail - original can be used
    }

    // Update user
    user, err := h.svc.UpdateAvatar(ctx, authUser.ID, thumbPath)
    if err != nil {
        return nil, huma.Error500InternalServerError("failed to update user")
    }

    return &UploadAvatarOutput{Body: user}, nil
}
```

### Pattern 3: Date Format Context
**What:** Use context/hook pattern for date formatting throughout app
**When to use:** Consistent date display based on user preference
**Example:**
```typescript
// Source: Pattern from existing auth-context.tsx
export function useDateFormat() {
    const { user } = useAuth();
    const format = user?.date_format || 'YYYY-MM-DD';

    const formatDate = useCallback((date: Date | string) => {
        const d = typeof date === 'string' ? parseISO(date) : date;
        // Map user format to date-fns format
        const formatMap: Record<string, string> = {
            'MM/DD/YY': 'MM/dd/yy',
            'DD/MM/YYYY': 'dd/MM/yyyy',
            'YYYY-MM-DD': 'yyyy-MM-dd',
            'DD.MM.YYYY': 'dd.MM.yyyy',
        };
        return dateFnsFormat(d, formatMap[format] || 'yyyy-MM-dd');
    }, [format]);

    return { format, formatDate };
}
```

### Anti-Patterns to Avoid
- **Storing large avatars without resize:** Always generate thumbnails for display, store reasonable max size (2MB upload, resize to 512px max)
- **Changing email without verification:** Email changes should ideally require verification email to new address (can be deferred)
- **Inline date formatting:** Always use the hook/context for consistency

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Image resizing | Custom resize logic | disintegration/imaging | Already handles EXIF orientation, quality, formats |
| File storage | Direct filesystem writes | existing Storage interface | Abstraction allows future S3 migration |
| Avatar display | Custom image component | shadcn Avatar component | Already handles fallback initials |
| Date formatting | String manipulation | date-fns | Handles locales, edge cases |
| Form validation | Manual validation | react-hook-form + zod | Already used everywhere |

**Key insight:** This phase should primarily wire together existing infrastructure rather than build new capabilities. The photo upload, image processing, and form handling patterns are all established.

## Common Pitfalls

### Pitfall 1: Avatar Path vs URL Confusion
**What goes wrong:** Storing full URLs instead of paths, breaking when base URL changes
**Why it happens:** Wanting to simplify frontend display
**How to avoid:** Store relative paths in DB, generate full URLs in API response
**Warning signs:** Hardcoded domains in database

### Pitfall 2: Email Change Without Auth Check
**What goes wrong:** Users changing email without verifying current password
**Why it happens:** Treating email like other profile fields
**How to avoid:** Require current password for email changes (security requirement)
**Warning signs:** Email update endpoint with no password in request

### Pitfall 3: Date Format Not Applied Everywhere
**What goes wrong:** Some dates use new format, others use hardcoded format
**Why it happens:** Incremental implementation without global search
**How to avoid:** Create useDateFormat hook, search for all date displays
**Warning signs:** Inconsistent date formats in UI

### Pitfall 4: Large Avatar Uploads Blocking
**What goes wrong:** User waits while large image is processed
**Why it happens:** Synchronous processing
**How to avoid:** Use existing Asynq pattern for thumbnail generation, return immediately with original
**Warning signs:** Upload timeout errors on slow connections

### Pitfall 5: Missing Avatar URL in Auth Context
**What goes wrong:** Avatar shows after settings change but disappears on page refresh
**Why it happens:** Not updating User type to include avatar_url
**How to avoid:** Add avatar_url to User interface and API response
**Warning signs:** Avatar not persisting across sessions

## Code Examples

Verified patterns from existing codebase:

### Database Migration
```sql
-- Source: Pattern from existing migrations
-- migrate:up
ALTER TABLE auth.users ADD COLUMN avatar_path VARCHAR(500);

COMMENT ON COLUMN auth.users.avatar_path IS
'Storage path to user avatar image. Null if user has no custom avatar.';

-- migrate:down
ALTER TABLE auth.users DROP COLUMN avatar_path;
```

### sqlc Query
```sql
-- Source: Pattern from backend/db/queries/users.sql
-- name: UpdateUserAvatar :one
UPDATE auth.users
SET avatar_path = $2, updated_at = now()
WHERE id = $1
RETURNING id, email, full_name, password_hash, is_active, is_superuser,
          date_format, language, theme, avatar_path, created_at, updated_at;

-- name: UpdateUserEmail :one
UPDATE auth.users
SET email = $2, updated_at = now()
WHERE id = $1
RETURNING id, email, full_name, password_hash, is_active, is_superuser,
          date_format, language, theme, avatar_path, created_at, updated_at;
```

### Frontend Settings Component
```typescript
// Source: Pattern from frontend/components/settings/notification-settings.tsx
"use client";

import { useTranslations } from "next-intl";
import { User } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function AccountSettings() {
  const t = useTranslations("settings.account");
  const { user, refreshUser } = useAuth();

  // Form logic using react-hook-form
  const form = useForm({
    defaultValues: {
      full_name: user?.full_name || '',
      email: user?.email || '',
    }
  });

  // Submit handler using existing API patterns
  const onSubmit = async (data) => {
    await authApi.updateProfile(data);
    await refreshUser();
    toast.success(t("saved"));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          {t("title")}
        </CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Form fields */}
        </form>
      </CardContent>
    </Card>
  );
}
```

### Avatar in User Menu
```typescript
// Source: Pattern from frontend/components/dashboard/user-menu.tsx
<Avatar className="h-8 w-8">
  <AvatarImage
    src={user.avatar_url} // NEW: use avatar URL from user
    alt={user.full_name}
  />
  <AvatarFallback className="text-xs">{initials}</AvatarFallback>
</Avatar>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Form encoding uploads | multipart/form-data | Standard | Required for file uploads |
| Storing base64 in DB | File path + storage | Standard | Much better performance |
| Single avatar size | Multiple sizes (thumb + original) | Standard | Better UX, faster loading |

**Deprecated/outdated:**
- None - this is a new feature area

## Open Questions

Things that couldn't be fully resolved:

1. **Email Change Verification**
   - What we know: Email changes should require verification for security
   - What's unclear: Whether to implement full email verification flow in this phase
   - Recommendation: Require current password for email change, defer verification email to future phase

2. **Avatar Storage Location**
   - What we know: Item photos use local filesystem storage
   - What's unclear: Whether avatars should use same storage or separate directory
   - Recommendation: Use separate `avatars/` directory under same storage root

3. **Delete Avatar Functionality**
   - What we know: Users may want to remove avatar and return to initials
   - What's unclear: UI pattern for this
   - Recommendation: Add "Remove" button that sets avatar_path to NULL

## Sources

### Primary (HIGH confidence)
- Existing codebase: `backend/internal/domain/auth/user/` - complete user management
- Existing codebase: `backend/internal/domain/warehouse/itemphoto/` - photo upload pipeline
- Existing codebase: `backend/db/migrations/001_initial_schema.sql` - schema including user preferences
- Existing codebase: `frontend/components/settings/` - settings page patterns
- Existing codebase: `frontend/lib/contexts/auth-context.tsx` - user state management

### Secondary (MEDIUM confidence)
- shadcn/ui Avatar component documentation (verified via installed component)
- date-fns formatting patterns (verified via existing usage in codebase)

### Tertiary (LOW confidence)
- None - all patterns verified from existing codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already in use
- Architecture: HIGH - follows existing patterns exactly
- Pitfalls: HIGH - based on common web development issues and codebase patterns

**Research date:** 2026-02-03
**Valid until:** 2026-03-03 (30 days - stable feature area)
