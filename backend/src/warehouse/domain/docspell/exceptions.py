"""Custom exceptions for Docspell operations."""


class DocspellError(Exception):
    """Base exception for Docspell operations."""

    pass


class DocspellAuthenticationError(DocspellError):
    """Raised when Docspell authentication fails."""

    pass


class DocspellTimeoutError(DocspellError):
    """Raised when Docspell request times out."""

    pass
