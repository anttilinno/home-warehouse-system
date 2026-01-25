package postgres

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/repairphoto"
	"github.com/antti/home-warehouse/go-backend/internal/infra/queries"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

type RepairPhotoRepository struct {
	pool    *pgxpool.Pool
	queries *queries.Queries
}

func NewRepairPhotoRepository(pool *pgxpool.Pool) *RepairPhotoRepository {
	return &RepairPhotoRepository{
		pool:    pool,
		queries: queries.New(pool),
	}
}

func (r *RepairPhotoRepository) Create(ctx context.Context, photo *repairphoto.RepairPhoto) (*repairphoto.RepairPhoto, error) {
	db := GetDBTX(ctx, r.pool)
	q := queries.New(db)

	row, err := q.InsertRepairPhoto(ctx, queries.InsertRepairPhotoParams{
		ID:            photo.ID,
		RepairLogID:   photo.RepairLogID,
		WorkspaceID:   photo.WorkspaceID,
		PhotoType:     queries.WarehouseRepairPhotoTypeEnum(photo.PhotoType),
		Filename:      photo.Filename,
		StoragePath:   photo.StoragePath,
		ThumbnailPath: photo.ThumbnailPath,
		FileSize:      photo.FileSize,
		MimeType:      photo.MimeType,
		Width:         photo.Width,
		Height:        photo.Height,
		DisplayOrder:  photo.DisplayOrder,
		Caption:       photo.Caption,
		UploadedBy:    photo.UploadedBy,
	})
	if err != nil {
		return nil, err
	}

	return r.rowToRepairPhoto(row), nil
}

func (r *RepairPhotoRepository) GetByID(ctx context.Context, id, workspaceID uuid.UUID) (*repairphoto.RepairPhoto, error) {
	db := GetDBTX(ctx, r.pool)
	q := queries.New(db)

	row, err := q.GetRepairPhoto(ctx, queries.GetRepairPhotoParams{
		ID:          id,
		WorkspaceID: workspaceID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, shared.ErrNotFound
		}
		return nil, err
	}

	return r.rowToRepairPhoto(row), nil
}

func (r *RepairPhotoRepository) ListByRepairLog(ctx context.Context, repairLogID, workspaceID uuid.UUID) ([]*repairphoto.RepairPhoto, error) {
	db := GetDBTX(ctx, r.pool)
	q := queries.New(db)

	rows, err := q.ListRepairPhotosByRepairLog(ctx, queries.ListRepairPhotosByRepairLogParams{
		RepairLogID: repairLogID,
		WorkspaceID: workspaceID,
	})
	if err != nil {
		return nil, err
	}

	photos := make([]*repairphoto.RepairPhoto, 0, len(rows))
	for _, row := range rows {
		photos = append(photos, r.rowToRepairPhoto(row))
	}

	return photos, nil
}

func (r *RepairPhotoRepository) UpdateCaption(ctx context.Context, id, workspaceID uuid.UUID, caption *string) (*repairphoto.RepairPhoto, error) {
	db := GetDBTX(ctx, r.pool)
	q := queries.New(db)

	row, err := q.UpdateRepairPhotoCaption(ctx, queries.UpdateRepairPhotoCaptionParams{
		ID:          id,
		Caption:     caption,
		WorkspaceID: workspaceID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, shared.ErrNotFound
		}
		return nil, err
	}

	return r.rowToRepairPhoto(row), nil
}

func (r *RepairPhotoRepository) UpdateDisplayOrder(ctx context.Context, id, workspaceID uuid.UUID, order int32) error {
	db := GetDBTX(ctx, r.pool)
	q := queries.New(db)

	return q.UpdateRepairPhotoDisplayOrder(ctx, queries.UpdateRepairPhotoDisplayOrderParams{
		ID:           id,
		DisplayOrder: order,
		WorkspaceID:  workspaceID,
	})
}

func (r *RepairPhotoRepository) Delete(ctx context.Context, id, workspaceID uuid.UUID) error {
	db := GetDBTX(ctx, r.pool)
	q := queries.New(db)

	return q.DeleteRepairPhoto(ctx, queries.DeleteRepairPhotoParams{
		ID:          id,
		WorkspaceID: workspaceID,
	})
}

func (r *RepairPhotoRepository) GetMaxDisplayOrder(ctx context.Context, repairLogID, workspaceID uuid.UUID) (int32, error) {
	db := GetDBTX(ctx, r.pool)
	q := queries.New(db)

	maxOrder, err := q.GetMaxRepairPhotoDisplayOrder(ctx, queries.GetMaxRepairPhotoDisplayOrderParams{
		RepairLogID: repairLogID,
		WorkspaceID: workspaceID,
	})
	if err != nil {
		return -1, err
	}

	return maxOrder, nil
}

func (r *RepairPhotoRepository) rowToRepairPhoto(row queries.WarehouseRepairPhoto) *repairphoto.RepairPhoto {
	return repairphoto.Reconstruct(
		row.ID,
		row.RepairLogID,
		row.WorkspaceID,
		repairphoto.PhotoType(row.PhotoType),
		row.Filename,
		row.StoragePath,
		row.ThumbnailPath,
		row.MimeType,
		row.FileSize,
		row.Width,
		row.Height,
		row.DisplayOrder,
		row.Caption,
		row.UploadedBy,
		row.CreatedAt,
		row.UpdatedAt,
	)
}
