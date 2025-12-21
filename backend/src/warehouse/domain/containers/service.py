"""Containers domain service."""

from uuid import UUID

from warehouse.domain.containers.models import Container
from warehouse.domain.containers.repository import ContainerRepository
from warehouse.domain.containers.schemas import ContainerCreate, ContainerUpdate
from warehouse.errors import AppError, ErrorCode


class ContainerService:
    """Container service."""

    def __init__(self, repository: ContainerRepository):
        """Initialize container service."""
        self.repository = repository

    async def create_container(
        self, container_data: ContainerCreate, workspace_id: UUID
    ) -> Container:
        """Create a new container."""
        container = Container(
            workspace_id=workspace_id,
            name=container_data.name,
            location_id=container_data.location_id,
            description=container_data.description,
            capacity=container_data.capacity,
            short_code=container_data.short_code,
        )
        container = await self.repository.add(container)
        await self.repository.session.commit()
        return container

    async def get_all_containers(self, workspace_id: UUID) -> list[Container]:
        """Get all containers for a workspace."""
        return await self.repository.list(workspace_id=workspace_id)

    async def get_container(self, container_id: UUID, workspace_id: UUID) -> Container:
        """Get container by ID within a workspace."""
        container = await self.repository.get_one_or_none(
            id=container_id, workspace_id=workspace_id
        )
        if not container:
            raise AppError(ErrorCode.CONTAINER_NOT_FOUND, status_code=404)
        return container

    async def update_container(
        self, container_id: UUID, container_data: ContainerUpdate, workspace_id: UUID
    ) -> Container:
        """Update a container."""
        container = await self.repository.get_one_or_none(
            id=container_id, workspace_id=workspace_id
        )
        if not container:
            raise AppError(ErrorCode.CONTAINER_NOT_FOUND, status_code=404)

        if container_data.name is not None:
            container.name = container_data.name
        if container_data.location_id is not None:
            container.location_id = container_data.location_id
        if container_data.description is not None:
            container.description = container_data.description
        if container_data.capacity is not None:
            container.capacity = container_data.capacity
        if container_data.short_code is not None:
            container.short_code = container_data.short_code

        container = await self.repository.update(container)
        await self.repository.session.commit()
        return container

    async def delete_container(self, container_id: UUID, workspace_id: UUID) -> bool:
        """Delete a container."""
        container = await self.repository.get_one_or_none(
            id=container_id, workspace_id=workspace_id
        )
        if not container:
            raise AppError(ErrorCode.CONTAINER_NOT_FOUND, status_code=404)

        await self.repository.session.delete(container)
        await self.repository.session.commit()
        return True
