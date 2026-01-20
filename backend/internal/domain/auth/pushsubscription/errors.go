package pushsubscription

import "errors"

var (
	// ErrSubscriptionNotFound is returned when a push subscription is not found.
	ErrSubscriptionNotFound = errors.New("push subscription not found")
)
