package postgres

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/locationphoto"
)

// LocationPhotoRepository persists the location <-> file links from migration
// 010. Hand-written pgx (like ShortlinkRepository) — the sqlc-generated query
// set does not cover this table.
//
// EVERY statement carries workspace_id in its WHERE/INSERT (Pitfall #5): a
// photo id from another tenant must read as "not found", never as a row.
type LocationPhotoRepository struct {
	pool *pgxpool.Pool
}

func NewLocationPhotoRepository(pool *pgxpool.Pool) *LocationPhotoRepository {
	return &LocationPhotoRepository{pool: pool}
}

const insertLocationPhotoSQL = `
INSERT INTO warehouse.location_photos
       (id, workspace_id, location_id, file_id, caption, created_at)
VALUES ($1, $2, $3, $4, $5, $6)`

// The file columns are joined in so a list render needs no second round trip.
const selectLocationPhotoCols = `
SELECT lp.id, lp.workspace_id, lp.location_id, lp.file_id, lp.caption,
       lp.created_at,
       COALESCE(f.original_name, ''), COALESCE(f.mime_type, ''),
       COALESCE(f.size_bytes, 0)
  FROM warehouse.location_photos lp
  JOIN warehouse.files f
    ON f.id = lp.file_id AND f.workspace_id = lp.workspace_id`

const listLocationPhotosSQL = selectLocationPhotoCols + `
 WHERE lp.workspace_id = $1 AND lp.location_id = $2
 ORDER BY lp.created_at DESC`

const findLocationPhotoSQL = selectLocationPhotoCols + `
 WHERE lp.workspace_id = $1 AND lp.id = $2`

const deleteLocationPhotoSQL = `
DELETE FROM warehouse.location_photos WHERE workspace_id = $1 AND id = $2`

func (r *LocationPhotoRepository) Save(ctx context.Context, p *locationphoto.LocationPhoto) error {
	_, err := r.pool.Exec(ctx, insertLocationPhotoSQL,
		p.ID, p.WorkspaceID, p.LocationID, p.FileID, p.Caption, p.CreatedAt)
	return err
}

func scanLocationPhoto(row pgx.Row) (*locationphoto.LocationPhoto, error) {
	var p locationphoto.LocationPhoto
	err := row.Scan(&p.ID, &p.WorkspaceID, &p.LocationID, &p.FileID, &p.Caption,
		&p.CreatedAt, &p.OriginalName, &p.MimeType, &p.SizeBytes)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *LocationPhotoRepository) ListByLocation(ctx context.Context, locationID, workspaceID uuid.UUID) ([]*locationphoto.LocationPhoto, error) {
	rows, err := r.pool.Query(ctx, listLocationPhotosSQL, workspaceID, locationID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	photos := make([]*locationphoto.LocationPhoto, 0)
	for rows.Next() {
		p, err := scanLocationPhoto(rows)
		if err != nil {
			return nil, err
		}
		photos = append(photos, p)
	}
	return photos, rows.Err()
}

// FindByID returns (nil, nil) for an unknown id — or one owned by another
// workspace, which is indistinguishable by design.
func (r *LocationPhotoRepository) FindByID(ctx context.Context, id, workspaceID uuid.UUID) (*locationphoto.LocationPhoto, error) {
	p, err := scanLocationPhoto(r.pool.QueryRow(ctx, findLocationPhotoSQL, workspaceID, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return p, nil
}

func (r *LocationPhotoRepository) Delete(ctx context.Context, id, workspaceID uuid.UUID) error {
	_, err := r.pool.Exec(ctx, deleteLocationPhotoSQL, workspaceID, id)
	return err
}
