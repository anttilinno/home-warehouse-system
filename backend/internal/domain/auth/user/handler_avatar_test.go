package user_test

import (
	"bytes"
	"context"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/textproto"
	"os"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/antti/home-warehouse/go-backend/internal/domain/auth/user"
	"github.com/antti/home-warehouse/go-backend/internal/shared/jwt"
	"github.com/antti/home-warehouse/go-backend/internal/testutil"
)

// fakeAvatarStorage is a hand-written fake (not a testify mock) because
// uploadAvatar reads the thumbnail file back off disk between calls, so the
// fake needs real side effects rather than canned return values.
type fakeAvatarStorage struct {
	saveUserID   string
	saveFilename string
	savePath     string
	saveErr      error
	deletedPaths []string
	deleteErr    error
	getErr       error
}

func (f *fakeAvatarStorage) SaveAvatar(_ context.Context, userID, filename string, reader io.Reader) (string, error) {
	_, _ = io.Copy(io.Discard, reader)
	f.saveUserID = userID
	f.saveFilename = filename
	if f.saveErr != nil {
		return "", f.saveErr
	}
	if f.savePath != "" {
		return f.savePath, nil
	}
	return "avatars/" + userID + "/" + filename, nil
}

func (f *fakeAvatarStorage) GetAvatar(_ context.Context, _ string) (io.ReadCloser, error) {
	if f.getErr != nil {
		return nil, f.getErr
	}
	return io.NopCloser(bytes.NewReader([]byte("avatar-bytes"))), nil
}

func (f *fakeAvatarStorage) DeleteAvatar(_ context.Context, path string) error {
	f.deletedPaths = append(f.deletedPaths, path)
	return f.deleteErr
}

// fakeImageProcessor writes a real thumbnail file to destPath since
// uploadAvatar opens it back up with os.Open after GenerateThumbnail runs.
type fakeImageProcessor struct {
	validateErr  error
	thumbnailErr error
}

func (f *fakeImageProcessor) Validate(_ context.Context, _ string) error {
	return f.validateErr
}

func (f *fakeImageProcessor) GenerateThumbnail(_ context.Context, _, destPath string, _, _ int) error {
	if f.thumbnailErr != nil {
		return f.thumbnailErr
	}
	return os.WriteFile(destPath, []byte("thumbnail-bytes"), 0644)
}

func (f *fakeImageProcessor) GetDimensions(_ context.Context, _ string) (int, int, error) {
	return user.AvatarThumbnailSize, user.AvatarThumbnailSize, nil
}

// newAvatarUploadRequest builds a multipart POST with a single "avatar" part.
func newAvatarUploadRequest(t *testing.T, filename, contentType string, content []byte) *http.Request {
	t.Helper()
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	h := make(textproto.MIMEHeader)
	h.Set("Content-Disposition", `form-data; name="avatar"; filename="`+filename+`"`)
	h.Set("Content-Type", contentType)
	part, err := writer.CreatePart(h)
	require.NoError(t, err)
	_, err = part.Write(content)
	require.NoError(t, err)
	require.NoError(t, writer.Close())

	req := httptest.NewRequest(http.MethodPost, "/users/me/avatar", body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	return req
}

func TestUserHandler_UploadAvatar(t *testing.T) {
	t.Run("uploads avatar successfully", func(t *testing.T) {
		setup := testutil.NewHandlerTestSetup()
		mockSvc := new(MockService)
		jwtSvc := jwt.NewService("test-secret", 24)
		handler := user.NewHandler(mockSvc, jwtSvc, nil)

		storage := &fakeAvatarStorage{}
		processor := &fakeImageProcessor{}
		handler.SetAvatarStorage(storage)
		handler.SetImageProcessor(processor)
		handler.RegisterAvatarRoutes(setup.Router)

		testUser, _ := user.NewUser("test@example.com", "Test User", "password123")
		updatedUser, _ := user.NewUser("test@example.com", "Test User", "password123")

		mockSvc.On("GetByID", mock.Anything, setup.UserID).Return(testUser, nil).Once()
		mockSvc.On("UpdateAvatar", mock.Anything, setup.UserID, mock.MatchedBy(func(path *string) bool {
			return path != nil && *path != ""
		})).Return(updatedUser, nil).Once()

		req := newAvatarUploadRequest(t, "avatar.jpg", "image/jpeg", []byte("fake jpeg bytes"))
		rec := httptest.NewRecorder()
		setup.Router.ServeHTTP(rec, req)

		testutil.AssertStatus(t, rec, http.StatusOK)
		require.Contains(t, rec.Body.String(), "test@example.com")
		require.Equal(t, setup.UserID.String(), storage.saveUserID)
		mockSvc.AssertExpectations(t)
	})

	t.Run("deletes old avatar when replacing", func(t *testing.T) {
		setup := testutil.NewHandlerTestSetup()
		mockSvc := new(MockService)
		jwtSvc := jwt.NewService("test-secret", 24)
		handler := user.NewHandler(mockSvc, jwtSvc, nil)

		storage := &fakeAvatarStorage{}
		processor := &fakeImageProcessor{}
		handler.SetAvatarStorage(storage)
		handler.SetImageProcessor(processor)
		handler.RegisterAvatarRoutes(setup.Router)

		testUser, _ := user.NewUser("test@example.com", "Test User", "password123")
		oldPath := "avatars/old-user/avatar_old.jpg"
		testUser.UpdateAvatar(&oldPath)
		updatedUser, _ := user.NewUser("test@example.com", "Test User", "password123")

		mockSvc.On("GetByID", mock.Anything, setup.UserID).Return(testUser, nil).Once()
		mockSvc.On("UpdateAvatar", mock.Anything, setup.UserID, mock.Anything).Return(updatedUser, nil).Once()

		req := newAvatarUploadRequest(t, "avatar.png", "image/png", []byte("fake png bytes"))
		rec := httptest.NewRecorder()
		setup.Router.ServeHTTP(rec, req)

		testutil.AssertStatus(t, rec, http.StatusOK)
		require.Contains(t, storage.deletedPaths, oldPath)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 400 for disallowed content type", func(t *testing.T) {
		setup := testutil.NewHandlerTestSetup()
		mockSvc := new(MockService)
		jwtSvc := jwt.NewService("test-secret", 24)
		handler := user.NewHandler(mockSvc, jwtSvc, nil)

		storage := &fakeAvatarStorage{}
		processor := &fakeImageProcessor{}
		handler.SetAvatarStorage(storage)
		handler.SetImageProcessor(processor)
		handler.RegisterAvatarRoutes(setup.Router)

		req := newAvatarUploadRequest(t, "notes.txt", "text/plain", []byte("not an image"))
		rec := httptest.NewRecorder()
		setup.Router.ServeHTTP(rec, req)

		testutil.AssertStatus(t, rec, http.StatusBadRequest)
		mockSvc.AssertExpectations(t) // no calls expected
	})

	t.Run("returns 400 when avatar file is missing", func(t *testing.T) {
		setup := testutil.NewHandlerTestSetup()
		mockSvc := new(MockService)
		jwtSvc := jwt.NewService("test-secret", 24)
		handler := user.NewHandler(mockSvc, jwtSvc, nil)

		storage := &fakeAvatarStorage{}
		processor := &fakeImageProcessor{}
		handler.SetAvatarStorage(storage)
		handler.SetImageProcessor(processor)
		handler.RegisterAvatarRoutes(setup.Router)

		body := &bytes.Buffer{}
		writer := multipart.NewWriter(body)
		_ = writer.WriteField("unrelated", "value")
		require.NoError(t, writer.Close())

		req := httptest.NewRequest(http.MethodPost, "/users/me/avatar", body)
		req.Header.Set("Content-Type", writer.FormDataContentType())
		rec := httptest.NewRecorder()
		setup.Router.ServeHTTP(rec, req)

		testutil.AssertStatus(t, rec, http.StatusBadRequest)
	})

	t.Run("returns 503 when storage is not configured", func(t *testing.T) {
		setup := testutil.NewHandlerTestSetup()
		mockSvc := new(MockService)
		jwtSvc := jwt.NewService("test-secret", 24)
		handler := user.NewHandler(mockSvc, jwtSvc, nil)
		handler.RegisterAvatarRoutes(setup.Router)

		req := newAvatarUploadRequest(t, "avatar.jpg", "image/jpeg", []byte("fake jpeg bytes"))
		rec := httptest.NewRecorder()
		setup.Router.ServeHTTP(rec, req)

		testutil.AssertStatus(t, rec, http.StatusServiceUnavailable)
	})
}

func TestUserHandler_DeleteAvatar(t *testing.T) {
	t.Run("deletes avatar successfully", func(t *testing.T) {
		setup := testutil.NewHandlerTestSetup()
		mockSvc := new(MockService)
		jwtSvc := jwt.NewService("test-secret", 24)
		handler := user.NewHandler(mockSvc, jwtSvc, nil)

		storage := &fakeAvatarStorage{}
		handler.SetAvatarStorage(storage)
		handler.RegisterProtectedRoutes(setup.API)

		testUser, _ := user.NewUser("test@example.com", "Test User", "password123")
		avatarPath := "avatars/" + setup.UserID.String() + "/avatar_abc123.jpg"
		testUser.UpdateAvatar(&avatarPath)

		mockSvc.On("GetByID", mock.Anything, setup.UserID).Return(testUser, nil).Once()
		mockSvc.On("UpdateAvatar", mock.Anything, setup.UserID, (*string)(nil)).Return(testUser, nil).Once()

		rec := setup.Delete("/users/me/avatar")

		testutil.AssertStatus(t, rec, http.StatusNoContent)
		require.Contains(t, storage.deletedPaths, avatarPath)
		mockSvc.AssertExpectations(t)
	})

	t.Run("no-ops when user has no avatar", func(t *testing.T) {
		setup := testutil.NewHandlerTestSetup()
		mockSvc := new(MockService)
		jwtSvc := jwt.NewService("test-secret", 24)
		handler := user.NewHandler(mockSvc, jwtSvc, nil)

		storage := &fakeAvatarStorage{}
		handler.SetAvatarStorage(storage)
		handler.RegisterProtectedRoutes(setup.API)

		testUser, _ := user.NewUser("test@example.com", "Test User", "password123")

		mockSvc.On("GetByID", mock.Anything, setup.UserID).Return(testUser, nil).Once()

		rec := setup.Delete("/users/me/avatar")

		testutil.AssertStatus(t, rec, http.StatusNoContent)
		require.Empty(t, storage.deletedPaths)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 503 when storage is not configured", func(t *testing.T) {
		setup := testutil.NewHandlerTestSetup()
		mockSvc := new(MockService)
		jwtSvc := jwt.NewService("test-secret", 24)
		handler := user.NewHandler(mockSvc, jwtSvc, nil)
		handler.RegisterProtectedRoutes(setup.API)

		rec := setup.Delete("/users/me/avatar")

		testutil.AssertStatus(t, rec, http.StatusServiceUnavailable)
	})

	t.Run("returns 404 when user not found", func(t *testing.T) {
		setup := testutil.NewHandlerTestSetup()
		mockSvc := new(MockService)
		jwtSvc := jwt.NewService("test-secret", 24)
		handler := user.NewHandler(mockSvc, jwtSvc, nil)

		storage := &fakeAvatarStorage{}
		handler.SetAvatarStorage(storage)
		handler.RegisterProtectedRoutes(setup.API)

		mockSvc.On("GetByID", mock.Anything, setup.UserID).Return(nil, user.ErrUserNotFound).Once()

		rec := setup.Delete("/users/me/avatar")

		testutil.AssertStatus(t, rec, http.StatusNotFound)
		mockSvc.AssertExpectations(t)
	})
}
