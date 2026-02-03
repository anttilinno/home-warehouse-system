package user

import (
	"context"
	"fmt"
	"io"
	"path/filepath"

	"github.com/google/uuid"
)

// GenericStorage is a simplified storage interface compatible with existing storage implementations
type GenericStorage interface {
	Save(ctx context.Context, workspaceID, itemID, filename string, reader io.Reader) (path string, err error)
	Get(ctx context.Context, path string) (io.ReadCloser, error)
	Delete(ctx context.Context, path string) error
}

// AvatarStorageAdapter adapts a GenericStorage for avatar operations
type AvatarStorageAdapter struct {
	storage GenericStorage
}

// NewAvatarStorageAdapter creates a new avatar storage adapter
func NewAvatarStorageAdapter(storage GenericStorage) *AvatarStorageAdapter {
	return &AvatarStorageAdapter{storage: storage}
}

// SaveAvatar saves an avatar file and returns the storage path.
// Uses "avatars" as the workspace-like prefix and userID as the entity ID.
func (a *AvatarStorageAdapter) SaveAvatar(ctx context.Context, userID, filename string, reader io.Reader) (string, error) {
	// Generate a unique filename to prevent caching issues
	ext := filepath.Ext(filename)
	uniqueFilename := fmt.Sprintf("avatar_%s%s", uuid.New().String()[:8], ext)

	// Use "avatars" as workspace prefix for organization
	return a.storage.Save(ctx, "avatars", userID, uniqueFilename, reader)
}

// GetAvatar retrieves an avatar file by path
func (a *AvatarStorageAdapter) GetAvatar(ctx context.Context, path string) (io.ReadCloser, error) {
	return a.storage.Get(ctx, path)
}

// DeleteAvatar removes an avatar file
func (a *AvatarStorageAdapter) DeleteAvatar(ctx context.Context, path string) error {
	return a.storage.Delete(ctx, path)
}
