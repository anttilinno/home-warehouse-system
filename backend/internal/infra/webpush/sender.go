package webpush

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"

	"github.com/SherClockHolmes/webpush-go"
	"github.com/google/uuid"

	"github.com/antti/home-warehouse/go-backend/internal/domain/auth/pushsubscription"
)

// PushMessage represents a push notification message.
type PushMessage struct {
	Title       string                 `json:"title"`
	Body        string                 `json:"body"`
	Icon        string                 `json:"icon,omitempty"`
	Badge       string                 `json:"badge,omitempty"`
	Tag         string                 `json:"tag,omitempty"`
	URL         string                 `json:"url,omitempty"`
	Data        map[string]interface{} `json:"data,omitempty"`
	RequireOpen bool                   `json:"require_open,omitempty"`
}

// Sender sends web push notifications.
type Sender struct {
	vapidPublicKey  string
	vapidPrivateKey string
	subscriber      string
	repo            pushsubscription.Repository
}

// NewSender creates a new web push sender.
func NewSender(vapidPublicKey, vapidPrivateKey, subscriber string, repo pushsubscription.Repository) *Sender {
	return &Sender{
		vapidPublicKey:  vapidPublicKey,
		vapidPrivateKey: vapidPrivateKey,
		subscriber:      subscriber,
		repo:            repo,
	}
}

// SendToUser sends a push notification to all devices of a user.
func (s *Sender) SendToUser(ctx context.Context, userID uuid.UUID, message PushMessage) error {
	subscriptions, err := s.repo.FindByUser(ctx, userID)
	if err != nil {
		return fmt.Errorf("failed to get subscriptions: %w", err)
	}

	if len(subscriptions) == 0 {
		return nil // No subscriptions, nothing to do
	}

	payload, err := json.Marshal(message)
	if err != nil {
		return fmt.Errorf("failed to marshal message: %w", err)
	}

	var lastErr error
	successCount := 0
	for _, sub := range subscriptions {
		if err := s.sendToSubscription(ctx, sub, payload); err != nil {
			log.Printf("Failed to send push to subscription %s: %v", sub.ID(), err)
			lastErr = err
			// If subscription is invalid, remove it
			if isInvalidSubscriptionError(err) {
				if delErr := s.repo.Delete(ctx, sub.ID()); delErr != nil {
					log.Printf("Failed to delete invalid subscription %s: %v", sub.ID(), delErr)
				}
			}
		} else {
			successCount++
		}
	}

	if successCount == 0 && lastErr != nil {
		return lastErr
	}

	return nil
}

// SendToUsers sends a push notification to multiple users.
func (s *Sender) SendToUsers(ctx context.Context, userIDs []uuid.UUID, message PushMessage) error {
	for _, userID := range userIDs {
		if err := s.SendToUser(ctx, userID, message); err != nil {
			log.Printf("Failed to send push to user %s: %v", userID, err)
			// Continue sending to other users
		}
	}
	return nil
}

// SendToAll sends a push notification to all registered subscriptions.
func (s *Sender) SendToAll(ctx context.Context, message PushMessage) error {
	subscriptions, err := s.repo.FindAll(ctx)
	if err != nil {
		return fmt.Errorf("failed to get subscriptions: %w", err)
	}

	if len(subscriptions) == 0 {
		return nil
	}

	payload, err := json.Marshal(message)
	if err != nil {
		return fmt.Errorf("failed to marshal message: %w", err)
	}

	for _, sub := range subscriptions {
		if err := s.sendToSubscription(ctx, sub, payload); err != nil {
			log.Printf("Failed to send push to subscription %s: %v", sub.ID(), err)
			if isInvalidSubscriptionError(err) {
				if delErr := s.repo.Delete(ctx, sub.ID()); delErr != nil {
					log.Printf("Failed to delete invalid subscription %s: %v", sub.ID(), delErr)
				}
			}
		}
	}

	return nil
}

// sendToSubscription sends a push notification to a single subscription.
func (s *Sender) sendToSubscription(ctx context.Context, sub *pushsubscription.PushSubscription, payload []byte) error {
	subscription := &webpush.Subscription{
		Endpoint: sub.Endpoint(),
		Keys: webpush.Keys{
			P256dh: sub.P256dh(),
			Auth:   sub.Auth(),
		},
	}

	resp, err := webpush.SendNotification(payload, subscription, &webpush.Options{
		Subscriber:      s.subscriber,
		VAPIDPublicKey:  s.vapidPublicKey,
		VAPIDPrivateKey: s.vapidPrivateKey,
		TTL:             86400, // 24 hours
	})
	if err != nil {
		return fmt.Errorf("failed to send notification: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("push service returned status %d", resp.StatusCode)
	}

	return nil
}

// isInvalidSubscriptionError checks if the error indicates an invalid subscription.
func isInvalidSubscriptionError(err error) bool {
	if err == nil {
		return false
	}
	// HTTP 404 (Not Found) or 410 (Gone) indicates the subscription is no longer valid
	errStr := err.Error()
	return errStr == fmt.Sprintf("push service returned status %d", http.StatusNotFound) ||
		errStr == fmt.Sprintf("push service returned status %d", http.StatusGone)
}

// IsEnabled returns whether web push is enabled (VAPID keys are configured).
func (s *Sender) IsEnabled() bool {
	return s.vapidPublicKey != "" && s.vapidPrivateKey != ""
}
