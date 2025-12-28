"""Tests for encryption utilities."""

import os
from unittest.mock import patch

import pytest
from cryptography.fernet import Fernet

from warehouse.domain.docspell.encryption import (
    decrypt_password,
    encrypt_password,
    get_encryption_key,
)


@pytest.fixture
def test_key():
    """Generate a test encryption key."""
    return Fernet.generate_key().decode()


class TestGetEncryptionKey:
    """Tests for get_encryption_key function."""

    def test_get_key_from_env(self, test_key):
        """Test getting key from environment."""
        with patch.dict(os.environ, {"ENCRYPTION_KEY": test_key}):
            key = get_encryption_key()
            assert key == test_key.encode()

    def test_missing_key_raises_error(self):
        """Test that missing key raises ValueError."""
        with patch.dict(os.environ, {}, clear=True):
            # Remove ENCRYPTION_KEY if present
            os.environ.pop("ENCRYPTION_KEY", None)
            with pytest.raises(ValueError, match="ENCRYPTION_KEY"):
                get_encryption_key()


class TestEncryptDecrypt:
    """Tests for encrypt and decrypt functions."""

    def test_encrypt_decrypt_roundtrip(self, test_key):
        """Test that encrypt and decrypt work together."""
        password = "my-secret-password-123"

        with patch.dict(os.environ, {"ENCRYPTION_KEY": test_key}):
            encrypted = encrypt_password(password)
            decrypted = decrypt_password(encrypted)

            assert decrypted == password
            assert encrypted != password

    def test_encrypt_produces_different_ciphertexts(self, test_key):
        """Test that encrypting same password produces different ciphertexts."""
        password = "same-password"

        with patch.dict(os.environ, {"ENCRYPTION_KEY": test_key}):
            encrypted1 = encrypt_password(password)
            encrypted2 = encrypt_password(password)

            # Fernet includes random IV, so ciphertexts differ
            assert encrypted1 != encrypted2

            # But both decrypt to the same value
            assert decrypt_password(encrypted1) == password
            assert decrypt_password(encrypted2) == password

    def test_encrypt_empty_password(self, test_key):
        """Test encrypting empty password."""
        with patch.dict(os.environ, {"ENCRYPTION_KEY": test_key}):
            encrypted = encrypt_password("")
            decrypted = decrypt_password(encrypted)
            assert decrypted == ""

    def test_encrypt_unicode_password(self, test_key):
        """Test encrypting unicode password."""
        password = "parool123"

        with patch.dict(os.environ, {"ENCRYPTION_KEY": test_key}):
            encrypted = encrypt_password(password)
            decrypted = decrypt_password(encrypted)
            assert decrypted == password
