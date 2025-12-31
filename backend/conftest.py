"""Shared pytest fixtures and test constants."""

import pytest

# =============================================================================
# Test Constants - User/Auth Data
# =============================================================================
TEST_USER_JOHN_DOE = "John Doe"
TEST_USER_ALICE_SMITH = "Alice Smith"
TEST_USER_ALICE_JOHNSON = "Alice Johnson"
TEST_USER_JANE_DOE = "Jane Doe"

TEST_EMAIL_ALICE = "alice@example.com"
TEST_EMAIL_BOB = "bob@example.com"
TEST_EMAIL_USER = "user@example.com"
TEST_EMAIL_JOHN = "john@example.com"
TEST_EMAIL_TEST = "test@example.com"
TEST_EMAIL_BORROWER = "borrower@example.com"
TEST_EMAIL_INVITEE = "invitee@example.com"

TEST_WORKSPACE_NAME = "Test Workspace"
TEST_WORKSPACE_HOME = "Home Workshop"

# =============================================================================
# Test Constants - Email Content
# =============================================================================
TEST_EMAIL_SUBJECT = "Test Subject"
TEST_EMAIL_HTML_BODY = "<p>Test</p>"
TEST_RESET_LINK = "https://app.example.com/reset?token=abc123"

# =============================================================================
# Test Constants - Inventory/Items
# =============================================================================
TEST_ITEM_POWER_DRILL = "Power Drill"
TEST_ITEM_UPDATED_NAME = "Updated Name"
TEST_ITEM_HAMMER = "A hammer"
TEST_ITEM_TEST = "Test Item"
TEST_ITEM_A = "Item A"

TEST_CONTAINER_BOX_A = "Box A"
TEST_CONTAINER_BOX_B = "Box B"
TEST_CONTAINER_CAPACITY = "10 items"
TEST_CONTAINER_UPDATED_DESC = "Updated desc"
TEST_CONTAINER_UPDATED_BOX = "Updated Box"

# =============================================================================
# Test Constants - Descriptions
# =============================================================================
TEST_DESC_A = "Desc A"
TEST_DESC_UPDATED = "Updated description"
TEST_WORKSPACE_DESC = "A test workspace"

# =============================================================================
# Test Constants - Error Messages
# =============================================================================
ERR_NOT_FOUND = "not found"
ERR_UNSUPPORTED_FILE = "Unsupported file type"

# =============================================================================
# Test Constants - Mock Paths for Barcode
# =============================================================================
MOCK_LOOKUP_OPENFOODFACTS = "warehouse.domain.imports.barcode.lookup_openfoodfacts"
MOCK_LOOKUP_UPCITEMDB = "warehouse.domain.imports.barcode.lookup_upcitemdb"
TEST_PRODUCT_NAME = "Test Product"
TEST_BRAND = "Test Brand"
TEST_IMAGE_URL = "https://example.com/image.jpg"

# =============================================================================
# Test Constants - Bob Jones
# =============================================================================
TEST_USER_BOB_JONES = "Bob Jones"
TEST_EMAIL_ALICE_NEW = "alice.new@example.com"
TEST_EMAIL_A = "a@example.com"

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
# Test Constants - Test Data Values
# =============================================================================
TEST_ITEM_A = "Item A"
TEST_DESC_A = "Desc A"

# =============================================================================
# Test Constants - Error Messages
# =============================================================================
ERROR_NOT_FOUND = "not found"
ERR_UNSUPPORTED_FILE = "Unsupported file type"

# =============================================================================
# Test Constants - Mock Paths
# =============================================================================
MOCK_HTTPX_ASYNC_CLIENT = "httpx.AsyncClient"
MOCK_OAUTH_SERVICE = "warehouse.domain.oauth.service.OAuthService"


@pytest.fixture
def placeholder():
    """Placeholder fixture."""
    return True

