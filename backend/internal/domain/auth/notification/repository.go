package notification

import (
	"context"

	"github.com/google/uuid"

	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

// Repository defines the interface for notification persistence.
type Repository interface {
	// Save persists a notification.
	Save(ctx context.Context, notification *Notification) error

	// FindByID retrieves a notification by ID.
	FindByID(ctx context.Context, id, userID uuid.UUID) (*Notification, error)

	// FindByUser retrieves notifications for a user with pagination.
	FindByUser(ctx context.Context, userID uuid.UUID, pagination shared.Pagination) ([]*Notification, int, error)

	// FindUnreadByUser retrieves unread notifications for a user.
	FindUnreadByUser(ctx context.Context, userID uuid.UUID) ([]*Notification, error)

	// MarkAsRead marks a notification as read.
	MarkAsRead(ctx context.Context, id, userID uuid.UUID) error

	// MarkAllAsRead marks all notifications as read for a user.
	MarkAllAsRead(ctx context.Context, userID uuid.UUID) error

	// GetUnreadCount returns the count of unread notifications for a user.
	GetUnreadCount(ctx context.Context, userID uuid.UUID) (int64, error)
}
