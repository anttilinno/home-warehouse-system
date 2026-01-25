package repairattachment

import (
	"time"

	"github.com/google/uuid"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/attachment"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

// RepairAttachment represents a file attached to a repair log entry.
type RepairAttachment struct {
	id             uuid.UUID
	repairLogID    uuid.UUID
	workspaceID    uuid.UUID
	fileID         uuid.UUID
	attachmentType attachment.AttachmentType
	title          *string
	createdAt      time.Time
	updatedAt      time.Time
}

// NewRepairAttachment creates a new repair attachment with validation.
func NewRepairAttachment(
	repairLogID, workspaceID, fileID uuid.UUID,
	attachmentType attachment.AttachmentType,
	title *string,
) (*RepairAttachment, error) {
	if err := shared.ValidateUUID(repairLogID, "repair_log_id"); err != nil {
		return nil, err
	}
	if err := shared.ValidateUUID(workspaceID, "workspace_id"); err != nil {
		return nil, err
	}
	if err := shared.ValidateUUID(fileID, "file_id"); err != nil {
		return nil, err
	}
	if !attachmentType.IsValid() {
		return nil, shared.NewFieldError(shared.ErrInvalidInput, "attachment_type", "invalid attachment type")
	}

	now := time.Now()
	return &RepairAttachment{
		id:             shared.NewUUID(),
		repairLogID:    repairLogID,
		workspaceID:    workspaceID,
		fileID:         fileID,
		attachmentType: attachmentType,
		title:          title,
		createdAt:      now,
		updatedAt:      now,
	}, nil
}

// Reconstruct recreates a repair attachment from stored data.
func Reconstruct(
	id, repairLogID, workspaceID, fileID uuid.UUID,
	attachmentType attachment.AttachmentType,
	title *string,
	createdAt, updatedAt time.Time,
) *RepairAttachment {
	return &RepairAttachment{
		id:             id,
		repairLogID:    repairLogID,
		workspaceID:    workspaceID,
		fileID:         fileID,
		attachmentType: attachmentType,
		title:          title,
		createdAt:      createdAt,
		updatedAt:      updatedAt,
	}
}

// Getters
func (a *RepairAttachment) ID() uuid.UUID                        { return a.id }
func (a *RepairAttachment) RepairLogID() uuid.UUID               { return a.repairLogID }
func (a *RepairAttachment) WorkspaceID() uuid.UUID               { return a.workspaceID }
func (a *RepairAttachment) FileID() uuid.UUID                    { return a.fileID }
func (a *RepairAttachment) AttachmentType() attachment.AttachmentType { return a.attachmentType }
func (a *RepairAttachment) Title() *string                       { return a.title }
func (a *RepairAttachment) CreatedAt() time.Time                 { return a.createdAt }
func (a *RepairAttachment) UpdatedAt() time.Time                 { return a.updatedAt }

// RepairAttachmentWithFile includes file metadata for joined queries.
type RepairAttachmentWithFile struct {
	RepairAttachment
	FileName       string
	FileMimeType   *string
	FileSizeBytes  *int64
	FileStorageKey *string
}

// ReconstructWithFile recreates a repair attachment with file metadata from stored data.
func ReconstructWithFile(
	id, repairLogID, workspaceID, fileID uuid.UUID,
	attachmentType attachment.AttachmentType,
	title *string,
	createdAt, updatedAt time.Time,
	fileName string,
	fileMimeType *string,
	fileSizeBytes *int64,
	fileStorageKey *string,
) *RepairAttachmentWithFile {
	return &RepairAttachmentWithFile{
		RepairAttachment: RepairAttachment{
			id:             id,
			repairLogID:    repairLogID,
			workspaceID:    workspaceID,
			fileID:         fileID,
			attachmentType: attachmentType,
			title:          title,
			createdAt:      createdAt,
			updatedAt:      updatedAt,
		},
		FileName:       fileName,
		FileMimeType:   fileMimeType,
		FileSizeBytes:  fileSizeBytes,
		FileStorageKey: fileStorageKey,
	}
}
