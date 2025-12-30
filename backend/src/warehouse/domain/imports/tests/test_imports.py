"""Tests for the imports domain service."""

from unittest.mock import AsyncMock, MagicMock
from uuid import uuid7

import pytest

from warehouse.domain.imports.schemas import EntityType, ImportError, ImportResult
from warehouse.domain.imports.service import ImportService


@pytest.fixture
def workspace_id():
    """A sample workspace ID for multi-tenancy."""
    return uuid7()


@pytest.fixture
def db_session_mock():
    """Mocked database session."""
    session = AsyncMock()
    session.execute = AsyncMock()
    session.add = MagicMock()
    session.flush = AsyncMock()
    session.commit = AsyncMock()
    return session


@pytest.fixture
def service(db_session_mock: AsyncMock) -> ImportService:
    """Import service wired with mocked db session."""
    return ImportService(session=db_session_mock)


def _mock_empty_result():
    """Create mock for empty query result."""
    result = MagicMock()
    result.scalars.return_value = iter([])
    return result


class TestImportData:
    """Tests for import_data method."""

    @pytest.mark.asyncio
    async def test_routes_to_correct_importer(
        self, service: ImportService, db_session_mock: AsyncMock, workspace_id
    ):
        """Test that import_data routes to the correct importer."""
        db_session_mock.execute.return_value = _mock_empty_result()

        result = await service.import_data(
            EntityType.CATEGORIES,
            [{"name": "Test Category"}],
            workspace_id,
        )

        assert result.entity_type == "categories"

    @pytest.mark.asyncio
    async def test_handles_unknown_entity_type(
        self, service: ImportService, workspace_id
    ):
        """Test that unknown entity type returns error."""
        # Create a mock entity type that isn't handled
        class FakeEntityType:
            value = "fake"

        result = await service.import_data(
            FakeEntityType(),  # type: ignore
            [{"name": "Test"}],
            workspace_id,
        )

        assert len(result.errors) == 1
        assert "Unknown entity type" in result.errors[0].message


class TestImportCategories:
    """Tests for _import_categories method."""

    @pytest.mark.asyncio
    async def test_creates_new_categories(
        self, service: ImportService, db_session_mock: AsyncMock, workspace_id
    ):
        """Test creating new categories."""
        db_session_mock.execute.return_value = _mock_empty_result()

        result = await service._import_categories(
            [{"name": "Electronics"}, {"name": "Tools"}],
            workspace_id,
        )

        assert result.created == 2
        assert result.skipped == 0
        assert len(result.errors) == 0
        assert db_session_mock.add.call_count == 2

    @pytest.mark.asyncio
    async def test_skips_existing_categories(
        self, service: ImportService, db_session_mock: AsyncMock, workspace_id
    ):
        """Test that existing categories are skipped."""
        existing_category = MagicMock()
        existing_category.name = "electronics"
        existing_category.id = uuid7()

        existing_result = MagicMock()
        existing_result.scalars.return_value = iter([existing_category])

        db_session_mock.execute.return_value = existing_result

        result = await service._import_categories(
            [{"name": "Electronics"}],
            workspace_id,
        )

        assert result.created == 0
        assert result.skipped == 1

    @pytest.mark.asyncio
    async def test_reports_missing_name_error(
        self, service: ImportService, db_session_mock: AsyncMock, workspace_id
    ):
        """Test that missing name is reported as error."""
        db_session_mock.execute.return_value = _mock_empty_result()

        result = await service._import_categories(
            [{"description": "No name"}],
            workspace_id,
        )

        assert result.created == 0
        assert len(result.errors) == 1
        assert result.errors[0].field == "name"
        assert "required" in result.errors[0].message.lower()

    @pytest.mark.asyncio
    async def test_reports_missing_parent_error(
        self, service: ImportService, db_session_mock: AsyncMock, workspace_id
    ):
        """Test that missing parent category is reported as error."""
        db_session_mock.execute.return_value = _mock_empty_result()

        result = await service._import_categories(
            [{"name": "Subcategory", "parent_category": "NonExistent"}],
            workspace_id,
        )

        assert result.created == 0
        assert len(result.errors) == 1
        assert "not found" in result.errors[0].message.lower()


class TestImportLocations:
    """Tests for _import_locations method."""

    @pytest.mark.asyncio
    async def test_creates_new_locations(
        self, service: ImportService, db_session_mock: AsyncMock, workspace_id
    ):
        """Test creating new locations."""
        db_session_mock.execute.return_value = _mock_empty_result()

        result = await service._import_locations(
            [
                {"name": "Garage", "zone": "A", "shelf": "1"},
                {"name": "Kitchen", "description": "Main kitchen"},
            ],
            workspace_id,
        )

        assert result.created == 2
        assert result.skipped == 0
        assert len(result.errors) == 0

    @pytest.mark.asyncio
    async def test_skips_existing_locations(
        self, service: ImportService, db_session_mock: AsyncMock, workspace_id
    ):
        """Test that existing locations are skipped."""
        existing_location = MagicMock()
        existing_location.name = "garage"
        existing_location.id = uuid7()

        existing_result = MagicMock()
        existing_result.scalars.return_value = iter([existing_location])

        db_session_mock.execute.return_value = existing_result

        result = await service._import_locations(
            [{"name": "Garage"}],
            workspace_id,
        )

        assert result.created == 0
        assert result.skipped == 1

    @pytest.mark.asyncio
    async def test_reports_missing_name_error(
        self, service: ImportService, db_session_mock: AsyncMock, workspace_id
    ):
        """Test that missing name is reported as error."""
        db_session_mock.execute.return_value = _mock_empty_result()

        result = await service._import_locations(
            [{"description": "No name"}],
            workspace_id,
        )

        assert result.created == 0
        assert len(result.errors) == 1
        assert result.errors[0].field == "name"

    @pytest.mark.asyncio
    async def test_reports_missing_parent_error(
        self, service: ImportService, db_session_mock: AsyncMock, workspace_id
    ):
        """Test that missing parent location is reported as error."""
        db_session_mock.execute.return_value = _mock_empty_result()

        result = await service._import_locations(
            [{"name": "Shelf A", "parent_location": "NonExistent"}],
            workspace_id,
        )

        assert result.created == 0
        assert len(result.errors) == 1
        assert "not found" in result.errors[0].message.lower()


class TestImportContainers:
    """Tests for _import_containers method."""

    @pytest.mark.asyncio
    async def test_creates_new_containers(
        self, service: ImportService, db_session_mock: AsyncMock, workspace_id
    ):
        """Test creating new containers with valid location."""
        location = MagicMock()
        location.name = "garage"
        location.id = uuid7()

        locations_result = MagicMock()
        locations_result.scalars.return_value = iter([location])

        containers_result = MagicMock()
        containers_result.scalars.return_value = iter([])

        db_session_mock.execute.side_effect = [locations_result, containers_result]

        result = await service._import_containers(
            [{"name": "Box A", "location": "Garage", "capacity": "10 items"}],
            workspace_id,
        )

        assert result.created == 1
        assert len(result.errors) == 0

    @pytest.mark.asyncio
    async def test_skips_existing_containers(
        self, service: ImportService, db_session_mock: AsyncMock, workspace_id
    ):
        """Test that existing containers are skipped."""
        location = MagicMock()
        location.name = "garage"
        location.id = uuid7()

        container = MagicMock()
        container.name = "box a"
        container.id = uuid7()

        locations_result = MagicMock()
        locations_result.scalars.return_value = iter([location])

        containers_result = MagicMock()
        containers_result.scalars.return_value = iter([container])

        db_session_mock.execute.side_effect = [locations_result, containers_result]

        result = await service._import_containers(
            [{"name": "Box A", "location": "Garage"}],
            workspace_id,
        )

        assert result.created == 0
        assert result.skipped == 1

    @pytest.mark.asyncio
    async def test_reports_missing_name_error(
        self, service: ImportService, db_session_mock: AsyncMock, workspace_id
    ):
        """Test that missing name is reported as error."""
        db_session_mock.execute.return_value = _mock_empty_result()

        result = await service._import_containers(
            [{"location": "Garage"}],
            workspace_id,
        )

        assert result.created == 0
        assert len(result.errors) == 1
        assert result.errors[0].field == "name"

    @pytest.mark.asyncio
    async def test_requires_location(
        self, service: ImportService, db_session_mock: AsyncMock, workspace_id
    ):
        """Test that containers require a location."""
        db_session_mock.execute.return_value = _mock_empty_result()

        result = await service._import_containers(
            [{"name": "Box A"}],  # No location
            workspace_id,
        )

        assert result.created == 0
        assert len(result.errors) == 1
        assert result.errors[0].field == "location"

    @pytest.mark.asyncio
    async def test_reports_missing_location_error(
        self, service: ImportService, db_session_mock: AsyncMock, workspace_id
    ):
        """Test that missing location is reported as error."""
        db_session_mock.execute.return_value = _mock_empty_result()

        result = await service._import_containers(
            [{"name": "Box A", "location": "NonExistent"}],
            workspace_id,
        )

        assert result.created == 0
        assert len(result.errors) == 1
        assert "not found" in result.errors[0].message.lower()


class TestImportItems:
    """Tests for _import_items method."""

    @pytest.mark.asyncio
    async def test_creates_new_items(
        self, service: ImportService, db_session_mock: AsyncMock, workspace_id
    ):
        """Test creating new items."""
        categories_result = MagicMock()
        categories_result.scalars.return_value = iter([])

        items_result = MagicMock()
        items_result.scalars.return_value = iter([])

        db_session_mock.execute.side_effect = [categories_result, items_result]

        result = await service._import_items(
            [
                {"sku": "SKU-001", "name": "Hammer", "description": "A hammer"},
                {"sku": "SKU-002", "name": "Screwdriver"},
            ],
            workspace_id,
        )

        assert result.created == 2
        assert len(result.errors) == 0

    @pytest.mark.asyncio
    async def test_skips_existing_items(
        self, service: ImportService, db_session_mock: AsyncMock, workspace_id
    ):
        """Test that existing items are skipped."""
        existing_item = MagicMock()
        existing_item.sku = "sku-001"
        existing_item.id = uuid7()

        categories_result = MagicMock()
        categories_result.scalars.return_value = iter([])

        items_result = MagicMock()
        items_result.scalars.return_value = iter([existing_item])

        db_session_mock.execute.side_effect = [categories_result, items_result]

        result = await service._import_items(
            [{"sku": "SKU-001", "name": "Hammer"}],
            workspace_id,
        )

        assert result.created == 0
        assert result.skipped == 1

    @pytest.mark.asyncio
    async def test_creates_item_with_category(
        self, service: ImportService, db_session_mock: AsyncMock, workspace_id
    ):
        """Test creating item with valid category."""
        category = MagicMock()
        category.name = "tools"
        category.id = uuid7()

        categories_result = MagicMock()
        categories_result.scalars.return_value = iter([category])

        items_result = MagicMock()
        items_result.scalars.return_value = iter([])

        db_session_mock.execute.side_effect = [categories_result, items_result]

        result = await service._import_items(
            [{"sku": "SKU-001", "name": "Hammer", "category": "Tools"}],
            workspace_id,
        )

        assert result.created == 1
        assert len(result.errors) == 0

    @pytest.mark.asyncio
    async def test_reports_missing_category_error(
        self, service: ImportService, db_session_mock: AsyncMock, workspace_id
    ):
        """Test that missing category is reported as error."""
        categories_result = MagicMock()
        categories_result.scalars.return_value = iter([])

        items_result = MagicMock()
        items_result.scalars.return_value = iter([])

        db_session_mock.execute.side_effect = [categories_result, items_result]

        result = await service._import_items(
            [{"sku": "SKU-001", "name": "Hammer", "category": "NonExistent"}],
            workspace_id,
        )

        assert result.created == 0
        assert len(result.errors) == 1
        assert "not found" in result.errors[0].message.lower()

    @pytest.mark.asyncio
    async def test_requires_sku(
        self, service: ImportService, db_session_mock: AsyncMock, workspace_id
    ):
        """Test that items require a SKU."""
        db_session_mock.execute.return_value = _mock_empty_result()

        result = await service._import_items(
            [{"name": "No SKU Item"}],
            workspace_id,
        )

        assert result.created == 0
        assert len(result.errors) == 1
        assert result.errors[0].field == "sku"

    @pytest.mark.asyncio
    async def test_requires_name(
        self, service: ImportService, db_session_mock: AsyncMock, workspace_id
    ):
        """Test that items require a name."""
        db_session_mock.execute.return_value = _mock_empty_result()

        result = await service._import_items(
            [{"sku": "SKU-001"}],
            workspace_id,
        )

        assert result.created == 0
        assert len(result.errors) == 1
        assert result.errors[0].field == "name"


class TestImportBorrowers:
    """Tests for _import_borrowers method."""

    @pytest.mark.asyncio
    async def test_creates_new_borrowers(
        self, service: ImportService, db_session_mock: AsyncMock, workspace_id
    ):
        """Test creating new borrowers."""
        db_session_mock.execute.return_value = _mock_empty_result()

        result = await service._import_borrowers(
            [
                {"name": "John Doe", "email": "john@example.com"},
                {"name": "Jane Doe"},
            ],
            workspace_id,
        )

        assert result.created == 2
        assert len(result.errors) == 0

    @pytest.mark.asyncio
    async def test_skips_existing_borrowers(
        self, service: ImportService, db_session_mock: AsyncMock, workspace_id
    ):
        """Test that existing borrowers are skipped."""
        existing_borrower = MagicMock()
        existing_borrower.name = "john doe"
        existing_borrower.id = uuid7()

        existing_result = MagicMock()
        existing_result.scalars.return_value = iter([existing_borrower])

        db_session_mock.execute.return_value = existing_result

        result = await service._import_borrowers(
            [{"name": "John Doe", "email": "john@example.com"}],
            workspace_id,
        )

        assert result.created == 0
        assert result.skipped == 1

    @pytest.mark.asyncio
    async def test_requires_name(
        self, service: ImportService, db_session_mock: AsyncMock, workspace_id
    ):
        """Test that borrowers require a name."""
        db_session_mock.execute.return_value = _mock_empty_result()

        result = await service._import_borrowers(
            [{"email": "test@example.com"}],
            workspace_id,
        )

        assert result.created == 0
        assert len(result.errors) == 1
        assert result.errors[0].field == "name"


class TestImportInventory:
    """Tests for _import_inventory method."""

    @pytest.mark.asyncio
    async def test_creates_new_inventory(
        self, service: ImportService, db_session_mock: AsyncMock, workspace_id
    ):
        """Test creating new inventory records."""
        item = MagicMock()
        item.sku = "sku-001"
        item.name = "hammer"
        item.id = uuid7()

        location = MagicMock()
        location.name = "garage"
        location.id = uuid7()

        items_result = MagicMock()
        items_result.scalars.return_value = iter([item])

        locations_result = MagicMock()
        locations_result.scalars.return_value = iter([location])

        inventory_result = MagicMock()
        inventory_result.scalars.return_value = iter([])

        db_session_mock.execute.side_effect = [
            items_result,
            locations_result,
            inventory_result,
        ]

        result = await service._import_inventory(
            [{"item": "SKU-001", "location": "Garage", "quantity": "5"}],
            workspace_id,
        )

        assert result.created == 1
        assert len(result.errors) == 0

    @pytest.mark.asyncio
    async def test_skips_existing_inventory(
        self, service: ImportService, db_session_mock: AsyncMock, workspace_id
    ):
        """Test that existing inventory records are skipped."""
        item_id = uuid7()
        location_id = uuid7()

        item = MagicMock()
        item.sku = "sku-001"
        item.name = "hammer"
        item.id = item_id

        location = MagicMock()
        location.name = "garage"
        location.id = location_id

        existing_inv = MagicMock()
        existing_inv.item_id = item_id
        existing_inv.location_id = location_id

        items_result = MagicMock()
        items_result.scalars.return_value = iter([item])

        locations_result = MagicMock()
        locations_result.scalars.return_value = iter([location])

        inventory_result = MagicMock()
        inventory_result.scalars.return_value = iter([existing_inv])

        db_session_mock.execute.side_effect = [
            items_result,
            locations_result,
            inventory_result,
        ]

        result = await service._import_inventory(
            [{"item": "SKU-001", "location": "Garage", "quantity": "5"}],
            workspace_id,
        )

        assert result.created == 0
        assert result.skipped == 1

    @pytest.mark.asyncio
    async def test_reports_item_not_found(
        self, service: ImportService, db_session_mock: AsyncMock, workspace_id
    ):
        """Test that missing item is reported as error."""
        location = MagicMock()
        location.name = "garage"
        location.id = uuid7()

        items_result = MagicMock()
        items_result.scalars.return_value = iter([])  # No items

        locations_result = MagicMock()
        locations_result.scalars.return_value = iter([location])

        inventory_result = MagicMock()
        inventory_result.scalars.return_value = iter([])

        db_session_mock.execute.side_effect = [
            items_result,
            locations_result,
            inventory_result,
        ]

        result = await service._import_inventory(
            [{"item": "NonExistent", "location": "Garage", "quantity": "5"}],
            workspace_id,
        )

        assert result.created == 0
        assert len(result.errors) == 1
        assert "not found" in result.errors[0].message.lower()

    @pytest.mark.asyncio
    async def test_reports_location_not_found(
        self, service: ImportService, db_session_mock: AsyncMock, workspace_id
    ):
        """Test that missing location is reported as error."""
        item = MagicMock()
        item.sku = "sku-001"
        item.name = "hammer"
        item.id = uuid7()

        items_result = MagicMock()
        items_result.scalars.return_value = iter([item])

        locations_result = MagicMock()
        locations_result.scalars.return_value = iter([])  # No locations

        inventory_result = MagicMock()
        inventory_result.scalars.return_value = iter([])

        db_session_mock.execute.side_effect = [
            items_result,
            locations_result,
            inventory_result,
        ]

        result = await service._import_inventory(
            [{"item": "SKU-001", "location": "NonExistent", "quantity": "5"}],
            workspace_id,
        )

        assert result.created == 0
        assert len(result.errors) == 1
        assert "not found" in result.errors[0].message.lower()

    @pytest.mark.asyncio
    async def test_requires_item(
        self, service: ImportService, db_session_mock: AsyncMock, workspace_id
    ):
        """Test that inventory requires an item reference."""
        db_session_mock.execute.return_value = _mock_empty_result()

        result = await service._import_inventory(
            [{"location": "Garage", "quantity": "10"}],
            workspace_id,
        )

        assert result.created == 0
        assert len(result.errors) == 1
        assert result.errors[0].field == "item"

    @pytest.mark.asyncio
    async def test_requires_location(
        self, service: ImportService, db_session_mock: AsyncMock, workspace_id
    ):
        """Test that inventory requires a location."""
        db_session_mock.execute.return_value = _mock_empty_result()

        result = await service._import_inventory(
            [{"item": "Screwdriver", "quantity": "10"}],
            workspace_id,
        )

        assert result.created == 0
        assert len(result.errors) == 1
        assert result.errors[0].field == "location"

    @pytest.mark.asyncio
    async def test_validates_quantity(
        self, service: ImportService, db_session_mock: AsyncMock, workspace_id
    ):
        """Test that invalid quantity is reported as error."""
        # Mock item and location existence
        item = MagicMock()
        item.sku = "sku-001"
        item.name = "screwdriver"
        item.id = uuid7()

        location = MagicMock()
        location.name = "garage"
        location.id = uuid7()

        # We need multiple execute calls - items, locations, inventory
        items_result = MagicMock()
        items_result.scalars.return_value = iter([item])

        locations_result = MagicMock()
        locations_result.scalars.return_value = iter([location])

        inventory_result = MagicMock()
        inventory_result.scalars.return_value = iter([])

        db_session_mock.execute.side_effect = [
            items_result,
            locations_result,
            inventory_result,
        ]

        result = await service._import_inventory(
            [{"item": "SKU-001", "location": "Garage", "quantity": "invalid"}],
            workspace_id,
        )

        assert result.created == 0
        assert len(result.errors) == 1
        assert "quantity" in result.errors[0].field.lower()


class TestImportSchemas:
    """Tests for import schemas."""

    def test_entity_type_enum(self):
        """Test EntityType enum values."""
        assert EntityType.CATEGORIES.value == "categories"
        assert EntityType.LOCATIONS.value == "locations"
        assert EntityType.CONTAINERS.value == "containers"
        assert EntityType.ITEMS.value == "items"
        assert EntityType.BORROWERS.value == "borrowers"
        assert EntityType.INVENTORY.value == "inventory"

    def test_import_error_schema(self):
        """Test ImportError schema."""
        error = ImportError(row=5, field="name", message="Name is required")
        assert error.row == 5
        assert error.field == "name"
        assert error.message == "Name is required"

    def test_import_result_schema(self):
        """Test ImportResult schema."""
        result = ImportResult(
            entity_type="categories",
            total_rows=10,
            created=8,
            updated=0,
            skipped=2,
            errors=[],
        )
        assert result.entity_type == "categories"
        assert result.total_rows == 10
        assert result.created == 8
        assert result.skipped == 2
