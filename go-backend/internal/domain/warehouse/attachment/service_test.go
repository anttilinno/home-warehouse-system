package attachment

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// MockFileRepository is a mock implementation of the FileRepository interface
type MockFileRepository struct {
	mock.Mock
}

func (m *MockFileRepository) Save(ctx context.Context, file *File) error {
	args := m.Called(ctx, file)
	return args.Error(0)
}

func (m *MockFileRepository) FindByID(ctx context.Context, id uuid.UUID) (*File, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*File), args.Error(1)
}

func (m *MockFileRepository) Delete(ctx context.Context, id uuid.UUID) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

// MockAttachmentRepository is a mock implementation of the AttachmentRepository interface
type MockAttachmentRepository struct {
	mock.Mock
}

func (m *MockAttachmentRepository) Save(ctx context.Context, attachment *Attachment) error {
	args := m.Called(ctx, attachment)
	return args.Error(0)
}

func (m *MockAttachmentRepository) FindByID(ctx context.Context, id uuid.UUID) (*Attachment, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*Attachment), args.Error(1)
}

func (m *MockAttachmentRepository) FindByItem(ctx context.Context, itemID uuid.UUID) ([]*Attachment, error) {
	args := m.Called(ctx, itemID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*Attachment), args.Error(1)
}

func (m *MockAttachmentRepository) Delete(ctx context.Context, id uuid.UUID) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockAttachmentRepository) SetPrimaryForItem(ctx context.Context, itemID, attachmentID uuid.UUID) error {
	args := m.Called(ctx, itemID, attachmentID)
	return args.Error(0)
}

// Helper functions
func ptrString(s string) *string {
	return &s
}

func ptrUUID(u uuid.UUID) *uuid.UUID {
	return &u
}

// =============================================================================
// Entity Tests - AttachmentType
// =============================================================================

func TestAttachmentType_IsValid(t *testing.T) {
	tests := []struct {
		testName       string
		attachmentType AttachmentType
		expected       bool
	}{
		{"PHOTO is valid", TypePhoto, true},
		{"MANUAL is valid", TypeManual, true},
		{"RECEIPT is valid", TypeReceipt, true},
		{"WARRANTY is valid", TypeWarranty, true},
		{"OTHER is valid", TypeOther, true},
		{"empty string is invalid", AttachmentType(""), false},
		{"random string is invalid", AttachmentType("RANDOM"), false},
		{"lowercase is invalid", AttachmentType("photo"), false},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			assert.Equal(t, tt.expected, tt.attachmentType.IsValid())
		})
	}
}

// =============================================================================
// Entity Tests - File
// =============================================================================

func TestNewFile(t *testing.T) {
	workspaceID := uuid.New()
	uploadedBy := uuid.New()

	tests := []struct {
		testName     string
		workspaceID  uuid.UUID
		originalName string
		extension    string
		mimeType     string
		checksum     string
		storageKey   string
		sizeBytes    int64
		uploadedBy   *uuid.UUID
		expectError  bool
		errorField   string
	}{
		{
			testName:     "valid file with all fields",
			workspaceID:  workspaceID,
			originalName: "document.pdf",
			extension:    "pdf",
			mimeType:     "application/pdf",
			checksum:     "abc123checksum",
			storageKey:   "files/workspace/document.pdf",
			sizeBytes:    1024000,
			uploadedBy:   &uploadedBy,
			expectError:  false,
		},
		{
			testName:     "valid file without uploadedBy",
			workspaceID:  workspaceID,
			originalName: "image.jpg",
			extension:    "jpg",
			mimeType:     "image/jpeg",
			checksum:     "xyz789checksum",
			storageKey:   "files/workspace/image.jpg",
			sizeBytes:    500000,
			uploadedBy:   nil,
			expectError:  false,
		},
		{
			testName:     "valid file with zero size",
			workspaceID:  workspaceID,
			originalName: "empty.txt",
			extension:    "txt",
			mimeType:     "text/plain",
			checksum:     "emptyfile",
			storageKey:   "files/workspace/empty.txt",
			sizeBytes:    0,
			uploadedBy:   nil,
			expectError:  false,
		},
		{
			testName:     "invalid workspace ID",
			workspaceID:  uuid.Nil,
			originalName: "document.pdf",
			extension:    "pdf",
			mimeType:     "application/pdf",
			checksum:     "abc123",
			storageKey:   "files/doc.pdf",
			sizeBytes:    1024,
			uploadedBy:   nil,
			expectError:  true,
			errorField:   "workspace_id",
		},
		{
			testName:     "empty original name",
			workspaceID:  workspaceID,
			originalName: "",
			extension:    "pdf",
			mimeType:     "application/pdf",
			checksum:     "abc123",
			storageKey:   "files/doc.pdf",
			sizeBytes:    1024,
			uploadedBy:   nil,
			expectError:  true,
			errorField:   "original_name",
		},
		{
			testName:     "empty storage key",
			workspaceID:  workspaceID,
			originalName: "document.pdf",
			extension:    "pdf",
			mimeType:     "application/pdf",
			checksum:     "abc123",
			storageKey:   "",
			sizeBytes:    1024,
			uploadedBy:   nil,
			expectError:  true,
			errorField:   "storage_key",
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			file, err := NewFile(
				tt.workspaceID,
				tt.originalName,
				tt.extension,
				tt.mimeType,
				tt.checksum,
				tt.storageKey,
				tt.sizeBytes,
				tt.uploadedBy,
			)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, file)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, file)
				assert.NotEqual(t, uuid.Nil, file.ID())
				assert.Equal(t, tt.workspaceID, file.WorkspaceID())
				assert.Equal(t, tt.originalName, file.OriginalName())
				assert.Equal(t, tt.extension, file.Extension())
				assert.Equal(t, tt.mimeType, file.MimeType())
				assert.Equal(t, tt.checksum, file.Checksum())
				assert.Equal(t, tt.storageKey, file.StorageKey())
				assert.Equal(t, tt.sizeBytes, file.SizeBytes())
				assert.Equal(t, tt.uploadedBy, file.UploadedBy())
				assert.False(t, file.CreatedAt().IsZero())
				assert.False(t, file.UpdatedAt().IsZero())
			}
		})
	}
}

func TestReconstructFile(t *testing.T) {
	id := uuid.New()
	workspaceID := uuid.New()
	uploadedBy := uuid.New()
	now := time.Now()

	file := ReconstructFile(
		id,
		workspaceID,
		"document.pdf",
		"pdf",
		"application/pdf",
		"abc123checksum",
		"files/workspace/document.pdf",
		2048000,
		&uploadedBy,
		now,
		now,
	)

	assert.Equal(t, id, file.ID())
	assert.Equal(t, workspaceID, file.WorkspaceID())
	assert.Equal(t, "document.pdf", file.OriginalName())
	assert.Equal(t, "pdf", file.Extension())
	assert.Equal(t, "application/pdf", file.MimeType())
	assert.Equal(t, "abc123checksum", file.Checksum())
	assert.Equal(t, "files/workspace/document.pdf", file.StorageKey())
	assert.Equal(t, int64(2048000), file.SizeBytes())
	assert.Equal(t, uploadedBy, *file.UploadedBy())
	assert.Equal(t, now, file.CreatedAt())
	assert.Equal(t, now, file.UpdatedAt())
}

func TestReconstructFile_MinimalFields(t *testing.T) {
	id := uuid.New()
	workspaceID := uuid.New()
	now := time.Now()

	file := ReconstructFile(
		id,
		workspaceID,
		"file.txt",
		"txt",
		"text/plain",
		"",
		"files/file.txt",
		0,
		nil,
		now,
		now,
	)

	assert.Equal(t, id, file.ID())
	assert.Empty(t, file.Checksum())
	assert.Equal(t, int64(0), file.SizeBytes())
	assert.Nil(t, file.UploadedBy())
}

// =============================================================================
// Entity Tests - Attachment
// =============================================================================

func TestNewAttachment(t *testing.T) {
	itemID := uuid.New()
	fileID := uuid.New()

	tests := []struct {
		testName       string
		itemID         uuid.UUID
		fileID         *uuid.UUID
		attachmentType AttachmentType
		title          *string
		isPrimary      bool
		docspellItemID *string
		expectError    bool
		errorType      error
	}{
		{
			testName:       "valid attachment with all fields",
			itemID:         itemID,
			fileID:         &fileID,
			attachmentType: TypePhoto,
			title:          ptrString("Product Photo"),
			isPrimary:      true,
			docspellItemID: ptrString("docspell-123"),
			expectError:    false,
		},
		{
			testName:       "valid attachment without file",
			itemID:         itemID,
			fileID:         nil,
			attachmentType: TypeManual,
			title:          ptrString("User Manual"),
			isPrimary:      false,
			docspellItemID: nil,
			expectError:    false,
		},
		{
			testName:       "valid attachment with minimal fields",
			itemID:         itemID,
			fileID:         nil,
			attachmentType: TypeOther,
			title:          nil,
			isPrimary:      false,
			docspellItemID: nil,
			expectError:    false,
		},
		{
			testName:       "all attachment types - receipt",
			itemID:         itemID,
			fileID:         &fileID,
			attachmentType: TypeReceipt,
			title:          ptrString("Purchase Receipt"),
			isPrimary:      false,
			docspellItemID: nil,
			expectError:    false,
		},
		{
			testName:       "all attachment types - warranty",
			itemID:         itemID,
			fileID:         &fileID,
			attachmentType: TypeWarranty,
			title:          ptrString("Warranty Certificate"),
			isPrimary:      false,
			docspellItemID: nil,
			expectError:    false,
		},
		{
			testName:       "invalid item ID",
			itemID:         uuid.Nil,
			fileID:         &fileID,
			attachmentType: TypePhoto,
			title:          nil,
			isPrimary:      false,
			docspellItemID: nil,
			expectError:    true,
		},
		{
			testName:       "invalid attachment type",
			itemID:         itemID,
			fileID:         &fileID,
			attachmentType: AttachmentType("INVALID"),
			title:          nil,
			isPrimary:      false,
			docspellItemID: nil,
			expectError:    true,
			errorType:      ErrInvalidAttachmentType,
		},
		{
			testName:       "empty attachment type",
			itemID:         itemID,
			fileID:         &fileID,
			attachmentType: AttachmentType(""),
			title:          nil,
			isPrimary:      false,
			docspellItemID: nil,
			expectError:    true,
			errorType:      ErrInvalidAttachmentType,
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			attachment, err := NewAttachment(
				tt.itemID,
				tt.fileID,
				tt.attachmentType,
				tt.title,
				tt.isPrimary,
				tt.docspellItemID,
			)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, attachment)
				if tt.errorType != nil {
					assert.Equal(t, tt.errorType, err)
				}
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, attachment)
				assert.NotEqual(t, uuid.Nil, attachment.ID())
				assert.Equal(t, tt.itemID, attachment.ItemID())
				assert.Equal(t, tt.fileID, attachment.FileID())
				assert.Equal(t, tt.attachmentType, attachment.AttachmentType())
				assert.Equal(t, tt.title, attachment.Title())
				assert.Equal(t, tt.isPrimary, attachment.IsPrimary())
				assert.Equal(t, tt.docspellItemID, attachment.DocspellItemID())
				assert.False(t, attachment.CreatedAt().IsZero())
				assert.False(t, attachment.UpdatedAt().IsZero())
			}
		})
	}
}

func TestReconstructAttachment(t *testing.T) {
	id := uuid.New()
	itemID := uuid.New()
	fileID := uuid.New()
	now := time.Now()

	attachment := ReconstructAttachment(
		id,
		itemID,
		&fileID,
		TypePhoto,
		ptrString("Main Photo"),
		true,
		ptrString("docspell-abc"),
		now,
		now,
	)

	assert.Equal(t, id, attachment.ID())
	assert.Equal(t, itemID, attachment.ItemID())
	assert.Equal(t, fileID, *attachment.FileID())
	assert.Equal(t, TypePhoto, attachment.AttachmentType())
	assert.Equal(t, "Main Photo", *attachment.Title())
	assert.True(t, attachment.IsPrimary())
	assert.Equal(t, "docspell-abc", *attachment.DocspellItemID())
	assert.Equal(t, now, attachment.CreatedAt())
	assert.Equal(t, now, attachment.UpdatedAt())
}

func TestAttachment_SetPrimary(t *testing.T) {
	itemID := uuid.New()
	attachment, _ := NewAttachment(itemID, nil, TypePhoto, nil, false, nil)
	assert.False(t, attachment.IsPrimary())
	originalUpdatedAt := attachment.UpdatedAt()
	time.Sleep(time.Millisecond)

	attachment.SetPrimary()

	assert.True(t, attachment.IsPrimary())
	assert.True(t, attachment.UpdatedAt().After(originalUpdatedAt))
}

func TestAttachment_UnsetPrimary(t *testing.T) {
	itemID := uuid.New()
	attachment, _ := NewAttachment(itemID, nil, TypePhoto, nil, true, nil)
	assert.True(t, attachment.IsPrimary())
	originalUpdatedAt := attachment.UpdatedAt()
	time.Sleep(time.Millisecond)

	attachment.UnsetPrimary()

	assert.False(t, attachment.IsPrimary())
	assert.True(t, attachment.UpdatedAt().After(originalUpdatedAt))
}

// =============================================================================
// Service Tests
// =============================================================================

func TestService_UploadFile(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	uploadedBy := uuid.New()

	tests := []struct {
		testName    string
		input       UploadFileInput
		setupMock   func(*MockFileRepository)
		expectError bool
	}{
		{
			testName: "successful upload",
			input: UploadFileInput{
				WorkspaceID:  workspaceID,
				OriginalName: "document.pdf",
				Extension:    "pdf",
				MimeType:     "application/pdf",
				SizeBytes:    1024000,
				Checksum:     "abc123",
				StorageKey:   "files/document.pdf",
				UploadedBy:   &uploadedBy,
			},
			setupMock: func(m *MockFileRepository) {
				m.On("Save", ctx, mock.AnythingOfType("*attachment.File")).Return(nil)
			},
			expectError: false,
		},
		{
			testName: "successful upload without uploader",
			input: UploadFileInput{
				WorkspaceID:  workspaceID,
				OriginalName: "image.jpg",
				Extension:    "jpg",
				MimeType:     "image/jpeg",
				SizeBytes:    500000,
				Checksum:     "xyz789",
				StorageKey:   "files/image.jpg",
				UploadedBy:   nil,
			},
			setupMock: func(m *MockFileRepository) {
				m.On("Save", ctx, mock.AnythingOfType("*attachment.File")).Return(nil)
			},
			expectError: false,
		},
		{
			testName: "invalid workspace ID",
			input: UploadFileInput{
				WorkspaceID:  uuid.Nil,
				OriginalName: "document.pdf",
				Extension:    "pdf",
				MimeType:     "application/pdf",
				SizeBytes:    1024,
				Checksum:     "abc123",
				StorageKey:   "files/document.pdf",
			},
			setupMock:   func(m *MockFileRepository) {},
			expectError: true,
		},
		{
			testName: "empty original name",
			input: UploadFileInput{
				WorkspaceID:  workspaceID,
				OriginalName: "",
				Extension:    "pdf",
				MimeType:     "application/pdf",
				SizeBytes:    1024,
				Checksum:     "abc123",
				StorageKey:   "files/document.pdf",
			},
			setupMock:   func(m *MockFileRepository) {},
			expectError: true,
		},
		{
			testName: "save returns error",
			input: UploadFileInput{
				WorkspaceID:  workspaceID,
				OriginalName: "document.pdf",
				Extension:    "pdf",
				MimeType:     "application/pdf",
				SizeBytes:    1024,
				Checksum:     "abc123",
				StorageKey:   "files/document.pdf",
			},
			setupMock: func(m *MockFileRepository) {
				m.On("Save", ctx, mock.AnythingOfType("*attachment.File")).Return(errors.New("save error"))
			},
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			mockFileRepo := new(MockFileRepository)
			mockAttachmentRepo := new(MockAttachmentRepository)
			svc := NewService(mockFileRepo, mockAttachmentRepo)

			tt.setupMock(mockFileRepo)

			file, err := svc.UploadFile(ctx, tt.input)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, file)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, file)
				assert.Equal(t, tt.input.WorkspaceID, file.WorkspaceID())
				assert.Equal(t, tt.input.OriginalName, file.OriginalName())
				assert.Equal(t, tt.input.Extension, file.Extension())
				assert.Equal(t, tt.input.MimeType, file.MimeType())
				assert.Equal(t, tt.input.SizeBytes, file.SizeBytes())
				assert.Equal(t, tt.input.Checksum, file.Checksum())
				assert.Equal(t, tt.input.StorageKey, file.StorageKey())
			}

			mockFileRepo.AssertExpectations(t)
		})
	}
}

func TestService_CreateAttachment(t *testing.T) {
	ctx := context.Background()
	itemID := uuid.New()
	fileID := uuid.New()

	tests := []struct {
		testName    string
		input       CreateAttachmentInput
		setupMock   func(*MockAttachmentRepository)
		expectError bool
		errorType   error
	}{
		{
			testName: "successful creation",
			input: CreateAttachmentInput{
				ItemID:         itemID,
				FileID:         &fileID,
				AttachmentType: TypePhoto,
				Title:          ptrString("Product Photo"),
				IsPrimary:      false,
				DocspellItemID: nil,
			},
			setupMock: func(m *MockAttachmentRepository) {
				m.On("Save", ctx, mock.AnythingOfType("*attachment.Attachment")).Return(nil)
			},
			expectError: false,
		},
		{
			testName: "successful creation with primary",
			input: CreateAttachmentInput{
				ItemID:         itemID,
				FileID:         &fileID,
				AttachmentType: TypePhoto,
				Title:          ptrString("Main Photo"),
				IsPrimary:      true,
				DocspellItemID: nil,
			},
			setupMock: func(m *MockAttachmentRepository) {
				m.On("Save", ctx, mock.AnythingOfType("*attachment.Attachment")).Return(nil)
				m.On("SetPrimaryForItem", ctx, itemID, mock.AnythingOfType("uuid.UUID")).Return(nil)
			},
			expectError: false,
		},
		{
			testName: "successful creation without file",
			input: CreateAttachmentInput{
				ItemID:         itemID,
				FileID:         nil,
				AttachmentType: TypeManual,
				Title:          ptrString("External Manual Link"),
				IsPrimary:      false,
				DocspellItemID: ptrString("docspell-123"),
			},
			setupMock: func(m *MockAttachmentRepository) {
				m.On("Save", ctx, mock.AnythingOfType("*attachment.Attachment")).Return(nil)
			},
			expectError: false,
		},
		{
			testName: "invalid item ID",
			input: CreateAttachmentInput{
				ItemID:         uuid.Nil,
				FileID:         &fileID,
				AttachmentType: TypePhoto,
				Title:          nil,
				IsPrimary:      false,
			},
			setupMock:   func(m *MockAttachmentRepository) {},
			expectError: true,
		},
		{
			testName: "invalid attachment type",
			input: CreateAttachmentInput{
				ItemID:         itemID,
				FileID:         &fileID,
				AttachmentType: AttachmentType("INVALID"),
				Title:          nil,
				IsPrimary:      false,
			},
			setupMock:   func(m *MockAttachmentRepository) {},
			expectError: true,
			errorType:   ErrInvalidAttachmentType,
		},
		{
			testName: "save returns error",
			input: CreateAttachmentInput{
				ItemID:         itemID,
				FileID:         &fileID,
				AttachmentType: TypePhoto,
				Title:          nil,
				IsPrimary:      false,
			},
			setupMock: func(m *MockAttachmentRepository) {
				m.On("Save", ctx, mock.AnythingOfType("*attachment.Attachment")).Return(errors.New("save error"))
			},
			expectError: true,
		},
		{
			testName: "set primary returns error",
			input: CreateAttachmentInput{
				ItemID:         itemID,
				FileID:         &fileID,
				AttachmentType: TypePhoto,
				Title:          nil,
				IsPrimary:      true,
			},
			setupMock: func(m *MockAttachmentRepository) {
				m.On("Save", ctx, mock.AnythingOfType("*attachment.Attachment")).Return(nil)
				m.On("SetPrimaryForItem", ctx, itemID, mock.AnythingOfType("uuid.UUID")).Return(errors.New("set primary error"))
			},
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			mockFileRepo := new(MockFileRepository)
			mockAttachmentRepo := new(MockAttachmentRepository)
			svc := NewService(mockFileRepo, mockAttachmentRepo)

			tt.setupMock(mockAttachmentRepo)

			attachment, err := svc.CreateAttachment(ctx, tt.input)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, attachment)
				if tt.errorType != nil {
					assert.Equal(t, tt.errorType, err)
				}
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, attachment)
				assert.Equal(t, tt.input.ItemID, attachment.ItemID())
				assert.Equal(t, tt.input.FileID, attachment.FileID())
				assert.Equal(t, tt.input.AttachmentType, attachment.AttachmentType())
				assert.Equal(t, tt.input.Title, attachment.Title())
			}

			mockAttachmentRepo.AssertExpectations(t)
		})
	}
}

func TestService_GetAttachment(t *testing.T) {
	ctx := context.Background()
	attachmentID := uuid.New()
	itemID := uuid.New()

	tests := []struct {
		testName    string
		attachID    uuid.UUID
		setupMock   func(*MockAttachmentRepository)
		expectError bool
		errorType   error
	}{
		{
			testName: "attachment found",
			attachID: attachmentID,
			setupMock: func(m *MockAttachmentRepository) {
				attachment := &Attachment{id: attachmentID, itemID: itemID, attachmentType: TypePhoto}
				m.On("FindByID", ctx, attachmentID).Return(attachment, nil)
			},
			expectError: false,
		},
		{
			testName: "attachment not found - returns nil",
			attachID: attachmentID,
			setupMock: func(m *MockAttachmentRepository) {
				m.On("FindByID", ctx, attachmentID).Return(nil, nil)
			},
			expectError: true,
			errorType:   ErrAttachmentNotFound,
		},
		{
			testName: "repository returns error",
			attachID: attachmentID,
			setupMock: func(m *MockAttachmentRepository) {
				m.On("FindByID", ctx, attachmentID).Return(nil, errors.New("database error"))
			},
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			mockFileRepo := new(MockFileRepository)
			mockAttachmentRepo := new(MockAttachmentRepository)
			svc := NewService(mockFileRepo, mockAttachmentRepo)

			tt.setupMock(mockAttachmentRepo)

			attachment, err := svc.GetAttachment(ctx, tt.attachID)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, attachment)
				if tt.errorType != nil {
					assert.Equal(t, tt.errorType, err)
				}
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, attachment)
				assert.Equal(t, tt.attachID, attachment.ID())
			}

			mockAttachmentRepo.AssertExpectations(t)
		})
	}
}

func TestService_ListByItem(t *testing.T) {
	ctx := context.Background()
	itemID := uuid.New()

	tests := []struct {
		testName    string
		itemID      uuid.UUID
		setupMock   func(*MockAttachmentRepository)
		expectLen   int
		expectError bool
	}{
		{
			testName: "list with results",
			itemID:   itemID,
			setupMock: func(m *MockAttachmentRepository) {
				attachments := []*Attachment{
					{id: uuid.New(), itemID: itemID, attachmentType: TypePhoto},
					{id: uuid.New(), itemID: itemID, attachmentType: TypeManual},
					{id: uuid.New(), itemID: itemID, attachmentType: TypeReceipt},
				}
				m.On("FindByItem", ctx, itemID).Return(attachments, nil)
			},
			expectLen:   3,
			expectError: false,
		},
		{
			testName: "empty results",
			itemID:   itemID,
			setupMock: func(m *MockAttachmentRepository) {
				m.On("FindByItem", ctx, itemID).Return([]*Attachment{}, nil)
			},
			expectLen:   0,
			expectError: false,
		},
		{
			testName: "repository returns error",
			itemID:   itemID,
			setupMock: func(m *MockAttachmentRepository) {
				m.On("FindByItem", ctx, itemID).Return(nil, errors.New("database error"))
			},
			expectLen:   0,
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			mockFileRepo := new(MockFileRepository)
			mockAttachmentRepo := new(MockAttachmentRepository)
			svc := NewService(mockFileRepo, mockAttachmentRepo)

			tt.setupMock(mockAttachmentRepo)

			attachments, err := svc.ListByItem(ctx, tt.itemID)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, attachments)
			} else {
				assert.NoError(t, err)
				assert.Len(t, attachments, tt.expectLen)
			}

			mockAttachmentRepo.AssertExpectations(t)
		})
	}
}

func TestService_DeleteAttachment(t *testing.T) {
	ctx := context.Background()
	attachmentID := uuid.New()
	itemID := uuid.New()
	fileID := uuid.New()

	tests := []struct {
		testName    string
		attachID    uuid.UUID
		setupMock   func(*MockAttachmentRepository, *MockFileRepository)
		expectError bool
		errorType   error
	}{
		{
			testName: "successful delete with file",
			attachID: attachmentID,
			setupMock: func(aRepo *MockAttachmentRepository, fRepo *MockFileRepository) {
				attachment := &Attachment{id: attachmentID, itemID: itemID, fileID: &fileID, attachmentType: TypePhoto}
				aRepo.On("FindByID", ctx, attachmentID).Return(attachment, nil)
				aRepo.On("Delete", ctx, attachmentID).Return(nil)
				fRepo.On("Delete", ctx, fileID).Return(nil)
			},
			expectError: false,
		},
		{
			testName: "successful delete without file",
			attachID: attachmentID,
			setupMock: func(aRepo *MockAttachmentRepository, fRepo *MockFileRepository) {
				attachment := &Attachment{id: attachmentID, itemID: itemID, fileID: nil, attachmentType: TypeOther}
				aRepo.On("FindByID", ctx, attachmentID).Return(attachment, nil)
				aRepo.On("Delete", ctx, attachmentID).Return(nil)
			},
			expectError: false,
		},
		{
			testName: "attachment not found",
			attachID: uuid.New(),
			setupMock: func(aRepo *MockAttachmentRepository, fRepo *MockFileRepository) {
				aRepo.On("FindByID", ctx, mock.Anything).Return(nil, nil)
			},
			expectError: true,
			errorType:   ErrAttachmentNotFound,
		},
		{
			testName: "delete returns error",
			attachID: attachmentID,
			setupMock: func(aRepo *MockAttachmentRepository, fRepo *MockFileRepository) {
				attachment := &Attachment{id: attachmentID, itemID: itemID, fileID: nil, attachmentType: TypePhoto}
				aRepo.On("FindByID", ctx, attachmentID).Return(attachment, nil)
				aRepo.On("Delete", ctx, attachmentID).Return(errors.New("delete error"))
			},
			expectError: true,
		},
		{
			testName: "file delete error is ignored",
			attachID: attachmentID,
			setupMock: func(aRepo *MockAttachmentRepository, fRepo *MockFileRepository) {
				attachment := &Attachment{id: attachmentID, itemID: itemID, fileID: &fileID, attachmentType: TypePhoto}
				aRepo.On("FindByID", ctx, attachmentID).Return(attachment, nil)
				aRepo.On("Delete", ctx, attachmentID).Return(nil)
				fRepo.On("Delete", ctx, fileID).Return(errors.New("file delete error"))
			},
			expectError: false, // File delete error is ignored
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			mockFileRepo := new(MockFileRepository)
			mockAttachmentRepo := new(MockAttachmentRepository)
			svc := NewService(mockFileRepo, mockAttachmentRepo)

			tt.setupMock(mockAttachmentRepo, mockFileRepo)

			err := svc.DeleteAttachment(ctx, tt.attachID)

			if tt.expectError {
				assert.Error(t, err)
				if tt.errorType != nil {
					assert.Equal(t, tt.errorType, err)
				}
			} else {
				assert.NoError(t, err)
			}

			mockAttachmentRepo.AssertExpectations(t)
			mockFileRepo.AssertExpectations(t)
		})
	}
}

func TestService_SetPrimary(t *testing.T) {
	ctx := context.Background()
	itemID := uuid.New()
	attachmentID := uuid.New()
	differentItemID := uuid.New()

	tests := []struct {
		testName     string
		itemID       uuid.UUID
		attachmentID uuid.UUID
		setupMock    func(*MockAttachmentRepository)
		expectError  bool
		errorType    error
	}{
		{
			testName:     "successful set primary",
			itemID:       itemID,
			attachmentID: attachmentID,
			setupMock: func(m *MockAttachmentRepository) {
				attachment := &Attachment{id: attachmentID, itemID: itemID, attachmentType: TypePhoto}
				m.On("FindByID", ctx, attachmentID).Return(attachment, nil)
				m.On("SetPrimaryForItem", ctx, itemID, attachmentID).Return(nil)
			},
			expectError: false,
		},
		{
			testName:     "attachment not found",
			itemID:       itemID,
			attachmentID: uuid.New(),
			setupMock: func(m *MockAttachmentRepository) {
				m.On("FindByID", ctx, mock.Anything).Return(nil, nil)
			},
			expectError: true,
			errorType:   ErrAttachmentNotFound,
		},
		{
			testName:     "attachment belongs to different item",
			itemID:       itemID,
			attachmentID: attachmentID,
			setupMock: func(m *MockAttachmentRepository) {
				attachment := &Attachment{id: attachmentID, itemID: differentItemID, attachmentType: TypePhoto}
				m.On("FindByID", ctx, attachmentID).Return(attachment, nil)
			},
			expectError: true,
			errorType:   ErrAttachmentNotFound,
		},
		{
			testName:     "set primary returns error",
			itemID:       itemID,
			attachmentID: attachmentID,
			setupMock: func(m *MockAttachmentRepository) {
				attachment := &Attachment{id: attachmentID, itemID: itemID, attachmentType: TypePhoto}
				m.On("FindByID", ctx, attachmentID).Return(attachment, nil)
				m.On("SetPrimaryForItem", ctx, itemID, attachmentID).Return(errors.New("database error"))
			},
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			mockFileRepo := new(MockFileRepository)
			mockAttachmentRepo := new(MockAttachmentRepository)
			svc := NewService(mockFileRepo, mockAttachmentRepo)

			tt.setupMock(mockAttachmentRepo)

			err := svc.SetPrimary(ctx, tt.itemID, tt.attachmentID)

			if tt.expectError {
				assert.Error(t, err)
				if tt.errorType != nil {
					assert.Equal(t, tt.errorType, err)
				}
			} else {
				assert.NoError(t, err)
			}

			mockAttachmentRepo.AssertExpectations(t)
		})
	}
}
