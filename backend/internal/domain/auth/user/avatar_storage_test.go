package user_test

import (
	"context"
	"errors"
	"io"
	"strings"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/antti/home-warehouse/go-backend/internal/domain/auth/user"
)

// mockGenericStorage implements user.GenericStorage for testing the adapter
// in isolation from any real filesystem.
type mockGenericStorage struct {
	mock.Mock
}

func (m *mockGenericStorage) Save(ctx context.Context, workspaceID, itemID, filename string, reader io.Reader) (string, error) {
	args := m.Called(ctx, workspaceID, itemID, filename, reader)
	return args.String(0), args.Error(1)
}

func (m *mockGenericStorage) Get(ctx context.Context, path string) (io.ReadCloser, error) {
	args := m.Called(ctx, path)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(io.ReadCloser), args.Error(1)
}

func (m *mockGenericStorage) Delete(ctx context.Context, path string) error {
	args := m.Called(ctx, path)
	return args.Error(0)
}

func TestAvatarStorageAdapter_SaveAvatar(t *testing.T) {
	t.Run("saves under the avatars prefix keyed by user ID", func(t *testing.T) {
		storage := new(mockGenericStorage)
		adapter := user.NewAvatarStorageAdapter(storage)

		userID := "11111111-1111-1111-1111-111111111111"
		var capturedFilename string
		storage.On("Save", mock.Anything, "avatars", userID, mock.AnythingOfType("string"), mock.Anything).
			Run(func(args mock.Arguments) {
				capturedFilename = args.String(3)
			}).
			Return("avatars/"+userID+"/saved.jpg", nil).Once()

		path, err := adapter.SaveAvatar(context.Background(), userID, "avatar.jpg", strings.NewReader("bytes"))

		require.NoError(t, err)
		require.Equal(t, "avatars/"+userID+"/saved.jpg", path)
		require.True(t, strings.HasSuffix(capturedFilename, ".jpg"))
		require.True(t, strings.HasPrefix(capturedFilename, "avatar_"))
		storage.AssertExpectations(t)
	})

	t.Run("path traversal in the source filename cannot escape the user's directory", func(t *testing.T) {
		storage := new(mockGenericStorage)
		adapter := user.NewAvatarStorageAdapter(storage)

		userID := "22222222-2222-2222-2222-222222222222"
		var capturedFilename string
		storage.On("Save", mock.Anything, "avatars", userID, mock.AnythingOfType("string"), mock.Anything).
			Run(func(args mock.Arguments) {
				capturedFilename = args.String(3)
			}).
			Return("avatars/"+userID+"/saved.jpg", nil).Once()

		// A malicious upload filename must not survive into the generated
		// storage filename: only the extension of the attacker-controlled
		// name is kept, appended to a server-generated UUID prefix.
		_, err := adapter.SaveAvatar(context.Background(), userID, "../../../etc/passwd.jpg", strings.NewReader("bytes"))

		require.NoError(t, err)
		require.NotContains(t, capturedFilename, "..")
		require.NotContains(t, capturedFilename, "/")
		require.True(t, strings.HasPrefix(capturedFilename, "avatar_"))
		storage.AssertExpectations(t)
	})

	t.Run("propagates the underlying storage error", func(t *testing.T) {
		storage := new(mockGenericStorage)
		adapter := user.NewAvatarStorageAdapter(storage)

		storage.On("Save", mock.Anything, "avatars", "user-1", mock.AnythingOfType("string"), mock.Anything).
			Return("", errors.New("disk full")).Once()

		_, err := adapter.SaveAvatar(context.Background(), "user-1", "avatar.jpg", strings.NewReader("bytes"))

		require.ErrorContains(t, err, "disk full")
		storage.AssertExpectations(t)
	})
}

func TestAvatarStorageAdapter_GetAvatar(t *testing.T) {
	t.Run("delegates to the underlying storage with the exact path", func(t *testing.T) {
		storage := new(mockGenericStorage)
		adapter := user.NewAvatarStorageAdapter(storage)

		reader := io.NopCloser(strings.NewReader("avatar-bytes"))
		storage.On("Get", mock.Anything, "avatars/user-1/avatar_abc.jpg").Return(reader, nil).Once()

		got, err := adapter.GetAvatar(context.Background(), "avatars/user-1/avatar_abc.jpg")

		require.NoError(t, err)
		gotBytes, err := io.ReadAll(got)
		require.NoError(t, err)
		require.Equal(t, "avatar-bytes", string(gotBytes))
		storage.AssertExpectations(t)
	})

	t.Run("does not sanitize traversal paths itself, relying on the underlying storage", func(t *testing.T) {
		// AvatarStorageAdapter is a thin pass-through; containment for
		// already-malicious stored paths is enforced by the underlying
		// storage implementation (e.g. LocalStorage.resolveWithinBase),
		// not by this adapter. This test documents that the adapter passes
		// the path through unmodified so the underlying storage's
		// containment check is what actually runs.
		storage := new(mockGenericStorage)
		adapter := user.NewAvatarStorageAdapter(storage)

		storage.On("Get", mock.Anything, "../../etc/passwd").
			Return(nil, errors.New("invalid or unsafe path")).Once()

		_, err := adapter.GetAvatar(context.Background(), "../../etc/passwd")

		require.ErrorContains(t, err, "invalid or unsafe path")
		storage.AssertExpectations(t)
	})
}

func TestAvatarStorageAdapter_DeleteAvatar(t *testing.T) {
	t.Run("delegates to the underlying storage with the exact path", func(t *testing.T) {
		storage := new(mockGenericStorage)
		adapter := user.NewAvatarStorageAdapter(storage)

		storage.On("Delete", mock.Anything, "avatars/user-1/avatar_abc.jpg").Return(nil).Once()

		err := adapter.DeleteAvatar(context.Background(), "avatars/user-1/avatar_abc.jpg")

		require.NoError(t, err)
		storage.AssertExpectations(t)
	})

	t.Run("propagates the underlying storage error for an unsafe path", func(t *testing.T) {
		storage := new(mockGenericStorage)
		adapter := user.NewAvatarStorageAdapter(storage)

		storage.On("Delete", mock.Anything, "../../etc/passwd").
			Return(errors.New("invalid or unsafe path")).Once()

		err := adapter.DeleteAvatar(context.Background(), "../../etc/passwd")

		require.ErrorContains(t, err, "invalid or unsafe path")
		storage.AssertExpectations(t)
	})
}
