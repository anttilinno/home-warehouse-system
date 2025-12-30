"""Import service for bulk data import operations."""

import logging
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from warehouse.domain.containers.models import Container
from warehouse.domain.imports.schemas import EntityType, ImportError, ImportResult
from warehouse.domain.inventory.models import Inventory
from warehouse.domain.items.models import Category, Item
from warehouse.domain.loans.models import Borrower
from warehouse.domain.locations.models import Location

logger = logging.getLogger(__name__)


class ImportService:
    """Service for importing data from CSV/Excel files."""

    def __init__(self, session: AsyncSession):
        """Initialize import service.

        Args:
            session: SQLAlchemy async session
        """
        self.session = session

    async def import_data(
        self,
        entity_type: EntityType,
        rows: list[dict[str, Any]],
        workspace_id: UUID,
    ) -> ImportResult:
        """Import data for the specified entity type.

        Args:
            entity_type: Type of entity to import
            rows: List of row dictionaries from parsed file
            workspace_id: Workspace ID for the import

        Returns:
            ImportResult with counts and errors
        """
        importers = {
            EntityType.CATEGORIES: self._import_categories,
            EntityType.LOCATIONS: self._import_locations,
            EntityType.CONTAINERS: self._import_containers,
            EntityType.ITEMS: self._import_items,
            EntityType.BORROWERS: self._import_borrowers,
            EntityType.INVENTORY: self._import_inventory,
        }

        importer = importers.get(entity_type)
        if not importer:
            return ImportResult(
                entity_type=entity_type.value,
                total_rows=len(rows),
                created=0,
                updated=0,
                skipped=0,
                errors=[ImportError(row=0, field=None, message=f"Unknown entity type: {entity_type}")],
            )

        return await importer(rows, workspace_id)

    async def _import_categories(
        self, rows: list[dict[str, Any]], workspace_id: UUID
    ) -> ImportResult:
        """Import categories."""
        errors = []
        created = 0
        skipped = 0

        # First pass: create a name -> id mapping for parent resolution
        existing = await self.session.execute(
            select(Category).where(Category.workspace_id == workspace_id)
        )
        name_to_id: dict[str, UUID] = {c.name.lower(): c.id for c in existing.scalars()}

        for idx, row in enumerate(rows, start=2):  # Start at 2 (header is row 1)
            name = row.get("name")
            if not name:
                errors.append(ImportError(row=idx, field="name", message="Name is required"))
                continue

            # Check if already exists
            if name.lower() in name_to_id:
                skipped += 1
                continue

            # Resolve parent category
            parent_id = None
            parent_name = row.get("parent_category") or row.get("parent")
            if parent_name:
                parent_id = name_to_id.get(parent_name.lower())
                if not parent_id:
                    errors.append(
                        ImportError(row=idx, field="parent_category", message=f"Parent '{parent_name}' not found")
                    )
                    continue

            category = Category(
                workspace_id=workspace_id,
                name=name,
                description=row.get("description"),
                parent_category_id=parent_id,
            )
            self.session.add(category)
            await self.session.flush()  # Get the ID
            name_to_id[name.lower()] = category.id
            created += 1

        await self.session.commit()

        return ImportResult(
            entity_type="categories",
            total_rows=len(rows),
            created=created,
            updated=0,
            skipped=skipped,
            errors=errors,
        )

    async def _import_locations(
        self, rows: list[dict[str, Any]], workspace_id: UUID
    ) -> ImportResult:
        """Import locations."""
        errors = []
        created = 0
        skipped = 0

        # Build existing name -> id mapping
        existing = await self.session.execute(
            select(Location).where(Location.workspace_id == workspace_id)
        )
        name_to_id: dict[str, UUID] = {loc.name.lower(): loc.id for loc in existing.scalars()}

        for idx, row in enumerate(rows, start=2):
            name = row.get("name")
            if not name:
                errors.append(ImportError(row=idx, field="name", message="Name is required"))
                continue

            if name.lower() in name_to_id:
                skipped += 1
                continue

            parent_id = None
            parent_name = row.get("parent_location") or row.get("parent")
            if parent_name:
                parent_id = name_to_id.get(parent_name.lower())
                if not parent_id:
                    errors.append(
                        ImportError(row=idx, field="parent_location", message=f"Parent '{parent_name}' not found")
                    )
                    continue

            location = Location(
                workspace_id=workspace_id,
                name=name,
                description=row.get("description"),
                zone=row.get("zone"),
                shelf=row.get("shelf"),
                bin=row.get("bin"),
                parent_location_id=parent_id,
            )
            self.session.add(location)
            await self.session.flush()
            name_to_id[name.lower()] = location.id
            created += 1

        await self.session.commit()

        return ImportResult(
            entity_type="locations",
            total_rows=len(rows),
            created=created,
            updated=0,
            skipped=skipped,
            errors=errors,
        )

    async def _import_containers(
        self, rows: list[dict[str, Any]], workspace_id: UUID
    ) -> ImportResult:
        """Import containers."""
        errors = []
        created = 0
        skipped = 0

        # Build location name -> id mapping
        existing_locs = await self.session.execute(
            select(Location).where(Location.workspace_id == workspace_id)
        )
        loc_name_to_id: dict[str, UUID] = {loc.name.lower(): loc.id for loc in existing_locs.scalars()}

        # Build existing container name -> id mapping
        existing = await self.session.execute(
            select(Container).where(Container.workspace_id == workspace_id)
        )
        name_to_id: dict[str, UUID] = {c.name.lower(): c.id for c in existing.scalars()}

        for idx, row in enumerate(rows, start=2):
            name = row.get("name")
            if not name:
                errors.append(ImportError(row=idx, field="name", message="Name is required"))
                continue

            if name.lower() in name_to_id:
                skipped += 1
                continue

            # Location is required
            location_name = row.get("location")
            if not location_name:
                errors.append(ImportError(row=idx, field="location", message="Location is required"))
                continue

            location_id = loc_name_to_id.get(location_name.lower())
            if not location_id:
                errors.append(
                    ImportError(row=idx, field="location", message=f"Location '{location_name}' not found")
                )
                continue

            container = Container(
                workspace_id=workspace_id,
                name=name,
                description=row.get("description"),
                location_id=location_id,
                capacity=row.get("capacity"),
                short_code=row.get("short_code"),
            )
            self.session.add(container)
            await self.session.flush()
            name_to_id[name.lower()] = container.id
            created += 1

        await self.session.commit()

        return ImportResult(
            entity_type="containers",
            total_rows=len(rows),
            created=created,
            updated=0,
            skipped=skipped,
            errors=errors,
        )

    async def _import_items(
        self, rows: list[dict[str, Any]], workspace_id: UUID
    ) -> ImportResult:
        """Import items."""
        errors = []
        created = 0
        skipped = 0

        # Build category name -> id mapping
        existing_cats = await self.session.execute(
            select(Category).where(Category.workspace_id == workspace_id)
        )
        cat_name_to_id: dict[str, UUID] = {c.name.lower(): c.id for c in existing_cats.scalars()}

        # Build existing item SKU -> id mapping
        existing = await self.session.execute(
            select(Item).where(Item.workspace_id == workspace_id)
        )
        sku_to_id: dict[str, UUID] = {item.sku.lower(): item.id for item in existing.scalars()}

        for idx, row in enumerate(rows, start=2):
            sku = row.get("sku")
            name = row.get("name")

            if not sku:
                errors.append(ImportError(row=idx, field="sku", message="SKU is required"))
                continue

            if not name:
                errors.append(ImportError(row=idx, field="name", message="Name is required"))
                continue

            if sku.lower() in sku_to_id:
                skipped += 1
                continue

            # Optional category
            category_id = None
            category_name = row.get("category")
            if category_name:
                category_id = cat_name_to_id.get(category_name.lower())
                if not category_id:
                    errors.append(
                        ImportError(row=idx, field="category", message=f"Category '{category_name}' not found")
                    )
                    continue

            item = Item(
                workspace_id=workspace_id,
                sku=sku,
                name=name,
                description=row.get("description"),
                category_id=category_id,
                obsidian_vault_path=row.get("obsidian_vault_path"),
                obsidian_note_path=row.get("obsidian_note_path"),
            )
            self.session.add(item)
            await self.session.flush()
            sku_to_id[sku.lower()] = item.id
            created += 1

        await self.session.commit()

        return ImportResult(
            entity_type="items",
            total_rows=len(rows),
            created=created,
            updated=0,
            skipped=skipped,
            errors=errors,
        )

    async def _import_borrowers(
        self, rows: list[dict[str, Any]], workspace_id: UUID
    ) -> ImportResult:
        """Import borrowers."""
        errors = []
        created = 0
        skipped = 0

        # Build existing borrower name -> id mapping
        existing = await self.session.execute(
            select(Borrower).where(Borrower.workspace_id == workspace_id)
        )
        name_to_id: dict[str, UUID] = {b.name.lower(): b.id for b in existing.scalars()}

        for idx, row in enumerate(rows, start=2):
            name = row.get("name")
            if not name:
                errors.append(ImportError(row=idx, field="name", message="Name is required"))
                continue

            if name.lower() in name_to_id:
                skipped += 1
                continue

            borrower = Borrower(
                workspace_id=workspace_id,
                name=name,
                email=row.get("email"),
                phone=row.get("phone"),
                notes=row.get("notes"),
            )
            self.session.add(borrower)
            await self.session.flush()
            name_to_id[name.lower()] = borrower.id
            created += 1

        await self.session.commit()

        return ImportResult(
            entity_type="borrowers",
            total_rows=len(rows),
            created=created,
            updated=0,
            skipped=skipped,
            errors=errors,
        )

    async def _build_inventory_lookups(
        self, workspace_id: UUID
    ) -> tuple[dict[str, UUID], dict[str, UUID], dict[str, UUID], set[tuple[UUID, UUID]]]:
        """Build lookup dictionaries for inventory import.

        Returns:
            Tuple of (item_sku_map, item_name_map, location_map, existing_inventory_set)
        """
        existing_items = await self.session.execute(
            select(Item).where(Item.workspace_id == workspace_id)
        )
        items = list(existing_items.scalars())
        item_sku_to_id = {item.sku.lower(): item.id for item in items}
        item_name_to_id = {item.name.lower(): item.id for item in items}

        existing_locs = await self.session.execute(
            select(Location).where(Location.workspace_id == workspace_id)
        )
        loc_name_to_id = {loc.name.lower(): loc.id for loc in existing_locs.scalars()}

        existing = await self.session.execute(
            select(Inventory).where(Inventory.workspace_id == workspace_id)
        )
        existing_set = {(inv.item_id, inv.location_id) for inv in existing.scalars()}

        return item_sku_to_id, item_name_to_id, loc_name_to_id, existing_set

    def _resolve_item_id(
        self,
        row: dict[str, Any],
        item_sku_map: dict[str, UUID],
        item_name_map: dict[str, UUID],
    ) -> tuple[UUID | None, str | None]:
        """Resolve item reference to ID.

        Assumes item_ref has already been validated as non-empty.

        Returns:
            Tuple of (item_id, error_message). One will be None.
        """
        item_ref = row.get("item") or row.get("sku") or row.get("item_name")
        item_id = item_sku_map.get(item_ref.lower()) or item_name_map.get(item_ref.lower())
        if not item_id:
            return None, f"Item '{item_ref}' not found"
        return item_id, None

    def _resolve_location_id(
        self, row: dict[str, Any], loc_map: dict[str, UUID]
    ) -> tuple[UUID | None, str | None]:
        """Resolve location name to ID.

        Assumes location_name has already been validated as non-empty.

        Returns:
            Tuple of (location_id, error_message). One will be None.
        """
        location_name = row.get("location")
        location_id = loc_map.get(location_name.lower())
        if not location_id:
            return None, f"Location '{location_name}' not found"
        return location_id, None

    def _parse_quantity(self, row: dict[str, Any]) -> tuple[int | None, str | None]:
        """Parse quantity from row.

        Returns:
            Tuple of (quantity, error_message). One will be None.
        """
        qty_str = row.get("quantity")
        if not qty_str:
            return 1, None

        try:
            return int(qty_str), None
        except ValueError:
            return None, f"Invalid quantity: {qty_str}"

    async def _import_inventory(
        self, rows: list[dict[str, Any]], workspace_id: UUID
    ) -> ImportResult:
        """Import inventory records."""
        errors: list[ImportError] = []
        created = 0
        skipped = 0

        item_sku_map, item_name_map, loc_map, existing_set = await self._build_inventory_lookups(
            workspace_id
        )

        for idx, row in enumerate(rows, start=2):
            # Validate required fields first (before resolution)
            item_ref = row.get("item") or row.get("sku") or row.get("item_name")
            location_name = row.get("location")

            if not item_ref:
                errors.append(ImportError(row=idx, field="item", message="Item is required"))
                continue

            if not location_name:
                errors.append(ImportError(row=idx, field="location", message="Location is required"))
                continue

            # Resolve item and location
            item_id, item_error = self._resolve_item_id(row, item_sku_map, item_name_map)
            if item_error:
                errors.append(ImportError(row=idx, field="item", message=item_error))
                continue

            location_id, loc_error = self._resolve_location_id(row, loc_map)
            if loc_error:
                errors.append(ImportError(row=idx, field="location", message=loc_error))
                continue

            if (item_id, location_id) in existing_set:
                skipped += 1
                continue

            quantity, qty_error = self._parse_quantity(row)
            if qty_error:
                errors.append(ImportError(row=idx, field="quantity", message=qty_error))
                continue

            inventory = Inventory(
                workspace_id=workspace_id,
                item_id=item_id,
                location_id=location_id,
                quantity=quantity,
            )
            self.session.add(inventory)
            await self.session.flush()
            existing_set.add((item_id, location_id))
            created += 1

        await self.session.commit()

        return ImportResult(
            entity_type="inventory",
            total_rows=len(rows),
            created=created,
            updated=0,
            skipped=skipped,
            errors=errors,
        )
