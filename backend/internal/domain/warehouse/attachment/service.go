package attachment

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"io"
	"mime/multipart"
	"path/filepath"

	"github.com/google/uuid"

	"github.com/antti/home-warehouse/go-backend/internal/infra/storage"
)

// ServiceInterface defines the attachment service operations.
// All lookups and mutations are workspace-scoped (security fix F1): the
// workspace ID from the request context is threaded down to the SQL layer
// so a leaked UUID can never reach another tenant's rows.
type ServiceInterface interface {
	UploadFile(ctx context.Context, input UploadFileInput) (*File, error)
	// UploadFileBytes persists the REAL uploaded bytes to storage (not just a
	// metadata row) and records a File whose StorageKey is the real returned
	// path. Used by the Chi multipart upload route (ATT-01).
	UploadFileBytes(ctx context.Context, workspaceID, itemID uuid.UUID, header *multipart.FileHeader, reader io.Reader, uploadedBy *uuid.UUID) (*File, error)
	// GetFile returns a File row by ID, workspace-scoped. Used by the serve
	// route to resolve the storage_key + mime_type for streaming.
	GetFile(ctx context.Context, id, workspaceID uuid.UUID) (*File, error)
	CreateAttachment(ctx context.Context, input CreateAttachmentInput) (*Attachment, error)
	GetAttachment(ctx context.Context, id, workspaceID uuid.UUID) (*Attachment, error)
	ListByItem(ctx context.Context, itemID, workspaceID uuid.UUID) ([]*Attachment, error)
	DeleteAttachment(ctx context.Context, id, workspaceID uuid.UUID) error
	SetPrimary(ctx context.Context, itemID, attachmentID, workspaceID uuid.UUID) error
}

type Service struct {
	fileRepo       FileRepository
	attachmentRepo AttachmentRepository
	storage        storage.Storage
}

func NewService(fileRepo FileRepository, attachmentRepo AttachmentRepository, store storage.Storage) *Service {
	return &Service{
		fileRepo:       fileRepo,
		attachmentRepo: attachmentRepo,
		storage:        store,
	}
}

type UploadFileInput struct {
	WorkspaceID  uuid.UUID
	OriginalName string
	Extension    string
	MimeType     string
	SizeBytes    int64
	Checksum     string
	StorageKey   string
	UploadedBy   *uuid.UUID
}

func (s *Service) UploadFile(ctx context.Context, input UploadFileInput) (*File, error) {
	file, err := NewFile(
		input.WorkspaceID,
		input.OriginalName,
		input.Extension,
		input.MimeType,
		input.Checksum,
		input.StorageKey,
		input.SizeBytes,
		input.UploadedBy,
	)
	if err != nil {
		return nil, err
	}

	if err := s.fileRepo.Save(ctx, file); err != nil {
		return nil, err
	}

	return file, nil
}

// UploadFileBytes streams the uploaded bytes to storage, computes their
// SHA-256 checksum, and persists a File row whose StorageKey is the REAL path
// returned by storage.Save. If the Save fails, no File row is created (no
// orphan metadata). The filename is sanitised inside storage.Save
// (SanitizeFilename + filepath.Base — zip-slip / F14, path-containment / F20).
func (s *Service) UploadFileBytes(
	ctx context.Context,
	workspaceID, itemID uuid.UUID,
	header *multipart.FileHeader,
	reader io.Reader,
	uploadedBy *uuid.UUID,
) (*File, error) {
	// Tee the reader so we hash the exact bytes we write, in one pass.
	hash := sha256.New()
	tee := io.TeeReader(reader, hash)

	storageKey, err := s.storage.Save(ctx, workspaceID.String(), itemID.String(), header.Filename, tee)
	if err != nil {
		// Bytes failed to persist — do NOT create a File row.
		return nil, err
	}

	checksum := hex.EncodeToString(hash.Sum(nil))

	mimeType := header.Header.Get("Content-Type")
	if mimeType == "" {
		mimeType = "application/octet-stream"
	}

	file, err := NewFile(
		workspaceID,
		header.Filename,
		filepath.Ext(header.Filename),
		mimeType,
		checksum,
		storageKey,
		header.Size,
		uploadedBy,
	)
	if err != nil {
		// Roll back the now-orphaned blob (best effort).
		_ = s.storage.Delete(ctx, storageKey)
		return nil, err
	}

	if err := s.fileRepo.Save(ctx, file); err != nil {
		_ = s.storage.Delete(ctx, storageKey)
		return nil, err
	}

	return file, nil
}

// GetFile returns a File row by ID, workspace-scoped (WHERE id=$1 AND
// workspace_id=$2 in the repo). Used by the serve route to resolve the
// storage_key + mime_type.
func (s *Service) GetFile(ctx context.Context, id, workspaceID uuid.UUID) (*File, error) {
	file, err := s.fileRepo.FindByID(ctx, id, workspaceID)
	if err != nil {
		return nil, err
	}
	if file == nil {
		return nil, ErrAttachmentNotFound
	}
	return file, nil
}

type CreateAttachmentInput struct {
	WorkspaceID    uuid.UUID
	ItemID         uuid.UUID
	FileID         *uuid.UUID
	AttachmentType AttachmentType
	Title          *string
	IsPrimary      bool
	// ExternalDocID links the attachment to a document in an external DMS
	// (Paperless-ngx). dms_type is derived from it in NewAttachment.
	ExternalDocID *string
}

func (s *Service) CreateAttachment(ctx context.Context, input CreateAttachmentInput) (*Attachment, error) {
	attachment, err := NewAttachment(
		input.WorkspaceID,
		input.ItemID,
		input.FileID,
		input.AttachmentType,
		input.Title,
		input.IsPrimary,
		input.ExternalDocID,
	)
	if err != nil {
		return nil, err
	}

	if err := s.attachmentRepo.Save(ctx, attachment); err != nil {
		return nil, err
	}

	// If this is marked as primary, update other attachments for the item
	if input.IsPrimary {
		if err := s.attachmentRepo.SetPrimaryForItem(ctx, input.ItemID, attachment.ID(), input.WorkspaceID); err != nil {
			return nil, err
		}
	}

	return attachment, nil
}

func (s *Service) GetAttachment(ctx context.Context, id, workspaceID uuid.UUID) (*Attachment, error) {
	attachment, err := s.attachmentRepo.FindByID(ctx, id, workspaceID)
	if err != nil {
		return nil, err
	}
	if attachment == nil {
		return nil, ErrAttachmentNotFound
	}
	return attachment, nil
}

func (s *Service) ListByItem(ctx context.Context, itemID, workspaceID uuid.UUID) ([]*Attachment, error) {
	return s.attachmentRepo.FindByItem(ctx, itemID, workspaceID)
}

func (s *Service) DeleteAttachment(ctx context.Context, id, workspaceID uuid.UUID) error {
	attachment, err := s.GetAttachment(ctx, id, workspaceID)
	if err != nil {
		return err
	}

	// Delete the attachment record
	if err := s.attachmentRepo.Delete(ctx, id, workspaceID); err != nil {
		return err
	}

	// If there's an associated file, delete it too
	if attachment.FileID() != nil {
		_ = s.fileRepo.Delete(ctx, *attachment.FileID(), workspaceID)
	}

	return nil
}

func (s *Service) SetPrimary(ctx context.Context, itemID, attachmentID, workspaceID uuid.UUID) error {
	// Verify attachment exists and belongs to the item
	attachment, err := s.GetAttachment(ctx, attachmentID, workspaceID)
	if err != nil {
		return err
	}
	if attachment.ItemID() != itemID {
		return ErrAttachmentNotFound
	}

	return s.attachmentRepo.SetPrimaryForItem(ctx, itemID, attachmentID, workspaceID)
}
