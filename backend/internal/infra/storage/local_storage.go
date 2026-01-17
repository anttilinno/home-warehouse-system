package storage

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/google/uuid"
)

var (
	// ErrFileNotFound is returned when a file doesn't exist
	ErrFileNotFound = errors.New("file not found")

	// ErrInvalidPath is returned when a path is invalid or unsafe
	ErrInvalidPath = errors.New("invalid or unsafe path")

	// filenamePattern matches safe filename characters
	filenamePattern = regexp.MustCompile(`^[a-zA-Z0-9_\-. ]+$`)
)

// LocalStorage implements the Storage interface using the local filesystem.
type LocalStorage struct {
	baseDir string // Base directory for all uploads
}

// NewLocalStorage creates a new LocalStorage instance.
// The baseDir will be created if it doesn't exist.
func NewLocalStorage(baseDir string) (*LocalStorage, error) {
	if baseDir == "" {
		return nil, errors.New("base directory cannot be empty")
	}

	// Create base directory if it doesn't exist
	if err := os.MkdirAll(baseDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create base directory: %w", err)
	}

	// Verify directory is writable
	testFile := filepath.Join(baseDir, ".write_test")
	if err := os.WriteFile(testFile, []byte("test"), 0644); err != nil {
		return nil, fmt.Errorf("base directory is not writable: %w", err)
	}
	os.Remove(testFile)

	return &LocalStorage{
		baseDir: baseDir,
	}, nil
}

// Save stores a file and returns the storage path.
// Path format: {workspace_id}/{item_id}/{uuid}_{filename}
func (s *LocalStorage) Save(ctx context.Context, workspaceID, itemID, filename string, reader io.Reader) (string, error) {
	if workspaceID == "" || itemID == "" || filename == "" {
		return "", errors.New("workspaceID, itemID, and filename are required")
	}

	// Sanitize and validate filename
	sanitized := SanitizeFilename(filename)
	if sanitized == "" {
		return "", fmt.Errorf("invalid filename: %s", filename)
	}

	// Generate unique filename with UUID prefix
	uniqueFilename := fmt.Sprintf("%s_%s", uuid.New().String(), sanitized)

	// Generate storage path
	relativePath := GenerateStoragePath(workspaceID, itemID, uniqueFilename)
	fullPath := filepath.Join(s.baseDir, relativePath)

	// Create directory structure
	dir := filepath.Dir(fullPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return "", fmt.Errorf("failed to create directory: %w", err)
	}

	// Write to temporary file first (atomic write)
	tempFile := fullPath + ".tmp"
	f, err := os.OpenFile(tempFile, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0644)
	if err != nil {
		return "", fmt.Errorf("failed to create temp file: %w", err)
	}

	// Copy data
	_, copyErr := io.Copy(f, reader)
	closeErr := f.Close()

	if copyErr != nil {
		os.Remove(tempFile)
		return "", fmt.Errorf("failed to write file: %w", copyErr)
	}
	if closeErr != nil {
		os.Remove(tempFile)
		return "", fmt.Errorf("failed to close file: %w", closeErr)
	}

	// Atomically rename temp file to final location
	if err := os.Rename(tempFile, fullPath); err != nil {
		os.Remove(tempFile)
		return "", fmt.Errorf("failed to finalize file: %w", err)
	}

	return relativePath, nil
}

// Get retrieves a file by its storage path.
func (s *LocalStorage) Get(ctx context.Context, path string) (io.ReadCloser, error) {
	if err := validateStoragePath(path); err != nil {
		return nil, err
	}

	fullPath := filepath.Join(s.baseDir, path)

	// Verify path is within base directory (prevent path traversal)
	cleanPath, err := filepath.Abs(fullPath)
	if err != nil {
		return nil, ErrInvalidPath
	}
	cleanBase, err := filepath.Abs(s.baseDir)
	if err != nil {
		return nil, ErrInvalidPath
	}
	if !strings.HasPrefix(cleanPath, cleanBase) {
		return nil, ErrInvalidPath
	}

	f, err := os.Open(fullPath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, ErrFileNotFound
		}
		return nil, fmt.Errorf("failed to open file: %w", err)
	}

	return f, nil
}

// Delete removes a file from storage.
func (s *LocalStorage) Delete(ctx context.Context, path string) error {
	if err := validateStoragePath(path); err != nil {
		return err
	}

	fullPath := filepath.Join(s.baseDir, path)

	// Verify path is within base directory
	cleanPath, err := filepath.Abs(fullPath)
	if err != nil {
		return ErrInvalidPath
	}
	cleanBase, err := filepath.Abs(s.baseDir)
	if err != nil {
		return ErrInvalidPath
	}
	if !strings.HasPrefix(cleanPath, cleanBase) {
		return ErrInvalidPath
	}

	if err := os.Remove(fullPath); err != nil {
		if os.IsNotExist(err) {
			return ErrFileNotFound
		}
		return fmt.Errorf("failed to delete file: %w", err)
	}

	// Try to clean up empty directories (best effort)
	dir := filepath.Dir(fullPath)
	for dir != s.baseDir {
		if err := os.Remove(dir); err != nil {
			break // Directory not empty or error, stop cleanup
		}
		dir = filepath.Dir(dir)
	}

	return nil
}

// GetURL returns a URL path for accessing the file.
// For local storage, this returns a relative path that can be served by the web server.
func (s *LocalStorage) GetURL(ctx context.Context, path string) (string, error) {
	if err := validateStoragePath(path); err != nil {
		return "", err
	}

	// Check if file exists
	exists, err := s.Exists(ctx, path)
	if err != nil {
		return "", err
	}
	if !exists {
		return "", ErrFileNotFound
	}

	// Return path prefixed with /uploads/ for web serving
	return "/uploads/photos/" + path, nil
}

// Exists checks if a file exists at the given path.
func (s *LocalStorage) Exists(ctx context.Context, path string) (bool, error) {
	if err := validateStoragePath(path); err != nil {
		return false, err
	}

	fullPath := filepath.Join(s.baseDir, path)

	// Verify path is within base directory
	cleanPath, err := filepath.Abs(fullPath)
	if err != nil {
		return false, ErrInvalidPath
	}
	cleanBase, err := filepath.Abs(s.baseDir)
	if err != nil {
		return false, ErrInvalidPath
	}
	if !strings.HasPrefix(cleanPath, cleanBase) {
		return false, ErrInvalidPath
	}

	_, err = os.Stat(fullPath)
	if err != nil {
		if os.IsNotExist(err) {
			return false, nil
		}
		return false, fmt.Errorf("failed to check file existence: %w", err)
	}

	return true, nil
}

// SanitizeFilename removes unsafe characters from filenames.
// Returns empty string if filename is invalid.
func SanitizeFilename(filename string) string {
	// Remove path separators
	filename = filepath.Base(filename)

	// Trim whitespace
	filename = strings.TrimSpace(filename)

	// Check if filename matches safe pattern
	if !filenamePattern.MatchString(filename) {
		// If not, remove unsafe characters
		filename = regexp.MustCompile(`[^a-zA-Z0-9_\-. ]`).ReplaceAllString(filename, "")
	}

	// Limit length
	if len(filename) > 255 {
		ext := filepath.Ext(filename)
		base := filename[:255-len(ext)]
		filename = base + ext
	}

	// Ensure we have a filename
	if filename == "" || filename == "." || filename == ".." {
		return ""
	}

	return filename
}

// GenerateStoragePath creates a storage path for a file.
// Format: {workspace_id}/{item_id}/{filename}
func GenerateStoragePath(workspaceID, itemID, filename string) string {
	return filepath.Join(workspaceID, itemID, filename)
}

// validateStoragePath checks if a storage path is valid.
func validateStoragePath(path string) error {
	if path == "" {
		return ErrInvalidPath
	}

	// Check for path traversal attempts
	if strings.Contains(path, "..") {
		return ErrInvalidPath
	}

	// Check for absolute paths
	if filepath.IsAbs(path) {
		return ErrInvalidPath
	}

	return nil
}
