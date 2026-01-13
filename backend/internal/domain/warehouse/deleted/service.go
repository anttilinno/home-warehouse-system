package deleted

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/activity"
)

// ServiceInterface defines the deleted record service operations.
type ServiceInterface interface {
	RecordDeletion(ctx context.Context, workspaceID uuid.UUID, entityType activity.EntityType, entityID uuid.UUID, deletedBy *uuid.UUID) error
	GetDeletedSince(ctx context.Context, workspaceID uuid.UUID, since time.Time) ([]*DeletedRecord, error)
	CleanupOld(ctx context.Context, before time.Time) error
}

type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) RecordDeletion(ctx context.Context, workspaceID uuid.UUID, entityType activity.EntityType, entityID uuid.UUID, deletedBy *uuid.UUID) error {
	record, err := NewDeletedRecord(workspaceID, entityType, entityID, deletedBy)
	if err != nil {
		return err
	}

	return s.repo.Save(ctx, record)
}

func (s *Service) GetDeletedSince(ctx context.Context, workspaceID uuid.UUID, since time.Time) ([]*DeletedRecord, error) {
	return s.repo.FindSince(ctx, workspaceID, since)
}

func (s *Service) CleanupOld(ctx context.Context, before time.Time) error {
	return s.repo.CleanupOld(ctx, before)
}
