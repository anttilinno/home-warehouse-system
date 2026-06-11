package storage

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// F20: the containment check must use a real path-relation test, not a
// string prefix — a sibling directory sharing the base path as a name prefix
// (e.g. /tmp/x/uploads-evil vs /tmp/x/uploads) must never be reachable.
func TestLocalStorage_PathContainment(t *testing.T) {
	root := t.TempDir()
	baseDir := filepath.Join(root, "uploads")
	siblingDir := baseDir + "-evil" // shares the prefix "uploads"
	require.NoError(t, os.MkdirAll(siblingDir, 0o755))

	secret := filepath.Join(siblingDir, "secret.txt")
	require.NoError(t, os.WriteFile(secret, []byte("top secret"), 0o644))

	s, err := NewLocalStorage(baseDir)
	require.NoError(t, err)

	ctx := context.Background()

	t.Run("resolveWithinBase accepts in-base path", func(t *testing.T) {
		full, err := s.resolveWithinBase("ws/item/photo.jpg")
		assert.NoError(t, err)
		assert.Equal(t, filepath.Join(baseDir, "ws", "item", "photo.jpg"), full)
	})

	t.Run("rejects traversal", func(t *testing.T) {
		_, err := s.resolveWithinBase("../uploads-evil/secret.txt")
		assert.ErrorIs(t, err, ErrInvalidPath)
	})

	t.Run("rejects absolute path", func(t *testing.T) {
		_, err := s.resolveWithinBase(secret)
		assert.ErrorIs(t, err, ErrInvalidPath)
	})

	t.Run("Get cannot read sibling-prefix directory", func(t *testing.T) {
		// ".." is filtered by validateStoragePath; this guards the deeper
		// filepath.Rel check in case that filter ever regresses.
		_, err := s.Get(ctx, "../uploads-evil/secret.txt")
		assert.ErrorIs(t, err, ErrInvalidPath)
	})

	t.Run("Delete cannot remove sibling-prefix file", func(t *testing.T) {
		err := s.Delete(ctx, "../uploads-evil/secret.txt")
		assert.ErrorIs(t, err, ErrInvalidPath)

		// File must still exist
		_, statErr := os.Stat(secret)
		assert.NoError(t, statErr)
	})

	t.Run("Exists cannot probe sibling-prefix file", func(t *testing.T) {
		_, err := s.Exists(ctx, "../uploads-evil/secret.txt")
		assert.ErrorIs(t, err, ErrInvalidPath)
	})
}
