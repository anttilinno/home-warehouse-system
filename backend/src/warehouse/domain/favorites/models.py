"""Favorites domain models."""

from datetime import datetime
from enum import Enum
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column

from warehouse.lib.base import Base, UUIDPKMixin


class FavoriteType(str, Enum):
    """Favorite type enum."""

    ITEM = "ITEM"
    LOCATION = "LOCATION"
    CONTAINER = "CONTAINER"


class Favorite(Base, UUIDPKMixin):
    """Favorite model for user-pinned items, locations, or containers."""

    __tablename__ = "favorites"
    __table_args__ = (
        UniqueConstraint("user_id", "item_id", name="favorites_unique_item"),
        UniqueConstraint("user_id", "location_id", name="favorites_unique_location"),
        UniqueConstraint("user_id", "container_id", name="favorites_unique_container"),
        {"schema": "warehouse"},
    )

    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("auth.users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("auth.workspaces.id", ondelete="CASCADE"), nullable=False, index=True
    )
    favorite_type: Mapped[FavoriteType] = mapped_column(
        SAEnum(
            FavoriteType,
            name="favorite_type_enum",
            schema="warehouse",
            create_type=False,
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
    )
    item_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("warehouse.items.id", ondelete="CASCADE"), nullable=True
    )
    location_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("warehouse.locations.id", ondelete="CASCADE"), nullable=True
    )
    container_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("warehouse.containers.id", ondelete="CASCADE"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
