package storage

import (
	"bytes"
	"context"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestNewLocalStorage(t *testing.T) {
	t.Run("creates storage with valid directory", func(t *testing.T) {
		tempDir := t.TempDir()
		storage, err := NewLocalStorage(tempDir)
		if err != nil {
			t.Fatalf("expected no error, got %v", err)
		}
		if storage == nil {
			t.Fatal("expected storage instance, got nil")
		}
		if storage.baseDir != tempDir {
			t.Errorf("expected baseDir %s, got %s", tempDir, storage.baseDir)
		}
	})

	t.Run("creates directory if it doesn't exist", func(t *testing.T) {
		tempDir := t.TempDir()
		newDir := filepath.Join(tempDir, "new", "nested", "dir")

		storage, err := NewLocalStorage(newDir)
		if err != nil {
			t.Fatalf("expected no error, got %v", err)
		}
		if storage == nil {
			t.Fatal("expected storage instance, got nil")
		}

		info, err := os.Stat(newDir)
		if err != nil {
			t.Fatalf("directory not created: %v", err)
		}
		if !info.IsDir() {
			t.Error("expected directory, got file")
		}
	})

	t.Run("returns error for empty base directory", func(t *testing.T) {
		_, err := NewLocalStorage("")
		if err == nil {
			t.Fatal("expected error for empty base directory")
		}
	})
}

func TestLocalStorage_Save(t *testing.T) {
	tempDir := t.TempDir()
	storage, err := NewLocalStorage(tempDir)
	if err != nil {
		t.Fatalf("failed to create storage: %v", err)
	}

	ctx := context.Background()

	t.Run("saves file successfully", func(t *testing.T) {
		content := []byte("test content")
		reader := bytes.NewReader(content)

		path, err := storage.Save(ctx, "workspace-123", "item-456", "test.jpg", reader)
		if err != nil {
			t.Fatalf("expected no error, got %v", err)
		}

		if path == "" {
			t.Fatal("expected non-empty path")
		}

		// Verify file exists and has correct content
		fullPath := filepath.Join(tempDir, path)
		savedContent, err := os.ReadFile(fullPath)
		if err != nil {
			t.Fatalf("failed to read saved file: %v", err)
		}
		if !bytes.Equal(savedContent, content) {
			t.Errorf("content mismatch: expected %s, got %s", content, savedContent)
		}
	})

	t.Run("creates unique filenames", func(t *testing.T) {
		content := []byte("test content")

		path1, err := storage.Save(ctx, "workspace-123", "item-456", "test.jpg", bytes.NewReader(content))
		if err != nil {
			t.Fatalf("failed to save first file: %v", err)
		}

		path2, err := storage.Save(ctx, "workspace-123", "item-456", "test.jpg", bytes.NewReader(content))
		if err != nil {
			t.Fatalf("failed to save second file: %v", err)
		}

		if path1 == path2 {
			t.Error("expected different paths for same filename")
		}
	})

	t.Run("sanitizes unsafe filenames", func(t *testing.T) {
		content := []byte("test content")
		unsafeFilename := "../../../etc/passwd"

		path, err := storage.Save(ctx, "workspace-123", "item-456", unsafeFilename, bytes.NewReader(content))
		if err != nil {
			t.Fatalf("expected no error, got %v", err)
		}

		// Verify path doesn't contain path traversal
		if strings.Contains(path, "..") {
			t.Errorf("path contains path traversal: %s", path)
		}

		// Verify file is within workspace/item directory
		if !strings.HasPrefix(path, "workspace-123/item-456/") {
			t.Errorf("path not in expected directory: %s", path)
		}
	})

	t.Run("returns error for missing workspace ID", func(t *testing.T) {
		content := []byte("test content")
		_, err := storage.Save(ctx, "", "item-456", "test.jpg", bytes.NewReader(content))
		if err == nil {
			t.Fatal("expected error for missing workspace ID")
		}
	})

	t.Run("returns error for missing item ID", func(t *testing.T) {
		content := []byte("test content")
		_, err := storage.Save(ctx, "workspace-123", "", "test.jpg", bytes.NewReader(content))
		if err == nil {
			t.Fatal("expected error for missing item ID")
		}
	})

	t.Run("returns error for missing filename", func(t *testing.T) {
		content := []byte("test content")
		_, err := storage.Save(ctx, "workspace-123", "item-456", "", bytes.NewReader(content))
		if err == nil {
			t.Fatal("expected error for missing filename")
		}
	})
}

func TestLocalStorage_Get(t *testing.T) {
	tempDir := t.TempDir()
	storage, err := NewLocalStorage(tempDir)
	if err != nil {
		t.Fatalf("failed to create storage: %v", err)
	}

	ctx := context.Background()

	t.Run("retrieves existing file", func(t *testing.T) {
		content := []byte("test content")
		path, err := storage.Save(ctx, "workspace-123", "item-456", "test.jpg", bytes.NewReader(content))
		if err != nil {
			t.Fatalf("failed to save file: %v", err)
		}

		reader, err := storage.Get(ctx, path)
		if err != nil {
			t.Fatalf("expected no error, got %v", err)
		}
		defer reader.Close()

		retrievedContent, err := io.ReadAll(reader)
		if err != nil {
			t.Fatalf("failed to read content: %v", err)
		}

		if !bytes.Equal(retrievedContent, content) {
			t.Errorf("content mismatch: expected %s, got %s", content, retrievedContent)
		}
	})

	t.Run("returns error for non-existent file", func(t *testing.T) {
		_, err := storage.Get(ctx, "workspace-123/item-456/nonexistent.jpg")
		if err != ErrFileNotFound {
			t.Errorf("expected ErrFileNotFound, got %v", err)
		}
	})

	t.Run("returns error for path traversal", func(t *testing.T) {
		_, err := storage.Get(ctx, "../../../etc/passwd")
		if err != ErrInvalidPath {
			t.Errorf("expected ErrInvalidPath, got %v", err)
		}
	})

	t.Run("returns error for absolute path", func(t *testing.T) {
		_, err := storage.Get(ctx, "/etc/passwd")
		if err != ErrInvalidPath {
			t.Errorf("expected ErrInvalidPath, got %v", err)
		}
	})
}

func TestLocalStorage_Delete(t *testing.T) {
	tempDir := t.TempDir()
	storage, err := NewLocalStorage(tempDir)
	if err != nil {
		t.Fatalf("failed to create storage: %v", err)
	}

	ctx := context.Background()

	t.Run("deletes existing file", func(t *testing.T) {
		content := []byte("test content")
		path, err := storage.Save(ctx, "workspace-123", "item-456", "test.jpg", bytes.NewReader(content))
		if err != nil {
			t.Fatalf("failed to save file: %v", err)
		}

		err = storage.Delete(ctx, path)
		if err != nil {
			t.Fatalf("expected no error, got %v", err)
		}

		// Verify file no longer exists
		exists, err := storage.Exists(ctx, path)
		if err != nil {
			t.Fatalf("failed to check existence: %v", err)
		}
		if exists {
			t.Error("file still exists after deletion")
		}
	})

	t.Run("returns error for non-existent file", func(t *testing.T) {
		err := storage.Delete(ctx, "workspace-123/item-456/nonexistent.jpg")
		if err != ErrFileNotFound {
			t.Errorf("expected ErrFileNotFound, got %v", err)
		}
	})

	t.Run("returns error for path traversal", func(t *testing.T) {
		err := storage.Delete(ctx, "../../../etc/passwd")
		if err != ErrInvalidPath {
			t.Errorf("expected ErrInvalidPath, got %v", err)
		}
	})
}

func TestLocalStorage_GetURL(t *testing.T) {
	tempDir := t.TempDir()
	storage, err := NewLocalStorage(tempDir)
	if err != nil {
		t.Fatalf("failed to create storage: %v", err)
	}

	ctx := context.Background()

	t.Run("returns URL for existing file", func(t *testing.T) {
		content := []byte("test content")
		path, err := storage.Save(ctx, "workspace-123", "item-456", "test.jpg", bytes.NewReader(content))
		if err != nil {
			t.Fatalf("failed to save file: %v", err)
		}

		url, err := storage.GetURL(ctx, path)
		if err != nil {
			t.Fatalf("expected no error, got %v", err)
		}

		expectedPrefix := "/uploads/photos/"
		if !strings.HasPrefix(url, expectedPrefix) {
			t.Errorf("expected URL to start with %s, got %s", expectedPrefix, url)
		}

		if !strings.Contains(url, path) {
			t.Errorf("expected URL to contain path %s, got %s", path, url)
		}
	})

	t.Run("returns error for non-existent file", func(t *testing.T) {
		_, err := storage.GetURL(ctx, "workspace-123/item-456/nonexistent.jpg")
		if err != ErrFileNotFound {
			t.Errorf("expected ErrFileNotFound, got %v", err)
		}
	})

	t.Run("returns error for invalid path", func(t *testing.T) {
		_, err := storage.GetURL(ctx, "../../../etc/passwd")
		if err != ErrInvalidPath {
			t.Errorf("expected ErrInvalidPath, got %v", err)
		}
	})
}

func TestLocalStorage_Exists(t *testing.T) {
	tempDir := t.TempDir()
	storage, err := NewLocalStorage(tempDir)
	if err != nil {
		t.Fatalf("failed to create storage: %v", err)
	}

	ctx := context.Background()

	t.Run("returns true for existing file", func(t *testing.T) {
		content := []byte("test content")
		path, err := storage.Save(ctx, "workspace-123", "item-456", "test.jpg", bytes.NewReader(content))
		if err != nil {
			t.Fatalf("failed to save file: %v", err)
		}

		exists, err := storage.Exists(ctx, path)
		if err != nil {
			t.Fatalf("expected no error, got %v", err)
		}
		if !exists {
			t.Error("expected file to exist")
		}
	})

	t.Run("returns false for non-existent file", func(t *testing.T) {
		exists, err := storage.Exists(ctx, "workspace-123/item-456/nonexistent.jpg")
		if err != nil {
			t.Fatalf("expected no error, got %v", err)
		}
		if exists {
			t.Error("expected file to not exist")
		}
	})

	t.Run("returns error for invalid path", func(t *testing.T) {
		_, err := storage.Exists(ctx, "../../../etc/passwd")
		if err != ErrInvalidPath {
			t.Errorf("expected ErrInvalidPath, got %v", err)
		}
	})
}

func TestSanitizeFilename(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "safe filename",
			input:    "test.jpg",
			expected: "test.jpg",
		},
		{
			name:     "filename with spaces",
			input:    "test file.jpg",
			expected: "test file.jpg",
		},
		{
			name:     "filename with underscores and dashes",
			input:    "test_file-123.jpg",
			expected: "test_file-123.jpg",
		},
		{
			name:     "path traversal",
			input:    "../../../etc/passwd",
			expected: "passwd",
		},
		{
			name:     "filename with path",
			input:    "/path/to/file.jpg",
			expected: "file.jpg",
		},
		{
			name:     "filename with special characters",
			input:    "file@#$%^&*().jpg",
			expected: "file.jpg",
		},
		{
			name:     "empty after sanitization",
			input:    "../../",
			expected: "",
		},
		{
			name:     "dot file",
			input:    ".",
			expected: "",
		},
		{
			name:     "dot dot file",
			input:    "..",
			expected: "",
		},
		{
			name:     "very long filename",
			input:    strings.Repeat("a", 300) + ".jpg",
			expected: strings.Repeat("a", 251) + ".jpg",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := SanitizeFilename(tt.input)
			if result != tt.expected {
				t.Errorf("expected %q, got %q", tt.expected, result)
			}
		})
	}
}

func TestGenerateStoragePath(t *testing.T) {
	tests := []struct {
		name        string
		workspaceID string
		itemID      string
		filename    string
		expected    string
	}{
		{
			name:        "basic path",
			workspaceID: "workspace-123",
			itemID:      "item-456",
			filename:    "test.jpg",
			expected:    "workspace-123/item-456/test.jpg",
		},
		{
			name:        "with UUID filename",
			workspaceID: "workspace-abc",
			itemID:      "item-xyz",
			filename:    "550e8400-e29b-41d4-a716-446655440000_photo.jpg",
			expected:    "workspace-abc/item-xyz/550e8400-e29b-41d4-a716-446655440000_photo.jpg",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := GenerateStoragePath(tt.workspaceID, tt.itemID, tt.filename)
			if result != tt.expected {
				t.Errorf("expected %q, got %q", tt.expected, result)
			}
		})
	}
}

func TestValidateStoragePath(t *testing.T) {
	tests := []struct {
		name        string
		path        string
		expectError bool
	}{
		{
			name:        "valid path",
			path:        "workspace-123/item-456/test.jpg",
			expectError: false,
		},
		{
			name:        "empty path",
			path:        "",
			expectError: true,
		},
		{
			name:        "path with traversal",
			path:        "../../../etc/passwd",
			expectError: true,
		},
		{
			name:        "absolute path",
			path:        "/etc/passwd",
			expectError: true,
		},
		{
			name:        "path with double dots in middle",
			path:        "workspace-123/../item-456/test.jpg",
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateStoragePath(tt.path)
			if tt.expectError && err == nil {
				t.Error("expected error, got nil")
			}
			if !tt.expectError && err != nil {
				t.Errorf("expected no error, got %v", err)
			}
		})
	}
}
