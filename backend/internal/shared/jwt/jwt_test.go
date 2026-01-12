package jwt

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestNewService(t *testing.T) {
	svc := NewService("test-secret", 24)
	assert.NotNil(t, svc)
}

func TestService_GenerateToken(t *testing.T) {
	svc := NewService("test-secret-key-that-is-long-enough", 24)
	userID := uuid.New()
	email := "test@example.com"

	tests := []struct {
		testName    string
		userID      uuid.UUID
		email       string
		isSuperuser bool
	}{
		{
			testName:    "generate token for regular user",
			userID:      userID,
			email:       email,
			isSuperuser: false,
		},
		{
			testName:    "generate token for superuser",
			userID:      userID,
			email:       email,
			isSuperuser: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			token, err := svc.GenerateToken(tt.userID, tt.email, tt.isSuperuser)

			assert.NoError(t, err)
			assert.NotEmpty(t, token)

			// Validate the token
			claims, err := svc.ValidateToken(token)
			assert.NoError(t, err)
			assert.Equal(t, tt.userID, claims.UserID)
			assert.Equal(t, tt.email, claims.Email)
			assert.Equal(t, tt.isSuperuser, claims.IsSuperuser)
		})
	}
}

func TestService_ValidateToken(t *testing.T) {
	svc := NewService("test-secret-key-that-is-long-enough", 24)
	userID := uuid.New()
	email := "test@example.com"

	tests := []struct {
		testName   string
		setupToken func() string
		wantErr    error
		validateFn func(*testing.T, *Claims)
	}{
		{
			testName: "valid token",
			setupToken: func() string {
				token, _ := svc.GenerateToken(userID, email, false)
				return token
			},
			wantErr: nil,
			validateFn: func(t *testing.T, claims *Claims) {
				assert.Equal(t, userID, claims.UserID)
				assert.Equal(t, email, claims.Email)
				assert.False(t, claims.IsSuperuser)
			},
		},
		{
			testName: "invalid token format",
			setupToken: func() string {
				return "invalid-token"
			},
			wantErr: ErrInvalidToken,
		},
		{
			testName: "empty token",
			setupToken: func() string {
				return ""
			},
			wantErr: ErrInvalidToken,
		},
		{
			testName: "token signed with different secret",
			setupToken: func() string {
				otherSvc := NewService("different-secret-key", 24)
				token, _ := otherSvc.GenerateToken(userID, email, false)
				return token
			},
			wantErr: ErrInvalidToken,
		},
		{
			testName: "malformed JWT",
			setupToken: func() string {
				return "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature"
			},
			wantErr: ErrInvalidToken,
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			token := tt.setupToken()
			claims, err := svc.ValidateToken(token)

			if tt.wantErr != nil {
				assert.Error(t, err)
				assert.Equal(t, tt.wantErr, err)
				assert.Nil(t, claims)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, claims)
				if tt.validateFn != nil {
					tt.validateFn(t, claims)
				}
			}
		})
	}
}

func TestService_GenerateRefreshToken(t *testing.T) {
	svc := NewService("test-secret-key-that-is-long-enough", 24)
	userID := uuid.New()

	token, err := svc.GenerateRefreshToken(userID)

	assert.NoError(t, err)
	assert.NotEmpty(t, token)

	// Validate the refresh token
	parsedID, err := svc.ValidateRefreshToken(token)
	assert.NoError(t, err)
	assert.Equal(t, userID, parsedID)
}

func TestService_ValidateRefreshToken(t *testing.T) {
	svc := NewService("test-secret-key-that-is-long-enough", 24)
	userID := uuid.New()

	tests := []struct {
		testName   string
		setupToken func() string
		wantErr    error
		wantUserID uuid.UUID
	}{
		{
			testName: "valid refresh token",
			setupToken: func() string {
				token, _ := svc.GenerateRefreshToken(userID)
				return token
			},
			wantErr:    nil,
			wantUserID: userID,
		},
		{
			testName: "invalid token",
			setupToken: func() string {
				return "invalid-token"
			},
			wantErr:    ErrInvalidToken,
			wantUserID: uuid.Nil,
		},
		{
			testName: "token signed with different secret",
			setupToken: func() string {
				otherSvc := NewService("different-secret-key", 24)
				token, _ := otherSvc.GenerateRefreshToken(userID)
				return token
			},
			wantErr:    ErrInvalidToken,
			wantUserID: uuid.Nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.testName, func(t *testing.T) {
			token := tt.setupToken()
			parsedID, err := svc.ValidateRefreshToken(token)

			if tt.wantErr != nil {
				assert.Error(t, err)
				assert.Equal(t, tt.wantErr, err)
				assert.Equal(t, uuid.Nil, parsedID)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.wantUserID, parsedID)
			}
		})
	}
}

func TestService_TokenExpiration(t *testing.T) {
	// Create a service with very short expiration for testing
	// Note: This test is more of an integration test since we can't easily
	// manipulate time. In a real scenario, you'd use a clock interface.
	svc := NewService("test-secret-key-that-is-long-enough", 24)
	userID := uuid.New()

	token, err := svc.GenerateToken(userID, "test@example.com", false)
	assert.NoError(t, err)

	// Token should be valid immediately
	claims, err := svc.ValidateToken(token)
	assert.NoError(t, err)
	assert.NotNil(t, claims)

	// Check that expiration is set correctly (24 hours from now)
	assert.True(t, claims.ExpiresAt.After(time.Now().Add(23*time.Hour)))
	assert.True(t, claims.ExpiresAt.Before(time.Now().Add(25*time.Hour)))
}

func TestService_TokenClaims(t *testing.T) {
	svc := NewService("test-secret-key-that-is-long-enough", 24)
	userID := uuid.New()
	email := "test@example.com"

	token, err := svc.GenerateToken(userID, email, true)
	assert.NoError(t, err)

	claims, err := svc.ValidateToken(token)
	assert.NoError(t, err)

	// Verify all claims
	assert.Equal(t, userID, claims.UserID)
	assert.Equal(t, email, claims.Email)
	assert.True(t, claims.IsSuperuser)
	assert.Equal(t, "home-warehouse", claims.Issuer)
	assert.Equal(t, userID.String(), claims.Subject)
	assert.NotNil(t, claims.IssuedAt)
	assert.NotNil(t, claims.NotBefore)
	assert.NotNil(t, claims.ExpiresAt)
}

func TestClaims_Fields(t *testing.T) {
	claims := Claims{
		UserID:      uuid.New(),
		Email:       "test@example.com",
		IsSuperuser: true,
	}

	assert.NotEqual(t, uuid.Nil, claims.UserID)
	assert.Equal(t, "test@example.com", claims.Email)
	assert.True(t, claims.IsSuperuser)
}

func TestErrors(t *testing.T) {
	assert.Equal(t, "invalid token", ErrInvalidToken.Error())
	assert.Equal(t, "token has expired", ErrExpiredToken.Error())
}
