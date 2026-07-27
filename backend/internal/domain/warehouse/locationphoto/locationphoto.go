// Package locationphoto serves photos attached to a location — "what does this
// shelf actually look like" — so a phone capture can record a place without
// typing and the naming happens from a desktop later.
//
// It owns only the LINK (location <-> file). The bytes and their metadata are
// handled by the existing files plumbing in the attachment package
// (UploadFileBytes / GetFile), which this package consumes through the narrow
// FileStore interface below rather than re-implementing a third copy of upload
// + checksum + storage handling (itemphoto and repairphoto are the first two).
package locationphoto

import (
	"context"
	"io"
	"mime/multipart"
	"time"

	"github.com/google/uuid"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/attachment"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

// MaxFileSize caps an upload at 10MB, matching itemphoto/repairphoto.
const MaxFileSize = 10 * 1024 * 1024

// LocationPhoto is one location <-> file link.
type LocationPhoto struct {
	ID          uuid.UUID
	WorkspaceID uuid.UUID
	LocationID  uuid.UUID
	FileID      uuid.UUID
	Caption     *string
	CreatedAt   time.Time
	// Denormalised from warehouse.files by the list/read queries so a caller
	// can render the photo without a second round trip.
	OriginalName string
	MimeType     string
	SizeBytes    int64
}

// Repository is the persistence port. Every method is workspace-scoped —
// workspace_id is part of each WHERE clause, never inferred from the row.
type Repository interface {
	Save(ctx context.Context, p *LocationPhoto) error
	ListByLocation(ctx context.Context, locationID, workspaceID uuid.UUID) ([]*LocationPhoto, error)
	FindByID(ctx context.Context, id, workspaceID uuid.UUID) (*LocationPhoto, error)
	Delete(ctx context.Context, id, workspaceID uuid.UUID) error
}

// FileStore is the slice of attachment.Service this package needs: persist the
// real bytes as a warehouse.files row, and read one back for streaming.
type FileStore interface {
	UploadFileBytes(ctx context.Context, workspaceID, entityID uuid.UUID, header *multipart.FileHeader, reader io.Reader, uploadedBy *uuid.UUID) (*attachment.File, error)
	GetFile(ctx context.Context, id, workspaceID uuid.UUID) (*attachment.File, error)
}

// ServiceInterface is what the handlers depend on (fake-able in tests).
type ServiceInterface interface {
	Upload(ctx context.Context, input UploadInput) (*LocationPhoto, error)
	ListByLocation(ctx context.Context, locationID, workspaceID uuid.UUID) ([]*LocationPhoto, error)
	Get(ctx context.Context, id, workspaceID uuid.UUID) (*LocationPhoto, error)
	OpenFile(ctx context.Context, p *LocationPhoto) (io.ReadCloser, string, error)
	Delete(ctx context.Context, id, workspaceID uuid.UUID) error
}

// Blobs is the byte-storage port (satisfied by infra/storage.Storage).
type Blobs interface {
	Get(ctx context.Context, path string) (io.ReadCloser, error)
}

type Service struct {
	repo  Repository
	files FileStore
	blobs Blobs
}

func NewService(repo Repository, files FileStore, blobs Blobs) *Service {
	return &Service{repo: repo, files: files, blobs: blobs}
}

type UploadInput struct {
	WorkspaceID uuid.UUID
	LocationID  uuid.UUID
	Header      *multipart.FileHeader
	Reader      io.Reader
	Caption     *string
	UploadedBy  *uuid.UUID
}

// Upload persists the bytes, then the link row. A failed link insert leaves the
// file row behind rather than the reverse — an orphan file is invisible and
// harmless, a link pointing at bytes that were never written is a broken photo.
func (s *Service) Upload(ctx context.Context, input UploadInput) (*LocationPhoto, error) {
	if err := shared.ValidateUUID(input.LocationID, "location_id"); err != nil {
		return nil, err
	}

	// entityID is only a storage path segment (workspace/<ws>/<entity>/<file>),
	// so the location id keeps a location's photos together on disk.
	file, err := s.files.UploadFileBytes(
		ctx, input.WorkspaceID, input.LocationID, input.Header, input.Reader, input.UploadedBy,
	)
	if err != nil {
		return nil, err
	}

	photo := &LocationPhoto{
		ID:           shared.NewUUID(),
		WorkspaceID:  input.WorkspaceID,
		LocationID:   input.LocationID,
		FileID:       file.ID(),
		Caption:      input.Caption,
		CreatedAt:    time.Now(),
		OriginalName: file.OriginalName(),
		MimeType:     file.MimeType(),
		SizeBytes:    file.SizeBytes(),
	}
	if err := s.repo.Save(ctx, photo); err != nil {
		return nil, err
	}
	return photo, nil
}

func (s *Service) ListByLocation(ctx context.Context, locationID, workspaceID uuid.UUID) ([]*LocationPhoto, error) {
	return s.repo.ListByLocation(ctx, locationID, workspaceID)
}

func (s *Service) Get(ctx context.Context, id, workspaceID uuid.UUID) (*LocationPhoto, error) {
	return s.repo.FindByID(ctx, id, workspaceID)
}

// OpenFile resolves the photo's file row and opens its bytes for streaming.
// Returns the reader plus the mime type to send back.
func (s *Service) OpenFile(ctx context.Context, p *LocationPhoto) (io.ReadCloser, string, error) {
	file, err := s.files.GetFile(ctx, p.FileID, p.WorkspaceID)
	if err != nil {
		return nil, "", err
	}
	body, err := s.blobs.Get(ctx, file.StorageKey())
	if err != nil {
		return nil, "", err
	}
	mime := file.MimeType()
	if mime == "" {
		mime = "application/octet-stream"
	}
	return body, mime, nil
}

// Delete removes the link row. The files row (and its bytes) is left in place —
// same lifetime rule the attachment delete path already uses; a sweep of
// unreferenced files is a separate job, not a per-delete cascade.
//
// ponytail: no orphan sweep. Add one when files-on-disk growth is measurable,
// or when a file can be linked from more than one place (then it needs a
// refcount, not a sweep).
func (s *Service) Delete(ctx context.Context, id, workspaceID uuid.UUID) error {
	return s.repo.Delete(ctx, id, workspaceID)
}
