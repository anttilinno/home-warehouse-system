## Phase 1: Auth Domain

### 1.1 User Domain

**Files:**

| File | Purpose |
|------|---------|
| `entity.go` | User entity with fields: id, email, fullName, passwordHash, isActive, isSuperuser, dateFormat, language, theme |
| `errors.go` | ErrEmailRequired, ErrEmailInvalid, ErrEmailTaken, ErrUserNotFound, ErrInvalidPassword |
| `repository.go` | Interface: Save, FindByID, FindByEmail, List, Delete |
| `service.go` | Create, Update, UpdatePassword, UpdatePreferences, Deactivate |
| `service_test.go` | TDD tests for all service methods |
| `handler.go` | HTTP endpoints: Register, Login, GetMe, UpdateMe, UpdatePassword |
| `handler_test.go` | Handler tests |

**Entity:**

```go
// internal/domain/auth/user/entity.go
type User struct {
    id           uuid.UUID
    email        string
    fullName     string
    passwordHash string
    isActive     bool
    isSuperuser  bool
    dateFormat   string
    language     string
    theme        string
    createdAt    time.Time
    updatedAt    time.Time
}
```

**sqlc queries** (`db/queries/users.sql`):

```sql
-- name: GetUserByID :one
SELECT * FROM auth.users WHERE id = $1;

-- name: GetUserByEmail :one
SELECT * FROM auth.users WHERE email = $1;

-- name: CreateUser :one
INSERT INTO auth.users (id, email, full_name, password_hash, date_format, language, theme)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: UpdateUser :one
UPDATE auth.users
SET full_name = $2, updated_at = now()
WHERE id = $1
RETURNING *;

-- name: UpdateUserPassword :exec
UPDATE auth.users
SET password_hash = $2, updated_at = now()
WHERE id = $1;

-- name: UpdateUserPreferences :one
UPDATE auth.users
SET date_format = $2, language = $3, theme = $4, updated_at = now()
WHERE id = $1
RETURNING *;

-- name: DeactivateUser :exec
UPDATE auth.users SET is_active = false, updated_at = now() WHERE id = $1;

-- name: ListUsers :many
SELECT * FROM auth.users
WHERE is_active = true
ORDER BY created_at DESC
LIMIT $1 OFFSET $2;
```

---

### 1.2 Workspace Domain

**Files:**

| File | Purpose |
|------|---------|
| `entity.go` | Workspace: id, name, slug, description, isPersonal |
| `errors.go` | ErrSlugTaken, ErrWorkspaceNotFound, ErrCannotDeletePersonal |
| `repository.go` | Save, FindByID, FindBySlug, FindByUserID, Delete |
| `service.go` | Create, Update, Delete, GetUserWorkspaces |
| `service_test.go` | TDD tests |
| `handler.go` | CRUD endpoints |
| `handler_test.go` | Handler tests |

**Entity:**

```go
// internal/domain/auth/workspace/entity.go
type Workspace struct {
    id          uuid.UUID
    name        string
    slug        string
    description *string
    isPersonal  bool
    createdAt   time.Time
    updatedAt   time.Time
}
```

**sqlc queries** (`db/queries/workspaces.sql`):

```sql
-- name: GetWorkspaceByID :one
SELECT * FROM auth.workspaces WHERE id = $1;

-- name: GetWorkspaceBySlug :one
SELECT * FROM auth.workspaces WHERE slug = $1;

-- name: CreateWorkspace :one
INSERT INTO auth.workspaces (id, name, slug, description, is_personal)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: UpdateWorkspace :one
UPDATE auth.workspaces
SET name = $2, description = $3, updated_at = now()
WHERE id = $1
RETURNING *;

-- name: DeleteWorkspace :exec
DELETE FROM auth.workspaces WHERE id = $1;

-- name: ListWorkspacesByUser :many
SELECT w.* FROM auth.workspaces w
JOIN auth.workspace_members wm ON w.id = wm.workspace_id
WHERE wm.user_id = $1
ORDER BY w.name;
```

---

### 1.3 Workspace Member Domain

**Files:**

| File | Purpose |
|------|---------|
| `entity.go` | Member: id, workspaceID, userID, role (enum: owner/admin/member/viewer), invitedBy |
| `errors.go` | ErrAlreadyMember, ErrCannotRemoveOwner, ErrInsufficientRole |
| `repository.go` | Save, FindByWorkspaceAndUser, ListByWorkspace, Delete |
| `service.go` | AddMember, UpdateRole, RemoveMember, GetRole |
| `service_test.go` | TDD tests with role permission logic |
| `handler.go` | List members, invite, update role, remove |

**Entity:**

```go
// internal/domain/auth/member/entity.go
type Role string

const (
    RoleOwner  Role = "owner"
    RoleAdmin  Role = "admin"
    RoleMember Role = "member"
    RoleViewer Role = "viewer"
)

type Member struct {
    id          uuid.UUID
    workspaceID uuid.UUID
    userID      uuid.UUID
    role        Role
    invitedBy   *uuid.UUID
    createdAt   time.Time
    updatedAt   time.Time
}
```

**sqlc queries** (`db/queries/workspace_members.sql`):

```sql
-- name: GetMember :one
SELECT * FROM auth.workspace_members
WHERE workspace_id = $1 AND user_id = $2;

-- name: CreateMember :one
INSERT INTO auth.workspace_members (id, workspace_id, user_id, role, invited_by)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: UpdateMemberRole :one
UPDATE auth.workspace_members
SET role = $3, updated_at = now()
WHERE workspace_id = $1 AND user_id = $2
RETURNING *;

-- name: DeleteMember :exec
DELETE FROM auth.workspace_members
WHERE workspace_id = $1 AND user_id = $2;

-- name: ListMembersByWorkspace :many
SELECT wm.*, u.email, u.full_name
FROM auth.workspace_members wm
JOIN auth.users u ON wm.user_id = u.id
WHERE wm.workspace_id = $1
ORDER BY wm.created_at;

-- name: GetUserRole :one
SELECT role FROM auth.workspace_members
WHERE workspace_id = $1 AND user_id = $2;

-- name: CountWorkspaceOwners :one
SELECT COUNT(*) FROM auth.workspace_members
WHERE workspace_id = $1 AND role = 'owner';
```

---

### 1.4 Notification Domain

**Files:**

| File | Purpose |
|------|---------|
| `entity.go` | Notification: id, userID, workspaceID, type (enum), title, message, isRead, metadata |
| `repository.go` | Save, FindByUser, MarkAsRead, MarkAllAsRead |
| `service.go` | Create, List, MarkRead, GetUnreadCount |
| `handler.go` | List, Mark as read |

**Entity:**

```go
// internal/domain/auth/notification/entity.go
type NotificationType string

const (
    TypeLoanDueSoon     NotificationType = "LOAN_DUE_SOON"
    TypeLoanOverdue     NotificationType = "LOAN_OVERDUE"
    TypeLoanReturned    NotificationType = "LOAN_RETURNED"
    TypeLowStock        NotificationType = "LOW_STOCK"
    TypeWorkspaceInvite NotificationType = "WORKSPACE_INVITE"
    TypeMemberJoined    NotificationType = "MEMBER_JOINED"
    TypeSystem          NotificationType = "SYSTEM"
)

type Notification struct {
    id               uuid.UUID
    userID           uuid.UUID
    workspaceID      *uuid.UUID
    notificationType NotificationType
    title            string
    message          string
    isRead           bool
    readAt           *time.Time
    metadata         map[string]interface{}
    createdAt        time.Time
}
```

**sqlc queries** (`db/queries/notifications.sql`):

```sql
-- name: GetNotification :one
SELECT * FROM auth.notifications WHERE id = $1 AND user_id = $2;

-- name: CreateNotification :one
INSERT INTO auth.notifications (id, user_id, workspace_id, notification_type, title, message, metadata)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: ListNotificationsByUser :many
SELECT * FROM auth.notifications
WHERE user_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: ListUnreadNotifications :many
SELECT * FROM auth.notifications
WHERE user_id = $1 AND is_read = false
ORDER BY created_at DESC;

-- name: MarkNotificationAsRead :exec
UPDATE auth.notifications
SET is_read = true, read_at = now()
WHERE id = $1 AND user_id = $2;

-- name: MarkAllNotificationsAsRead :exec
UPDATE auth.notifications
SET is_read = true, read_at = now()
WHERE user_id = $1 AND is_read = false;

-- name: GetUnreadCount :one
SELECT COUNT(*) FROM auth.notifications
WHERE user_id = $1 AND is_read = false;
```

---

