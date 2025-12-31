"""Containers domain controllers."""

from uuid import UUID

from litestar import delete, get, patch, post
from litestar.controller import Controller
from litestar.di import Provide
from litestar.status_codes import HTTP_201_CREATED
from sqlalchemy.ext.asyncio import AsyncSession

from warehouse.domain.activity_log.models import ActivityAction, ActivityEntity
from warehouse.domain.activity_log.repository import ActivityLogRepository
from warehouse.domain.activity_log.service import ActivityLogService
from warehouse.domain.containers.repository import ContainerRepository
from warehouse.domain.containers.schemas import ContainerCreate, ContainerResponse, ContainerUpdate
from warehouse.domain.containers.service import ContainerService
from warehouse.errors import AppError
from warehouse.lib.workspace import WorkspaceContext, get_workspace_context, require_write_permission


def get_container_service(db_session: AsyncSession) -> ContainerService:
    """Dependency for container service."""
    repository = ContainerRepository(session=db_session)
    return ContainerService(repository)


def get_activity_log_service(db_session: AsyncSession) -> ActivityLogService:
    """Dependency for activity log service."""
    repository = ActivityLogRepository(session=db_session)
    return ActivityLogService(repository)


class ContainerController(Controller):
    """Container controller."""

    path = "/containers"
    dependencies = {
        "container_service": Provide(get_container_service, sync_to_thread=False),
        "activity_service": Provide(get_activity_log_service, sync_to_thread=False),
        "workspace": Provide(get_workspace_context),
    }

    @post("/", status_code=HTTP_201_CREATED)
    async def create_container(
        self,
        data: ContainerCreate,
        container_service: ContainerService,
        activity_service: ActivityLogService,
        workspace: WorkspaceContext,
    ) -> ContainerResponse:
        """Create a new container."""
        require_write_permission(workspace)
        container = await container_service.create_container(data, workspace.workspace_id)

        await activity_service.log_action(
            workspace_id=workspace.workspace_id,
            user_id=workspace.user_id,
            action=ActivityAction.CREATE,
            entity_type=ActivityEntity.CONTAINER,
            entity_id=container.id,
            entity_name=container.name,
        )

        return ContainerResponse(
            id=container.id,
            name=container.name,
            location_id=container.location_id,
            location_name=container.location.name if container.location else None,
            description=container.description,
            capacity=container.capacity,
            short_code=container.short_code,
            created_at=container.created_at,
            updated_at=container.updated_at,
        )

    @get("/")
    async def list_containers(
        self,
        container_service: ContainerService,
        workspace: WorkspaceContext,
    ) -> list[ContainerResponse]:
        """List all containers."""
        containers = await container_service.get_all_containers(workspace.workspace_id)
        return [
            ContainerResponse(
                id=c.id,
                name=c.name,
                location_id=c.location_id,
                location_name=c.location.name if c.location else None,
                description=c.description,
                capacity=c.capacity,
                short_code=c.short_code,
                created_at=c.created_at,
                updated_at=c.updated_at,
            )
            for c in containers
        ]

    @get("/{container_id:uuid}")
    async def get_container(
        self,
        container_id: UUID,
        container_service: ContainerService,
        workspace: WorkspaceContext,
    ) -> ContainerResponse:
        """Get container by ID."""
        try:
            container = await container_service.get_container(container_id, workspace.workspace_id)
        except AppError as exc:
            raise exc.to_http_exception()
        return ContainerResponse(
            id=container.id,
            name=container.name,
            location_id=container.location_id,
            location_name=container.location.name if container.location else None,
            description=container.description,
            capacity=container.capacity,
            short_code=container.short_code,
            created_at=container.created_at,
            updated_at=container.updated_at,
        )

    @patch("/{container_id:uuid}")
    async def update_container(
        self,
        container_id: UUID,
        data: ContainerUpdate,
        container_service: ContainerService,
        activity_service: ActivityLogService,
        workspace: WorkspaceContext,
    ) -> ContainerResponse:
        """Update a container."""
        require_write_permission(workspace)
        try:
            # Get old values for change tracking
            old_container = await container_service.get_container(
                container_id, workspace.workspace_id
            )
            old_name = old_container.name

            container = await container_service.update_container(
                container_id, data, workspace.workspace_id
            )

            # Track changes
            changes = {}
            if data.name is not None and data.name != old_name:
                changes["name"] = {"old": old_name, "new": data.name}

            await activity_service.log_action(
                workspace_id=workspace.workspace_id,
                user_id=workspace.user_id,
                action=ActivityAction.UPDATE,
                entity_type=ActivityEntity.CONTAINER,
                entity_id=container.id,
                entity_name=container.name,
                changes=changes if changes else None,
            )
        except AppError as exc:
            raise exc.to_http_exception()
        return ContainerResponse(
            id=container.id,
            name=container.name,
            location_id=container.location_id,
            location_name=container.location.name if container.location else None,
            description=container.description,
            capacity=container.capacity,
            short_code=container.short_code,
            created_at=container.created_at,
            updated_at=container.updated_at,
        )

    @delete("/{container_id:uuid}")
    async def delete_container(
        self,
        container_id: UUID,
        container_service: ContainerService,
        activity_service: ActivityLogService,
        workspace: WorkspaceContext,
    ) -> None:
        """Delete a container."""
        require_write_permission(workspace)
        try:
            # Get container details before deletion
            container = await container_service.get_container(
                container_id, workspace.workspace_id
            )
            container_name = container.name

            await container_service.delete_container(container_id, workspace.workspace_id)

            await activity_service.log_action(
                workspace_id=workspace.workspace_id,
                user_id=workspace.user_id,
                action=ActivityAction.DELETE,
                entity_type=ActivityEntity.CONTAINER,
                entity_id=container_id,
                entity_name=container_name,
            )
        except AppError as exc:
            raise exc.to_http_exception()
