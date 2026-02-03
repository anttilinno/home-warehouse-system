package session

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net"
	"time"

	"github.com/google/uuid"
	"github.com/mssola/useragent"
)

// Session represents an active user session.
type Session struct {
	id               uuid.UUID
	userID           uuid.UUID
	refreshTokenHash string
	deviceInfo       string
	ipAddress        net.IP
	userAgent        string
	lastActiveAt     time.Time
	expiresAt        time.Time
	createdAt        time.Time
}

// NewSession creates a new session from login data.
func NewSession(userID uuid.UUID, refreshToken, userAgentStr, ipAddress string, expiresAt time.Time) *Session {
	return &Session{
		id:               uuid.Must(uuid.NewV7()),
		userID:           userID,
		refreshTokenHash: HashToken(refreshToken),
		deviceInfo:       ParseDeviceInfo(userAgentStr),
		ipAddress:        net.ParseIP(ipAddress),
		userAgent:        userAgentStr,
		lastActiveAt:     time.Now(),
		expiresAt:        expiresAt,
		createdAt:        time.Now(),
	}
}

// Reconstitute creates a Session from persistence data.
func Reconstitute(id, userID uuid.UUID, tokenHash, deviceInfo, ipAddr, userAgent string, lastActive, expires, created time.Time) *Session {
	return &Session{
		id:               id,
		userID:           userID,
		refreshTokenHash: tokenHash,
		deviceInfo:       deviceInfo,
		ipAddress:        net.ParseIP(ipAddr),
		userAgent:        userAgent,
		lastActiveAt:     lastActive,
		expiresAt:        expires,
		createdAt:        created,
	}
}

// Getters
func (s *Session) ID() uuid.UUID           { return s.id }
func (s *Session) UserID() uuid.UUID       { return s.userID }
func (s *Session) TokenHash() string       { return s.refreshTokenHash }
func (s *Session) DeviceInfo() string      { return s.deviceInfo }
func (s *Session) UserAgent() string       { return s.userAgent }
func (s *Session) LastActiveAt() time.Time { return s.lastActiveAt }
func (s *Session) ExpiresAt() time.Time    { return s.expiresAt }
func (s *Session) CreatedAt() time.Time    { return s.createdAt }

// IPAddress returns the IP address as a string.
func (s *Session) IPAddress() string {
	if s.ipAddress == nil {
		return ""
	}
	return s.ipAddress.String()
}

// UpdateActivity updates the session's last active time and token hash.
func (s *Session) UpdateActivity(newRefreshToken string) {
	s.refreshTokenHash = HashToken(newRefreshToken)
	s.lastActiveAt = time.Now()
}

// HashToken creates SHA-256 hash of a refresh token.
func HashToken(token string) string {
	hash := sha256.Sum256([]byte(token))
	return hex.EncodeToString(hash[:])
}

// ParseDeviceInfo extracts human-readable device description from user agent.
func ParseDeviceInfo(userAgentStr string) string {
	if userAgentStr == "" {
		return "Unknown device"
	}
	ua := useragent.New(userAgentStr)
	browser, version := ua.Browser()
	os := ua.OS()

	if ua.Mobile() {
		if os == "iOS" || os == "iPhone OS" {
			return fmt.Sprintf("%s on iPhone", browser)
		}
		return fmt.Sprintf("%s on Android", browser)
	}

	if browser != "" && os != "" {
		return fmt.Sprintf("%s %s on %s", browser, version, os)
	}
	if browser != "" {
		return browser
	}
	return "Unknown device"
}
