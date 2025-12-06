"""Items domain controllers."""

from uuid import UUID

from litestar import delete, get, patch, post
from litestar.controller import Controller
from litestar.di import Provide
from litestar.exceptions import NotFoundException
from litestar.status_codes import HTTP_201_CREATED

from warehouse.domain.items.repository import CategoryRepository, ItemRepository
from warehouse.domain.items.schemas import (
    CategoryCreate,
    CategoryResponse,
    ItemCreate,
    ItemResponse,
    ItemUpdate,
)
from warehouse.domain.items.service import CategoryService, ItemService


def get_category_service(repository: CategoryRepository) -> CategoryService:
    """Dependency for category service."""
    return CategoryService(repository)


def get_item_service(repository: ItemRepository) -> ItemService:
    """Dependency for item service."""
    return ItemService(repository)


class CategoryController(Controller):
    """Category controller."""

    path = "/categories"
    dependencies = {"category_service": Provide(get_category_service)}

    @post("/", status_code=HTTP_201_CREATED)
    async def create_category(
        self, data: CategoryCreate, category_service: CategoryService
    ) -> CategoryResponse:
        """Create a new category."""
        category = await category_service.create_category(data)
        return CategoryResponse(
            id=category.id,
            name=category.name,
            description=category.description,
            created_at=category.created_at,
        )

    @get("/")
    async def list_categories(
        self, category_service: CategoryService
    ) -> list[CategoryResponse]:
        """List all categories."""
        categories = await category_service.get_all_categories()
        return [
            CategoryResponse(
                id=c.id,
                name=c.name,
                description=c.description,
                created_at=c.created_at,
            )
            for c in categories
        ]


class ItemController(Controller):
    """Item controller."""

    path = "/items"
    dependencies = {"item_service": Provide(get_item_service)}

    @post("/", status_code=HTTP_201_CREATED)
    async def create_item(
        self, data: ItemCreate, item_service: ItemService
    ) -> ItemResponse:
        """Create a new item."""
        item = await item_service.create_item(data)
        return ItemResponse(
            id=item.id,
            sku=item.sku,
            name=item.name,
            description=item.description,
            category_id=item.category_id,
            created_at=item.created_at,
            updated_at=item.updated_at,
        )

    @get("/")
    async def list_items(self, item_service: ItemService) -> list[ItemResponse]:
        """List all items."""
        items = await item_service.get_all_items()
        return [
            ItemResponse(
                id=i.id,
                sku=i.sku,
                name=i.name,
                description=i.description,
                category_id=i.category_id,
                created_at=i.created_at,
                updated_at=i.updated_at,
            )
            for i in items
        ]

    @get("/{item_id:uuid}")
    async def get_item(
        self, item_id: UUID, item_service: ItemService
    ) -> ItemResponse:
        """Get item by ID."""
        item = await item_service.get_item(item_id)
        if not item:
            raise NotFoundException("Item not found")
        return ItemResponse(
            id=item.id,
            sku=item.sku,
            name=item.name,
            description=item.description,
            category_id=item.category_id,
            created_at=item.created_at,
            updated_at=item.updated_at,
        )

    @patch("/{item_id:uuid}")
    async def update_item(
        self, item_id: UUID, data: ItemUpdate, item_service: ItemService
    ) -> ItemResponse:
        """Update an item."""
        item = await item_service.update_item(item_id, data)
        if not item:
            raise NotFoundException("Item not found")
        return ItemResponse(
            id=item.id,
            sku=item.sku,
            name=item.name,
            description=item.description,
            category_id=item.category_id,
            created_at=item.created_at,
            updated_at=item.updated_at,
        )

    @delete("/{item_id:uuid}")
    async def delete_item(self, item_id: UUID, item_service: ItemService) -> None:
        """Delete an item."""
        deleted = await item_service.delete_item(item_id)
        if not deleted:
            raise NotFoundException("Item not found")

