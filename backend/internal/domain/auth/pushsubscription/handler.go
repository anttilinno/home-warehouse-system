package pushsubscription

import (
	"context"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"

	appMiddleware "github.com/antti/home-warehouse/go-backend/internal/api/middleware"
)

// RegisterRoutes registers push subscription routes.
func RegisterRoutes(api huma.API, svc ServiceInterface) {
	// Subscribe to push notifications
	huma.Post(api, "/push/subscribe", func(ctx context.Context, input *SubscribeRequest) (*SubscribeResponse, error) {
		authUser, ok := appMiddleware.GetAuthUser(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("authentication required")
		}

		subscription, err := svc.Subscribe(ctx, SubscribeInput{
			UserID:    authUser.ID,
			Endpoint:  input.Body.Endpoint,
			P256dh:    input.Body.Keys.P256dh,
			Auth:      input.Body.Keys.Auth,
			UserAgent: input.Body.UserAgent,
		})
		if err != nil {
			return nil, huma.Error400BadRequest(err.Error())
		}

		return &SubscribeResponse{
			Body: PushSubscriptionResponse{
				ID:        subscription.ID(),
				UserID:    subscription.UserID(),
				Endpoint:  subscription.Endpoint(),
				CreatedAt: subscription.CreatedAt(),
				UpdatedAt: subscription.UpdatedAt(),
			},
		}, nil
	})

	// Unsubscribe from push notifications
	huma.Post(api, "/push/unsubscribe", func(ctx context.Context, input *UnsubscribeRequest) (*struct{}, error) {
		authUser, ok := appMiddleware.GetAuthUser(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("authentication required")
		}

		err := svc.Unsubscribe(ctx, authUser.ID, input.Body.Endpoint)
		if err != nil {
			return nil, huma.Error400BadRequest(err.Error())
		}

		return nil, nil
	})

	// Unsubscribe all devices
	huma.Delete(api, "/push/subscriptions", func(ctx context.Context, input *struct{}) (*struct{}, error) {
		authUser, ok := appMiddleware.GetAuthUser(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("authentication required")
		}

		err := svc.UnsubscribeAll(ctx, authUser.ID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to remove subscriptions")
		}

		return nil, nil
	})

	// Get subscription status
	huma.Get(api, "/push/status", func(ctx context.Context, input *struct{}) (*PushStatusResponse, error) {
		authUser, ok := appMiddleware.GetAuthUser(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("authentication required")
		}

		subscriptions, err := svc.GetUserSubscriptions(ctx, authUser.ID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to get subscriptions")
		}

		devices := make([]DeviceInfo, len(subscriptions))
		for i, sub := range subscriptions {
			devices[i] = DeviceInfo{
				ID:        sub.ID(),
				UserAgent: sub.UserAgent(),
				CreatedAt: sub.CreatedAt(),
			}
		}

		return &PushStatusResponse{
			Body: PushStatus{
				Enabled:      len(subscriptions) > 0,
				DeviceCount:  len(subscriptions),
				Devices:      devices,
			},
		}, nil
	})
}

// Request/Response types

type SubscribeRequest struct {
	Body SubscribeRequestBody
}

type SubscribeRequestBody struct {
	Endpoint  string                `json:"endpoint" doc:"Push service endpoint URL" minLength:"1"`
	Keys      PushSubscriptionKeys  `json:"keys" doc:"Encryption keys for the subscription"`
	UserAgent *string               `json:"user_agent,omitempty" doc:"Device user agent string"`
}

type PushSubscriptionKeys struct {
	P256dh string `json:"p256dh" doc:"Client public key (base64)" minLength:"1"`
	Auth   string `json:"auth" doc:"Authentication secret (base64)" minLength:"1"`
}

type SubscribeResponse struct {
	Body PushSubscriptionResponse
}

type PushSubscriptionResponse struct {
	ID        uuid.UUID `json:"id"`
	UserID    uuid.UUID `json:"user_id"`
	Endpoint  string    `json:"endpoint"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type UnsubscribeRequest struct {
	Body UnsubscribeRequestBody
}

type UnsubscribeRequestBody struct {
	Endpoint string `json:"endpoint" doc:"Push service endpoint URL to unsubscribe" minLength:"1"`
}

type PushStatusResponse struct {
	Body PushStatus
}

type PushStatus struct {
	Enabled     bool         `json:"enabled" doc:"Whether push notifications are enabled for this user"`
	DeviceCount int          `json:"device_count" doc:"Number of registered devices"`
	Devices     []DeviceInfo `json:"devices" doc:"List of registered devices"`
}

type DeviceInfo struct {
	ID        uuid.UUID `json:"id"`
	UserAgent *string   `json:"user_agent,omitempty"`
	CreatedAt time.Time `json:"created_at"`
}
