package notification

import (
	"context"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"

	appMiddleware "github.com/antti/home-warehouse/go-backend/internal/api/middleware"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

// RegisterRoutes registers notification routes.
func RegisterRoutes(api huma.API, svc *Service) {
	// List user notifications
	huma.Get(api, "/notifications", func(ctx context.Context, input *ListNotificationsInput) (*ListNotificationsOutput, error) {
		authUser, ok := appMiddleware.GetAuthUser(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("authentication required")
		}

		pagination := shared.Pagination{Page: input.Page, PageSize: input.Limit}
		result, err := svc.ListUserNotifications(ctx, authUser.ID, pagination)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to list notifications")
		}

		items := make([]NotificationResponse, len(result.Items))
		for i, notif := range result.Items {
			items[i] = toNotificationResponse(notif)
		}

		return &ListNotificationsOutput{
			Body: NotificationListResponse{
				Items:      items,
				Total:      result.Total,
				Page:       result.Page,
				TotalPages: result.TotalPages,
			},
		}, nil
	})

	// Get unread notifications
	huma.Get(api, "/notifications/unread", func(ctx context.Context, input *struct{}) (*ListUnreadNotificationsOutput, error) {
		authUser, ok := appMiddleware.GetAuthUser(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("authentication required")
		}

		notifications, err := svc.GetUnreadNotifications(ctx, authUser.ID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to get unread notifications")
		}

		items := make([]NotificationResponse, len(notifications))
		for i, notif := range notifications {
			items[i] = toNotificationResponse(notif)
		}

		return &ListUnreadNotificationsOutput{
			Body: NotificationListResponse{
				Items:      items,
				Total:      len(items),
				Page:       1,
				TotalPages: 1,
			},
		}, nil
	})

	// Get unread count
	huma.Get(api, "/notifications/unread/count", func(ctx context.Context, input *struct{}) (*UnreadCountOutput, error) {
		authUser, ok := appMiddleware.GetAuthUser(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("authentication required")
		}

		count, err := svc.GetUnreadCount(ctx, authUser.ID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to get unread count")
		}

		return &UnreadCountOutput{
			Body: UnreadCountResponse{Count: count},
		}, nil
	})

	// Get notification by ID
	huma.Get(api, "/notifications/{id}", func(ctx context.Context, input *GetNotificationInput) (*GetNotificationOutput, error) {
		authUser, ok := appMiddleware.GetAuthUser(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("authentication required")
		}

		notification, err := svc.GetByID(ctx, input.ID, authUser.ID)
		if err != nil || notification == nil {
			return nil, huma.Error404NotFound("notification not found")
		}

		return &GetNotificationOutput{
			Body: toNotificationResponse(notification),
		}, nil
	})

	// Mark notification as read
	huma.Post(api, "/notifications/{id}/read", func(ctx context.Context, input *GetNotificationInput) (*struct{}, error) {
		authUser, ok := appMiddleware.GetAuthUser(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("authentication required")
		}

		err := svc.MarkAsRead(ctx, input.ID, authUser.ID)
		if err != nil {
			return nil, huma.Error400BadRequest(err.Error())
		}

		return nil, nil
	})

	// Mark all notifications as read
	huma.Post(api, "/notifications/read-all", func(ctx context.Context, input *struct{}) (*struct{}, error) {
		authUser, ok := appMiddleware.GetAuthUser(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("authentication required")
		}

		err := svc.MarkAllAsRead(ctx, authUser.ID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to mark all as read")
		}

		return nil, nil
	})
}

func toNotificationResponse(n *Notification) NotificationResponse {
	return NotificationResponse{
		ID:               n.ID(),
		UserID:           n.UserID(),
		WorkspaceID:      n.WorkspaceID(),
		NotificationType: string(n.NotificationType()),
		Title:            n.Title(),
		Message:          n.Message(),
		IsRead:           n.IsRead(),
		ReadAt:           n.ReadAt(),
		Metadata:         n.Metadata(),
		CreatedAt:        n.CreatedAt(),
	}
}

// Request/Response types

type ListNotificationsInput struct {
	Page  int `query:"page" default:"1" minimum:"1"`
	Limit int `query:"limit" default:"50" minimum:"1" maximum:"100"`
}

type ListNotificationsOutput struct {
	Body NotificationListResponse
}

type ListUnreadNotificationsOutput struct {
	Body NotificationListResponse
}

type NotificationListResponse struct {
	Items      []NotificationResponse `json:"items"`
	Total      int                    `json:"total"`
	Page       int                    `json:"page"`
	TotalPages int                    `json:"total_pages"`
}

type GetNotificationInput struct {
	ID uuid.UUID `path:"id"`
}

type GetNotificationOutput struct {
	Body NotificationResponse
}

type UnreadCountOutput struct {
	Body UnreadCountResponse
}

type UnreadCountResponse struct {
	Count int64 `json:"count"`
}

type NotificationResponse struct {
	ID               uuid.UUID              `json:"id"`
	UserID           uuid.UUID              `json:"user_id"`
	WorkspaceID      *uuid.UUID             `json:"workspace_id,omitempty"`
	NotificationType string                 `json:"notification_type" enum:"LOAN_DUE_SOON,LOAN_OVERDUE,LOAN_RETURNED,LOW_STOCK,WORKSPACE_INVITE,MEMBER_JOINED,SYSTEM"`
	Title            string                 `json:"title"`
	Message          string                 `json:"message"`
	IsRead           bool                   `json:"is_read"`
	ReadAt           *time.Time             `json:"read_at,omitempty"`
	Metadata         map[string]interface{} `json:"metadata,omitempty"`
	CreatedAt        time.Time              `json:"created_at"`
}
