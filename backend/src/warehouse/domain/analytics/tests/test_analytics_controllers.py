"""Controller tests for analytics domain."""

from unittest.mock import AsyncMock
from uuid import uuid7

import pytest

from warehouse.domain.analytics.controllers import AnalyticsController
from warehouse.domain.analytics.schemas import (
    AnalyticsResponse,
    AssetValueSummary,
    LoanStats,
)
from warehouse.domain.auth.models import WorkspaceRole
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
def analytics_service_mock() -> AsyncMock:
    """Mocked analytics service."""
    svc = AsyncMock()
    svc.get_analytics = AsyncMock()
    return svc


@pytest.fixture
def controller() -> AnalyticsController:
    """Analytics controller instance."""
    return AnalyticsController(owner=None)


async def _call(handler, controller, **kwargs):
    """Invoke underlying handler function."""
    return await handler.fn(controller, **kwargs)


def _mock_analytics_response() -> AnalyticsResponse:
    """Create a mock analytics response."""
    return AnalyticsResponse(
        inventory_by_status=[],
        inventory_by_condition=[],
        category_breakdown=[],
        location_breakdown=[],
        loan_stats=LoanStats(
            total_loans=10,
            active_loans=5,
            returned_loans=5,
            overdue_loans=1,
        ),
        asset_value=AssetValueSummary(
            total_value=10000,
            currency_code="EUR",
            item_count=20,
        ),
        top_borrowers=[],
        total_items=50,
        total_inventory_records=100,
        total_locations=10,
        total_containers=5,
    )


@pytest.mark.asyncio
async def test_get_analytics(
    controller: AnalyticsController,
    analytics_service_mock: AsyncMock,
    workspace: WorkspaceContext,
):
    """Test get_analytics endpoint returns analytics data."""
    expected_response = _mock_analytics_response()
    analytics_service_mock.get_analytics.return_value = expected_response

    result = await _call(
        controller.get_analytics,
        controller,
        analytics_service=analytics_service_mock,
        workspace=workspace,
    )

    analytics_service_mock.get_analytics.assert_awaited_once_with(workspace.workspace_id)
    assert result == expected_response
    assert result.total_items == 50
    assert result.loan_stats.total_loans == 10


@pytest.mark.asyncio
async def test_get_analytics_calls_service_with_workspace_id(
    controller: AnalyticsController,
    analytics_service_mock: AsyncMock,
    workspace: WorkspaceContext,
):
    """Test that get_analytics passes the correct workspace_id to service."""
    analytics_service_mock.get_analytics.return_value = _mock_analytics_response()

    await _call(
        controller.get_analytics,
        controller,
        analytics_service=analytics_service_mock,
        workspace=workspace,
    )

    # Verify workspace_id was passed correctly
    call_args = analytics_service_mock.get_analytics.call_args
    assert call_args[0][0] == workspace.workspace_id
