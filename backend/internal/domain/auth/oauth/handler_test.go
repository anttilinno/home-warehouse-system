package oauth

import (
	"context"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/go-chi/chi/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/oauth2"

	"github.com/antti/home-warehouse/go-backend/internal/config"
)

// fakeRedisClient is an in-memory stand-in for the Redis one-time-code store.
// GetDel deletes on read, matching real Redis GETDEL semantics -- this is what
// makes the reuse-rejection test meaningful.
type fakeRedisClient struct {
	store     map[string]string
	lastTTL   time.Duration
	setErr    error
	getDelErr error
}

func newFakeRedisClient() *fakeRedisClient {
	return &fakeRedisClient{store: make(map[string]string)}
}

func (f *fakeRedisClient) Set(_ context.Context, key, value string, expiration time.Duration) error {
	if f.setErr != nil {
		return f.setErr
	}
	f.lastTTL = expiration
	f.store[key] = value
	return nil
}

func (f *fakeRedisClient) GetDel(_ context.Context, key string) (string, error) {
	if f.getDelErr != nil {
		return "", f.getDelErr
	}
	v, ok := f.store[key]
	if !ok {
		return "", nil
	}
	delete(f.store, key)
	return v, nil
}

func newChiRequest(method, target, provider string) *http.Request {
	req := httptest.NewRequest(method, target, nil)
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("provider", provider)
	return req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))
}

func assertRedirectError(t *testing.T, w *httptest.ResponseRecorder, code string) {
	t.Helper()
	assert.Equal(t, http.StatusTemporaryRedirect, w.Code)
	loc, err := url.Parse(w.Header().Get("Location"))
	require.NoError(t, err)
	assert.Equal(t, code, loc.Query().Get("error"))
}

func findCookie(cookies []*http.Cookie, name string) *http.Cookie {
	for _, c := range cookies {
		if c.Name == name {
			return c
		}
	}
	return nil
}

func testConfig() *config.Config {
	return &config.Config{AppEnv: "production", AppURL: "https://app.example.com"}
}

// --- Initiate: PKCE + state cookie ---

func TestHandler_Initiate_UnsupportedProvider(t *testing.T) {
	h := &Handler{cfg: testConfig(), providerConfigs: map[string]*oauth2.Config{}}
	req := newChiRequest(http.MethodGet, "/auth/oauth/unknown", "unknown")
	w := httptest.NewRecorder()

	h.Initiate(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
	assert.Contains(t, w.Body.String(), "invalid_provider")
}

func TestHandler_Initiate_SetsPKCEStateCookieAndRedirects(t *testing.T) {
	fakeCfg := &oauth2.Config{
		ClientID: "client-id",
		Endpoint: oauth2.Endpoint{AuthURL: "https://provider.example.com/auth"},
	}
	h := &Handler{
		cfg:             testConfig(),
		providerConfigs: map[string]*oauth2.Config{"test": fakeCfg},
	}
	req := newChiRequest(http.MethodGet, "/auth/oauth/test", "test")
	w := httptest.NewRecorder()

	h.Initiate(w, req)

	assert.Equal(t, http.StatusTemporaryRedirect, w.Code)

	stateCookie := findCookie(w.Result().Cookies(), oauthStateCookie)
	require.NotNil(t, stateCookie)
	assert.True(t, stateCookie.HttpOnly)
	assert.True(t, stateCookie.Secure) // production => secure cookies
	assert.Equal(t, oauthStateCookieMaxAge, stateCookie.MaxAge)

	parts := strings.SplitN(stateCookie.Value, "|", 2)
	require.Len(t, parts, 2)
	state, verifier := parts[0], parts[1]
	assert.NotEmpty(t, state)
	assert.NotEmpty(t, verifier)

	loc, err := url.Parse(w.Header().Get("Location"))
	require.NoError(t, err)
	assert.Equal(t, state, loc.Query().Get("state"))
	assert.Equal(t, "S256", loc.Query().Get("code_challenge_method"))
	assert.NotEmpty(t, loc.Query().Get("code_challenge"))
}

// --- Callback: state-cookie CSRF validation + error paths ---

func TestHandler_Callback_UnsupportedProvider(t *testing.T) {
	h := &Handler{cfg: testConfig(), providerConfigs: map[string]*oauth2.Config{}}
	req := newChiRequest(http.MethodGet, "/auth/oauth/unknown/callback", "unknown")
	w := httptest.NewRecorder()

	h.Callback(w, req)

	assertRedirectError(t, w, "provider_unavailable")
}

func TestHandler_Callback_MissingStateCookie(t *testing.T) {
	fakeCfg := &oauth2.Config{Endpoint: oauth2.Endpoint{AuthURL: "https://provider.example.com/auth"}}
	h := &Handler{cfg: testConfig(), providerConfigs: map[string]*oauth2.Config{"test": fakeCfg}}
	req := newChiRequest(http.MethodGet, "/auth/oauth/test/callback?state=abc123", "test")
	w := httptest.NewRecorder()

	h.Callback(w, req)

	assertRedirectError(t, w, "invalid_state")
}

func TestHandler_Callback_MalformedStateCookie(t *testing.T) {
	fakeCfg := &oauth2.Config{Endpoint: oauth2.Endpoint{AuthURL: "https://provider.example.com/auth"}}
	h := &Handler{cfg: testConfig(), providerConfigs: map[string]*oauth2.Config{"test": fakeCfg}}
	req := newChiRequest(http.MethodGet, "/auth/oauth/test/callback?state=abc123", "test")
	req.AddCookie(&http.Cookie{Name: oauthStateCookie, Value: "no-pipe-separator"})
	w := httptest.NewRecorder()

	h.Callback(w, req)

	assertRedirectError(t, w, "invalid_state")
}

func TestHandler_Callback_StateMismatch(t *testing.T) {
	fakeCfg := &oauth2.Config{Endpoint: oauth2.Endpoint{AuthURL: "https://provider.example.com/auth"}}
	h := &Handler{cfg: testConfig(), providerConfigs: map[string]*oauth2.Config{"test": fakeCfg}}
	req := newChiRequest(http.MethodGet, "/auth/oauth/test/callback?state=attacker-supplied", "test")
	req.AddCookie(&http.Cookie{Name: oauthStateCookie, Value: "expected-state|verifier"})
	w := httptest.NewRecorder()

	h.Callback(w, req)

	assertRedirectError(t, w, "invalid_state")
}

func TestHandler_Callback_AuthorizationCancelled(t *testing.T) {
	fakeCfg := &oauth2.Config{Endpoint: oauth2.Endpoint{AuthURL: "https://provider.example.com/auth"}}
	h := &Handler{cfg: testConfig(), providerConfigs: map[string]*oauth2.Config{"test": fakeCfg}}
	req := newChiRequest(http.MethodGet, "/auth/oauth/test/callback?state=abc123&error=access_denied", "test")
	req.AddCookie(&http.Cookie{Name: oauthStateCookie, Value: "abc123|verifier"})
	w := httptest.NewRecorder()

	h.Callback(w, req)

	assertRedirectError(t, w, "authorization_cancelled")

	// State cookie must be cleared once consumed, even on a rejected flow.
	cleared := findCookie(w.Result().Cookies(), oauthStateCookie)
	require.NotNil(t, cleared)
	assert.Equal(t, -1, cleared.MaxAge)
}

func TestHandler_Callback_TokenExchangeError(t *testing.T) {
	tokenSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
		_, _ = w.Write([]byte(`{"error":"invalid_grant"}`))
	}))
	defer tokenSrv.Close()

	fakeCfg := &oauth2.Config{
		ClientID:     "client-id",
		ClientSecret: "secret",
		Endpoint:     oauth2.Endpoint{AuthURL: tokenSrv.URL + "/auth", TokenURL: tokenSrv.URL + "/token"},
	}
	h := &Handler{cfg: testConfig(), providerConfigs: map[string]*oauth2.Config{"test": fakeCfg}}
	req := newChiRequest(http.MethodGet, "/auth/oauth/test/callback?state=abc123&code=authcode123", "test")
	req.AddCookie(&http.Cookie{Name: oauthStateCookie, Value: "abc123|verifier"})
	w := httptest.NewRecorder()

	h.Callback(w, req)

	assertRedirectError(t, w, "server_error")
}

// --- ExchangeCode: one-time code exchange, TTL expiry, reuse rejection ---

func TestHandler_ExchangeCode_EmptyCode(t *testing.T) {
	h := &Handler{cfg: testConfig(), redisClient: newFakeRedisClient()}

	out, err := h.ExchangeCode(context.Background(), &ExchangeInput{})

	require.Error(t, err)
	assert.Nil(t, out)
	var statusErr huma.StatusError
	require.ErrorAs(t, err, &statusErr)
	assert.Equal(t, http.StatusBadRequest, statusErr.GetStatus())
}

func TestHandler_ExchangeCode_Success(t *testing.T) {
	redis := newFakeRedisClient()
	h := &Handler{cfg: testConfig(), redisClient: redis}

	code, err := StoreOneTimeCode(context.Background(), redis, "access-tok", "refresh-tok")
	require.NoError(t, err)
	assert.Equal(t, oauthCodeTTL, redis.lastTTL)

	out, err := h.ExchangeCode(context.Background(), &ExchangeInput{Body: struct {
		Code string `json:"code" required:"true" minLength:"1"`
	}{Code: code}})

	require.NoError(t, err)
	require.NotNil(t, out)
	assert.Equal(t, "access-tok", out.Body.Token)
	assert.Equal(t, "refresh-tok", out.Body.RefreshToken)
	require.Len(t, out.SetCookie, 2)
	access := out.SetCookie[0]
	assert.Equal(t, accessTokenCookie, access.Name)
	assert.Equal(t, "access-tok", access.Value)
	assert.True(t, access.Secure)
	refresh := out.SetCookie[1]
	assert.Equal(t, refreshTokenCookie, refresh.Name)
	assert.Equal(t, "refresh-tok", refresh.Value)
}

func TestHandler_ExchangeCode_ExpiredOrUnknownCode(t *testing.T) {
	h := &Handler{cfg: testConfig(), redisClient: newFakeRedisClient()}

	out, err := h.ExchangeCode(context.Background(), &ExchangeInput{Body: struct {
		Code string `json:"code" required:"true" minLength:"1"`
	}{Code: "never-issued-or-expired"}})

	require.Error(t, err)
	assert.Nil(t, out)
	var statusErr huma.StatusError
	require.ErrorAs(t, err, &statusErr)
	assert.Equal(t, http.StatusUnauthorized, statusErr.GetStatus())
}

func TestHandler_ExchangeCode_RedisErrorRejected(t *testing.T) {
	redis := newFakeRedisClient()
	redis.getDelErr = assert.AnError
	h := &Handler{cfg: testConfig(), redisClient: redis}

	out, err := h.ExchangeCode(context.Background(), &ExchangeInput{Body: struct {
		Code string `json:"code" required:"true" minLength:"1"`
	}{Code: "some-code"}})

	require.Error(t, err)
	assert.Nil(t, out)
	var statusErr huma.StatusError
	require.ErrorAs(t, err, &statusErr)
	assert.Equal(t, http.StatusUnauthorized, statusErr.GetStatus())
}

func TestHandler_ExchangeCode_ReuseRejected(t *testing.T) {
	redis := newFakeRedisClient()
	h := &Handler{cfg: testConfig(), redisClient: redis}

	code, err := StoreOneTimeCode(context.Background(), redis, "access-tok", "refresh-tok")
	require.NoError(t, err)

	input := &ExchangeInput{Body: struct {
		Code string `json:"code" required:"true" minLength:"1"`
	}{Code: code}}

	_, err = h.ExchangeCode(context.Background(), input)
	require.NoError(t, err)

	// Second exchange of the same one-time code must fail: GetDel already
	// consumed it from the store.
	out, err := h.ExchangeCode(context.Background(), input)

	require.Error(t, err)
	assert.Nil(t, out)
	var statusErr huma.StatusError
	require.ErrorAs(t, err, &statusErr)
	assert.Equal(t, http.StatusUnauthorized, statusErr.GetStatus())
}

func TestHandler_ExchangeCode_MalformedStoredValue(t *testing.T) {
	redis := newFakeRedisClient()
	redis.store[oauthCodePrefix+"broken-code"] = "no-separator-here"
	h := &Handler{cfg: testConfig(), redisClient: redis}

	out, err := h.ExchangeCode(context.Background(), &ExchangeInput{Body: struct {
		Code string `json:"code" required:"true" minLength:"1"`
	}{Code: "broken-code"}})

	require.Error(t, err)
	assert.Nil(t, out)
	var statusErr huma.StatusError
	require.ErrorAs(t, err, &statusErr)
	assert.Equal(t, http.StatusInternalServerError, statusErr.GetStatus())
}

// --- StoreOneTimeCode ---

func TestStoreOneTimeCode_RedisErrorPropagates(t *testing.T) {
	redis := newFakeRedisClient()
	redis.setErr = assert.AnError

	code, err := StoreOneTimeCode(context.Background(), redis, "access-tok", "refresh-tok")

	require.Error(t, err)
	assert.Empty(t, code)
}
