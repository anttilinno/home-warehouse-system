"""Fixtures for activity_log tests.

This module ensures the User model is registered before activity_log models
are used, resolving the SQLAlchemy relationship dependency.
"""

# Import auth models to ensure they're registered before tests run
import warehouse.domain.auth.models  # noqa: F401
