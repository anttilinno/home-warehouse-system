package pushsubscription

import (
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestValidateEndpoint(t *testing.T) {
	valid := []string{
		"https://fcm.googleapis.com/fcm/send/abc123",
		"https://updates.push.services.mozilla.com/wpush/v2/xyz",
		"https://web.push.apple.com/QOZpQ",
		"https://203.0.113.10/push", // public IP literal is allowed
	}
	for _, endpoint := range valid {
		t.Run("valid "+endpoint, func(t *testing.T) {
			assert.NoError(t, validateEndpoint(endpoint))
		})
	}

	invalid := []string{
		"http://fcm.googleapis.com/fcm/send/abc123", // not https
		"https://localhost/push",
		"https://foo.localhost/push",
		"https://127.0.0.1/push",
		"https://[::1]/push",
		"https://169.254.169.254/latest/meta-data/", // link-local / metadata service
		"https://10.0.0.5/internal",
		"https://192.168.1.1/admin",
		"https://172.16.0.1/router",
		"https://0.0.0.0/",
		"ftp://example.com/x",
		"not-a-url-at-all://",
		"https://",
	}
	for _, endpoint := range invalid {
		t.Run("invalid "+endpoint, func(t *testing.T) {
			assert.Error(t, validateEndpoint(endpoint), "endpoint should be rejected: %s", endpoint)
		})
	}
}

func TestNewPushSubscription_RejectsSSRFEndpoint(t *testing.T) {
	_, err := NewPushSubscription(uuid.New(), "https://169.254.169.254/x", "p256dh-key", "auth-secret", nil)
	assert.Error(t, err)

	sub, err := NewPushSubscription(uuid.New(), "https://fcm.googleapis.com/fcm/send/abc", "p256dh-key", "auth-secret", nil)
	assert.NoError(t, err)
	assert.NotNil(t, sub)
}
