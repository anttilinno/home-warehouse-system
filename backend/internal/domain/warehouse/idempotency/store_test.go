package idempotency

import (
	"context"
	"sync"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// inMemoryStore is a reference Store implementation used to pin down the
// dedupe contract every real implementation (postgres.IdempotencyRepository)
// must satisfy: replaying a (workspace, key) pair must return the entity
// from the FIRST save, and never overwrite it.
type inMemoryStore struct {
	mu      sync.Mutex
	records map[string]uuid.UUID
}

func newInMemoryStore() *inMemoryStore {
	return &inMemoryStore{records: make(map[string]uuid.UUID)}
}

func (s *inMemoryStore) recordKey(workspaceID uuid.UUID, key string) string {
	return workspaceID.String() + "|" + key
}

func (s *inMemoryStore) FindByIdempotencyKey(_ context.Context, workspaceID uuid.UUID, key string) (uuid.UUID, bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	entityID, found := s.records[s.recordKey(workspaceID, key)]
	return entityID, found, nil
}

func (s *inMemoryStore) SaveIdempotencyKey(_ context.Context, workspaceID uuid.UUID, key string, _ EntityType, entityID uuid.UUID) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	// ON CONFLICT DO NOTHING semantics (mirrors the postgres impl): first
	// write wins, replays must not clobber it.
	if _, exists := s.records[s.recordKey(workspaceID, key)]; !exists {
		s.records[s.recordKey(workspaceID, key)] = entityID
	}
	return nil
}

var _ Store = (*inMemoryStore)(nil)

func TestStore_SameKeyTwice_ReturnsFirstResult_NoDoubleWrite(t *testing.T) {
	store := newInMemoryStore()
	ctx := context.Background()
	wsID := uuid.New()
	key := "idem-key-1"
	firstEntityID := uuid.New()
	secondEntityID := uuid.New()

	require.NoError(t, store.SaveIdempotencyKey(ctx, wsID, key, TypeItem, firstEntityID))
	require.NoError(t, store.SaveIdempotencyKey(ctx, wsID, key, TypeItem, secondEntityID))

	entityID, found, err := store.FindByIdempotencyKey(ctx, wsID, key)
	require.NoError(t, err)
	require.True(t, found)
	assert.Equal(t, firstEntityID, entityID, "second save with the same key must not overwrite the first entity")
}

func TestStore_DifferentKeys_AreIndependent(t *testing.T) {
	store := newInMemoryStore()
	ctx := context.Background()
	wsID := uuid.New()
	entityA := uuid.New()
	entityB := uuid.New()

	require.NoError(t, store.SaveIdempotencyKey(ctx, wsID, "key-a", TypeItem, entityA))
	require.NoError(t, store.SaveIdempotencyKey(ctx, wsID, "key-b", TypeContainer, entityB))

	gotA, found, err := store.FindByIdempotencyKey(ctx, wsID, "key-a")
	require.NoError(t, err)
	require.True(t, found)
	assert.Equal(t, entityA, gotA)

	gotB, found, err := store.FindByIdempotencyKey(ctx, wsID, "key-b")
	require.NoError(t, err)
	require.True(t, found)
	assert.Equal(t, entityB, gotB)
}

func TestStore_UnknownKey_NotFound(t *testing.T) {
	store := newInMemoryStore()
	ctx := context.Background()

	entityID, found, err := store.FindByIdempotencyKey(ctx, uuid.New(), "never-saved")
	require.NoError(t, err)
	assert.False(t, found)
	assert.Equal(t, uuid.Nil, entityID)
}
