package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/antti/home-warehouse/go-backend/internal/domain/auth/notification"
	"github.com/antti/home-warehouse/go-backend/internal/infra/queries"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

// NotificationRepository implements notification.Repository using PostgreSQL.
type NotificationRepository struct {
	pool    *pgxpool.Pool
	queries *queries.Queries
}

// NewNotificationRepository creates a new NotificationRepository.
func NewNotificationRepository(pool *pgxpool.Pool) *NotificationRepository {
	return &NotificationRepository{
		pool:    pool,
		queries: queries.New(pool),
	}
}

// Save persists a notification.
func (r *NotificationRepository) Save(ctx context.Context, n *notification.Notification) error {
	// Convert metadata to JSON
	metadataBytes, err := json.Marshal(n.Metadata())
	if err != nil {
		return err
	}

	// Convert workspace ID
	var workspaceID pgtype.UUID
	if n.WorkspaceID() != nil {
		workspaceID = pgtype.UUID{Bytes: *n.WorkspaceID(), Valid: true}
	}

	_, err = r.queries.CreateNotification(ctx, queries.CreateNotificationParams{
		ID:               n.ID(),
		UserID:           n.UserID(),
		WorkspaceID:      workspaceID,
		NotificationType: queries.AuthNotificationTypeEnum(n.NotificationType()),
		Title:            n.Title(),
		Message:          n.Message(),
		Metadata:         metadataBytes,
	})
	return err
}

// FindByID retrieves a notification by ID.
func (r *NotificationRepository) FindByID(ctx context.Context, id, userID uuid.UUID) (*notification.Notification, error) {
	row, err := r.queries.GetNotification(ctx, queries.GetNotificationParams{
		ID:     id,
		UserID: userID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, shared.ErrNotFound
		}
		return nil, err
	}

	return r.rowToNotification(row)
}

// FindByUser retrieves notifications for a user with pagination.
func (r *NotificationRepository) FindByUser(ctx context.Context, userID uuid.UUID, pagination shared.Pagination) ([]*notification.Notification, int, error) {
	// Get total count
	totalCount, err := r.queries.CountNotificationsByUser(ctx, userID)
	if err != nil {
		return nil, 0, err
	}

	rows, err := r.queries.ListNotificationsByUser(ctx, queries.ListNotificationsByUserParams{
		UserID: userID,
		Limit:  int32(pagination.Limit()),
		Offset: int32(pagination.Offset()),
	})
	if err != nil {
		return nil, 0, err
	}

	notifications := make([]*notification.Notification, 0, len(rows))
	for _, row := range rows {
		n, err := r.rowToNotification(row)
		if err != nil {
			return nil, 0, err
		}
		notifications = append(notifications, n)
	}

	return notifications, int(totalCount), nil
}

// FindUnreadByUser retrieves unread notifications for a user.
func (r *NotificationRepository) FindUnreadByUser(ctx context.Context, userID uuid.UUID) ([]*notification.Notification, error) {
	rows, err := r.queries.ListUnreadNotifications(ctx, userID)
	if err != nil {
		return nil, err
	}

	notifications := make([]*notification.Notification, 0, len(rows))
	for _, row := range rows {
		n, err := r.rowToNotification(row)
		if err != nil {
			return nil, err
		}
		notifications = append(notifications, n)
	}

	return notifications, nil
}

// MarkAsRead marks a notification as read.
func (r *NotificationRepository) MarkAsRead(ctx context.Context, id, userID uuid.UUID) error {
	return r.queries.MarkNotificationAsRead(ctx, queries.MarkNotificationAsReadParams{
		ID:     id,
		UserID: userID,
	})
}

// MarkAllAsRead marks all notifications as read for a user.
func (r *NotificationRepository) MarkAllAsRead(ctx context.Context, userID uuid.UUID) error {
	return r.queries.MarkAllNotificationsAsRead(ctx, userID)
}

// GetUnreadCount returns the count of unread notifications for a user.
func (r *NotificationRepository) GetUnreadCount(ctx context.Context, userID uuid.UUID) (int64, error) {
	return r.queries.GetUnreadCount(ctx, userID)
}

// rowToNotification converts a database row to a Notification entity.
func (r *NotificationRepository) rowToNotification(row queries.AuthNotification) (*notification.Notification, error) {
	// Parse metadata
	var metadata map[string]interface{}
	if len(row.Metadata) > 0 {
		if err := json.Unmarshal(row.Metadata, &metadata); err != nil {
			return nil, err
		}
	}

	// Convert workspace ID
	var workspaceID *uuid.UUID
	if row.WorkspaceID.Valid {
		id := uuid.UUID(row.WorkspaceID.Bytes)
		workspaceID = &id
	}

	// Convert read_at
	var readAt *time.Time
	if row.ReadAt.Valid {
		t := row.ReadAt.Time
		readAt = &t
	}

	// Convert is_read
	isRead := false
	if row.IsRead != nil {
		isRead = *row.IsRead
	}

	return notification.Reconstruct(
		row.ID,
		row.UserID,
		workspaceID,
		notification.NotificationType(row.NotificationType),
		row.Title,
		row.Message,
		isRead,
		readAt,
		metadata,
		row.CreatedAt.Time,
	), nil
}
