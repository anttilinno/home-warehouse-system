package storage

import (
	"context"
	"io"
)

// Storage defines the interface for file storage operations.
// Implementations can store files locally, in cloud storage, etc.
type Storage interface {
	// Save stores a file and returns the storage path.
	// The path can be used with other methods to retrieve or delete the file.
	Save(ctx context.Context, workspaceID, itemID, filename string, reader io.Reader) (path string, err error)

	// Get retrieves a file by its storage path.
	// Returns an io.ReadCloser that must be closed by the caller.
	Get(ctx context.Context, path string) (io.ReadCloser, error)

	// Delete removes a file from storage.
	Delete(ctx context.Context, path string) error

	// GetURL returns a URL that can be used to access the file.
	// For local storage, this might be a relative path for the web server.
	// For cloud storage, this might be a signed URL.
	GetURL(ctx context.Context, path string) (string, error)

	// Exists checks if a file exists at the given path.
	Exists(ctx context.Context, path string) (bool, error)
}
