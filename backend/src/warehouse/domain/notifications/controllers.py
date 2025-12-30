"""Notifications domain controllers."""

from litestar import get, post, Request
from litestar.controller import Controller
from litestar.di import Provide
from sqlalchemy.ext.asyncio import AsyncSession

from warehouse.config import Config
from warehouse.domain.auth.repository import UserRepository
from warehouse.domain.auth.service import AuthService
from warehouse.domain.notifications.repository import NotificationRepository
from warehouse.domain.notifications.schemas import (
    NotificationListResponse,
    NotificationMarkReadRequest,
)
from warehouse.domain.notifications.service import NotificationService
from warehouse.errors import AppError, ErrorCode


def get_notification_service(db_session: AsyncSession) -> NotificationService:
    """Dependency for notification service."""
    repository = NotificationRepository(session=db_session)
    return NotificationService(repository)


def get_auth_service(db_session: AsyncSession, config: Config) -> AuthService:
    """Dependency for auth service."""
    user_repository = UserRepository(session=db_session)
    return AuthService(user_repository, config)


class NotificationController(Controller):
    """Notification controller."""

    path = "/notifications"
    dependencies = {
        "notification_service": Provide(get_notification_service, sync_to_thread=False),
        "auth_service": Provide(get_auth_service, sync_to_thread=False),
    }

    def _extract_token(self, request: Request) -> str:
        """Extract JWT token from Authorization header."""
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            raise AppError(ErrorCode.AUTH_INVALID_TOKEN, status_code=401)
        return auth_header[7:]

    @get("/")
    async def get_notifications(
        self,
        request: Request,
        notification_service: NotificationService,
        auth_service: AuthService,
        limit: int = 50,
        offset: int = 0,
        unread_only: bool = False,
    ) -> NotificationListResponse:
        """Get notifications for the current user."""
        token = self._extract_token(request)
        user = await auth_service.get_current_user(token)

        return await notification_service.get_notifications(
            user_id=user.id,
            limit=limit,
            offset=offset,
            unread_only=unread_only,
        )

    @get("/unread-count")
    async def get_unread_count(
        self,
        request: Request,
        notification_service: NotificationService,
        auth_service: AuthService,
    ) -> dict:
        """Get unread notification count for the current user."""
        token = self._extract_token(request)
        user = await auth_service.get_current_user(token)

        count = await notification_service.get_unread_count(user.id)
        return {"unread_count": count}

    @post("/mark-read")
    async def mark_as_read(
        self,
        request: Request,
        data: NotificationMarkReadRequest,
        notification_service: NotificationService,
        auth_service: AuthService,
    ) -> dict:
        """Mark notifications as read."""
        token = self._extract_token(request)
        user = await auth_service.get_current_user(token)

        count = await notification_service.mark_as_read(
            user_id=user.id,
            notification_ids=data.notification_ids,
        )
        return {"marked_count": count}
