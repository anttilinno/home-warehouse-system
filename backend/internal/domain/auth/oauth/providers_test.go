package oauth

import (
	"context"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/endpoints"
)

func TestGoogleConfig(t *testing.T) {
	cfg := GoogleConfig("client-id", "client-secret", "https://example.com")

	if cfg.ClientID != "client-id" {
		t.Errorf("ClientID = %q, want %q", cfg.ClientID, "client-id")
	}
	if cfg.ClientSecret != "client-secret" {
		t.Errorf("ClientSecret = %q, want %q", cfg.ClientSecret, "client-secret")
	}
	wantRedirect := "https://example.com/auth/oauth/google/callback"
	if cfg.RedirectURL != wantRedirect {
		t.Errorf("RedirectURL = %q, want %q", cfg.RedirectURL, wantRedirect)
	}
	if got := cfg.Endpoint; got != endpoints.Google {
		t.Errorf("Endpoint = %+v, want %+v", got, endpoints.Google)
	}
	wantScopes := []string{"openid", "email", "profile"}
	if len(cfg.Scopes) != len(wantScopes) {
		t.Fatalf("Scopes = %v, want %v", cfg.Scopes, wantScopes)
	}
	for i, s := range wantScopes {
		if cfg.Scopes[i] != s {
			t.Errorf("Scopes[%d] = %q, want %q", i, cfg.Scopes[i], s)
		}
	}
}

func TestGitHubConfig(t *testing.T) {
	cfg := GitHubConfig("client-id", "client-secret", "https://example.com")

	if cfg.ClientID != "client-id" {
		t.Errorf("ClientID = %q, want %q", cfg.ClientID, "client-id")
	}
	if cfg.ClientSecret != "client-secret" {
		t.Errorf("ClientSecret = %q, want %q", cfg.ClientSecret, "client-secret")
	}
	wantRedirect := "https://example.com/auth/oauth/github/callback"
	if cfg.RedirectURL != wantRedirect {
		t.Errorf("RedirectURL = %q, want %q", cfg.RedirectURL, wantRedirect)
	}
	if got := cfg.Endpoint; got != endpoints.GitHub {
		t.Errorf("Endpoint = %+v, want %+v", got, endpoints.GitHub)
	}
	wantScopes := []string{"user:email"}
	if len(cfg.Scopes) != len(wantScopes) || cfg.Scopes[0] != wantScopes[0] {
		t.Errorf("Scopes = %v, want %v", cfg.Scopes, wantScopes)
	}
}

// rewriteTransport redirects every request to targetURL's host, regardless of
// the URL the OAuth client code hardcodes, so provider fetchers can be
// pointed at an httptest server without changing production code.
type rewriteTransport struct {
	target *url.URL
}

func (rt *rewriteTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	req = req.Clone(req.Context())
	req.URL.Scheme = rt.target.Scheme
	req.URL.Host = rt.target.Host
	return http.DefaultTransport.RoundTrip(req)
}

func contextWithRedirectingClient(t *testing.T, server *httptest.Server) context.Context {
	t.Helper()
	target, err := url.Parse(server.URL)
	if err != nil {
		t.Fatalf("parse server URL: %v", err)
	}
	client := &http.Client{Transport: &rewriteTransport{target: target}}
	return context.WithValue(context.Background(), oauth2.HTTPClient, client)
}

func TestFetchGoogleProfile(t *testing.T) {
	var gotAuth string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotAuth = r.Header.Get("Authorization")
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"sub": "12345",
			"email": "user@example.com",
			"email_verified": true,
			"name": "Jane Doe",
			"picture": "https://example.com/avatar.png"
		}`))
	}))
	defer server.Close()

	ctx := contextWithRedirectingClient(t, server)
	token := &oauth2.Token{AccessToken: "test-access-token"}

	profile, err := FetchGoogleProfile(ctx, token, &oauth2.Config{})
	if err != nil {
		t.Fatalf("FetchGoogleProfile: %v", err)
	}

	if gotAuth != "Bearer test-access-token" {
		t.Errorf("Authorization header = %q, want %q", gotAuth, "Bearer test-access-token")
	}
	want := &OAuthProfile{
		Provider:       "google",
		ProviderUserID: "12345",
		Email:          "user@example.com",
		EmailVerified:  true,
		FullName:       "Jane Doe",
		AvatarURL:      "https://example.com/avatar.png",
	}
	if *profile != *want {
		t.Errorf("profile = %+v, want %+v", profile, want)
	}
}

func TestFetchGoogleProfile_NonOKStatus(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = w.Write([]byte(`{"error": "invalid_token"}`))
	}))
	defer server.Close()

	ctx := contextWithRedirectingClient(t, server)
	_, err := FetchGoogleProfile(ctx, &oauth2.Token{AccessToken: "tok"}, &oauth2.Config{})
	if err == nil {
		t.Fatal("expected error for non-200 response, got nil")
	}
}

func TestFetchGoogleProfile_MalformedJSON(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{not json`))
	}))
	defer server.Close()

	ctx := contextWithRedirectingClient(t, server)
	_, err := FetchGoogleProfile(ctx, &oauth2.Token{AccessToken: "tok"}, &oauth2.Config{})
	if err == nil {
		t.Fatal("expected error for malformed JSON, got nil")
	}
}

func TestFetchGitHubProfile(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/user", func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{
			"id": 999,
			"login": "janedoe",
			"name": "Jane Doe",
			"avatar_url": "https://example.com/avatar.png",
			"email": null
		}`))
	})
	mux.HandleFunc("/user/emails", func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`[
			{"email": "secondary@example.com", "primary": false, "verified": true},
			{"email": "primary@example.com", "primary": true, "verified": true}
		]`))
	})
	server := httptest.NewServer(mux)
	defer server.Close()

	ctx := contextWithRedirectingClient(t, server)
	profile, err := FetchGitHubProfile(ctx, &oauth2.Token{AccessToken: "tok"}, &oauth2.Config{})
	if err != nil {
		t.Fatalf("FetchGitHubProfile: %v", err)
	}

	want := &OAuthProfile{
		Provider:       "github",
		ProviderUserID: "999",
		Email:          "primary@example.com",
		EmailVerified:  true,
		FullName:       "Jane Doe",
		AvatarURL:      "https://example.com/avatar.png",
	}
	if *profile != *want {
		t.Errorf("profile = %+v, want %+v", profile, want)
	}
}

func TestFetchGitHubProfile_NoNameFallsBackToLogin(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/user", func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"id": 1, "login": "janedoe", "name": "", "avatar_url": ""}`))
	})
	mux.HandleFunc("/user/emails", func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`[{"email": "jane@example.com", "primary": true, "verified": true}]`))
	})
	server := httptest.NewServer(mux)
	defer server.Close()

	ctx := contextWithRedirectingClient(t, server)
	profile, err := FetchGitHubProfile(ctx, &oauth2.Token{AccessToken: "tok"}, &oauth2.Config{})
	if err != nil {
		t.Fatalf("FetchGitHubProfile: %v", err)
	}
	if profile.FullName != "janedoe" {
		t.Errorf("FullName = %q, want fallback to login %q", profile.FullName, "janedoe")
	}
}

func TestFetchGitHubProfile_NoPrimaryVerifiedEmail(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/user", func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"id": 1, "login": "janedoe", "name": "Jane Doe"}`))
	})
	mux.HandleFunc("/user/emails", func(w http.ResponseWriter, r *http.Request) {
		// Primary email exists but is unverified — must not be selected.
		_, _ = w.Write([]byte(`[{"email": "unverified@example.com", "primary": true, "verified": false}]`))
	})
	server := httptest.NewServer(mux)
	defer server.Close()

	ctx := contextWithRedirectingClient(t, server)
	profile, err := FetchGitHubProfile(ctx, &oauth2.Token{AccessToken: "tok"}, &oauth2.Config{})
	if err != nil {
		t.Fatalf("FetchGitHubProfile: %v", err)
	}
	if profile.Email != "" || profile.EmailVerified {
		t.Errorf("profile = %+v, want empty unverified email", profile)
	}
}

func TestFetchGitHubProfile_UserEndpointError(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/user", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusForbidden)
	})
	server := httptest.NewServer(mux)
	defer server.Close()

	ctx := contextWithRedirectingClient(t, server)
	_, err := FetchGitHubProfile(ctx, &oauth2.Token{AccessToken: "tok"}, &oauth2.Config{})
	if err == nil {
		t.Fatal("expected error when /user returns non-200, got nil")
	}
}

func TestFetchGitHubProfile_EmailsEndpointError(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/user", func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"id": 1, "login": "janedoe"}`))
	})
	mux.HandleFunc("/user/emails", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	})
	server := httptest.NewServer(mux)
	defer server.Close()

	ctx := contextWithRedirectingClient(t, server)
	_, err := FetchGitHubProfile(ctx, &oauth2.Token{AccessToken: "tok"}, &oauth2.Config{})
	if err == nil {
		t.Fatal("expected error when /user/emails returns non-200, got nil")
	}
}
