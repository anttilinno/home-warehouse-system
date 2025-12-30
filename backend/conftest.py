"""Shared pytest fixtures and test constants."""

import pytest

# =============================================================================
# Test Constants - User/Auth Data
# =============================================================================
TEST_USER_JOHN_DOE = "John Doe"
TEST_USER_ALICE_SMITH = "Alice Smith"
TEST_USER_ALICE_JOHNSON = "Alice Johnson"

TEST_EMAIL_ALICE = "alice@example.com"
TEST_EMAIL_BOB = "bob@example.com"
TEST_EMAIL_USER = "user@example.com"
TEST_EMAIL_JOHN = "john@example.com"

TEST_WORKSPACE_NAME = "Test Workspace"
TEST_WORKSPACE_HOME = "Home Workshop"

# =============================================================================
# Test Constants - Inventory/Items
# =============================================================================
TEST_ITEM_POWER_DRILL = "Power Drill"
TEST_ITEM_UPDATED_NAME = "Updated Name"

TEST_CONTAINER_BOX_A = "Box A"
TEST_CONTAINER_BOX_B = "Box B"
TEST_CONTAINER_CAPACITY = "10 items"

# =============================================================================
# Test Constants - Obsidian Integration
# =============================================================================
TEST_VAULT_PATH = "/path/to/vault"
TEST_NOTE_PATH = "items/hammer.md"

# =============================================================================
# Test Constants - Docspell Integration
# =============================================================================
TEST_DOCSPELL_URL = "http://localhost:7880"

# =============================================================================
# Test Constants - Error Messages
# =============================================================================
ERROR_NOT_FOUND = "not found"

# =============================================================================
# Test Constants - Mock Paths
# =============================================================================
MOCK_HTTPX_ASYNC_CLIENT = "httpx.AsyncClient"
MOCK_OAUTH_SERVICE = "warehouse.domain.oauth.service.OAuthService"


@pytest.fixture
def placeholder():
    """Placeholder fixture."""
    return True

