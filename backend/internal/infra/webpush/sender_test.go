package webpush

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"github.com/antti/home-warehouse/go-backend/internal/domain/auth/pushsubscription"
)

// Valid RFC8291 client keys, taken from the webpush-go test fixtures
// (https://github.com/SherClockHolmes/webpush-go), so SendNotification's ECDH
// encryption step succeeds instead of failing on a malformed test key.
const (
	testP256dh = "BNNL5ZaTfK81qhXOx23-wewhigUeFb632jN6LvRWCFH1ubQr77FE_9qV1FuojuRmHP42zmf34rXgW80OvUVDgTk"
	testAuth   = "zqbxT6JKstKSY9JKibZLSQ"
)

// MockRepository is a mock implementation of pushsubscription.Repository.
type MockRepository struct {
	mock.Mock
}

func (m *MockRepository) Save(ctx context.Context, subscription *pushsubscription.PushSubscription) error {
	args := m.Called(ctx, subscription)
	return args.Error(0)
}

func (m *MockRepository) FindByID(ctx context.Context, id uuid.UUID) (*pushsubscription.PushSubscription, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*pushsubscription.PushSubscription), args.Error(1)
}

func (m *MockRepository) FindByEndpoint(ctx context.Context, userID uuid.UUID, endpoint string) (*pushsubscription.PushSubscription, error) {
	args := m.Called(ctx, userID, endpoint)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*pushsubscription.PushSubscription), args.Error(1)
}

func (m *MockRepository) FindByUser(ctx context.Context, userID uuid.UUID) ([]*pushsubscription.PushSubscription, error) {
	args := m.Called(ctx, userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*pushsubscription.PushSubscription), args.Error(1)
}

func (m *MockRepository) FindAll(ctx context.Context) ([]*pushsubscription.PushSubscription, error) {
	args := m.Called(ctx)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*pushsubscription.PushSubscription), args.Error(1)
}

func (m *MockRepository) Delete(ctx context.Context, id uuid.UUID) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockRepository) DeleteByEndpoint(ctx context.Context, userID uuid.UUID, endpoint string) error {
	args := m.Called(ctx, userID, endpoint)
	return args.Error(0)
}

func (m *MockRepository) DeleteAllByUser(ctx context.Context, userID uuid.UUID) error {
	args := m.Called(ctx, userID)
	return args.Error(0)
}

func (m *MockRepository) Count(ctx context.Context, userID uuid.UUID) (int64, error) {
	args := m.Called(ctx, userID)
	return args.Get(0).(int64), args.Error(1)
}

// testSubscription builds a subscription whose endpoint points at the given
// httptest server URL. Reconstruct (rather than NewPushSubscription) is used
// because the entity's SSRF guard rejects http/localhost endpoints, which is
// exactly what httptest.Server hands back.
func testSubscription(endpoint string) *pushsubscription.PushSubscription {
	now := time.Now()
	return pushsubscription.Reconstruct(
		uuid.New(), uuid.New(), endpoint, testP256dh, testAuth, nil, now, now,
	)
}

func TestSender_SendToUser_NoSubscriptions(t *testing.T) {
	ctx := context.Background()
	userID := uuid.New()
	repo := new(MockRepository)
	repo.On("FindByUser", ctx, userID).Return([]*pushsubscription.PushSubscription{}, nil)

	sender := NewSender("pub", "priv", "mailto:test@example.com", repo)
	err := sender.SendToUser(ctx, userID, PushMessage{Title: "hi"})

	assert.NoError(t, err)
	repo.AssertExpectations(t)
}

func TestSender_SendToUser_RepositoryError(t *testing.T) {
	ctx := context.Background()
	userID := uuid.New()
	repo := new(MockRepository)
	repo.On("FindByUser", ctx, userID).Return(nil, assert.AnError)

	sender := NewSender("pub", "priv", "mailto:test@example.com", repo)
	err := sender.SendToUser(ctx, userID, PushMessage{Title: "hi"})

	assert.Error(t, err)
	assert.ErrorContains(t, err, "failed to get subscriptions")
	repo.AssertExpectations(t)
}

func TestSender_SendToUser_Success_EncryptsPayload(t *testing.T) {
	ctx := context.Background()
	userID := uuid.New()

	var gotTTL, gotEncoding, gotAuth string
	var gotBody []byte
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotTTL = r.Header.Get("TTL")
		gotEncoding = r.Header.Get("Content-Encoding")
		gotAuth = r.Header.Get("Authorization")
		gotBody, _ = io.ReadAll(r.Body)
		w.WriteHeader(http.StatusCreated)
	}))
	defer server.Close()

	sub := testSubscription(server.URL)
	repo := new(MockRepository)
	repo.On("FindByUser", ctx, userID).Return([]*pushsubscription.PushSubscription{sub}, nil)

	sender := NewSender("pub", "priv", "mailto:test@example.com", repo)
	err := sender.SendToUser(ctx, userID, PushMessage{Title: "Secret Title", Body: "Secret Body"})

	assert.NoError(t, err)
	assert.Equal(t, "86400", gotTTL)
	assert.Equal(t, "aes128gcm", gotEncoding)
	assert.True(t, strings.HasPrefix(gotAuth, "vapid"), "Authorization header = %q, want vapid prefix", gotAuth)
	assert.NotEmpty(t, gotBody)
	assert.NotContains(t, string(gotBody), "Secret Title", "payload must be encrypted, not sent as plaintext")
	repo.AssertExpectations(t)
	repo.AssertNotCalled(t, "Delete", mock.Anything, mock.Anything)
}

func TestSender_SendToUser_RemovesSubscriptionOn410Gone(t *testing.T) {
	ctx := context.Background()
	userID := uuid.New()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusGone)
	}))
	defer server.Close()

	sub := testSubscription(server.URL)
	repo := new(MockRepository)
	repo.On("FindByUser", ctx, userID).Return([]*pushsubscription.PushSubscription{sub}, nil)
	repo.On("Delete", ctx, sub.ID()).Return(nil)

	sender := NewSender("pub", "priv", "mailto:test@example.com", repo)
	err := sender.SendToUser(ctx, userID, PushMessage{Title: "hi"})

	assert.Error(t, err)
	repo.AssertExpectations(t)
}

func TestSender_SendToUser_RemovesSubscriptionOn404NotFound(t *testing.T) {
	ctx := context.Background()
	userID := uuid.New()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	}))
	defer server.Close()

	sub := testSubscription(server.URL)
	repo := new(MockRepository)
	repo.On("FindByUser", ctx, userID).Return([]*pushsubscription.PushSubscription{sub}, nil)
	repo.On("Delete", ctx, sub.ID()).Return(nil)

	sender := NewSender("pub", "priv", "mailto:test@example.com", repo)
	err := sender.SendToUser(ctx, userID, PushMessage{Title: "hi"})

	assert.Error(t, err)
	repo.AssertExpectations(t)
}

func TestSender_SendToUser_ServerErrorKeepsSubscription(t *testing.T) {
	ctx := context.Background()
	userID := uuid.New()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer server.Close()

	sub := testSubscription(server.URL)
	repo := new(MockRepository)
	repo.On("FindByUser", ctx, userID).Return([]*pushsubscription.PushSubscription{sub}, nil)

	sender := NewSender("pub", "priv", "mailto:test@example.com", repo)
	err := sender.SendToUser(ctx, userID, PushMessage{Title: "hi"})

	assert.Error(t, err)
	repo.AssertExpectations(t)
	repo.AssertNotCalled(t, "Delete", mock.Anything, mock.Anything)
}

func TestSender_SendToUsers_ContinuesPastPerUserError(t *testing.T) {
	ctx := context.Background()
	failUser := uuid.New()
	okUser := uuid.New()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusCreated)
	}))
	defer server.Close()

	repo := new(MockRepository)
	repo.On("FindByUser", ctx, failUser).Return(nil, assert.AnError)
	repo.On("FindByUser", ctx, okUser).Return([]*pushsubscription.PushSubscription{testSubscription(server.URL)}, nil)

	sender := NewSender("pub", "priv", "mailto:test@example.com", repo)
	err := sender.SendToUsers(ctx, []uuid.UUID{failUser, okUser}, PushMessage{Title: "hi"})

	assert.NoError(t, err, "SendToUsers must not abort on a single user's failure")
	repo.AssertExpectations(t)
}

func TestSender_SendToAll_Success(t *testing.T) {
	ctx := context.Background()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusCreated)
	}))
	defer server.Close()

	sub := testSubscription(server.URL)
	repo := new(MockRepository)
	repo.On("FindAll", ctx).Return([]*pushsubscription.PushSubscription{sub}, nil)

	sender := NewSender("pub", "priv", "mailto:test@example.com", repo)
	err := sender.SendToAll(ctx, PushMessage{Title: "hi"})

	assert.NoError(t, err)
	repo.AssertExpectations(t)
}

func TestSender_SendToAll_NoSubscriptions(t *testing.T) {
	ctx := context.Background()
	repo := new(MockRepository)
	repo.On("FindAll", ctx).Return([]*pushsubscription.PushSubscription{}, nil)

	sender := NewSender("pub", "priv", "mailto:test@example.com", repo)
	err := sender.SendToAll(ctx, PushMessage{Title: "hi"})

	assert.NoError(t, err)
	repo.AssertExpectations(t)
}

func TestSender_SendToAll_RepositoryError(t *testing.T) {
	ctx := context.Background()
	repo := new(MockRepository)
	repo.On("FindAll", ctx).Return(nil, assert.AnError)

	sender := NewSender("pub", "priv", "mailto:test@example.com", repo)
	err := sender.SendToAll(ctx, PushMessage{Title: "hi"})

	assert.Error(t, err)
	assert.ErrorContains(t, err, "failed to get subscriptions")
	repo.AssertExpectations(t)
}

func TestSender_SendToAll_RemovesInvalidSubscription(t *testing.T) {
	ctx := context.Background()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusGone)
	}))
	defer server.Close()

	sub := testSubscription(server.URL)
	repo := new(MockRepository)
	repo.On("FindAll", ctx).Return([]*pushsubscription.PushSubscription{sub}, nil)
	repo.On("Delete", ctx, sub.ID()).Return(nil)

	sender := NewSender("pub", "priv", "mailto:test@example.com", repo)
	err := sender.SendToAll(ctx, PushMessage{Title: "hi"})

	assert.NoError(t, err, "SendToAll never returns per-subscription errors")
	repo.AssertExpectations(t)
}

func TestSender_IsEnabled(t *testing.T) {
	repo := new(MockRepository)

	assert.True(t, NewSender("pub", "priv", "mailto:test@example.com", repo).IsEnabled())
	assert.False(t, NewSender("", "priv", "mailto:test@example.com", repo).IsEnabled())
	assert.False(t, NewSender("pub", "", "mailto:test@example.com", repo).IsEnabled())
	assert.False(t, NewSender("", "", "mailto:test@example.com", repo).IsEnabled())
}
