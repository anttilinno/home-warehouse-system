package postgres

import (
	"context"
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/activity"
	"github.com/antti/home-warehouse/go-backend/internal/infra/queries"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

type ActivityRepository struct {
	pool    *pgxpool.Pool
	queries *queries.Queries
}

func NewActivityRepository(pool *pgxpool.Pool) *ActivityRepository {
	return &ActivityRepository{
		pool:    pool,
		queries: queries.New(pool),
	}
}

func (r *ActivityRepository) Save(ctx context.Context, a *activity.ActivityLog) error {
	var userID pgtype.UUID
	if a.UserID() != nil {
		userID = pgtype.UUID{Bytes: *a.UserID(), Valid: true}
	}

	// Convert map[string]interface{} to []byte (JSON)
	changes, err := json.Marshal(a.Changes())
	if err != nil {
		return err
	}
	metadata, err := json.Marshal(a.Metadata())
	if err != nil {
		return err
	}

	entityName := a.EntityName()

	_, err = r.queries.CreateActivityLog(ctx, queries.CreateActivityLogParams{
		ID:          a.ID(),
		WorkspaceID: a.WorkspaceID(),
		UserID:      userID,
		Action:      queries.WarehouseActivityActionEnum(a.Action()),
		EntityType:  queries.WarehouseActivityEntityEnum(a.EntityType()),
		EntityID:    a.EntityID(),
		EntityName:  &entityName,
		Changes:     changes,
		Metadata:    metadata,
	})
	return err
}

func (r *ActivityRepository) FindByWorkspace(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination) ([]*activity.ActivityLog, error) {
	rows, err := r.queries.ListActivityByWorkspace(ctx, queries.ListActivityByWorkspaceParams{
		WorkspaceID: workspaceID,
		Limit:       int32(pagination.Limit()),
		Offset:      int32(pagination.Offset()),
	})
	if err != nil {
		return nil, err
	}

	logs := make([]*activity.ActivityLog, 0, len(rows))
	for _, row := range rows {
		logs = append(logs, r.rowToActivityLogFromWorkspace(row))
	}

	return logs, nil
}

func (r *ActivityRepository) FindByEntity(ctx context.Context, workspaceID uuid.UUID, entityType activity.EntityType, entityID uuid.UUID, pagination shared.Pagination) ([]*activity.ActivityLog, error) {
	rows, err := r.queries.ListActivityByEntity(ctx, queries.ListActivityByEntityParams{
		WorkspaceID: workspaceID,
		EntityType:  queries.WarehouseActivityEntityEnum(entityType),
		EntityID:    entityID,
		Limit:       int32(pagination.Limit()),
		Offset:      int32(pagination.Offset()),
	})
	if err != nil {
		return nil, err
	}

	logs := make([]*activity.ActivityLog, 0, len(rows))
	for _, row := range rows {
		logs = append(logs, r.rowToActivityLogFromEntity(row))
	}

	return logs, nil
}

func (r *ActivityRepository) FindByUser(ctx context.Context, workspaceID, userID uuid.UUID, pagination shared.Pagination) ([]*activity.ActivityLog, error) {
	rows, err := r.queries.ListActivityByUser(ctx, queries.ListActivityByUserParams{
		WorkspaceID: workspaceID,
		UserID:      pgtype.UUID{Bytes: userID, Valid: true},
		Limit:       int32(pagination.Limit()),
		Offset:      int32(pagination.Offset()),
	})
	if err != nil {
		return nil, err
	}

	logs := make([]*activity.ActivityLog, 0, len(rows))
	for _, row := range rows {
		logs = append(logs, r.rowToActivityLog(row))
	}

	return logs, nil
}

func (r *ActivityRepository) FindRecentActivity(ctx context.Context, workspaceID uuid.UUID, since time.Time) ([]*activity.ActivityLog, error) {
	rows, err := r.queries.ListRecentActivity(ctx, queries.ListRecentActivityParams{
		WorkspaceID: workspaceID,
		CreatedAt:   pgtype.Timestamptz{Time: since, Valid: true},
	})
	if err != nil {
		return nil, err
	}

	logs := make([]*activity.ActivityLog, 0, len(rows))
	for _, row := range rows {
		logs = append(logs, r.rowToActivityLogFromRecent(row))
	}

	return logs, nil
}

func (r *ActivityRepository) rowToActivityLog(row queries.WarehouseActivityLog) *activity.ActivityLog {
	var userID *uuid.UUID
	if row.UserID.Valid {
		id := uuid.UUID(row.UserID.Bytes)
		userID = &id
	}

	entityName := ""
	if row.EntityName != nil {
		entityName = *row.EntityName
	}

	// Unmarshal JSON to map[string]interface{}
	var changes, metadata map[string]interface{}
	if len(row.Changes) > 0 {
		json.Unmarshal(row.Changes, &changes)
	}
	if len(row.Metadata) > 0 {
		json.Unmarshal(row.Metadata, &metadata)
	}

	return activity.Reconstruct(
		row.ID,
		row.WorkspaceID,
		userID,
		activity.Action(row.Action),
		activity.EntityType(row.EntityType),
		row.EntityID,
		entityName,
		changes,
		metadata,
		row.CreatedAt.Time,
	)
}

func (r *ActivityRepository) rowToActivityLogFromWorkspace(row queries.ListActivityByWorkspaceRow) *activity.ActivityLog {
	var userID *uuid.UUID
	if row.UserID.Valid {
		id := uuid.UUID(row.UserID.Bytes)
		userID = &id
	}

	entityName := ""
	if row.EntityName != nil {
		entityName = *row.EntityName
	}

	var changes, metadata map[string]interface{}
	if len(row.Changes) > 0 {
		json.Unmarshal(row.Changes, &changes)
	}
	if len(row.Metadata) > 0 {
		json.Unmarshal(row.Metadata, &metadata)
	}

	return activity.Reconstruct(
		row.ID,
		row.WorkspaceID,
		userID,
		activity.Action(row.Action),
		activity.EntityType(row.EntityType),
		row.EntityID,
		entityName,
		changes,
		metadata,
		row.CreatedAt.Time,
	)
}

func (r *ActivityRepository) rowToActivityLogFromEntity(row queries.ListActivityByEntityRow) *activity.ActivityLog {
	var userID *uuid.UUID
	if row.UserID.Valid {
		id := uuid.UUID(row.UserID.Bytes)
		userID = &id
	}

	entityName := ""
	if row.EntityName != nil {
		entityName = *row.EntityName
	}

	var changes, metadata map[string]interface{}
	if len(row.Changes) > 0 {
		json.Unmarshal(row.Changes, &changes)
	}
	if len(row.Metadata) > 0 {
		json.Unmarshal(row.Metadata, &metadata)
	}

	return activity.Reconstruct(
		row.ID,
		row.WorkspaceID,
		userID,
		activity.Action(row.Action),
		activity.EntityType(row.EntityType),
		row.EntityID,
		entityName,
		changes,
		metadata,
		row.CreatedAt.Time,
	)
}

func (r *ActivityRepository) rowToActivityLogFromRecent(row queries.ListRecentActivityRow) *activity.ActivityLog {
	var userID *uuid.UUID
	if row.UserID.Valid {
		id := uuid.UUID(row.UserID.Bytes)
		userID = &id
	}

	entityName := ""
	if row.EntityName != nil {
		entityName = *row.EntityName
	}

	var changes, metadata map[string]interface{}
	if len(row.Changes) > 0 {
		json.Unmarshal(row.Changes, &changes)
	}
	if len(row.Metadata) > 0 {
		json.Unmarshal(row.Metadata, &metadata)
	}

	return activity.Reconstruct(
		row.ID,
		row.WorkspaceID,
		userID,
		activity.Action(row.Action),
		activity.EntityType(row.EntityType),
		row.EntityID,
		entityName,
		changes,
		metadata,
		row.CreatedAt.Time,
	)
}
