"""Tests for the analytics domain service."""

from unittest.mock import AsyncMock, MagicMock
from uuid import uuid7

import pytest

from warehouse.domain.analytics.schemas import (
    AnalyticsResponse,
    AssetValueSummary,
    CategoryBreakdown,
    InventoryByCondition,
    InventoryByStatus,
    LoanStats,
    LocationBreakdown,
    TopBorrower,
)
from warehouse.domain.analytics.service import AnalyticsService


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
def service(db_session_mock: AsyncMock) -> AnalyticsService:
    """Analytics service wired with mocked db session."""
    return AnalyticsService(db_session=db_session_mock)


class TestGetAnalytics:
    """Tests for get_analytics method."""

    @pytest.mark.asyncio
    async def test_returns_analytics_response(
        self, service: AnalyticsService, db_session_mock: AsyncMock, workspace_id
    ):
        """Test that get_analytics returns a complete AnalyticsResponse."""
        # Mock status query result
        status_row = MagicMock()
        status_row.status = "AVAILABLE"
        status_row.count = 10
        status_row.quantity = 25

        status_result = MagicMock()
        status_result.all.return_value = [status_row]

        # Mock condition query result
        condition_row = MagicMock()
        condition_row.condition = "NEW"
        condition_row.count = 5
        condition_row.quantity = 15

        condition_result = MagicMock()
        condition_result.all.return_value = [condition_row]

        # Mock category query result
        category_row = MagicMock()
        category_row.id = uuid7()
        category_row.name = "Electronics"
        category_row.item_count = 8
        category_row.inventory_count = 12

        category_result = MagicMock()
        category_result.all.return_value = [category_row]

        # Mock uncategorized query result
        uncategorized_row = MagicMock()
        uncategorized_row.item_count = 0
        uncategorized_row.inventory_count = 0

        uncategorized_result = MagicMock()
        uncategorized_result.one.return_value = uncategorized_row

        # Mock location query result
        location_row = MagicMock()
        location_row.id = uuid7()
        location_row.name = "Garage"
        location_row.inventory_count = 6
        location_row.total_quantity = 20

        location_result = MagicMock()
        location_result.all.return_value = [location_row]

        # Mock loan stats query result
        loan_row = MagicMock()
        loan_row.total_loans = 15
        loan_row.active_loans = 5
        loan_row.returned_loans = 10
        loan_row.overdue_loans = 2

        loan_result = MagicMock()
        loan_result.one.return_value = loan_row

        # Mock asset value query result
        asset_row = MagicMock()
        asset_row.total_value = 5000
        asset_row.item_count = 10

        asset_result = MagicMock()
        asset_result.one.return_value = asset_row

        # Mock top borrowers query result
        borrower_row = MagicMock()
        borrower_row.id = uuid7()
        borrower_row.name = "John Doe"
        borrower_row.active_loans = 3
        borrower_row.total_loans = 5

        borrowers_result = MagicMock()
        borrowers_result.all.return_value = [borrower_row]

        # Mock count queries
        count_result = MagicMock()
        count_result.scalar.return_value = 10

        # Configure execute to return different results based on call order
        db_session_mock.execute.side_effect = [
            status_result,  # 1. inventory_by_status
            condition_result,  # 2. inventory_by_condition
            category_result,  # 3. category_breakdown
            uncategorized_result,  # 4. uncategorized items
            location_result,  # 5. location_breakdown
            loan_result,  # 6. loan_stats
            asset_result,  # 7. asset_value
            borrowers_result,  # 8. top_borrowers
            count_result,  # 9. total_items
            count_result,  # 10. total_inventory
            count_result,  # 11. total_locations
            count_result,  # 12. total_containers
        ]

        result = await service.get_analytics(workspace_id)

        assert isinstance(result, AnalyticsResponse)
        assert len(result.inventory_by_status) == 1
        assert result.inventory_by_status[0].status == "AVAILABLE"
        assert result.inventory_by_status[0].count == 10
        assert result.inventory_by_status[0].quantity == 25
        assert len(result.inventory_by_condition) == 1
        assert result.inventory_by_condition[0].condition == "NEW"
        assert len(result.category_breakdown) == 1
        assert result.category_breakdown[0].category_name == "Electronics"
        assert len(result.location_breakdown) == 1
        assert result.location_breakdown[0].location_name == "Garage"
        assert result.loan_stats.total_loans == 15
        assert result.loan_stats.active_loans == 5
        assert result.loan_stats.overdue_loans == 2
        assert result.asset_value.total_value == 5000
        assert len(result.top_borrowers) == 1
        assert result.top_borrowers[0].borrower_name == "John Doe"
        assert result.total_items == 10

    @pytest.mark.asyncio
    async def test_handles_unknown_status(
        self, service: AnalyticsService, db_session_mock: AsyncMock, workspace_id
    ):
        """Test that get_analytics handles None/unknown status values."""
        status_row = MagicMock()
        status_row.status = None
        status_row.count = 2
        status_row.quantity = 5

        status_result = MagicMock()
        status_result.all.return_value = [status_row]

        condition_result = MagicMock()
        condition_result.all.return_value = []

        category_result = MagicMock()
        category_result.all.return_value = []

        uncategorized_row = MagicMock()
        uncategorized_row.item_count = 0
        uncategorized_row.inventory_count = 0
        uncategorized_result = MagicMock()
        uncategorized_result.one.return_value = uncategorized_row

        location_result = MagicMock()
        location_result.all.return_value = []

        loan_row = MagicMock()
        loan_row.total_loans = 0
        loan_row.active_loans = 0
        loan_row.returned_loans = 0
        loan_row.overdue_loans = 0
        loan_result = MagicMock()
        loan_result.one.return_value = loan_row

        asset_row = MagicMock()
        asset_row.total_value = 0
        asset_row.item_count = 0
        asset_result = MagicMock()
        asset_result.one.return_value = asset_row

        borrowers_result = MagicMock()
        borrowers_result.all.return_value = []

        count_result = MagicMock()
        count_result.scalar.return_value = 0

        db_session_mock.execute.side_effect = [
            status_result,
            condition_result,
            category_result,
            uncategorized_result,
            location_result,
            loan_result,
            asset_result,
            borrowers_result,
            count_result,
            count_result,
            count_result,
            count_result,
        ]

        result = await service.get_analytics(workspace_id)

        assert result.inventory_by_status[0].status == "UNKNOWN"

    @pytest.mark.asyncio
    async def test_includes_uncategorized_when_present(
        self, service: AnalyticsService, db_session_mock: AsyncMock, workspace_id
    ):
        """Test that uncategorized items are included in category breakdown."""
        status_result = MagicMock()
        status_result.all.return_value = []

        condition_result = MagicMock()
        condition_result.all.return_value = []

        category_result = MagicMock()
        category_result.all.return_value = []

        uncategorized_row = MagicMock()
        uncategorized_row.item_count = 5
        uncategorized_row.inventory_count = 8
        uncategorized_result = MagicMock()
        uncategorized_result.one.return_value = uncategorized_row

        location_result = MagicMock()
        location_result.all.return_value = []

        loan_row = MagicMock()
        loan_row.total_loans = 0
        loan_row.active_loans = 0
        loan_row.returned_loans = 0
        loan_row.overdue_loans = 0
        loan_result = MagicMock()
        loan_result.one.return_value = loan_row

        asset_row = MagicMock()
        asset_row.total_value = 0
        asset_row.item_count = 0
        asset_result = MagicMock()
        asset_result.one.return_value = asset_row

        borrowers_result = MagicMock()
        borrowers_result.all.return_value = []

        count_result = MagicMock()
        count_result.scalar.return_value = 0

        db_session_mock.execute.side_effect = [
            status_result,
            condition_result,
            category_result,
            uncategorized_result,
            location_result,
            loan_result,
            asset_result,
            borrowers_result,
            count_result,
            count_result,
            count_result,
            count_result,
        ]

        result = await service.get_analytics(workspace_id)

        assert len(result.category_breakdown) == 1
        assert result.category_breakdown[0].category_name == "Uncategorized"
        assert result.category_breakdown[0].category_id is None
        assert result.category_breakdown[0].item_count == 5


class TestCountHelper:
    """Tests for _count helper method."""

    @pytest.mark.asyncio
    async def test_count_returns_zero_when_no_results(
        self, service: AnalyticsService, db_session_mock: AsyncMock, workspace_id
    ):
        """Test that _count returns 0 when scalar returns None."""
        count_result = MagicMock()
        count_result.scalar.return_value = None

        db_session_mock.execute.return_value = count_result

        # We need to import the model for counting
        from warehouse.domain.items.models import Item

        result = await service._count(Item, workspace_id)

        assert result == 0

    @pytest.mark.asyncio
    async def test_count_returns_correct_value(
        self, service: AnalyticsService, db_session_mock: AsyncMock, workspace_id
    ):
        """Test that _count returns the correct count."""
        count_result = MagicMock()
        count_result.scalar.return_value = 42

        db_session_mock.execute.return_value = count_result

        from warehouse.domain.items.models import Item

        result = await service._count(Item, workspace_id)

        assert result == 42


class TestAnalyticsSchemas:
    """Tests for analytics schemas."""

    def test_inventory_by_status_schema(self):
        schema = InventoryByStatus(status="AVAILABLE", count=10, quantity=25)
        assert schema.status == "AVAILABLE"
        assert schema.count == 10
        assert schema.quantity == 25

    def test_inventory_by_condition_schema(self):
        schema = InventoryByCondition(condition="NEW", count=5, quantity=15)
        assert schema.condition == "NEW"
        assert schema.count == 5
        assert schema.quantity == 15

    def test_category_breakdown_schema(self):
        cat_id = str(uuid7())
        schema = CategoryBreakdown(
            category_id=cat_id,
            category_name="Electronics",
            item_count=8,
            inventory_count=12,
        )
        assert schema.category_id == cat_id
        assert schema.category_name == "Electronics"

    def test_location_breakdown_schema(self):
        loc_id = str(uuid7())
        schema = LocationBreakdown(
            location_id=loc_id,
            location_name="Garage",
            inventory_count=6,
            total_quantity=20,
        )
        assert schema.location_id == loc_id
        assert schema.location_name == "Garage"

    def test_loan_stats_schema(self):
        schema = LoanStats(
            total_loans=15,
            active_loans=5,
            returned_loans=10,
            overdue_loans=2,
        )
        assert schema.total_loans == 15
        assert schema.overdue_loans == 2

    def test_asset_value_summary_schema(self):
        schema = AssetValueSummary(
            total_value=5000,
            currency_code="EUR",
            item_count=10,
        )
        assert schema.total_value == 5000
        assert schema.currency_code == "EUR"

    def test_top_borrower_schema(self):
        borrower_id = str(uuid7())
        schema = TopBorrower(
            borrower_id=borrower_id,
            borrower_name="John Doe",
            active_loans=3,
            total_loans=5,
        )
        assert schema.borrower_name == "John Doe"
        assert schema.active_loans == 3
