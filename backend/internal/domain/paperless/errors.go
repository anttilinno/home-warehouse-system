package paperless

import "errors"

var (
	// ErrNotConfigured means the workspace has no Paperless settings row.
	ErrNotConfigured = errors.New("paperless integration is not configured for this workspace")
	// ErrNotEnabled means settings exist but is_enabled is false.
	ErrNotEnabled = errors.New("paperless integration is disabled for this workspace")
	// ErrTokenRequired means the first save attempt did not include an API token.
	ErrTokenRequired = errors.New("api token is required when configuring paperless for the first time")
	// ErrInvalidBaseURL means the base URL is empty or not http(s).
	ErrInvalidBaseURL = errors.New("base url must be a valid http(s) URL")
	// ErrEncryptionKeyMissing means PAPERLESS_TOKEN_KEY is not configured on
	// the server, so tokens can neither be stored nor used.
	ErrEncryptionKeyMissing = errors.New("PAPERLESS_TOKEN_KEY is not configured on the server")
)
