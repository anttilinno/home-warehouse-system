package notification

import (
	"context"

	"github.com/google/uuid"

	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

// ServiceInterface defines the notification service operations.
type ServiceInterface interface {
	Create(ctx context.Context, input CreateInput) (*Notification, error)
	GetByID(ctx context.Context, id, userID uuid.UUID) (*Notification, error)
	ListUserNotifications(ctx context.Context, userID uuid.UUID, pagination shared.Pagination) (*shared.PagedResult[*Notification], error)
	GetUnreadNotifications(ctx context.Context, userID uuid.UUID) ([]*Notification, error)
	MarkAsRead(ctx context.Context, id, userID uuid.UUID) error
	MarkAllAsRead(ctx context.Context, userID uuid.UUID) error
	GetUnreadCount(ctx context.Context, userID uuid.UUID) (int64, error)
}

// Service handles notification business logic.
type Service struct {
	repo Repository
}

// NewService creates a new notification service.
func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

// CreateInput holds the input for creating a notification.
type CreateInput struct {
	UserID           uuid.UUID
	WorkspaceID      *uuid.UUID
	NotificationType NotificationType
	Title            string
	Message          string
	Metadata         map[string]interface{}
}

// Create creates a new notification.
func (s *Service) Create(ctx context.Context, input CreateInput) (*Notification, error) {
	notification, err := NewNotification(
		input.UserID,
		input.WorkspaceID,
		input.NotificationType,
		input.Title,
		input.Message,
		input.Metadata,
	)
	if err != nil {
		return nil, err
	}

	if err := s.repo.Save(ctx, notification); err != nil {
		return nil, err
	}

	return notification, nil
}

// GetByID retrieves a notification by ID.
func (s *Service) GetByID(ctx context.Context, id, userID uuid.UUID) (*Notification, error) {
	return s.repo.FindByID(ctx, id, userID)
}

// ListUserNotifications retrieves notifications for a user with pagination.
func (s *Service) ListUserNotifications(ctx context.Context, userID uuid.UUID, pagination shared.Pagination) (*shared.PagedResult[*Notification], error) {
	notifications, total, err := s.repo.FindByUser(ctx, userID, pagination)
	if err != nil {
		return nil, err
	}

	result := shared.NewPagedResult(notifications, total, pagination)
	return &result, nil
}

// GetUnreadNotifications retrieves unread notifications for a user.
func (s *Service) GetUnreadNotifications(ctx context.Context, userID uuid.UUID) ([]*Notification, error) {
	return s.repo.FindUnreadByUser(ctx, userID)
}

// MarkAsRead marks a notification as read.
func (s *Service) MarkAsRead(ctx context.Context, id, userID uuid.UUID) error {
	return s.repo.MarkAsRead(ctx, id, userID)
}

// MarkAllAsRead marks all notifications as read for a user.
func (s *Service) MarkAllAsRead(ctx context.Context, userID uuid.UUID) error {
	return s.repo.MarkAllAsRead(ctx, userID)
}

// GetUnreadCount returns the count of unread notifications for a user.
func (s *Service) GetUnreadCount(ctx context.Context, userID uuid.UUID) (int64, error) {
	return s.repo.GetUnreadCount(ctx, userID)
}
