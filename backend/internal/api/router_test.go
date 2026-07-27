package api_test

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/antti/home-warehouse/go-backend/internal/api"
	"github.com/antti/home-warehouse/go-backend/internal/config"
)

// Building the router is the whole test. huma keys its schema registry by BARE
// type name, so two packages exporting the same response type name (the
// location-photo types are called LocationPhoto* precisely to dodge this)
// panic during route registration — i.e. at boot, in production, on a binary
// whose `go test ./...` was green.
//
// Until now only the tagged integration lane caught that, because it was the
// only thing that built the real router — and it needs a live Postgres, so it
// does not run on the default path. NewRouter dials nothing (every repository
// constructor just stores the pool; queries.New takes an interface), so a nil
// pool is enough to register all 32 domains across all six huma API instances.
// The router is never served here, so no query ever runs against that nil.
func TestNewRouter_RegistersEveryRouteWithoutSchemaCollision(t *testing.T) {
	for _, tc := range []struct {
		name     string
		authelia bool
	}{
		// The Authelia SSO routes sit behind a config flag and get their own
		// huma instance, so they are only registered — and only collision-
		// checked — when it is on.
		{name: "default", authelia: false},
		{name: "authelia enabled", authelia: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			// NewRouter MkdirAll's these and probes them with a .write_test
			// file; without the override it would litter ./uploads/photos and
			// /tmp/photo-uploads from a unit-test run.
			t.Setenv("PHOTO_STORAGE_DIR", t.TempDir())
			t.Setenv("PHOTO_UPLOAD_DIR", t.TempDir())

			cfg := &config.Config{
				// Parsed, never dialed — but a value that fails to parse is a
				// log.Fatalf, which would take the test binary with it.
				RedisURL:           "redis://localhost:6379/0",
				JWTSecret:          "test-secret-key-for-the-router-construction-test",
				JWTExpirationHours: 24,
				MaxBodyBytes:       64 << 20,
				BackendURL:         "http://localhost:8080",
				DebugMode:          true,
				AutheliaEnabled:    tc.authelia,
				// Exercises the crypto.NewEncryptor branch rather than the
				// nil-encryptor one.
				PaperlessTokenKey: "test-paperless-token-key",
			}

			require.NotNil(t, api.NewRouter(nil, cfg))
		})
	}
}
