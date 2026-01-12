package postgres

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/attachment"
	"github.com/antti/home-warehouse/go-backend/internal/infra/queries"
)

type FileRepository struct {
	pool    *pgxpool.Pool
	queries *queries.Queries
}

func NewFileRepository(pool *pgxpool.Pool) *FileRepository {
	return &FileRepository{
		pool:    pool,
		queries: queries.New(pool),
	}
}

func (r *FileRepository) Save(ctx context.Context, f *attachment.File) error {
	var uploadedBy pgtype.UUID
	if f.UploadedBy() != nil {
		uploadedBy = pgtype.UUID{Bytes: *f.UploadedBy(), Valid: true}
	}

	extension := f.Extension()
	mimeType := f.MimeType()
	sizeBytes := f.SizeBytes()
	checksum := f.Checksum()
	storageKey := f.StorageKey()

	_, err := r.queries.CreateFile(ctx, queries.CreateFileParams{
		ID:           f.ID(),
		WorkspaceID:  f.WorkspaceID(),
		OriginalName: f.OriginalName(),
		Extension:    &extension,
		MimeType:     &mimeType,
		SizeBytes:    &sizeBytes,
		Checksum:     &checksum,
		StorageKey:   &storageKey,
		UploadedBy:   uploadedBy,
	})
	return err
}

func (r *FileRepository) FindByID(ctx context.Context, id uuid.UUID) (*attachment.File, error) {
	row, err := r.queries.GetFile(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	return r.rowToFile(row), nil
}

func (r *FileRepository) Delete(ctx context.Context, id uuid.UUID) error {
	return r.queries.DeleteFile(ctx, id)
}

func (r *FileRepository) rowToFile(row queries.WarehouseFile) *attachment.File {
	var uploadedBy *uuid.UUID
	if row.UploadedBy.Valid {
		id := uuid.UUID(row.UploadedBy.Bytes)
		uploadedBy = &id
	}

	extension := ""
	if row.Extension != nil {
		extension = *row.Extension
	}
	mimeType := ""
	if row.MimeType != nil {
		mimeType = *row.MimeType
	}
	sizeBytes := int64(0)
	if row.SizeBytes != nil {
		sizeBytes = *row.SizeBytes
	}
	checksum := ""
	if row.Checksum != nil {
		checksum = *row.Checksum
	}
	storageKey := ""
	if row.StorageKey != nil {
		storageKey = *row.StorageKey
	}

	return attachment.ReconstructFile(
		row.ID,
		row.WorkspaceID,
		row.OriginalName,
		extension,
		mimeType,
		checksum,
		storageKey,
		sizeBytes,
		uploadedBy,
		row.CreatedAt.Time,
		row.UpdatedAt.Time,
	)
}

type AttachmentRepository struct {
	pool    *pgxpool.Pool
	queries *queries.Queries
}

func NewAttachmentRepository(pool *pgxpool.Pool) *AttachmentRepository {
	return &AttachmentRepository{
		pool:    pool,
		queries: queries.New(pool),
	}
}

func (r *AttachmentRepository) Save(ctx context.Context, a *attachment.Attachment) error {
	var fileID pgtype.UUID
	if a.FileID() != nil {
		fileID = pgtype.UUID{Bytes: *a.FileID(), Valid: true}
	}

	isPrimary := a.IsPrimary()

	_, err := r.queries.CreateAttachment(ctx, queries.CreateAttachmentParams{
		ID:             a.ID(),
		ItemID:         a.ItemID(),
		FileID:         fileID,
		AttachmentType: queries.WarehouseAttachmentTypeEnum(a.AttachmentType()),
		Title:          a.Title(),
		IsPrimary:      &isPrimary,
		DocspellItemID: a.DocspellItemID(),
	})
	return err
}

func (r *AttachmentRepository) FindByID(ctx context.Context, id uuid.UUID) (*attachment.Attachment, error) {
	row, err := r.queries.GetAttachment(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	return r.rowToAttachment(row), nil
}

func (r *AttachmentRepository) FindByItem(ctx context.Context, itemID uuid.UUID) ([]*attachment.Attachment, error) {
	rows, err := r.queries.ListAttachmentsByItem(ctx, itemID)
	if err != nil {
		return nil, err
	}

	attachments := make([]*attachment.Attachment, 0, len(rows))
	for _, row := range rows {
		attachments = append(attachments, r.rowToAttachmentFromList(row))
	}

	return attachments, nil
}

func (r *AttachmentRepository) Delete(ctx context.Context, id uuid.UUID) error {
	return r.queries.DeleteAttachment(ctx, id)
}

func (r *AttachmentRepository) SetPrimaryForItem(ctx context.Context, itemID, attachmentID uuid.UUID) error {
	return r.queries.SetPrimaryAttachment(ctx, queries.SetPrimaryAttachmentParams{
		ItemID: itemID,
		ID:     attachmentID,
	})
}

func (r *AttachmentRepository) rowToAttachment(row queries.WarehouseAttachment) *attachment.Attachment {
	var fileID *uuid.UUID
	if row.FileID.Valid {
		id := uuid.UUID(row.FileID.Bytes)
		fileID = &id
	}

	isPrimary := false
	if row.IsPrimary != nil {
		isPrimary = *row.IsPrimary
	}

	return attachment.ReconstructAttachment(
		row.ID,
		row.ItemID,
		fileID,
		attachment.AttachmentType(row.AttachmentType),
		row.Title,
		isPrimary,
		row.DocspellItemID,
		row.CreatedAt.Time,
		row.UpdatedAt.Time,
	)
}

func (r *AttachmentRepository) rowToAttachmentFromList(row queries.ListAttachmentsByItemRow) *attachment.Attachment {
	var fileID *uuid.UUID
	if row.FileID.Valid {
		id := uuid.UUID(row.FileID.Bytes)
		fileID = &id
	}

	isPrimary := false
	if row.IsPrimary != nil {
		isPrimary = *row.IsPrimary
	}

	return attachment.ReconstructAttachment(
		row.ID,
		row.ItemID,
		fileID,
		attachment.AttachmentType(row.AttachmentType),
		row.Title,
		isPrimary,
		row.DocspellItemID,
		row.CreatedAt.Time,
		row.UpdatedAt.Time,
	)
}
