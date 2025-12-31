"""Tests for the Docspell domain service."""

import os
from datetime import datetime, timezone
from uuid import uuid7
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from cryptography.fernet import Fernet

from warehouse.domain.docspell.models import WorkspaceDocspellSettings
from warehouse.domain.docspell.schemas import (
    DocspellSettingsCreate,
    DocspellSettingsUpdate,
)
from warehouse.domain.docspell.service import DocspellService
from warehouse.errors import AppError, ErrorCode


@pytest.fixture
def test_key():
    """Generate a test encryption key."""
    return Fernet.generate_key().decode()


@pytest.fixture
def workspace_id():
    """A sample workspace ID."""
    return uuid7()


@pytest.fixture
def repository_mock():
    """Mock docspell settings repository."""
    repo = AsyncMock()
    repo.add = AsyncMock()
    repo.get_by_workspace = AsyncMock(return_value=None)
    repo.session = AsyncMock()
    repo.session.commit = AsyncMock()
    repo.session.refresh = AsyncMock()
    repo.session.delete = AsyncMock()
    return repo


@pytest.fixture
def service(repository_mock):
    """Docspell service with mocked repository."""
    return DocspellService(repository=repository_mock)


@pytest.fixture
def sample_settings(workspace_id, test_key):
    """Sample docspell settings."""
    with patch.dict(os.environ, {"ENCRYPTION_KEY": test_key}):
        from warehouse.domain.docspell.encryption import encrypt_password

        settings = MagicMock(spec=WorkspaceDocspellSettings)
        settings.id = uuid7()
        settings.workspace_id = workspace_id
        settings.base_url = "http://localhost:7880"
        settings.collective_name = "test-collective"
        settings.username = "testuser"
        settings.password_encrypted = encrypt_password("testpass")
        settings.sync_tags_enabled = False
        settings.is_enabled = True
        settings.last_sync_at = None
        settings.created_at = datetime.now(timezone.utc)
        settings.updated_at = datetime.now(timezone.utc)
        return settings


class TestDocspellServiceGetSettings:
    """Tests for get_settings method."""

    async def test_get_settings_not_found(self, service, repository_mock, workspace_id):
        """Test getting settings when none exist."""
        repository_mock.get_by_workspace.return_value = None

        result = await service.get_settings(workspace_id)

        assert result is None
        repository_mock.get_by_workspace.assert_called_once_with(workspace_id)

    async def test_get_settings_found(
        self, service, repository_mock, workspace_id, sample_settings
    ):
        """Test getting existing settings."""
        repository_mock.get_by_workspace.return_value = sample_settings

        result = await service.get_settings(workspace_id)

        assert result is not None
        assert result.workspace_id == workspace_id
        assert result.base_url == "http://localhost:7880"
        assert result.collective_name == "test-collective"


class TestDocspellServiceCreateSettings:
    """Tests for create_settings method."""

    async def test_create_settings_success(
        self, service, repository_mock, workspace_id, test_key
    ):
        """Test creating new settings."""
        with patch.dict(os.environ, {"ENCRYPTION_KEY": test_key}):
            data = DocspellSettingsCreate(
                base_url="http://localhost:7880",
                collective_name="my-collective",
                username="myuser",
                password="mypassword",
                sync_tags_enabled=True,
            )

            created_settings = MagicMock(spec=WorkspaceDocspellSettings)
            created_settings.id = uuid7()
            created_settings.workspace_id = workspace_id
            created_settings.base_url = data.base_url
            created_settings.collective_name = data.collective_name
            created_settings.username = data.username
            created_settings.password_encrypted = "encrypted"
            created_settings.sync_tags_enabled = True
            created_settings.is_enabled = True
            created_settings.last_sync_at = None
            created_settings.created_at = datetime.now(timezone.utc)
            created_settings.updated_at = datetime.now(timezone.utc)

            repository_mock.get_by_workspace.return_value = None
            repository_mock.add.return_value = created_settings

            result = await service.create_settings(workspace_id, data)

            assert result.base_url == "http://localhost:7880"
            assert result.collective_name == "my-collective"
            assert result.sync_tags_enabled is True
            repository_mock.add.assert_called_once()
            repository_mock.session.commit.assert_called_once()

    async def test_create_settings_already_exists(
        self, service, repository_mock, workspace_id, sample_settings, test_key
    ):
        """Test creating settings when they already exist."""
        with patch.dict(os.environ, {"ENCRYPTION_KEY": test_key}):
            repository_mock.get_by_workspace.return_value = sample_settings

            data = DocspellSettingsCreate(
                base_url="http://localhost:7880",
                collective_name="another",
                username="user",
                password="pass",
            )

            with pytest.raises(AppError) as exc_info:
                await service.create_settings(workspace_id, data)

            assert exc_info.value.code == ErrorCode.DOCSPELL_SETTINGS_EXISTS


class TestDocspellServiceUpdateSettings:
    """Tests for update_settings method."""

    async def test_update_settings_success(
        self, service, repository_mock, workspace_id, sample_settings, test_key
    ):
        """Test updating existing settings."""
        with patch.dict(os.environ, {"ENCRYPTION_KEY": test_key}):
            repository_mock.get_by_workspace.return_value = sample_settings

            data = DocspellSettingsUpdate(
                base_url="http://new-url:7880",
                sync_tags_enabled=True,
            )

            await service.update_settings(workspace_id, data)

            assert sample_settings.base_url == "http://new-url:7880"
            assert sample_settings.sync_tags_enabled is True
            repository_mock.session.commit.assert_called_once()

    async def test_update_settings_not_found(
        self, service, repository_mock, workspace_id, test_key
    ):
        """Test updating settings that don't exist."""
        with patch.dict(os.environ, {"ENCRYPTION_KEY": test_key}):
            repository_mock.get_by_workspace.return_value = None

            data = DocspellSettingsUpdate(base_url="http://new-url:7880")

            with pytest.raises(AppError) as exc_info:
                await service.update_settings(workspace_id, data)

            assert exc_info.value.code == ErrorCode.DOCSPELL_SETTINGS_NOT_FOUND

    async def test_update_password(
        self, service, repository_mock, workspace_id, sample_settings, test_key
    ):
        """Test updating password encrypts it."""
        with patch.dict(os.environ, {"ENCRYPTION_KEY": test_key}):
            repository_mock.get_by_workspace.return_value = sample_settings
            old_encrypted = sample_settings.password_encrypted

            data = DocspellSettingsUpdate(password="new-password")

            await service.update_settings(workspace_id, data)

            # Password should be re-encrypted
            assert sample_settings.password_encrypted != old_encrypted
            assert sample_settings.password_encrypted != "new-password"


class TestDocspellServiceDeleteSettings:
    """Tests for delete_settings method."""

    async def test_delete_settings_success(
        self, service, repository_mock, workspace_id, sample_settings
    ):
        """Test deleting existing settings."""
        repository_mock.get_by_workspace.return_value = sample_settings

        result = await service.delete_settings(workspace_id)

        assert result is True
        repository_mock.session.delete.assert_called_once_with(sample_settings)
        repository_mock.session.commit.assert_called_once()

    async def test_delete_settings_not_found(
        self, service, repository_mock, workspace_id
    ):
        """Test deleting settings that don't exist."""
        repository_mock.get_by_workspace.return_value = None

        with pytest.raises(AppError) as exc_info:
            await service.delete_settings(workspace_id)

        assert exc_info.value.code == ErrorCode.DOCSPELL_SETTINGS_NOT_FOUND


class TestDocspellServiceTestConnection:
    """Tests for test_connection method."""

    async def test_connection_not_configured(
        self, service, repository_mock, workspace_id
    ):
        """Test connection when not configured."""
        repository_mock.get_by_workspace.return_value = None

        result = await service.test_connection(workspace_id)

        assert result.success is False
        assert "not configured" in result.message.lower()

    async def test_connection_success(
        self, service, repository_mock, workspace_id, sample_settings, test_key
    ):
        """Test successful connection."""
        with patch.dict(os.environ, {"ENCRYPTION_KEY": test_key}):
            repository_mock.get_by_workspace.return_value = sample_settings

            with patch(
                "warehouse.domain.docspell.service.DocspellClient"
            ) as mock_client_class:
                mock_client = AsyncMock()
                mock_client.test_connection.return_value = (
                    True,
                    "Connection successful",
                    "0.42.0",
                )
                mock_client_class.return_value = mock_client

                result = await service.test_connection(workspace_id)

                assert result.success is True
                assert result.version == "0.42.0"


class TestDocspellServiceEnabledSettings:
    """Tests for _get_enabled_settings helper."""

    async def test_not_configured_raises_error(
        self, service, repository_mock, workspace_id
    ):
        """Test that not configured raises error."""
        repository_mock.get_by_workspace.return_value = None

        with pytest.raises(AppError) as exc_info:
            await service._get_enabled_settings(workspace_id)

        assert exc_info.value.code == ErrorCode.DOCSPELL_NOT_CONFIGURED

    async def test_disabled_raises_error(
        self, service, repository_mock, workspace_id, sample_settings
    ):
        """Test that disabled settings raise error."""
        sample_settings.is_enabled = False
        repository_mock.get_by_workspace.return_value = sample_settings

        with pytest.raises(AppError) as exc_info:
            await service._get_enabled_settings(workspace_id)

        assert exc_info.value.code == ErrorCode.DOCSPELL_DISABLED


class TestDocspellServiceSyncTags:
    """Tests for sync_tags method."""

    async def test_sync_tags_disabled(
        self, service, repository_mock, workspace_id, sample_settings
    ):
        """Test sync when tag sync is disabled."""
        sample_settings.sync_tags_enabled = False
        repository_mock.get_by_workspace.return_value = sample_settings

        with pytest.raises(AppError) as exc_info:
            await service.sync_tags(workspace_id)

        assert exc_info.value.code == ErrorCode.DOCSPELL_TAG_SYNC_DISABLED
