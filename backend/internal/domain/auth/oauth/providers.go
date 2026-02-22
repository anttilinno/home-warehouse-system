package oauth

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/endpoints"
)

// GoogleConfig returns an OAuth2 config for Google sign-in.
func GoogleConfig(clientID, clientSecret, backendURL string) *oauth2.Config {
	return &oauth2.Config{
		ClientID:     clientID,
		ClientSecret: clientSecret,
		RedirectURL:  backendURL + "/auth/oauth/google/callback",
		Scopes:       []string{"openid", "email", "profile"},
		Endpoint:     endpoints.Google,
	}
}

// GitHubConfig returns an OAuth2 config for GitHub sign-in.
func GitHubConfig(clientID, clientSecret, backendURL string) *oauth2.Config {
	return &oauth2.Config{
		ClientID:     clientID,
		ClientSecret: clientSecret,
		RedirectURL:  backendURL + "/auth/oauth/github/callback",
		Scopes:       []string{"user:email"},
		Endpoint:     endpoints.GitHub,
	}
}

// googleUserInfo represents the JSON response from Google's userinfo endpoint.
type googleUserInfo struct {
	Sub           string `json:"sub"`
	Email         string `json:"email"`
	EmailVerified bool   `json:"email_verified"`
	Name          string `json:"name"`
	Picture       string `json:"picture"`
}

// FetchGoogleProfile fetches the user's profile from Google using the provided token.
func FetchGoogleProfile(ctx context.Context, token *oauth2.Token, cfg *oauth2.Config) (*OAuthProfile, error) {
	client := cfg.Client(ctx, token)

	resp, err := client.Get("https://www.googleapis.com/oauth2/v3/userinfo")
	if err != nil {
		return nil, fmt.Errorf("failed to fetch Google profile: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("Google userinfo returned %d: %s", resp.StatusCode, string(body))
	}

	var info googleUserInfo
	if err := json.NewDecoder(resp.Body).Decode(&info); err != nil {
		return nil, fmt.Errorf("failed to decode Google profile: %w", err)
	}

	return &OAuthProfile{
		Provider:       "google",
		ProviderUserID: info.Sub,
		Email:          info.Email,
		EmailVerified:  info.EmailVerified,
		FullName:       info.Name,
		AvatarURL:      info.Picture,
	}, nil
}

// githubUser represents the JSON response from GitHub's /user endpoint.
type githubUser struct {
	ID        int64  `json:"id"`
	Login     string `json:"login"`
	Name      string `json:"name"`
	AvatarURL string `json:"avatar_url"`
	Email     string `json:"email"` // May be null for private-email users
}

// githubEmail represents an entry from GitHub's /user/emails endpoint.
type githubEmail struct {
	Email    string `json:"email"`
	Primary  bool   `json:"primary"`
	Verified bool   `json:"verified"`
}

// FetchGitHubProfile fetches the user's profile from GitHub using the provided token.
// CRITICAL: Always uses /user/emails for email (Pitfall 8-G: /user may return null email for private-email users).
func FetchGitHubProfile(ctx context.Context, token *oauth2.Token, cfg *oauth2.Config) (*OAuthProfile, error) {
	client := cfg.Client(ctx, token)

	// Step 1: Fetch user profile
	resp, err := client.Get("https://api.github.com/user")
	if err != nil {
		return nil, fmt.Errorf("failed to fetch GitHub profile: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("GitHub /user returned %d: %s", resp.StatusCode, string(body))
	}

	var ghUser githubUser
	if err := json.NewDecoder(resp.Body).Decode(&ghUser); err != nil {
		return nil, fmt.Errorf("failed to decode GitHub profile: %w", err)
	}

	// Step 2: Fetch user emails (required because /user may have null email)
	emailResp, err := client.Get("https://api.github.com/user/emails")
	if err != nil {
		return nil, fmt.Errorf("failed to fetch GitHub emails: %w", err)
	}
	defer emailResp.Body.Close()

	if emailResp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(emailResp.Body)
		return nil, fmt.Errorf("GitHub /user/emails returned %d: %s", emailResp.StatusCode, string(body))
	}

	var emails []githubEmail
	if err := json.NewDecoder(emailResp.Body).Decode(&emails); err != nil {
		return nil, fmt.Errorf("failed to decode GitHub emails: %w", err)
	}

	// Find primary verified email
	var primaryEmail string
	var emailVerified bool
	for _, e := range emails {
		if e.Primary && e.Verified {
			primaryEmail = e.Email
			emailVerified = true
			break
		}
	}

	// If no primary verified email found, return profile with EmailVerified=false.
	// The service will reject this in the verification gate.

	// Determine display name: use name, fall back to login
	displayName := ghUser.Name
	if displayName == "" {
		displayName = ghUser.Login
	}

	return &OAuthProfile{
		Provider:       "github",
		ProviderUserID: strconv.FormatInt(ghUser.ID, 10),
		Email:          primaryEmail,
		EmailVerified:  emailVerified,
		FullName:       displayName,
		AvatarURL:      ghUser.AvatarURL,
	}, nil
}
