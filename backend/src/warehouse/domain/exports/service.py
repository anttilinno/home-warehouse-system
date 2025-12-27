"""Export domain service."""

import io
import json
from datetime import UTC, datetime
from uuid import UUID

from openpyxl import Workbook
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from warehouse.domain.auth.models import Workspace, WorkspaceExport
from warehouse.domain.containers.models import Container
from warehouse.domain.inventory.models import Inventory
from warehouse.domain.items.models import Category, Item
from warehouse.domain.loans.models import Borrower, Loan
from warehouse.domain.locations.models import Location


class ExportService:
    """Export service for generating workspace data exports."""

    def __init__(self, session: AsyncSession):
        """Initialize export service."""
        self.session = session

    async def export_workspace_xlsx(
        self, workspace_id: UUID, user_id: UUID
    ) -> tuple[bytes, dict]:
        """Export workspace data as Excel file."""
        data = await self._fetch_all_data(workspace_id)

        wb = Workbook()
        # Remove default sheet
        wb.remove(wb.active)

        # Categories sheet
        self._add_sheet(wb, "Categories", [
            ["ID", "Name", "Parent Category", "Description"],
        ] + [
            [str(c["id"]), c["name"], c["parent_name"] or "", c["description"] or ""]
            for c in data["categories"]
        ])

        # Locations sheet
        self._add_sheet(wb, "Locations", [
            ["ID", "Name", "Parent Location", "Zone", "Shelf", "Bin", "Description"],
        ] + [
            [str(loc["id"]), loc["name"], loc["parent_name"] or "",
             loc["zone"] or "", loc["shelf"] or "", loc["bin"] or "", loc["description"] or ""]
            for loc in data["locations"]
        ])

        # Containers sheet
        self._add_sheet(wb, "Containers", [
            ["ID", "Name", "Location", "Description", "Capacity", "Short Code"],
        ] + [
            [str(c["id"]), c["name"], c["location_name"],
             c["description"] or "", c["capacity"] or "", c["short_code"] or ""]
            for c in data["containers"]
        ])

        # Items sheet
        self._add_sheet(wb, "Items", [
            ["ID", "SKU", "Name", "Category", "Description"],
        ] + [
            [str(i["id"]), i["sku"], i["name"], i["category_name"] or "", i["description"] or ""]
            for i in data["items"]
        ])

        # Borrowers sheet
        self._add_sheet(wb, "Borrowers", [
            ["ID", "Name", "Email", "Phone", "Notes"],
        ] + [
            [str(b["id"]), b["name"], b["email"] or "", b["phone"] or "", b["notes"] or ""]
            for b in data["borrowers"]
        ])

        # Inventory sheet
        self._add_sheet(wb, "Inventory", [
            ["ID", "Item", "SKU", "Location", "Quantity", "Expiration Date", "Warranty Expires"],
        ] + [
            [str(inv["id"]), inv["item_name"], inv["item_sku"], inv["location_name"],
             inv["quantity"], inv["expiration_date"] or "", inv["warranty_expires"] or ""]
            for inv in data["inventory"]
        ])

        # Loans sheet
        self._add_sheet(wb, "Loans", [
            ["ID", "Item", "Borrower", "Quantity", "Loaned At", "Due Date", "Returned At", "Notes"],
        ] + [
            [str(loan["id"]), loan["item_name"], loan["borrower_name"], loan["quantity"],
             loan["loaned_at"], loan["due_date"] or "", loan["returned_at"] or "", loan["notes"] or ""]
            for loan in data["loans"]
        ])

        # Save to bytes
        output = io.BytesIO()
        wb.save(output)
        file_bytes = output.getvalue()

        # Log export
        record_counts = {
            "categories": len(data["categories"]),
            "locations": len(data["locations"]),
            "containers": len(data["containers"]),
            "items": len(data["items"]),
            "borrowers": len(data["borrowers"]),
            "inventory": len(data["inventory"]),
            "loans": len(data["loans"]),
        }
        await self._log_export(workspace_id, user_id, "xlsx", len(file_bytes), record_counts)

        return file_bytes, record_counts

    async def export_workspace_json(
        self, workspace_id: UUID, user_id: UUID
    ) -> tuple[dict, dict]:
        """Export workspace data as JSON."""
        data = await self._fetch_all_data(workspace_id)

        # Get workspace name
        workspace = await self.session.get(Workspace, workspace_id)
        workspace_name = workspace.name if workspace else "Unknown"

        export_data = {
            "exported_at": datetime.now(UTC).isoformat(),
            "workspace_id": str(workspace_id),
            "workspace_name": workspace_name,
            **data,
        }

        # Calculate size
        json_str = json.dumps(export_data, default=str)
        file_size = len(json_str.encode())

        # Log export
        record_counts = {
            "categories": len(data["categories"]),
            "locations": len(data["locations"]),
            "containers": len(data["containers"]),
            "items": len(data["items"]),
            "borrowers": len(data["borrowers"]),
            "inventory": len(data["inventory"]),
            "loans": len(data["loans"]),
        }
        await self._log_export(workspace_id, user_id, "json", file_size, record_counts)

        return export_data, record_counts

    def _add_sheet(self, wb: Workbook, name: str, rows: list[list]) -> None:
        """Add a sheet with data to the workbook."""
        ws = wb.create_sheet(name)
        for row in rows:
            ws.append(row)
        # Auto-size columns (approximate)
        for col_idx, _ in enumerate(rows[0] if rows else [], 1):
            ws.column_dimensions[chr(64 + col_idx)].width = 20

    async def _fetch_all_data(self, workspace_id: UUID) -> dict:
        """Fetch all workspace data with resolved foreign keys."""
        # Fetch categories
        categories_result = await self.session.execute(
            select(Category).where(Category.workspace_id == workspace_id)
        )
        categories = categories_result.scalars().all()
        category_map = {c.id: c.name for c in categories}

        categories_data = [
            {
                "id": c.id,
                "name": c.name,
                "parent_name": category_map.get(c.parent_category_id),
                "description": c.description,
            }
            for c in categories
        ]

        # Fetch locations
        locations_result = await self.session.execute(
            select(Location).where(Location.workspace_id == workspace_id)
        )
        locations = locations_result.scalars().all()
        location_map = {loc.id: loc.name for loc in locations}

        locations_data = [
            {
                "id": loc.id,
                "name": loc.name,
                "parent_name": location_map.get(loc.parent_location_id),
                "zone": loc.zone,
                "shelf": loc.shelf,
                "bin": loc.bin,
                "description": loc.description,
            }
            for loc in locations
        ]

        # Fetch containers
        containers_result = await self.session.execute(
            select(Container).where(Container.workspace_id == workspace_id)
        )
        containers = containers_result.scalars().all()

        containers_data = [
            {
                "id": c.id,
                "name": c.name,
                "location_name": location_map.get(c.location_id, "Unknown"),
                "description": c.description,
                "capacity": c.capacity,
                "short_code": c.short_code,
            }
            for c in containers
        ]

        # Fetch items
        items_result = await self.session.execute(
            select(Item).where(Item.workspace_id == workspace_id)
        )
        items = items_result.scalars().all()
        item_map = {i.id: {"name": i.name, "sku": i.sku} for i in items}

        items_data = [
            {
                "id": i.id,
                "sku": i.sku,
                "name": i.name,
                "category_name": category_map.get(i.category_id),
                "description": i.description,
            }
            for i in items
        ]

        # Fetch borrowers
        borrowers_result = await self.session.execute(
            select(Borrower).where(Borrower.workspace_id == workspace_id)
        )
        borrowers = borrowers_result.scalars().all()
        borrower_map = {b.id: b.name for b in borrowers}

        borrowers_data = [
            {
                "id": b.id,
                "name": b.name,
                "email": b.email,
                "phone": b.phone,
                "notes": b.notes,
            }
            for b in borrowers
        ]

        # Fetch inventory
        inventory_result = await self.session.execute(
            select(Inventory).where(Inventory.workspace_id == workspace_id)
        )
        inventory_items = inventory_result.scalars().all()
        inventory_map = {}  # For loans lookup

        inventory_data = []
        for inv in inventory_items:
            item_info = item_map.get(inv.item_id, {"name": "Unknown", "sku": ""})
            inventory_map[inv.id] = item_info["name"]
            inventory_data.append({
                "id": inv.id,
                "item_name": item_info["name"],
                "item_sku": item_info["sku"],
                "location_name": location_map.get(inv.location_id, "Unknown"),
                "quantity": inv.quantity,
                "expiration_date": inv.expiration_date.isoformat() if inv.expiration_date else None,
                "warranty_expires": inv.warranty_expires.isoformat() if inv.warranty_expires else None,
            })

        # Fetch loans
        loans_result = await self.session.execute(
            select(Loan).where(Loan.workspace_id == workspace_id)
        )
        loans = loans_result.scalars().all()

        loans_data = [
            {
                "id": loan.id,
                "item_name": inventory_map.get(loan.inventory_id, "Unknown"),
                "borrower_name": borrower_map.get(loan.borrower_id, "Unknown"),
                "quantity": loan.quantity,
                "loaned_at": loan.loaned_at.isoformat() if loan.loaned_at else None,
                "due_date": loan.due_date.isoformat() if loan.due_date else None,
                "returned_at": loan.returned_at.isoformat() if loan.returned_at else None,
                "notes": loan.notes,
            }
            for loan in loans
        ]

        return {
            "categories": categories_data,
            "locations": locations_data,
            "containers": containers_data,
            "items": items_data,
            "borrowers": borrowers_data,
            "inventory": inventory_data,
            "loans": loans_data,
        }

    async def _log_export(
        self,
        workspace_id: UUID,
        user_id: UUID,
        format: str,
        file_size: int,
        record_counts: dict,
    ) -> None:
        """Log export to audit table."""
        export_log = WorkspaceExport(
            workspace_id=workspace_id,
            exported_by=user_id,
            format=format,
            file_size_bytes=file_size,
            record_counts=record_counts,
        )
        self.session.add(export_log)
        await self.session.commit()
