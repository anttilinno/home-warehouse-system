"""Tests for the dashboard domain service."""

from datetime import date, datetime
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid7

import pytest

from warehouse.domain.dashboard.schemas import (
    DashboardExtendedStats,
    DashboardStats,
    InventoryAlertItem,
    InventorySummary,
    OverdueLoan,
)
from warehouse.domain.dashboard.service import DashboardService


@pytest.fixture
def workspace_id():
    """A sample workspace ID for multi-tenancy."""
    return uuid7()


@pytest.fixture
def db_session_mock():
    """Mocked database session with async execute method."""
    session = AsyncMock()
    session.execute = AsyncMock()
    return session


@pytest.fixture
def service(db_session_mock: AsyncMock) -> DashboardService:
    """Dashboard service wired with mocked db session."""
    return DashboardService(db_session=db_session_mock)


class TestGetStats:
    """Tests for get_stats method."""

    @pytest.mark.asyncio
    async def test_returns_dashboard_stats(
        self, service: DashboardService, db_session_mock: AsyncMock, workspace_id
    ):
        """Test that get_stats returns correct statistics."""
        # Mock count query results
        items_result = MagicMock()
        items_result.scalar.return_value = 50

        locations_result = MagicMock()
        locations_result.scalar.return_value = 10

        loans_result = MagicMock()
        loans_result.scalar.return_value = 5

        categories_result = MagicMock()
        categories_result.scalar.return_value = 8

        db_session_mock.execute.side_effect = [
            items_result,
            locations_result,
            loans_result,
            categories_result,
        ]

        result = await service.get_stats(workspace_id)

        assert isinstance(result, DashboardStats)
        assert result.total_items == 50
        assert result.total_locations == 10
        assert result.active_loans == 5
        assert result.total_categories == 8

    @pytest.mark.asyncio
    async def test_handles_none_values(
        self, service: DashboardService, db_session_mock: AsyncMock, workspace_id
    ):
        """Test that get_stats handles None scalar values."""
        none_result = MagicMock()
        none_result.scalar.return_value = None

        db_session_mock.execute.side_effect = [
            none_result,
            none_result,
            none_result,
            none_result,
        ]

        result = await service.get_stats(workspace_id)

        assert result.total_items == 0
        assert result.total_locations == 0
        assert result.active_loans == 0
        assert result.total_categories == 0

    @pytest.mark.asyncio
    async def test_works_without_workspace_id(
        self, service: DashboardService, db_session_mock: AsyncMock
    ):
        """Test that get_stats works without a workspace_id filter."""
        count_result = MagicMock()
        count_result.scalar.return_value = 100

        db_session_mock.execute.side_effect = [
            count_result,
            count_result,
            count_result,
            count_result,
        ]

        result = await service.get_stats(None)

        assert result.total_items == 100


class TestGetExtendedStats:
    """Tests for get_extended_stats method."""

    @pytest.mark.asyncio
    async def test_returns_extended_stats(
        self, service: DashboardService, db_session_mock: AsyncMock, workspace_id
    ):
        """Test that get_extended_stats returns complete statistics."""
        # Mock basic stats queries
        items_result = MagicMock()
        items_result.scalar.return_value = 50

        locations_result = MagicMock()
        locations_result.scalar.return_value = 10

        loans_result = MagicMock()
        loans_result.scalar.return_value = 5

        categories_result = MagicMock()
        categories_result.scalar.return_value = 8

        # Mock extended stats queries
        value_result = MagicMock()
        value_result.scalar.return_value = 100000

        out_of_stock_result = MagicMock()
        out_of_stock_result.scalar.return_value = 3

        low_stock_result = MagicMock()
        low_stock_result.scalar.return_value = 7

        expiring_result = MagicMock()
        expiring_result.scalar.return_value = 2

        warranty_result = MagicMock()
        warranty_result.scalar.return_value = 4

        overdue_result = MagicMock()
        overdue_result.scalar.return_value = 1

        db_session_mock.execute.side_effect = [
            # Basic stats
            items_result,
            locations_result,
            loans_result,
            categories_result,
            # Extended stats
            value_result,
            out_of_stock_result,
            low_stock_result,
            expiring_result,
            warranty_result,
            overdue_result,
        ]

        result = await service.get_extended_stats(workspace_id)

        assert isinstance(result, DashboardExtendedStats)
        assert result.total_items == 50
        assert result.total_locations == 10
        assert result.active_loans == 5
        assert result.total_categories == 8
        assert result.total_inventory_value == 100000
        assert result.currency_code == "EUR"
        assert result.out_of_stock_count == 3
        assert result.low_stock_count == 7
        assert result.expiring_soon_count == 2
        assert result.warranty_expiring_count == 4
        assert result.overdue_loans_count == 1


class TestGetRecentlyModified:
    """Tests for get_recently_modified method."""

    @pytest.mark.asyncio
    async def test_returns_inventory_summaries(
        self, service: DashboardService, db_session_mock: AsyncMock, workspace_id
    ):
        """Test that get_recently_modified returns inventory summaries."""
        row = MagicMock()
        row.id = uuid7()
        row.item_name = "Test Item"
        row.item_sku = "SKU-001"
        row.location_name = "Garage"
        row.quantity = 10
        row.updated_at = datetime(2024, 1, 1, 12, 0, 0)

        result_mock = MagicMock()
        result_mock.fetchall.return_value = [row]

        db_session_mock.execute.return_value = result_mock

        result = await service.get_recently_modified(workspace_id, limit=10)

        assert len(result) == 1
        assert isinstance(result[0], InventorySummary)
        assert result[0].item_name == "Test Item"
        assert result[0].item_sku == "SKU-001"
        assert result[0].location_name == "Garage"
        assert result[0].quantity == 10


class TestGetOutOfStock:
    """Tests for get_out_of_stock method."""

    @pytest.mark.asyncio
    async def test_returns_zero_quantity_items(
        self, service: DashboardService, db_session_mock: AsyncMock, workspace_id
    ):
        """Test that get_out_of_stock returns items with zero quantity."""
        row = MagicMock()
        row.id = uuid7()
        row.item_name = "Empty Item"
        row.item_sku = "SKU-002"
        row.location_name = "Storage"
        row.quantity = 0
        row.updated_at = datetime(2024, 1, 1, 12, 0, 0)

        result_mock = MagicMock()
        result_mock.fetchall.return_value = [row]

        db_session_mock.execute.return_value = result_mock

        result = await service.get_out_of_stock(workspace_id, limit=10)

        assert len(result) == 1
        assert result[0].quantity == 0


class TestGetLowStock:
    """Tests for get_low_stock method."""

    @pytest.mark.asyncio
    async def test_returns_low_quantity_items(
        self, service: DashboardService, db_session_mock: AsyncMock, workspace_id
    ):
        """Test that get_low_stock returns items with low quantity."""
        row = MagicMock()
        row.id = uuid7()
        row.item_name = "Low Stock Item"
        row.item_sku = "SKU-003"
        row.location_name = "Shelf A"
        row.quantity = 2
        row.updated_at = datetime(2024, 1, 1, 12, 0, 0)

        result_mock = MagicMock()
        result_mock.fetchall.return_value = [row]

        db_session_mock.execute.return_value = result_mock

        result = await service.get_low_stock(workspace_id, limit=10)

        assert len(result) == 1
        assert result[0].quantity == 2


class TestGetExpiringSoon:
    """Tests for get_expiring_soon method."""

    @pytest.mark.asyncio
    async def test_returns_expiring_items(
        self, service: DashboardService, db_session_mock: AsyncMock, workspace_id
    ):
        """Test that get_expiring_soon returns items expiring within 30 days."""
        row = MagicMock()
        row.id = uuid7()
        row.item_name = "Expiring Item"
        row.item_sku = "SKU-004"
        row.location_name = "Fridge"
        row.quantity = 5
        row.expiration_date = date(2024, 2, 15)

        result_mock = MagicMock()
        result_mock.fetchall.return_value = [row]

        db_session_mock.execute.return_value = result_mock

        result = await service.get_expiring_soon(workspace_id, limit=10)

        assert len(result) == 1
        assert isinstance(result[0], InventoryAlertItem)
        assert result[0].expiration_date == date(2024, 2, 15)


class TestGetWarrantyExpiring:
    """Tests for get_warranty_expiring method."""

    @pytest.mark.asyncio
    async def test_returns_warranty_expiring_items(
        self, service: DashboardService, db_session_mock: AsyncMock, workspace_id
    ):
        """Test that get_warranty_expiring returns items with warranty expiring."""
        row = MagicMock()
        row.id = uuid7()
        row.item_name = "Warranty Item"
        row.item_sku = "SKU-005"
        row.location_name = "Office"
        row.quantity = 1
        row.warranty_expires = date(2024, 3, 1)

        result_mock = MagicMock()
        result_mock.fetchall.return_value = [row]

        db_session_mock.execute.return_value = result_mock

        result = await service.get_warranty_expiring(workspace_id, limit=10)

        assert len(result) == 1
        assert isinstance(result[0], InventoryAlertItem)
        assert result[0].warranty_expires == date(2024, 3, 1)


class TestGetOverdueLoans:
    """Tests for get_overdue_loans method."""

    @pytest.mark.asyncio
    async def test_returns_overdue_loans(
        self, service: DashboardService, db_session_mock: AsyncMock, workspace_id
    ):
        """Test that get_overdue_loans returns overdue loan details."""
        row = MagicMock()
        row.id = uuid7()
        row.borrower_name = "John Doe"
        row.item_name = "Power Drill"
        row.quantity = 1
        row.due_date = date(2024, 1, 1)
        row.days_overdue = 15

        result_mock = MagicMock()
        result_mock.fetchall.return_value = [row]

        db_session_mock.execute.return_value = result_mock

        result = await service.get_overdue_loans(workspace_id, limit=10)

        assert len(result) == 1
        assert isinstance(result[0], OverdueLoan)
        assert result[0].borrower_name == "John Doe"
        assert result[0].item_name == "Power Drill"
        assert result[0].days_overdue == 15


class TestDashboardSchemas:
    """Tests for dashboard schemas."""

    def test_dashboard_stats_schema(self):
        stats = DashboardStats(
            total_items=50,
            total_locations=10,
            active_loans=5,
            total_categories=8,
        )
        assert stats.total_items == 50
        assert stats.total_locations == 10
        assert stats.active_loans == 5
        assert stats.total_categories == 8

    def test_dashboard_extended_stats_schema(self):
        stats = DashboardExtendedStats(
            total_items=50,
            total_locations=10,
            active_loans=5,
            total_categories=8,
            total_inventory_value=100000,
            currency_code="EUR",
            out_of_stock_count=3,
            low_stock_count=7,
            expiring_soon_count=2,
            warranty_expiring_count=4,
            overdue_loans_count=1,
        )
        assert stats.total_inventory_value == 100000
        assert stats.currency_code == "EUR"
        assert stats.out_of_stock_count == 3

    def test_inventory_summary_schema(self):
        summary = InventorySummary(
            id=uuid7(),
            item_name="Test Item",
            item_sku="SKU-001",
            location_name="Garage",
            quantity=10,
            updated_at=datetime(2024, 1, 1, 12, 0, 0),
        )
        assert summary.item_name == "Test Item"
        assert summary.quantity == 10

    def test_inventory_alert_item_schema(self):
        alert = InventoryAlertItem(
            id=uuid7(),
            item_name="Expiring Item",
            item_sku="SKU-002",
            location_name="Fridge",
            quantity=5,
            expiration_date=date(2024, 2, 15),
        )
        assert alert.expiration_date == date(2024, 2, 15)
        assert alert.warranty_expires is None

    def test_overdue_loan_schema(self):
        loan = OverdueLoan(
            id=uuid7(),
            borrower_name="John Doe",
            item_name="Power Drill",
            quantity=1,
            due_date=date(2024, 1, 1),
            days_overdue=15,
        )
        assert loan.borrower_name == "John Doe"
        assert loan.days_overdue == 15
