"""Items domain controllers."""

from uuid import UUID

from litestar import delete, get, patch, post
from litestar.controller import Controller
from litestar.di import Provide
from litestar.status_codes import HTTP_201_CREATED
from sqlalchemy.ext.asyncio import AsyncSession

from warehouse.domain.items.repository import CategoryRepository, ItemRepository
from warehouse.domain.items.schemas import (
    CategoryCreate,
    CategoryResponse,
    CategoryUpdate,
    ItemCreate,
    ItemResponse,
    ItemUpdate,
)
from warehouse.domain.items.service import CategoryService, ItemService, item_to_response
from warehouse.errors import AppError
from warehouse.lib.workspace import WorkspaceContext, get_workspace_context, require_write_permission


def get_category_service(db_session: AsyncSession) -> CategoryService:
    """Dependency for category service."""
    repository = CategoryRepository(session=db_session)
    return CategoryService(repository)


def get_item_service(db_session: AsyncSession) -> ItemService:
    """Dependency for item service."""
    repository = ItemRepository(session=db_session)
    return ItemService(repository)


class CategoryController(Controller):
    """Category controller."""

    path = "/categories"
    dependencies = {
        "category_service": Provide(get_category_service, sync_to_thread=False),
        "workspace": Provide(get_workspace_context),
    }

    @post("/", status_code=HTTP_201_CREATED)
    async def create_category(
        self,
        data: CategoryCreate,
        category_service: CategoryService,
        workspace: WorkspaceContext,
    ) -> CategoryResponse:
        """Create a new category."""
        require_write_permission(workspace)
        category = await category_service.create_category(data, workspace.workspace_id)
        return CategoryResponse(
            id=category.id,
            name=category.name,
            parent_category_id=category.parent_category_id,
            description=category.description,
            created_at=category.created_at,
        )

    @get("/")
    async def list_categories(
        self,
        category_service: CategoryService,
        workspace: WorkspaceContext,
    ) -> list[CategoryResponse]:
        """List all categories."""
        categories = await category_service.get_all_categories(workspace.workspace_id)
        return [
            CategoryResponse(
                id=c.id,
                name=c.name,
                parent_category_id=c.parent_category_id,
                description=c.description,
                created_at=c.created_at,
            )
            for c in categories
        ]

    @patch("/{category_id:uuid}")
    async def update_category(
        self,
        category_id: UUID,
        data: CategoryUpdate,
        category_service: CategoryService,
        workspace: WorkspaceContext,
    ) -> CategoryResponse:
        """Update a category."""
        require_write_permission(workspace)
        try:
            category = await category_service.update_category(
                category_id, data, workspace.workspace_id
            )
        except AppError as exc:
            raise exc.to_http_exception()
        return CategoryResponse(
            id=category.id,
            name=category.name,
            parent_category_id=category.parent_category_id,
            description=category.description,
            created_at=category.created_at,
        )

    @delete("/{category_id:uuid}")
    async def delete_category(
        self,
        category_id: UUID,
        category_service: CategoryService,
        workspace: WorkspaceContext,
    ) -> None:
        """Delete a category."""
        require_write_permission(workspace)
        try:
            await category_service.delete_category(category_id, workspace.workspace_id)
        except AppError as exc:
            raise exc.to_http_exception()


class ItemController(Controller):
    """Item controller."""

    path = "/items"
    dependencies = {
        "item_service": Provide(get_item_service, sync_to_thread=False),
        "workspace": Provide(get_workspace_context),
    }

    @post("/", status_code=HTTP_201_CREATED)
    async def create_item(
        self,
        data: ItemCreate,
        item_service: ItemService,
        workspace: WorkspaceContext,
    ) -> ItemResponse:
        """Create a new item."""
        require_write_permission(workspace)
        try:
            item = await item_service.create_item(data, workspace.workspace_id)
        except AppError as exc:
            raise exc.to_http_exception()
        return item_to_response(item)

    @get("/")
    async def list_items(
        self,
        item_service: ItemService,
        workspace: WorkspaceContext,
    ) -> list[ItemResponse]:
        """List all items."""
        items = await item_service.get_all_items(workspace.workspace_id)
        return [item_to_response(i) for i in items]

    @get("/{item_id:uuid}")
    async def get_item(
        self,
        item_id: UUID,
        item_service: ItemService,
        workspace: WorkspaceContext,
    ) -> ItemResponse:
        """Get item by ID."""
        try:
            item = await item_service.get_item(item_id, workspace.workspace_id)
        except AppError as exc:
            raise exc.to_http_exception()
        return item_to_response(item)

    @patch("/{item_id:uuid}")
    async def update_item(
        self,
        item_id: UUID,
        data: ItemUpdate,
        item_service: ItemService,
        workspace: WorkspaceContext,
    ) -> ItemResponse:
        """Update an item."""
        require_write_permission(workspace)
        try:
            item = await item_service.update_item(item_id, data, workspace.workspace_id)
        except AppError as exc:
            raise exc.to_http_exception()
        return item_to_response(item)

    @delete("/{item_id:uuid}")
    async def delete_item(
        self,
        item_id: UUID,
        item_service: ItemService,
        workspace: WorkspaceContext,
    ) -> None:
        """Delete an item."""
        require_write_permission(workspace)
        try:
            await item_service.delete_item(item_id, workspace.workspace_id)
        except AppError as exc:
            raise exc.to_http_exception()

