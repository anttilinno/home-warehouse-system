package activity

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

type LogInput struct {
	WorkspaceID uuid.UUID
	UserID      *uuid.UUID
	Action      Action
	EntityType  EntityType
	EntityID    uuid.UUID
	EntityName  string
	Changes     map[string]interface{}
	Metadata    map[string]interface{}
}

func (s *Service) Log(ctx context.Context, input LogInput) error {
	log, err := NewActivityLog(
		input.WorkspaceID,
		input.UserID,
		input.Action,
		input.EntityType,
		input.EntityID,
		input.EntityName,
		input.Changes,
		input.Metadata,
	)
	if err != nil {
		return err
	}

	return s.repo.Save(ctx, log)
}

func (s *Service) ListByWorkspace(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination) ([]*ActivityLog, error) {
	return s.repo.FindByWorkspace(ctx, workspaceID, pagination)
}

func (s *Service) ListByEntity(ctx context.Context, workspaceID uuid.UUID, entityType EntityType, entityID uuid.UUID, pagination shared.Pagination) ([]*ActivityLog, error) {
	return s.repo.FindByEntity(ctx, workspaceID, entityType, entityID, pagination)
}

func (s *Service) ListByUser(ctx context.Context, workspaceID, userID uuid.UUID, pagination shared.Pagination) ([]*ActivityLog, error) {
	return s.repo.FindByUser(ctx, workspaceID, userID, pagination)
}

func (s *Service) GetRecentActivity(ctx context.Context, workspaceID uuid.UUID, since time.Time) ([]*ActivityLog, error) {
	return s.repo.FindRecentActivity(ctx, workspaceID, since)
}
