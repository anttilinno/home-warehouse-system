package crypto

import (
	"errors"
	"testing"
)

func TestEncryptor_RoundTrip(t *testing.T) {
	enc, err := NewEncryptor("test-key-material")
	if err != nil {
		t.Fatalf("NewEncryptor: %v", err)
	}

	for _, plaintext := range []string{"", "tok_abc123", "пример テスト 🚀", "a-very-long-paperless-api-token-0123456789abcdef"} {
		ciphertext, err := enc.Encrypt(plaintext)
		if err != nil {
			t.Fatalf("Encrypt(%q): %v", plaintext, err)
		}
		if ciphertext == plaintext && plaintext != "" {
			t.Fatalf("ciphertext equals plaintext for %q", plaintext)
		}
		got, err := enc.Decrypt(ciphertext)
		if err != nil {
			t.Fatalf("Decrypt(%q): %v", plaintext, err)
		}
		if got != plaintext {
			t.Errorf("roundtrip mismatch: got %q, want %q", got, plaintext)
		}
	}
}

func TestEncryptor_NonDeterministicNonce(t *testing.T) {
	enc, _ := NewEncryptor("test-key-material")
	a, _ := enc.Encrypt("same input")
	b, _ := enc.Encrypt("same input")
	if a == b {
		t.Error("two encryptions of the same plaintext produced identical ciphertexts (nonce reuse?)")
	}
}

func TestEncryptor_WrongKeyFails(t *testing.T) {
	enc1, _ := NewEncryptor("key-one")
	enc2, _ := NewEncryptor("key-two")

	ciphertext, err := enc1.Encrypt("secret")
	if err != nil {
		t.Fatalf("Encrypt: %v", err)
	}
	if _, err := enc2.Decrypt(ciphertext); !errors.Is(err, ErrInvalidCiphertext) {
		t.Errorf("Decrypt with wrong key: got %v, want ErrInvalidCiphertext", err)
	}
}

func TestEncryptor_MalformedCiphertext(t *testing.T) {
	enc, _ := NewEncryptor("test-key-material")
	for _, bad := range []string{"", "not-base64!!!", "YWJj"} { // "YWJj" = "abc": too short for a nonce
		if _, err := enc.Decrypt(bad); !errors.Is(err, ErrInvalidCiphertext) {
			t.Errorf("Decrypt(%q): got %v, want ErrInvalidCiphertext", bad, err)
		}
	}
}

func TestNewEncryptor_EmptyKey(t *testing.T) {
	if _, err := NewEncryptor(""); err == nil {
		t.Error("NewEncryptor with empty key material should fail")
	}
}
