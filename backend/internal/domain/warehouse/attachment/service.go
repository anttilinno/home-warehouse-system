package attachment

import (
	"context"

	"github.com/google/uuid"
)

// ServiceInterface defines the attachment service operations.
type ServiceInterface interface {
	UploadFile(ctx context.Context, input UploadFileInput) (*File, error)
	CreateAttachment(ctx context.Context, input CreateAttachmentInput) (*Attachment, error)
	GetAttachment(ctx context.Context, id uuid.UUID) (*Attachment, error)
	ListByItem(ctx context.Context, itemID uuid.UUID) ([]*Attachment, error)
	DeleteAttachment(ctx context.Context, id uuid.UUID) error
	SetPrimary(ctx context.Context, itemID, attachmentID uuid.UUID) error
}

type Service struct {
	fileRepo       FileRepository
	attachmentRepo AttachmentRepository
}

func NewService(fileRepo FileRepository, attachmentRepo AttachmentRepository) *Service {
	return &Service{
		fileRepo:       fileRepo,
		attachmentRepo: attachmentRepo,
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

type CreateAttachmentInput struct {
	ItemID         uuid.UUID
	FileID         *uuid.UUID
	AttachmentType AttachmentType
	Title          *string
	IsPrimary      bool
	DocspellItemID *string
}

func (s *Service) CreateAttachment(ctx context.Context, input CreateAttachmentInput) (*Attachment, error) {
	attachment, err := NewAttachment(
		input.ItemID,
		input.FileID,
		input.AttachmentType,
		input.Title,
		input.IsPrimary,
		input.DocspellItemID,
	)
	if err != nil {
		return nil, err
	}

	if err := s.attachmentRepo.Save(ctx, attachment); err != nil {
		return nil, err
	}

	// If this is marked as primary, update other attachments for the item
	if input.IsPrimary {
		if err := s.attachmentRepo.SetPrimaryForItem(ctx, input.ItemID, attachment.ID()); err != nil {
			return nil, err
		}
	}

	return attachment, nil
}

func (s *Service) GetAttachment(ctx context.Context, id uuid.UUID) (*Attachment, error) {
	attachment, err := s.attachmentRepo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if attachment == nil {
		return nil, ErrAttachmentNotFound
	}
	return attachment, nil
}

func (s *Service) ListByItem(ctx context.Context, itemID uuid.UUID) ([]*Attachment, error) {
	return s.attachmentRepo.FindByItem(ctx, itemID)
}

func (s *Service) DeleteAttachment(ctx context.Context, id uuid.UUID) error {
	attachment, err := s.GetAttachment(ctx, id)
	if err != nil {
		return err
	}

	// Delete the attachment record
	if err := s.attachmentRepo.Delete(ctx, id); err != nil {
		return err
	}

	// If there's an associated file, delete it too
	if attachment.FileID() != nil {
		_ = s.fileRepo.Delete(ctx, *attachment.FileID())
	}

	return nil
}

func (s *Service) SetPrimary(ctx context.Context, itemID, attachmentID uuid.UUID) error {
	// Verify attachment exists and belongs to the item
	attachment, err := s.GetAttachment(ctx, attachmentID)
	if err != nil {
		return err
	}
	if attachment.ItemID() != itemID {
		return ErrAttachmentNotFound
	}

	return s.attachmentRepo.SetPrimaryForItem(ctx, itemID, attachmentID)
}
