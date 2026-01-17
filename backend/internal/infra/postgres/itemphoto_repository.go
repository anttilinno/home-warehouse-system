package postgres

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/itemphoto"
	"github.com/antti/home-warehouse/go-backend/internal/infra/queries"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

type ItemPhotoRepository struct {
	pool      *pgxpool.Pool
	queries   *queries.Queries
	txManager *TxManager
}

func NewItemPhotoRepository(pool *pgxpool.Pool, txManager *TxManager) *ItemPhotoRepository {
	return &ItemPhotoRepository{
		pool:      pool,
		queries:   queries.New(pool),
		txManager: txManager,
	}
}

func (r *ItemPhotoRepository) Create(ctx context.Context, photo *itemphoto.ItemPhoto) (*itemphoto.ItemPhoto, error) {
	db := GetDBTX(ctx, r.pool)
	q := queries.New(db)

	row, err := q.CreateItemPhoto(ctx, queries.CreateItemPhotoParams{
		ID:            photo.ID,
		ItemID:        photo.ItemID,
		WorkspaceID:   photo.WorkspaceID,
		Filename:      photo.Filename,
		StoragePath:   photo.StoragePath,
		ThumbnailPath: photo.ThumbnailPath,
		FileSize:      photo.FileSize,
		MimeType:      photo.MimeType,
		Width:         photo.Width,
		Height:        photo.Height,
		DisplayOrder:  photo.DisplayOrder,
		IsPrimary:     photo.IsPrimary,
		Caption:       photo.Caption,
		UploadedBy:    photo.UploadedBy,
	})
	if err != nil {
		return nil, err
	}

	return r.rowToItemPhoto(row), nil
}

func (r *ItemPhotoRepository) GetByID(ctx context.Context, id uuid.UUID) (*itemphoto.ItemPhoto, error) {
	db := GetDBTX(ctx, r.pool)
	q := queries.New(db)

	row, err := q.GetItemPhoto(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, shared.ErrNotFound
		}
		return nil, err
	}

	return r.rowToItemPhoto(row), nil
}

func (r *ItemPhotoRepository) GetByItem(ctx context.Context, itemID, workspaceID uuid.UUID) ([]*itemphoto.ItemPhoto, error) {
	db := GetDBTX(ctx, r.pool)
	q := queries.New(db)

	rows, err := q.ListItemPhotosByItem(ctx, queries.ListItemPhotosByItemParams{
		ItemID:      itemID,
		WorkspaceID: workspaceID,
	})
	if err != nil {
		return nil, err
	}

	photos := make([]*itemphoto.ItemPhoto, 0, len(rows))
	for _, row := range rows {
		photos = append(photos, r.rowToItemPhoto(row))
	}

	return photos, nil
}

func (r *ItemPhotoRepository) GetPrimary(ctx context.Context, itemID, workspaceID uuid.UUID) (*itemphoto.ItemPhoto, error) {
	db := GetDBTX(ctx, r.pool)
	q := queries.New(db)

	row, err := q.GetPrimaryItemPhoto(ctx, queries.GetPrimaryItemPhotoParams{
		ItemID:      itemID,
		WorkspaceID: workspaceID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, shared.ErrNotFound
		}
		return nil, err
	}

	return r.rowToItemPhoto(row), nil
}

func (r *ItemPhotoRepository) Update(ctx context.Context, photo *itemphoto.ItemPhoto) error {
	db := GetDBTX(ctx, r.pool)
	q := queries.New(db)

	_, err := q.UpdateItemPhoto(ctx, queries.UpdateItemPhotoParams{
		ID:           photo.ID,
		Filename:     &photo.Filename,
		Caption:      photo.Caption,
		IsPrimary:    &photo.IsPrimary,
		DisplayOrder: &photo.DisplayOrder,
	})
	return err
}

func (r *ItemPhotoRepository) UpdateDisplayOrder(ctx context.Context, photoID uuid.UUID, order int32) error {
	db := GetDBTX(ctx, r.pool)
	q := queries.New(db)

	return q.UpdateItemPhotoDisplayOrder(ctx, queries.UpdateItemPhotoDisplayOrderParams{
		ID:           photoID,
		DisplayOrder: order,
	})
}

func (r *ItemPhotoRepository) SetPrimary(ctx context.Context, photoID uuid.UUID) error {
	// First, get the photo to know which item it belongs to
	photo, err := r.GetByID(ctx, photoID)
	if err != nil {
		return err
	}

	// Use transaction to ensure atomicity
	return r.txManager.WithTx(ctx, func(txCtx context.Context) error {
		db := GetDBTX(txCtx, r.pool)
		q := queries.New(db)

		// Unset all primary photos for this item
		if err := q.UnsetPrimaryPhotosForItem(txCtx, queries.UnsetPrimaryPhotosForItemParams{
			ItemID:      photo.ItemID,
			WorkspaceID: photo.WorkspaceID,
		}); err != nil {
			return err
		}

		// Set this photo as primary
		if err := q.SetItemPhotoAsPrimary(txCtx, queries.SetItemPhotoAsPrimaryParams{
			ID:          photoID,
			WorkspaceID: photo.WorkspaceID,
		}); err != nil {
			return err
		}

		return nil
	})
}

func (r *ItemPhotoRepository) Delete(ctx context.Context, id uuid.UUID) error {
	// Get the photo first to know workspace_id
	photo, err := r.GetByID(ctx, id)
	if err != nil {
		return err
	}

	db := GetDBTX(ctx, r.pool)
	q := queries.New(db)

	return q.DeleteItemPhoto(ctx, queries.DeleteItemPhotoParams{
		ID:          id,
		WorkspaceID: photo.WorkspaceID,
	})
}

func (r *ItemPhotoRepository) DeleteByItem(ctx context.Context, itemID, workspaceID uuid.UUID) error {
	db := GetDBTX(ctx, r.pool)
	q := queries.New(db)

	return q.DeleteItemPhotosByItem(ctx, queries.DeleteItemPhotosByItemParams{
		ItemID:      itemID,
		WorkspaceID: workspaceID,
	})
}

func (r *ItemPhotoRepository) rowToItemPhoto(row queries.WarehouseItemPhoto) *itemphoto.ItemPhoto {
	return &itemphoto.ItemPhoto{
		ID:            row.ID,
		ItemID:        row.ItemID,
		WorkspaceID:   row.WorkspaceID,
		Filename:      row.Filename,
		StoragePath:   row.StoragePath,
		ThumbnailPath: row.ThumbnailPath,
		FileSize:      row.FileSize,
		MimeType:      row.MimeType,
		Width:         row.Width,
		Height:        row.Height,
		DisplayOrder:  row.DisplayOrder,
		IsPrimary:     row.IsPrimary,
		Caption:       row.Caption,
		UploadedBy:    row.UploadedBy,
		CreatedAt:     row.CreatedAt,
		UpdatedAt:     row.UpdatedAt,
	}
}
