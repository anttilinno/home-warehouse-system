"""Fixtures for auth tests.

This module ensures the UserOAuthAccount model is registered before auth models
are used, resolving the SQLAlchemy relationship dependency.
"""

# Import oauth models to ensure they're registered before auth tests run
# This is needed because User has a relationship to UserOAuthAccount
import warehouse.domain.oauth.models  # noqa: F401
