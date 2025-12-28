"""Controller tests for dashboard domain."""

from datetime import date, datetime
from unittest.mock import AsyncMock
from uuid import uuid7

import pytest

from warehouse.domain.auth.models import WorkspaceRole
from warehouse.domain.dashboard.controllers import DashboardController
from warehouse.domain.dashboard.schemas import (
    DashboardExtendedStats,
    DashboardStats,
    InventoryAlertItem,
    InventorySummary,
    OverdueLoan,
)
from warehouse.lib.workspace import WorkspaceContext


@pytest.fixture
def workspace_id():
    """A sample workspace ID for multi-tenancy."""
    return uuid7()


@pytest.fixture
def user_id():
    """A sample user ID."""
    return uuid7()


@pytest.fixture
def workspace(workspace_id, user_id) -> WorkspaceContext:
    """Workspace context for tests."""
    return WorkspaceContext(
        workspace_id=workspace_id,
        user_id=user_id,
        user_role=WorkspaceRole.MEMBER,
    )


@pytest.fixture
def dashboard_service_mock() -> AsyncMock:
    """Mocked dashboard service."""
    svc = AsyncMock()
    svc.get_stats = AsyncMock()
    svc.get_extended_stats = AsyncMock()
    svc.get_recently_modified = AsyncMock()
    svc.get_out_of_stock = AsyncMock()
    svc.get_low_stock = AsyncMock()
    svc.get_expiring_soon = AsyncMock()
    svc.get_warranty_expiring = AsyncMock()
    svc.get_overdue_loans = AsyncMock()
    return svc


@pytest.fixture
def controller() -> DashboardController:
    """Dashboard controller instance."""
    return DashboardController(owner=None)


async def _call(handler, controller, **kwargs):
    """Invoke underlying handler function."""
    return await handler.fn(controller, **kwargs)


def _mock_stats() -> DashboardStats:
    """Create mock dashboard stats."""
    return DashboardStats(
        total_items=50,
        total_locations=10,
        active_loans=5,
        total_categories=8,
    )


def _mock_extended_stats() -> DashboardExtendedStats:
    """Create mock extended dashboard stats."""
    return DashboardExtendedStats(
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


def _mock_inventory_summary() -> InventorySummary:
    """Create mock inventory summary."""
    return InventorySummary(
        id=uuid7(),
        item_name="Test Item",
        item_sku="SKU-001",
        location_name="Garage",
        quantity=10,
        updated_at=datetime(2024, 1, 1, 12, 0, 0),
    )


def _mock_inventory_alert() -> InventoryAlertItem:
    """Create mock inventory alert item."""
    return InventoryAlertItem(
        id=uuid7(),
        item_name="Expiring Item",
        item_sku="SKU-002",
        location_name="Fridge",
        quantity=5,
        expiration_date=date(2024, 2, 15),
    )


def _mock_overdue_loan() -> OverdueLoan:
    """Create mock overdue loan."""
    return OverdueLoan(
        id=uuid7(),
        borrower_name="John Doe",
        item_name="Power Drill",
        quantity=1,
        due_date=date(2024, 1, 1),
        days_overdue=15,
    )


@pytest.mark.asyncio
async def test_get_stats(
    controller: DashboardController,
    dashboard_service_mock: AsyncMock,
    workspace: WorkspaceContext,
):
    """Test get_stats endpoint returns dashboard statistics."""
    expected = _mock_stats()
    dashboard_service_mock.get_stats.return_value = expected

    result = await _call(
        controller.get_stats,
        controller,
        dashboard_service=dashboard_service_mock,
        workspace=workspace,
    )

    dashboard_service_mock.get_stats.assert_awaited_once_with(workspace.workspace_id)
    assert result == expected
    assert result.total_items == 50


@pytest.mark.asyncio
async def test_get_extended_stats(
    controller: DashboardController,
    dashboard_service_mock: AsyncMock,
    workspace: WorkspaceContext,
):
    """Test get_extended_stats endpoint returns extended statistics."""
    expected = _mock_extended_stats()
    dashboard_service_mock.get_extended_stats.return_value = expected

    result = await _call(
        controller.get_extended_stats,
        controller,
        dashboard_service=dashboard_service_mock,
        workspace=workspace,
    )

    dashboard_service_mock.get_extended_stats.assert_awaited_once_with(
        workspace.workspace_id
    )
    assert result == expected
    assert result.out_of_stock_count == 3


@pytest.mark.asyncio
async def test_get_recently_modified(
    controller: DashboardController,
    dashboard_service_mock: AsyncMock,
    workspace: WorkspaceContext,
):
    """Test get_recently_modified endpoint returns inventory summaries."""
    expected = [_mock_inventory_summary()]
    dashboard_service_mock.get_recently_modified.return_value = expected

    result = await _call(
        controller.get_recently_modified,
        controller,
        dashboard_service=dashboard_service_mock,
        workspace=workspace,
        limit=10,
    )

    dashboard_service_mock.get_recently_modified.assert_awaited_once_with(
        workspace.workspace_id, 10
    )
    assert len(result) == 1
    assert result[0].item_name == "Test Item"


@pytest.mark.asyncio
async def test_get_out_of_stock(
    controller: DashboardController,
    dashboard_service_mock: AsyncMock,
    workspace: WorkspaceContext,
):
    """Test get_out_of_stock endpoint returns zero quantity items."""
    expected = [_mock_inventory_summary()]
    dashboard_service_mock.get_out_of_stock.return_value = expected

    result = await _call(
        controller.get_out_of_stock,
        controller,
        dashboard_service=dashboard_service_mock,
        workspace=workspace,
        limit=10,
    )

    dashboard_service_mock.get_out_of_stock.assert_awaited_once_with(
        workspace.workspace_id, 10
    )
    assert len(result) == 1


@pytest.mark.asyncio
async def test_get_low_stock(
    controller: DashboardController,
    dashboard_service_mock: AsyncMock,
    workspace: WorkspaceContext,
):
    """Test get_low_stock endpoint returns low quantity items."""
    expected = [_mock_inventory_summary()]
    dashboard_service_mock.get_low_stock.return_value = expected

    result = await _call(
        controller.get_low_stock,
        controller,
        dashboard_service=dashboard_service_mock,
        workspace=workspace,
        limit=10,
    )

    dashboard_service_mock.get_low_stock.assert_awaited_once_with(
        workspace.workspace_id, 10
    )
    assert len(result) == 1


@pytest.mark.asyncio
async def test_get_expiring_soon(
    controller: DashboardController,
    dashboard_service_mock: AsyncMock,
    workspace: WorkspaceContext,
):
    """Test get_expiring_soon endpoint returns expiring items."""
    expected = [_mock_inventory_alert()]
    dashboard_service_mock.get_expiring_soon.return_value = expected

    result = await _call(
        controller.get_expiring_soon,
        controller,
        dashboard_service=dashboard_service_mock,
        workspace=workspace,
        limit=10,
    )

    dashboard_service_mock.get_expiring_soon.assert_awaited_once_with(
        workspace.workspace_id, 10
    )
    assert len(result) == 1
    assert result[0].expiration_date == date(2024, 2, 15)


@pytest.mark.asyncio
async def test_get_warranty_expiring(
    controller: DashboardController,
    dashboard_service_mock: AsyncMock,
    workspace: WorkspaceContext,
):
    """Test get_warranty_expiring endpoint returns warranty expiring items."""
    alert = InventoryAlertItem(
        id=uuid7(),
        item_name="Warranty Item",
        item_sku="SKU-003",
        location_name="Office",
        quantity=1,
        warranty_expires=date(2024, 3, 1),
    )
    dashboard_service_mock.get_warranty_expiring.return_value = [alert]

    result = await _call(
        controller.get_warranty_expiring,
        controller,
        dashboard_service=dashboard_service_mock,
        workspace=workspace,
        limit=10,
    )

    dashboard_service_mock.get_warranty_expiring.assert_awaited_once_with(
        workspace.workspace_id, 10
    )
    assert len(result) == 1
    assert result[0].warranty_expires == date(2024, 3, 1)


@pytest.mark.asyncio
async def test_get_overdue_loans(
    controller: DashboardController,
    dashboard_service_mock: AsyncMock,
    workspace: WorkspaceContext,
):
    """Test get_overdue_loans endpoint returns overdue loan details."""
    expected = [_mock_overdue_loan()]
    dashboard_service_mock.get_overdue_loans.return_value = expected

    result = await _call(
        controller.get_overdue_loans,
        controller,
        dashboard_service=dashboard_service_mock,
        workspace=workspace,
        limit=10,
    )

    dashboard_service_mock.get_overdue_loans.assert_awaited_once_with(
        workspace.workspace_id, 10
    )
    assert len(result) == 1
    assert result[0].borrower_name == "John Doe"
    assert result[0].days_overdue == 15
