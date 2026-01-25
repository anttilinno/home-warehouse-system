package repairattachment

import (
	"context"
	"errors"

	"github.com/google/uuid"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/attachment"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

// ErrRepairAttachmentNotFound is returned when a repair attachment cannot be found.
var ErrRepairAttachmentNotFound = errors.New("repair attachment not found")

// ErrFileNotFound is returned when the file to attach does not exist.
var ErrFileNotFound = errors.New("file not found")

// ErrFileBelongsToDifferentWorkspace is returned when the file belongs to a different workspace.
var ErrFileBelongsToDifferentWorkspace = errors.New("file belongs to a different workspace")

// FileVerifier is an interface for verifying file existence and workspace ownership.
type FileVerifier interface {
	GetFileByID(ctx context.Context, fileID uuid.UUID) (*attachment.File, error)
}

// ServiceInterface defines the repair attachment service operations.
type ServiceInterface interface {
	Create(ctx context.Context, repairLogID, workspaceID, fileID uuid.UUID, attachmentType attachment.AttachmentType, title *string) (*RepairAttachment, error)
	GetByID(ctx context.Context, id, workspaceID uuid.UUID) (*RepairAttachment, error)
	ListByRepairLog(ctx context.Context, repairLogID, workspaceID uuid.UUID) ([]*RepairAttachmentWithFile, error)
	Delete(ctx context.Context, id, workspaceID uuid.UUID) error
}

// Service provides repair attachment operations.
type Service struct {
	repo         Repository
	fileVerifier FileVerifier
}

// NewService creates a new repair attachment service.
func NewService(repo Repository, fileVerifier FileVerifier) *Service {
	return &Service{
		repo:         repo,
		fileVerifier: fileVerifier,
	}
}

// Create links an existing file to a repair log as an attachment.
func (s *Service) Create(
	ctx context.Context,
	repairLogID, workspaceID, fileID uuid.UUID,
	attachmentType attachment.AttachmentType,
	title *string,
) (*RepairAttachment, error) {
	// Verify file exists and belongs to the workspace
	if s.fileVerifier != nil {
		file, err := s.fileVerifier.GetFileByID(ctx, fileID)
		if err != nil {
			if errors.Is(err, shared.ErrNotFound) {
				return nil, ErrFileNotFound
			}
			return nil, err
		}
		if file.WorkspaceID() != workspaceID {
			return nil, ErrFileBelongsToDifferentWorkspace
		}
	}

	ra, err := NewRepairAttachment(repairLogID, workspaceID, fileID, attachmentType, title)
	if err != nil {
		return nil, err
	}

	if err := s.repo.Create(ctx, ra); err != nil {
		return nil, err
	}

	return ra, nil
}

// GetByID retrieves a repair attachment by ID.
func (s *Service) GetByID(ctx context.Context, id, workspaceID uuid.UUID) (*RepairAttachment, error) {
	ra, err := s.repo.GetByID(ctx, id, workspaceID)
	if err != nil {
		if errors.Is(err, shared.ErrNotFound) {
			return nil, ErrRepairAttachmentNotFound
		}
		return nil, err
	}
	return ra, nil
}

// ListByRepairLog retrieves all attachments for a repair log with file metadata.
func (s *Service) ListByRepairLog(ctx context.Context, repairLogID, workspaceID uuid.UUID) ([]*RepairAttachmentWithFile, error) {
	return s.repo.ListByRepairLog(ctx, repairLogID, workspaceID)
}

// Delete removes a repair attachment. Note: this only deletes the junction record,
// not the underlying file. The file can be reused or deleted separately.
func (s *Service) Delete(ctx context.Context, id, workspaceID uuid.UUID) error {
	// Verify attachment exists first
	_, err := s.GetByID(ctx, id, workspaceID)
	if err != nil {
		return err
	}

	return s.repo.Delete(ctx, id, workspaceID)
}
