"""Fixtures for notifications tests.

This module ensures the UserOAuthAccount model is registered before auth models
are used, resolving the SQLAlchemy relationship dependency.
"""

# Import oauth models to ensure they're registered before tests run
import warehouse.domain.oauth.models  # noqa: F401
