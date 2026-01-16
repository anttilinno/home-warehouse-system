package pendingchange

import (
	"context"
	"encoding/json"

	"github.com/google/uuid"
)

// MiddlewareAdapter adapts the Service to the middleware interface
// This avoids import cycles by keeping the adapter in the domain layer
type MiddlewareAdapter struct {
	service *Service
}

// NewMiddlewareAdapter creates a new adapter for the middleware
func NewMiddlewareAdapter(service *Service) *MiddlewareAdapter {
	return &MiddlewareAdapter{
		service: service,
	}
}

// CreatePendingChange implements the middleware's PendingChangeCreator interface
func (a *MiddlewareAdapter) CreatePendingChange(
	ctx context.Context,
	workspaceID uuid.UUID,
	requesterID uuid.UUID,
	entityType string,
	entityID *uuid.UUID,
	action string,
	payload json.RawMessage,
) (changeID uuid.UUID, err error) {
	// Convert string action to Action type
	pendingAction, err := ParseAction(action)
	if err != nil {
		return uuid.Nil, err
	}

	// Call the service
	change, err := a.service.CreatePendingChange(
		ctx,
		workspaceID,
		requesterID,
		entityType,
		entityID,
		pendingAction,
		payload,
	)
	if err != nil {
		return uuid.Nil, err
	}

	return change.ID(), nil
}
