"""Encryption utilities for sensitive data."""

import os

from cryptography.fernet import Fernet


def get_encryption_key() -> bytes:
    """Get encryption key from environment.

    The key should be a valid Fernet key (32 url-safe base64-encoded bytes).
    Generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

    Returns:
        Encryption key as bytes

    Raises:
        ValueError: If ENCRYPTION_KEY is not set
    """
    key = os.environ.get("ENCRYPTION_KEY")
    if not key:
        raise ValueError("ENCRYPTION_KEY environment variable must be set")
    return key.encode()


def encrypt_password(password: str) -> str:
    """Encrypt a password using Fernet.

    Args:
        password: Plain text password

    Returns:
        Encrypted password as string
    """
    fernet = Fernet(get_encryption_key())
    return fernet.encrypt(password.encode()).decode()


def decrypt_password(encrypted: str) -> str:
    """Decrypt a password using Fernet.

    Args:
        encrypted: Encrypted password string

    Returns:
        Plain text password
    """
    fernet = Fernet(get_encryption_key())
    return fernet.decrypt(encrypted.encode()).decode()
