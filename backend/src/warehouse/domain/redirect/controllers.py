"""Redirect controller for short code URL resolution."""

from litestar import Controller, get
from litestar.exceptions import NotFoundException
from litestar.response import Redirect
from sqlalchemy import select, union_all, literal
from sqlalchemy.ext.asyncio import AsyncSession

from warehouse.domain.containers.models import Container
from warehouse.domain.locations.models import Location
from warehouse.domain.items.models import Item


class RedirectController(Controller):
    """Controller for short code redirects."""

    path = "/r"
    tags = ["redirect"]

    @get("/{code:str}", sync_to_thread=False)
    async def redirect_short_code(self, code: str, db_session: AsyncSession) -> Redirect:
        """Resolve a short code and redirect to the appropriate dashboard page.

        Looks up the short code in containers, locations, and items tables.
        Returns a 302 redirect to the frontend dashboard page for the entity.
        """
        # Build union query to find the short code across all entity types
        container_query = select(
            literal("container").label("type"),
            Container.id.label("id"),
        ).where(Container.short_code == code)

        location_query = select(
            literal("location").label("type"),
            Location.id.label("id"),
        ).where(Location.short_code == code)

        item_query = select(
            literal("item").label("type"),
            Item.id.label("id"),
        ).where(Item.short_code == code)

        # Combine all queries
        combined = union_all(container_query, location_query, item_query)
        result = await db_session.execute(combined)
        row = result.first()

        if row is None:
            raise NotFoundException(detail=f"Short code '{code}' not found")

        entity_type, entity_id = row

        # Build redirect URL based on entity type
        # Using /en as default locale - frontend will handle locale switching
        redirect_urls = {
            "container": f"/en/dashboard/containers?id={entity_id}",
            "location": f"/en/dashboard/locations?id={entity_id}",
            "item": f"/en/dashboard/items/{entity_id}",
        }

        redirect_url = redirect_urls.get(entity_type)
        if redirect_url is None:
            raise NotFoundException(detail=f"Unknown entity type: {entity_type}")

        return Redirect(path=redirect_url)
