package notification

import (
	"time"

	"github.com/google/uuid"

	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

// NotificationType represents the type of notification.
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

// Notification represents a user notification.
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

// NewNotification creates a new notification.
func NewNotification(
	userID uuid.UUID,
	workspaceID *uuid.UUID,
	notificationType NotificationType,
	title, message string,
	metadata map[string]interface{},
) (*Notification, error) {
	if err := shared.ValidateUUID(userID, "user_id"); err != nil {
		return nil, err
	}
	if title == "" {
		return nil, shared.NewFieldError(shared.ErrInvalidInput, "title", "notification title is required")
	}
	if message == "" {
		return nil, shared.NewFieldError(shared.ErrInvalidInput, "message", "notification message is required")
	}

	return &Notification{
		id:               shared.NewUUID(),
		userID:           userID,
		workspaceID:      workspaceID,
		notificationType: notificationType,
		title:            title,
		message:          message,
		isRead:           false,
		readAt:           nil,
		metadata:         metadata,
		createdAt:        time.Now(),
	}, nil
}

// Reconstruct recreates a notification from stored data.
func Reconstruct(
	id, userID uuid.UUID,
	workspaceID *uuid.UUID,
	notificationType NotificationType,
	title, message string,
	isRead bool,
	readAt *time.Time,
	metadata map[string]interface{},
	createdAt time.Time,
) *Notification {
	return &Notification{
		id:               id,
		userID:           userID,
		workspaceID:      workspaceID,
		notificationType: notificationType,
		title:            title,
		message:          message,
		isRead:           isRead,
		readAt:           readAt,
		metadata:         metadata,
		createdAt:        createdAt,
	}
}

// ID returns the notification's ID.
func (n *Notification) ID() uuid.UUID { return n.id }

// UserID returns the user ID.
func (n *Notification) UserID() uuid.UUID { return n.userID }

// WorkspaceID returns the workspace ID.
func (n *Notification) WorkspaceID() *uuid.UUID { return n.workspaceID }

// NotificationType returns the notification type.
func (n *Notification) NotificationType() NotificationType { return n.notificationType }

// Title returns the notification title.
func (n *Notification) Title() string { return n.title }

// Message returns the notification message.
func (n *Notification) Message() string { return n.message }

// IsRead returns whether the notification has been read.
func (n *Notification) IsRead() bool { return n.isRead }

// ReadAt returns when the notification was read.
func (n *Notification) ReadAt() *time.Time { return n.readAt }

// Metadata returns the notification metadata.
func (n *Notification) Metadata() map[string]interface{} { return n.metadata }

// CreatedAt returns when the notification was created.
func (n *Notification) CreatedAt() time.Time { return n.createdAt }

// MarkAsRead marks the notification as read.
func (n *Notification) MarkAsRead() {
	if !n.isRead {
		n.isRead = true
		now := time.Now()
		n.readAt = &now
	}
}
