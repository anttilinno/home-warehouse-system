package jobs

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/hibiken/asynq"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/antti/home-warehouse/go-backend/internal/infra/imageprocessor"
)

// =============================================================================
// Mock Storage Implementation
// =============================================================================

type mockStorage struct {
	files       map[string][]byte
	saveError   error
	getError    error
	deleteError error
	savedFiles  map[string][]byte
}

func newMockStorage() *mockStorage {
	return &mockStorage{
		files:      make(map[string][]byte),
		savedFiles: make(map[string][]byte),
	}
}

func (m *mockStorage) Save(ctx context.Context, workspaceID, itemID, filename string, reader io.Reader) (string, error) {
	if m.saveError != nil {
		return "", m.saveError
	}
	data, err := io.ReadAll(reader)
	if err != nil {
		return "", err
	}
	path := workspaceID + "/" + itemID + "/" + filename
	m.savedFiles[path] = data
	return path, nil
}

func (m *mockStorage) Get(ctx context.Context, path string) (io.ReadCloser, error) {
	if m.getError != nil {
		return nil, m.getError
	}
	data, ok := m.files[path]
	if !ok {
		return nil, errors.New("file not found")
	}
	return io.NopCloser(bytes.NewReader(data)), nil
}

func (m *mockStorage) Delete(ctx context.Context, path string) error {
	if m.deleteError != nil {
		return m.deleteError
	}
	delete(m.files, path)
	return nil
}

func (m *mockStorage) GetURL(ctx context.Context, path string) (string, error) {
	return "/uploads/" + path, nil
}

func (m *mockStorage) Exists(ctx context.Context, path string) (bool, error) {
	_, ok := m.files[path]
	return ok, nil
}

// =============================================================================
// Mock Image Processor Implementation
// =============================================================================

type mockImageProcessor struct {
	thumbnails map[imageprocessor.ThumbnailSize]string
	genError   error
}

func newMockImageProcessor() *mockImageProcessor {
	return &mockImageProcessor{
		thumbnails: map[imageprocessor.ThumbnailSize]string{
			imageprocessor.ThumbnailSizeSmall:  "/tmp/thumb_small.webp",
			imageprocessor.ThumbnailSizeMedium: "/tmp/thumb_medium.webp",
			imageprocessor.ThumbnailSizeLarge:  "/tmp/thumb_large.webp",
		},
	}
}

func (m *mockImageProcessor) GenerateThumbnail(ctx context.Context, sourcePath, destPath string, maxWidth, maxHeight int) error {
	return nil
}

func (m *mockImageProcessor) GenerateAllThumbnails(ctx context.Context, sourcePath, baseDestPath string) (map[imageprocessor.ThumbnailSize]string, error) {
	if m.genError != nil {
		return nil, m.genError
	}
	return m.thumbnails, nil
}

func (m *mockImageProcessor) GetDimensions(ctx context.Context, path string) (int, int, error) {
	return 800, 600, nil
}

func (m *mockImageProcessor) Optimize(ctx context.Context, sourcePath, destPath string, quality int) error {
	return nil
}

func (m *mockImageProcessor) Validate(ctx context.Context, path string) error {
	return nil
}

// =============================================================================
// ThumbnailPayload Tests
// =============================================================================

func TestThumbnailPayload_JSON_Roundtrip(t *testing.T) {
	photoID := uuid.New()
	workspaceID := uuid.New()
	itemID := uuid.New()

	payload := ThumbnailPayload{
		PhotoID:     photoID,
		WorkspaceID: workspaceID,
		ItemID:      itemID,
		StoragePath: "workspace/item/photo.jpg",
	}

	data, err := json.Marshal(payload)
	require.NoError(t, err)

	var decoded ThumbnailPayload
	err = json.Unmarshal(data, &decoded)
	require.NoError(t, err)

	assert.Equal(t, payload.PhotoID, decoded.PhotoID)
	assert.Equal(t, payload.WorkspaceID, decoded.WorkspaceID)
	assert.Equal(t, payload.ItemID, decoded.ItemID)
	assert.Equal(t, payload.StoragePath, decoded.StoragePath)
}

func TestThumbnailPayload_EmptyStoragePath(t *testing.T) {
	payload := ThumbnailPayload{
		PhotoID:     uuid.New(),
		WorkspaceID: uuid.New(),
		ItemID:      uuid.New(),
		StoragePath: "",
	}

	data, err := json.Marshal(payload)
	require.NoError(t, err)

	var decoded ThumbnailPayload
	err = json.Unmarshal(data, &decoded)
	require.NoError(t, err)

	assert.Empty(t, decoded.StoragePath)
}

func TestThumbnailPayload_LongStoragePath(t *testing.T) {
	longPath := strings.Repeat("a/", 100) + "photo.jpg"

	payload := ThumbnailPayload{
		PhotoID:     uuid.New(),
		WorkspaceID: uuid.New(),
		ItemID:      uuid.New(),
		StoragePath: longPath,
	}

	data, err := json.Marshal(payload)
	require.NoError(t, err)

	var decoded ThumbnailPayload
	err = json.Unmarshal(data, &decoded)
	require.NoError(t, err)

	assert.Equal(t, longPath, decoded.StoragePath)
}

func TestThumbnailPayload_SpecialCharactersInPath(t *testing.T) {
	tests := []struct {
		name string
		path string
	}{
		{"spaces", "workspace/item/photo with spaces.jpg"},
		{"unicode", "workspace/item/foto_cafe.jpg"},
		{"special", "workspace/item/photo-2024_01.jpg"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			payload := ThumbnailPayload{
				PhotoID:     uuid.New(),
				WorkspaceID: uuid.New(),
				ItemID:      uuid.New(),
				StoragePath: tt.path,
			}

			data, err := json.Marshal(payload)
			require.NoError(t, err)

			var decoded ThumbnailPayload
			err = json.Unmarshal(data, &decoded)
			require.NoError(t, err)

			assert.Equal(t, tt.path, decoded.StoragePath)
		})
	}
}

// =============================================================================
// NewThumbnailGenerationTask Tests
// =============================================================================

func TestNewThumbnailGenerationTask_Type(t *testing.T) {
	photoID := uuid.New()
	workspaceID := uuid.New()
	itemID := uuid.New()

	task := NewThumbnailGenerationTask(photoID, workspaceID, itemID, "test/path.jpg")

	assert.NotNil(t, task)
	assert.Equal(t, TypeThumbnailGeneration, task.Type())
}

func TestNewThumbnailGenerationTask_Payload(t *testing.T) {
	photoID := uuid.New()
	workspaceID := uuid.New()
	itemID := uuid.New()
	storagePath := "workspace/item/photo.jpg"

	task := NewThumbnailGenerationTask(photoID, workspaceID, itemID, storagePath)

	var payload ThumbnailPayload
	err := json.Unmarshal(task.Payload(), &payload)
	require.NoError(t, err)

	assert.Equal(t, photoID, payload.PhotoID)
	assert.Equal(t, workspaceID, payload.WorkspaceID)
	assert.Equal(t, itemID, payload.ItemID)
	assert.Equal(t, storagePath, payload.StoragePath)
}

func TestNewThumbnailGenerationTask_MultipleInstances(t *testing.T) {
	task1 := NewThumbnailGenerationTask(uuid.New(), uuid.New(), uuid.New(), "path1.jpg")
	task2 := NewThumbnailGenerationTask(uuid.New(), uuid.New(), uuid.New(), "path2.jpg")

	// Each instance should be independent but same type
	assert.Equal(t, task1.Type(), task2.Type())
	assert.NotEqual(t, task1.Payload(), task2.Payload())
}

// =============================================================================
// ThumbnailProcessor Constructor Tests
// =============================================================================

func TestNewThumbnailProcessor(t *testing.T) {
	processor := NewThumbnailProcessor(nil, nil, nil, nil, "/tmp/uploads")
	assert.NotNil(t, processor)
}

func TestNewThumbnailProcessor_WithDependencies(t *testing.T) {
	storage := newMockStorage()
	imgProcessor := newMockImageProcessor()

	processor := NewThumbnailProcessor(nil, imgProcessor, storage, nil, "/tmp/uploads")
	assert.NotNil(t, processor)
}

func TestNewThumbnailProcessor_EmptyUploadDir(t *testing.T) {
	processor := NewThumbnailProcessor(nil, nil, nil, nil, "")
	assert.NotNil(t, processor)
}

// =============================================================================
// ThumbnailProcessor.ProcessTask Tests - Invalid Payload
// =============================================================================

func TestThumbnailProcessor_ProcessTask_InvalidPayload(t *testing.T) {
	processor := NewThumbnailProcessor(nil, nil, nil, nil, "/tmp")

	tests := []struct {
		name    string
		payload []byte
	}{
		{"empty payload", []byte{}},
		{"invalid json", []byte("not valid json")},
		{"truncated json", []byte(`{"photo_id": "abc`)},
		{"malformed object", []byte(`{photo_id: 123}`)},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			task := asynq.NewTask(TypeThumbnailGeneration, tt.payload)
			err := processor.ProcessTask(context.Background(), task)

			assert.Error(t, err)
			assert.Contains(t, err.Error(), "unmarshal payload")
		})
	}
}

func TestThumbnailProcessor_ProcessTask_InvalidUUID(t *testing.T) {
	processor := NewThumbnailProcessor(nil, nil, nil, nil, "/tmp")

	// Payload with invalid UUID format
	payload := []byte(`{"photo_id": "not-a-valid-uuid"}`)
	task := asynq.NewTask(TypeThumbnailGeneration, payload)
	err := processor.ProcessTask(context.Background(), task)

	assert.Error(t, err)
}

// =============================================================================
// ThumbnailProcessor.ProcessTask Tests - Payload Validation
// =============================================================================
// Note: ProcessTask requires a real database pool for status updates, which
// makes it difficult to unit test without integration tests. The payload
// parsing and constructor tests above cover the testable logic without
// external dependencies. Full ProcessTask testing is covered by integration
// tests in thumbnail_processor_integration_test.go.

func TestThumbnailProcessor_ProcessTask_RequiresValidPayload(t *testing.T) {
	// This test verifies that invalid payloads are caught early
	// before any database operations
	processor := NewThumbnailProcessor(nil, nil, nil, nil, "/tmp")

	// Only test cases where we can verify the error is returned before
	// database operations are attempted (i.e., payload unmarshaling errors)
	tests := []struct {
		name        string
		payload     []byte
		errContains string
	}{
		{
			name:        "empty payload returns error",
			payload:     []byte{},
			errContains: "unmarshal",
		},
		{
			name:        "invalid json returns error",
			payload:     []byte("{{invalid}}"),
			errContains: "unmarshal",
		},
		{
			name:        "array instead of object",
			payload:     []byte("[1,2,3]"),
			errContains: "unmarshal",
		},
		{
			name:        "string instead of object",
			payload:     []byte(`"just a string"`),
			errContains: "unmarshal",
		},
		{
			name:        "number instead of object",
			payload:     []byte("12345"),
			errContains: "unmarshal",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			task := asynq.NewTask(TypeThumbnailGeneration, tt.payload)
			err := processor.ProcessTask(context.Background(), task)

			assert.Error(t, err)
			assert.Contains(t, err.Error(), tt.errContains)
		})
	}
}

// =============================================================================
// Type Constant Tests
// =============================================================================

func TestTypeThumbnailGeneration_Value(t *testing.T) {
	assert.Equal(t, "photo:generate_thumbnails", TypeThumbnailGeneration)
}

func TestTypeThumbnailGeneration_NotEqualToOtherTypes(t *testing.T) {
	assert.NotEqual(t, TypeLoanReminder, TypeThumbnailGeneration)
	assert.NotEqual(t, TypeRepairReminder, TypeThumbnailGeneration)
	assert.NotEqual(t, TypeCleanupDeletedRecords, TypeThumbnailGeneration)
	assert.NotEqual(t, TypeCleanupOldActivity, TypeThumbnailGeneration)
}

// =============================================================================
// ThumbnailPayload Field Tests
// =============================================================================

func TestThumbnailPayload_AllFieldsRequired(t *testing.T) {
	// Test that all fields serialize correctly
	photoID := uuid.New()
	workspaceID := uuid.New()
	itemID := uuid.New()

	payload := ThumbnailPayload{
		PhotoID:     photoID,
		WorkspaceID: workspaceID,
		ItemID:      itemID,
		StoragePath: "path/to/image.jpg",
	}

	data, err := json.Marshal(payload)
	require.NoError(t, err)

	// Check that all fields are present in JSON
	jsonStr := string(data)
	assert.Contains(t, jsonStr, "photo_id")
	assert.Contains(t, jsonStr, "workspace_id")
	assert.Contains(t, jsonStr, "item_id")
	assert.Contains(t, jsonStr, "storage_path")
}

func TestThumbnailPayload_ZeroUUIDs(t *testing.T) {
	payload := ThumbnailPayload{
		PhotoID:     uuid.Nil,
		WorkspaceID: uuid.Nil,
		ItemID:      uuid.Nil,
		StoragePath: "path/to/image.jpg",
	}

	data, err := json.Marshal(payload)
	require.NoError(t, err)

	var decoded ThumbnailPayload
	err = json.Unmarshal(data, &decoded)
	require.NoError(t, err)

	assert.Equal(t, uuid.Nil, decoded.PhotoID)
	assert.Equal(t, uuid.Nil, decoded.WorkspaceID)
	assert.Equal(t, uuid.Nil, decoded.ItemID)
}

func TestThumbnailPayload_DifferentStoragePathFormats(t *testing.T) {
	tests := []struct {
		name string
		path string
	}{
		{"simple", "photo.jpg"},
		{"with_directory", "workspace/item/photo.jpg"},
		{"deep_nested", "a/b/c/d/e/photo.jpg"},
		{"with_extension_webp", "photo.webp"},
		{"with_extension_png", "photo.png"},
		{"uuid_based", "550e8400-e29b-41d4-a716-446655440000/photo.jpg"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			payload := ThumbnailPayload{
				PhotoID:     uuid.New(),
				WorkspaceID: uuid.New(),
				ItemID:      uuid.New(),
				StoragePath: tt.path,
			}

			data, err := json.Marshal(payload)
			require.NoError(t, err)

			var decoded ThumbnailPayload
			err = json.Unmarshal(data, &decoded)
			require.NoError(t, err)

			assert.Equal(t, tt.path, decoded.StoragePath)
		})
	}
}

// =============================================================================
// Mock Storage Additional Tests
// =============================================================================

func TestMockStorage_SaveAndGet(t *testing.T) {
	storage := newMockStorage()
	ctx := context.Background()

	content := []byte("test image content")
	reader := bytes.NewReader(content)

	path, err := storage.Save(ctx, "workspace-1", "item-1", "photo.jpg", reader)
	require.NoError(t, err)
	assert.Equal(t, "workspace-1/item-1/photo.jpg", path)

	// Verify saved data
	assert.Equal(t, content, storage.savedFiles[path])
}

func TestMockStorage_GetError(t *testing.T) {
	storage := newMockStorage()
	storage.getError = errors.New("connection refused")

	_, err := storage.Get(context.Background(), "any/path")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "connection refused")
}

func TestMockStorage_FileNotFound(t *testing.T) {
	storage := newMockStorage()

	_, err := storage.Get(context.Background(), "nonexistent/path")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "not found")
}

// =============================================================================
// Mock Image Processor Additional Tests
// =============================================================================

func TestMockImageProcessor_GenerateAllThumbnails_Success(t *testing.T) {
	processor := newMockImageProcessor()

	paths, err := processor.GenerateAllThumbnails(context.Background(), "/src.jpg", "/dest.webp")
	require.NoError(t, err)

	assert.Len(t, paths, 3)
	assert.Contains(t, paths, imageprocessor.ThumbnailSizeSmall)
	assert.Contains(t, paths, imageprocessor.ThumbnailSizeMedium)
	assert.Contains(t, paths, imageprocessor.ThumbnailSizeLarge)
}

func TestMockImageProcessor_GenerateAllThumbnails_Error(t *testing.T) {
	processor := newMockImageProcessor()
	processor.genError = errors.New("corrupted image")

	paths, err := processor.GenerateAllThumbnails(context.Background(), "/src.jpg", "/dest.webp")
	assert.Error(t, err)
	assert.Nil(t, paths)
	assert.Contains(t, err.Error(), "corrupted image")
}

// =============================================================================
// Concurrent Access Tests
// =============================================================================

func TestThumbnailPayload_ConcurrentMarshal(t *testing.T) {
	payload := ThumbnailPayload{
		PhotoID:     uuid.New(),
		WorkspaceID: uuid.New(),
		ItemID:      uuid.New(),
		StoragePath: "test/path.jpg",
	}

	done := make(chan bool)
	for i := 0; i < 10; i++ {
		go func() {
			data, err := json.Marshal(payload)
			require.NoError(t, err)
			require.NotEmpty(t, data)
			done <- true
		}()
	}

	for i := 0; i < 10; i++ {
		<-done
	}
}

func TestNewThumbnailGenerationTask_Concurrent(t *testing.T) {
	done := make(chan bool)
	for i := 0; i < 10; i++ {
		go func() {
			task := NewThumbnailGenerationTask(uuid.New(), uuid.New(), uuid.New(), "path.jpg")
			require.NotNil(t, task)
			require.Equal(t, TypeThumbnailGeneration, task.Type())
			done <- true
		}()
	}

	for i := 0; i < 10; i++ {
		<-done
	}
}
