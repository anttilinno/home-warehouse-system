package attachment

import (
	"time"

	"github.com/google/uuid"

	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

type AttachmentType string

const (
	TypePhoto    AttachmentType = "PHOTO"
	TypeManual   AttachmentType = "MANUAL"
	TypeReceipt  AttachmentType = "RECEIPT"
	TypeWarranty AttachmentType = "WARRANTY"
	TypeOther    AttachmentType = "OTHER"
)

func (a AttachmentType) IsValid() bool {
	switch a {
	case TypePhoto, TypeManual, TypeReceipt, TypeWarranty, TypeOther:
		return true
	}
	return false
}

type File struct {
	id           uuid.UUID
	workspaceID  uuid.UUID
	originalName string
	extension    string
	mimeType     string
	sizeBytes    int64
	checksum     string
	storageKey   string
	uploadedBy   *uuid.UUID
	createdAt    time.Time
	updatedAt    time.Time
}

func NewFile(
	workspaceID uuid.UUID,
	originalName, extension, mimeType, checksum, storageKey string,
	sizeBytes int64,
	uploadedBy *uuid.UUID,
) (*File, error) {
	if err := shared.ValidateUUID(workspaceID, "workspace_id"); err != nil {
		return nil, err
	}
	if originalName == "" {
		return nil, shared.NewFieldError(shared.ErrInvalidInput, "original_name", "file name is required")
	}
	if storageKey == "" {
		return nil, shared.NewFieldError(shared.ErrInvalidInput, "storage_key", "storage key is required")
	}

	now := time.Now()
	return &File{
		id:           shared.NewUUID(),
		workspaceID:  workspaceID,
		originalName: originalName,
		extension:    extension,
		mimeType:     mimeType,
		sizeBytes:    sizeBytes,
		checksum:     checksum,
		storageKey:   storageKey,
		uploadedBy:   uploadedBy,
		createdAt:    now,
		updatedAt:    now,
	}, nil
}

func ReconstructFile(
	id, workspaceID uuid.UUID,
	originalName, extension, mimeType, checksum, storageKey string,
	sizeBytes int64,
	uploadedBy *uuid.UUID,
	createdAt, updatedAt time.Time,
) *File {
	return &File{
		id:           id,
		workspaceID:  workspaceID,
		originalName: originalName,
		extension:    extension,
		mimeType:     mimeType,
		sizeBytes:    sizeBytes,
		checksum:     checksum,
		storageKey:   storageKey,
		uploadedBy:   uploadedBy,
		createdAt:    createdAt,
		updatedAt:    updatedAt,
	}
}

// File Getters
func (f *File) ID() uuid.UUID          { return f.id }
func (f *File) WorkspaceID() uuid.UUID { return f.workspaceID }
func (f *File) OriginalName() string   { return f.originalName }
func (f *File) Extension() string      { return f.extension }
func (f *File) MimeType() string       { return f.mimeType }
func (f *File) SizeBytes() int64       { return f.sizeBytes }
func (f *File) Checksum() string       { return f.checksum }
func (f *File) StorageKey() string     { return f.storageKey }
func (f *File) UploadedBy() *uuid.UUID { return f.uploadedBy }
func (f *File) CreatedAt() time.Time   { return f.createdAt }
func (f *File) UpdatedAt() time.Time   { return f.updatedAt }

type Attachment struct {
	id             uuid.UUID
	itemID         uuid.UUID
	fileID         *uuid.UUID
	attachmentType AttachmentType
	title          *string
	isPrimary      bool
	docspellItemID *string
	createdAt      time.Time
	updatedAt      time.Time
}

func NewAttachment(
	itemID uuid.UUID,
	fileID *uuid.UUID,
	attachmentType AttachmentType,
	title *string,
	isPrimary bool,
	docspellItemID *string,
) (*Attachment, error) {
	if err := shared.ValidateUUID(itemID, "item_id"); err != nil {
		return nil, err
	}
	if !attachmentType.IsValid() {
		return nil, ErrInvalidAttachmentType
	}

	now := time.Now()
	return &Attachment{
		id:             shared.NewUUID(),
		itemID:         itemID,
		fileID:         fileID,
		attachmentType: attachmentType,
		title:          title,
		isPrimary:      isPrimary,
		docspellItemID: docspellItemID,
		createdAt:      now,
		updatedAt:      now,
	}, nil
}

func ReconstructAttachment(
	id, itemID uuid.UUID,
	fileID *uuid.UUID,
	attachmentType AttachmentType,
	title *string,
	isPrimary bool,
	docspellItemID *string,
	createdAt, updatedAt time.Time,
) *Attachment {
	return &Attachment{
		id:             id,
		itemID:         itemID,
		fileID:         fileID,
		attachmentType: attachmentType,
		title:          title,
		isPrimary:      isPrimary,
		docspellItemID: docspellItemID,
		createdAt:      createdAt,
		updatedAt:      updatedAt,
	}
}

// Attachment Getters
func (a *Attachment) ID() uuid.UUID                { return a.id }
func (a *Attachment) ItemID() uuid.UUID            { return a.itemID }
func (a *Attachment) FileID() *uuid.UUID           { return a.fileID }
func (a *Attachment) AttachmentType() AttachmentType { return a.attachmentType }
func (a *Attachment) Title() *string               { return a.title }
func (a *Attachment) IsPrimary() bool              { return a.isPrimary }
func (a *Attachment) DocspellItemID() *string      { return a.docspellItemID }
func (a *Attachment) CreatedAt() time.Time         { return a.createdAt }
func (a *Attachment) UpdatedAt() time.Time         { return a.updatedAt }

func (a *Attachment) SetPrimary() {
	a.isPrimary = true
	a.updatedAt = time.Now()
}

func (a *Attachment) UnsetPrimary() {
	a.isPrimary = false
	a.updatedAt = time.Now()
}
