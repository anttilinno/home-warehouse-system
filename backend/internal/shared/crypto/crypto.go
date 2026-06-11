// Package crypto provides a small AES-256-GCM helper for encrypting
// application-layer secrets at rest (currently the per-workspace Paperless
// API token). The roadmap originally called for Fernet (a Python-ecosystem
// format); AES-GCM is the idiomatic Go equivalent — authenticated encryption
// with a random nonce — without pulling in a new dependency.
package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
)

// ErrInvalidCiphertext is returned when a ciphertext cannot be decrypted:
// wrong key, truncated payload, or tampered data.
var ErrInvalidCiphertext = errors.New("invalid ciphertext")

// Encryptor encrypts and decrypts short secrets with AES-256-GCM.
type Encryptor struct {
	aead cipher.AEAD
}

// NewEncryptor derives a 32-byte AES key from the given key material via
// SHA-256 and returns a ready-to-use Encryptor. Any non-empty string works as
// key material (e.g. `openssl rand -base64 32`).
func NewEncryptor(keyMaterial string) (*Encryptor, error) {
	if keyMaterial == "" {
		return nil, errors.New("encryption key material must not be empty")
	}

	key := sha256.Sum256([]byte(keyMaterial))
	block, err := aes.NewCipher(key[:])
	if err != nil {
		return nil, fmt.Errorf("create cipher: %w", err)
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("create GCM: %w", err)
	}
	return &Encryptor{aead: aead}, nil
}

// Encrypt returns base64(nonce || ciphertext) for the given plaintext.
func (e *Encryptor) Encrypt(plaintext string) (string, error) {
	nonce := make([]byte, e.aead.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return "", fmt.Errorf("generate nonce: %w", err)
	}
	sealed := e.aead.Seal(nonce, nonce, []byte(plaintext), nil)
	return base64.StdEncoding.EncodeToString(sealed), nil
}

// Decrypt reverses Encrypt. It returns ErrInvalidCiphertext when the payload
// is malformed or fails authentication (wrong key or tampering).
func (e *Encryptor) Decrypt(encoded string) (string, error) {
	raw, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return "", ErrInvalidCiphertext
	}
	nonceSize := e.aead.NonceSize()
	if len(raw) < nonceSize {
		return "", ErrInvalidCiphertext
	}
	plaintext, err := e.aead.Open(nil, raw[:nonceSize], raw[nonceSize:], nil)
	if err != nil {
		return "", ErrInvalidCiphertext
	}
	return string(plaintext), nil
}
